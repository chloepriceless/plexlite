/**
 * TimescaleDB adapter unit tests.
 *
 * Unit tests mock pg.Pool to verify SQL generation without a real database.
 * Integration tests require PG_CONNECTION_STRING env var and skip otherwise.
 *
 * @module test/db-timescale
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * MockPool captures queries for assertion and returns canned results.
 */
class MockPool {
  constructor() {
    this.queries = [];
    this.ended = false;
    this._errorHandlers = [];
  }

  async query(sql, params) {
    this.queries.push({ sql, params });
    // Return canned result for SELECT 1 (healthCheck)
    if (sql === 'SELECT 1') {
      return { rows: [{ '?column?': 1 }] };
    }
    // Return empty rows by default
    return { rows: [] };
  }

  async end() {
    this.ended = true;
  }

  on(event, handler) {
    if (event === 'error') {
      this._errorHandlers.push(handler);
    }
  }
}

describe('TimescaleDB Adapter - Unit Tests', () => {
  let createTimescaleAdapter;
  let mockPool;

  beforeEach(async () => {
    const mod = await import('../core/database/timescaledb.js');
    createTimescaleAdapter = mod.createTimescaleAdapter;
    mockPool = new MockPool();
  });

  it('returns object with all ADAPTER_METHODS', async () => {
    const { ADAPTER_METHODS } = await import('../core/database/adapter.js');
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    for (const method of ADAPTER_METHODS) {
      assert.equal(typeof adapter[method], 'function', `adapter.${method} should be a function`);
    }
  });

  it('getBackendInfo returns {backend: "timescaledb"}', () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    const info = adapter.getBackendInfo();
    assert.deepEqual(info, { backend: 'timescaledb' });
  });

  it('insertSamples builds correct parameterized INSERT', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    const rows = [
      { ts: new Date('2026-01-01T00:00:00Z'), seriesKey: 'pv.power', valueNum: 5000, unit: 'W' },
      { ts: new Date('2026-01-01T00:01:00Z'), seriesKey: 'pv.power', valueNum: 5100, unit: 'W' }
    ];
    await adapter.insertSamples(rows);

    assert.equal(mockPool.queries.length, 1);
    const q = mockPool.queries[0];
    assert.ok(q.sql.includes('INSERT INTO telemetry_raw'), 'SQL should INSERT INTO telemetry_raw');
    assert.ok(q.sql.includes('$1'), 'SQL should use parameterized query');
    assert.equal(q.params.length, 14, 'Should have 7 params per row * 2 rows = 14');
  });

  it('insertSamples with empty array is a no-op', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.insertSamples([]);
    assert.equal(mockPool.queries.length, 0, 'No queries should be issued for empty array');
  });

  it('querySamples with resolution=5min queries telemetry_5min view', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.querySamples({
      seriesKeys: ['pv.power'],
      start: new Date('2026-01-01'),
      end: new Date('2026-01-02'),
      resolution: '5min'
    });
    assert.equal(mockPool.queries.length, 1);
    assert.ok(mockPool.queries[0].sql.includes('telemetry_5min'), 'Should query telemetry_5min');
  });

  it('querySamples with resolution=15min queries telemetry_15min view', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.querySamples({
      seriesKeys: ['pv.power'],
      start: new Date('2026-01-01'),
      end: new Date('2026-01-02'),
      resolution: '15min'
    });
    assert.equal(mockPool.queries.length, 1);
    assert.ok(mockPool.queries[0].sql.includes('telemetry_15min'), 'Should query telemetry_15min');
  });

  it('querySamples with resolution=daily queries telemetry_daily view', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.querySamples({
      seriesKeys: ['pv.power'],
      start: new Date('2026-01-01'),
      end: new Date('2026-01-02'),
      resolution: 'daily'
    });
    assert.equal(mockPool.queries.length, 1);
    assert.ok(mockPool.queries[0].sql.includes('telemetry_daily'), 'Should query telemetry_daily');
  });

  it('querySamples with resolution=raw or undefined queries telemetry_raw', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });

    await adapter.querySamples({
      seriesKeys: ['pv.power'],
      start: new Date('2026-01-01'),
      end: new Date('2026-01-02'),
      resolution: 'raw'
    });
    assert.ok(mockPool.queries[0].sql.includes('telemetry_raw'), 'resolution=raw should query telemetry_raw');

    mockPool.queries = [];
    await adapter.querySamples({
      seriesKeys: ['pv.power'],
      start: new Date('2026-01-01'),
      end: new Date('2026-01-02')
    });
    assert.ok(mockPool.queries[0].sql.includes('telemetry_raw'), 'undefined resolution should query telemetry_raw');
  });

  it('runRollups returns {rolledUp: 0} (no-op for TimescaleDB)', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    const result = await adapter.runRollups({ now: new Date() });
    assert.deepEqual(result, { rolledUp: 0 });
  });

  it('runRetention returns {deleted: 0} (no-op for TimescaleDB)', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    const result = await adapter.runRetention({ now: new Date() });
    assert.deepEqual(result, { deleted: 0 });
  });

  it('healthCheck with mock pool returns {ok: true, backend: "timescaledb", latencyMs: number}', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    const result = await adapter.healthCheck();
    assert.equal(result.ok, true);
    assert.equal(result.backend, 'timescaledb');
    assert.equal(typeof result.latencyMs, 'number');
    assert.ok(result.latencyMs >= 0);
  });

  it('close calls pool.end()', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.close();
    assert.equal(mockPool.ended, true, 'pool.end() should have been called');
  });

  it('insertControlEvent inserts into shared.event_log', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.insertControlEvent({
      ts: new Date('2026-01-01'),
      type: 'curtailment',
      source: 'dv-module',
      details: { reason: 'grid overload' }
    });
    assert.equal(mockPool.queries.length, 1);
    assert.ok(mockPool.queries[0].sql.includes('shared.event_log'), 'Should insert into shared.event_log');
  });

  it('queryLatest uses DISTINCT ON for PostgreSQL', async () => {
    const adapter = createTimescaleAdapter({ _pool: mockPool });
    await adapter.queryLatest(['pv.power', 'battery.soc']);
    assert.equal(mockPool.queries.length, 1);
    assert.ok(mockPool.queries[0].sql.includes('DISTINCT ON'), 'Should use DISTINCT ON');
    assert.ok(mockPool.queries[0].sql.includes('telemetry_raw'), 'Should query telemetry_raw');
  });
});

// Integration tests - skip without PG_CONNECTION_STRING
const PG_URL = process.env.PG_CONNECTION_STRING;

describe('TimescaleDB Integration', { skip: !PG_URL ? 'PG_CONNECTION_STRING not set - skipping integration tests' : false }, () => {
  it('placeholder for integration test - initialize creates tables', async () => {
    const { createTimescaleAdapter } = await import('../core/database/timescaledb.js');
    const adapter = createTimescaleAdapter({ connectionString: PG_URL });
    try {
      await adapter.initialize();
      const health = await adapter.healthCheck();
      assert.equal(health.ok, true);
    } finally {
      await adapter.close();
    }
  });

  it('placeholder for integration test - insert + query roundtrip', async () => {
    const { createTimescaleAdapter } = await import('../core/database/timescaledb.js');
    const adapter = createTimescaleAdapter({ connectionString: PG_URL });
    try {
      await adapter.initialize();
      const ts = new Date();
      await adapter.insertSamples([
        { ts, seriesKey: 'test.integration', valueNum: 42, unit: 'W' }
      ]);
      const rows = await adapter.querySamples({
        seriesKeys: ['test.integration'],
        start: new Date(ts.getTime() - 1000),
        end: new Date(ts.getTime() + 1000),
        resolution: 'raw'
      });
      assert.ok(rows.length >= 1, 'Should find inserted row');
    } finally {
      await adapter.close();
    }
  });
});
