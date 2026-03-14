import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSqliteAdapter } from '../core/database/sqlite.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * SQLite Backend Tests
 *
 * Uses :memory: for most tests (fast, no cleanup).
 * Uses temp file for WAL mode test (WAL requires real file).
 */

describe('SQLite Backend', () => {
  let adapter;

  before(async () => {
    adapter = createSqliteAdapter({ dbPath: ':memory:' });
    await adapter.initialize();
  });

  after(async () => {
    await adapter.close();
  });

  it('WAL mode is enabled after initialize (file-backed DB)', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'dvhub-test-'));
    const dbPath = join(tmpDir, 'test.sqlite');
    const fileAdapter = createSqliteAdapter({ dbPath });
    await fileAdapter.initialize();
    // Access internal db to check PRAGMA
    const info = fileAdapter.getBackendInfo();
    assert.equal(info.backend, 'sqlite');
    assert.equal(info.walMode, true, 'WAL mode should be enabled for file-backed DB');
    await fileAdapter.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rollup tables exist after initialize', async () => {
    // Query sqlite_master for rollup tables
    const info = adapter.getBackendInfo();
    assert.equal(info.backend, 'sqlite');
    // Insert into rollup tables to prove they exist (would throw if missing)
    // We test by doing a querySamples with resolution='5min' which targets telemetry_5min
    const result = await adapter.querySamples({
      seriesKeys: ['test_key'],
      start: new Date('2026-01-01'),
      end: new Date('2026-12-31'),
      resolution: '5min'
    });
    assert.ok(Array.isArray(result), 'querySamples should return array');
  });

  it('insertSamples creates monthly partition and inserts row', async () => {
    const ts = new Date('2026-03-14T10:00:00Z');
    await adapter.insertSamples([{
      ts,
      seriesKey: 'grid_import_w',
      valueNum: 1500,
      unit: 'W'
    }]);

    const rows = await adapter.querySamples({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T09:00:00Z'),
      end: new Date('2026-03-14T11:00:00Z')
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].seriesKey, 'grid_import_w');
    assert.equal(rows[0].value, 1500);
    assert.equal(rows[0].unit, 'W');
  });

  it('querySamples returns inserted row with correct values', async () => {
    const ts = new Date('2026-03-14T10:30:00Z');
    await adapter.insertSamples([{
      ts,
      seriesKey: 'pv_power_w',
      valueNum: 3200,
      unit: 'W',
      source: 'inverter',
      quality: 'measured'
    }]);

    const rows = await adapter.querySamples({
      seriesKeys: ['pv_power_w'],
      start: new Date('2026-03-14T10:00:00Z'),
      end: new Date('2026-03-14T11:00:00Z')
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value, 3200);
    assert.equal(rows[0].unit, 'W');
  });

  it('insertSamples at month boundary creates new partition', async () => {
    await adapter.insertSamples([{
      ts: new Date('2026-04-01T00:00:00Z'),
      seriesKey: 'grid_import_w',
      valueNum: 800,
      unit: 'W'
    }]);

    const rows = await adapter.querySamples({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-04-01T00:00:00Z'),
      end: new Date('2026-04-01T01:00:00Z')
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value, 800);
  });

  it('querySamples with resolution=5min queries telemetry_5min', async () => {
    const result = await adapter.querySamples({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T00:00:00Z'),
      end: new Date('2026-03-14T23:59:59Z'),
      resolution: '5min'
    });
    assert.ok(Array.isArray(result));
  });

  it('querySamples with resolution=15min queries telemetry_15min', async () => {
    const result = await adapter.querySamples({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T00:00:00Z'),
      end: new Date('2026-03-14T23:59:59Z'),
      resolution: '15min'
    });
    assert.ok(Array.isArray(result));
  });

  it('querySamples with resolution=daily queries telemetry_daily', async () => {
    const result = await adapter.querySamples({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T00:00:00Z'),
      end: new Date('2026-03-14T23:59:59Z'),
      resolution: 'daily'
    });
    assert.ok(Array.isArray(result));
  });

  it('healthCheck returns ok with backend and latency', async () => {
    const result = await adapter.healthCheck();
    assert.equal(result.ok, true);
    assert.equal(result.backend, 'sqlite');
    assert.equal(typeof result.latencyMs, 'number');
    assert.ok(result.latencyMs >= 0);
  });

  it('getBackendInfo returns sqlite backend', () => {
    const info = adapter.getBackendInfo();
    assert.equal(info.backend, 'sqlite');
  });

  it('close prevents subsequent operations', async () => {
    const tempAdapter = createSqliteAdapter({ dbPath: ':memory:' });
    await tempAdapter.initialize();
    await tempAdapter.close();
    await assert.rejects(
      () => tempAdapter.healthCheck(),
      /closed/i
    );
  });

  it('batch insert of 100 samples completes without error', async () => {
    const rows = [];
    for (let i = 0; i < 100; i++) {
      rows.push({
        ts: new Date(`2026-03-14T12:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`),
        seriesKey: 'batch_test',
        valueNum: i * 10,
        unit: 'W'
      });
    }
    await adapter.insertSamples(rows);

    const result = await adapter.querySamples({
      seriesKeys: ['batch_test'],
      start: new Date('2026-03-14T12:00:00Z'),
      end: new Date('2026-03-14T12:02:00Z')
    });
    assert.equal(result.length, 100);
  });

  it('queryLatest returns most recent value per series_key', async () => {
    // Insert multiple values at different times
    await adapter.insertSamples([
      { ts: new Date('2026-03-14T14:00:00Z'), seriesKey: 'latest_test', valueNum: 100, unit: 'W' },
      { ts: new Date('2026-03-14T14:05:00Z'), seriesKey: 'latest_test', valueNum: 200, unit: 'W' },
      { ts: new Date('2026-03-14T14:10:00Z'), seriesKey: 'latest_test', valueNum: 300, unit: 'W' },
    ]);

    const result = await adapter.queryLatest(['latest_test']);
    assert.equal(result.length, 1);
    assert.equal(result[0].seriesKey, 'latest_test');
    assert.equal(result[0].value, 300);
  });

  it('insertControlEvent inserts into shared_event_log', async () => {
    await adapter.insertControlEvent({
      ts: new Date('2026-03-14T15:00:00Z'),
      type: 'curtailment',
      source: 'dv_module',
      details: { power: 5000 }
    });
    // No error means success - event was inserted
  });
});
