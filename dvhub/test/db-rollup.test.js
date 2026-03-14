import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSqliteAdapter } from '../core/database/sqlite.js';

/**
 * Rollup Engine Tests
 *
 * Tests the SQLite rollup engine: 5min, 15min, daily aggregation,
 * retention cleanup, and compression.
 */

describe('Rollup Engine', () => {
  let adapter;

  beforeEach(async () => {
    adapter = createSqliteAdapter({ dbPath: ':memory:' });
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
  });

  // Helper: insert raw samples into the current month's table
  async function insertRawSamples(samples) {
    await adapter.insertSamples(samples.map(s => ({
      ts: s.ts instanceof Date ? s.ts : new Date(s.ts),
      seriesKey: s.seriesKey || 'grid_import_w',
      valueNum: s.value,
      unit: s.unit || 'W',
      source: 'test'
    })));
  }

  it('5-min rollup with 10 samples produces 1 row with correct avg/min/max/count', async () => {
    // Insert 10 samples within a single 5-min window (00:00 - 00:04)
    const base = new Date('2026-03-14T10:00:00Z');
    const samples = [];
    for (let i = 0; i < 10; i++) {
      samples.push({
        ts: new Date(base.getTime() + i * 20_000), // every 20 seconds
        value: 100 + i * 10 // 100, 110, 120, ... 190
      });
    }
    await insertRawSamples(samples);

    const result = await adapter.runRollups({ now: new Date('2026-03-14T10:10:00Z') });
    assert.ok(result.rolledUp > 0, 'should have rolled up rows');

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T10:00:00Z'),
      end: new Date('2026-03-14T10:05:00Z'),
      bucket: '5min'
    });

    assert.equal(rows.length, 1, 'should produce exactly 1 5-min bucket');
    assert.equal(rows[0].sampleCount, 10);
    assert.equal(rows[0].avgValue, 145); // (100+110+...+190)/10 = 145
    assert.equal(rows[0].minValue, 100);
    assert.equal(rows[0].maxValue, 190);
  });

  it('5-min rollup with [100, 200, 300] produces avg=200, min=100, max=300, count=3', async () => {
    const base = new Date('2026-03-14T10:00:00Z');
    await insertRawSamples([
      { ts: new Date(base.getTime()), value: 100 },
      { ts: new Date(base.getTime() + 60_000), value: 200 },
      { ts: new Date(base.getTime() + 120_000), value: 300 }
    ]);

    await adapter.runRollups({ now: new Date('2026-03-14T10:10:00Z') });

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T10:00:00Z'),
      end: new Date('2026-03-14T10:05:00Z'),
      bucket: '5min'
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].avgValue, 200);
    assert.equal(rows[0].minValue, 100);
    assert.equal(rows[0].maxValue, 300);
    assert.equal(rows[0].sampleCount, 3);
  });

  it('15-min rollup uses weighted average: SUM(avg*count)/SUM(count)', async () => {
    // Insert samples across 3 different 5-min windows within a 15-min window
    // Window 00:00-00:04: 2 samples of value 100 -> avg=100, count=2
    // Window 00:05-00:09: 1 sample of value 400 -> avg=400, count=1
    // Window 00:10-00:14: 3 samples of value 200 -> avg=200, count=3
    // Weighted avg = (100*2 + 400*1 + 200*3) / (2+1+3) = (200+400+600)/6 = 200
    const samples = [
      { ts: '2026-03-14T10:00:00Z', value: 100 },
      { ts: '2026-03-14T10:01:00Z', value: 100 },
      { ts: '2026-03-14T10:05:00Z', value: 400 },
      { ts: '2026-03-14T10:10:00Z', value: 200 },
      { ts: '2026-03-14T10:11:00Z', value: 200 },
      { ts: '2026-03-14T10:12:00Z', value: 200 }
    ];
    await insertRawSamples(samples);

    await adapter.runRollups({ now: new Date('2026-03-14T10:20:00Z') });

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T10:00:00Z'),
      end: new Date('2026-03-14T10:15:00Z'),
      bucket: '15min'
    });

    assert.equal(rows.length, 1, 'should produce exactly 1 15-min bucket');
    assert.equal(rows[0].sampleCount, 6);
    assert.equal(rows[0].avgValue, 200); // weighted average
    assert.equal(rows[0].minValue, 100);
    assert.equal(rows[0].maxValue, 400);
  });

  it('daily rollup aggregates from 15-min data using weighted average', async () => {
    // Insert samples across multiple 15-min windows
    // We need at least 3 different 5-min windows spanning multiple 15-min windows
    const samples = [];
    // 10:00 - 10:14 window: 6 samples of value 100
    for (let i = 0; i < 6; i++) {
      samples.push({ ts: new Date(Date.UTC(2026, 2, 14, 10, i * 2, 0)), value: 100 });
    }
    // 10:15 - 10:29 window: 3 samples of value 400
    for (let i = 0; i < 3; i++) {
      samples.push({ ts: new Date(Date.UTC(2026, 2, 14, 10, 15 + i * 2, 0)), value: 400 });
    }
    await insertRawSamples(samples);

    await adapter.runRollups({ now: new Date('2026-03-14T11:00:00Z') });

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T00:00:00Z'),
      end: new Date('2026-03-15T00:00:00Z'),
      bucket: 'daily'
    });

    assert.equal(rows.length, 1, 'should produce exactly 1 daily bucket');
    assert.equal(rows[0].sampleCount, 9);
    // Weighted: (100*6 + 400*3) / 9 = (600+1200)/9 = 200
    assert.equal(rows[0].avgValue, 200);
    assert.equal(rows[0].minValue, 100);
    assert.equal(rows[0].maxValue, 400);
  });

  it('rollup with no data returns {rolledUp: 0}', async () => {
    const result = await adapter.runRollups({ now: new Date('2026-03-14T10:00:00Z') });
    assert.deepStrictEqual(result, { rolledUp: 0 });
  });

  it('rollup does not duplicate existing entries (idempotent)', async () => {
    await insertRawSamples([
      { ts: '2026-03-14T10:00:00Z', value: 100 },
      { ts: '2026-03-14T10:01:00Z', value: 200 }
    ]);

    // Run rollups twice
    await adapter.runRollups({ now: new Date('2026-03-14T10:10:00Z') });
    await adapter.runRollups({ now: new Date('2026-03-14T10:10:00Z') });

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-03-14T10:00:00Z'),
      end: new Date('2026-03-14T10:05:00Z'),
      bucket: '5min'
    });

    assert.equal(rows.length, 1, 'should still have exactly 1 bucket, not duplicated');
    assert.equal(rows[0].sampleCount, 2);
  });

  it('retention deletes raw partition tables older than 7 days', async () => {
    // Insert data in a very old month
    const oldDate = new Date('2026-02-01T10:00:00Z');
    await insertRawSamples([{ ts: oldDate, value: 100 }]);

    // Rollup first so retention is safe to delete
    await adapter.runRollups({ now: new Date('2026-02-01T10:10:00Z') });

    // Now set "now" to 7+ days later
    const result = await adapter.runRetention({
      now: new Date('2026-03-14T10:00:00Z'),
      retention: { rawDays: 7, fiveMinDays: 90, fifteenMinDays: 730, dailyDays: null }
    });

    assert.ok(result.deleted >= 0, 'should return deleted count');

    // Verify raw data is gone (query should return empty)
    const rawRows = await adapter.querySamples({
      seriesKeys: ['grid_import_w'],
      start: new Date('2026-02-01T00:00:00Z'),
      end: new Date('2026-02-28T23:59:59Z'),
      resolution: 'raw'
    });
    assert.equal(rawRows.length, 0, 'raw data should be deleted');
  });

  it('retention deletes 5min data older than 90 days', async () => {
    // Insert data and rollup, then run retention with the right window
    const oldDate = new Date('2025-11-01T10:00:00Z');
    await insertRawSamples([
      { ts: oldDate, value: 100 },
      { ts: new Date(oldDate.getTime() + 60_000), value: 200 }
    ]);

    await adapter.runRollups({ now: new Date('2025-11-01T10:10:00Z') });

    const result = await adapter.runRetention({
      now: new Date('2026-03-14T10:00:00Z'),
      retention: { rawDays: 7, fiveMinDays: 90, fifteenMinDays: 730, dailyDays: null }
    });

    // 5min data from Nov 2025 is >90 days old from Mar 2026
    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2025-11-01T00:00:00Z'),
      end: new Date('2025-11-30T23:59:59Z'),
      bucket: '5min'
    });
    assert.equal(rows.length, 0, '5min data older than 90 days should be deleted');
  });

  it('retention deletes 15min data older than 730 days', async () => {
    const oldDate = new Date('2023-01-01T10:00:00Z');
    await insertRawSamples([
      { ts: oldDate, value: 100 },
      { ts: new Date(oldDate.getTime() + 60_000), value: 200 }
    ]);

    await adapter.runRollups({ now: new Date('2023-01-01T10:20:00Z') });

    const result = await adapter.runRetention({
      now: new Date('2026-03-14T10:00:00Z'),
      retention: { rawDays: 7, fiveMinDays: 90, fifteenMinDays: 730, dailyDays: null }
    });

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2023-01-01T00:00:00Z'),
      end: new Date('2023-01-31T23:59:59Z'),
      bucket: '15min'
    });
    assert.equal(rows.length, 0, '15min data older than 730 days should be deleted');
  });

  it('retention does not delete daily data (retained forever)', async () => {
    const oldDate = new Date('2023-01-01T10:00:00Z');
    await insertRawSamples([
      { ts: oldDate, value: 100 },
      { ts: new Date(oldDate.getTime() + 60_000), value: 200 }
    ]);

    await adapter.runRollups({ now: new Date('2023-01-01T10:20:00Z') });

    await adapter.runRetention({
      now: new Date('2026-03-14T10:00:00Z'),
      retention: { rawDays: 7, fiveMinDays: 90, fifteenMinDays: 730, dailyDays: null }
    });

    const rows = await adapter.queryAggregates({
      seriesKeys: ['grid_import_w'],
      start: new Date('2023-01-01T00:00:00Z'),
      end: new Date('2023-01-31T23:59:59Z'),
      bucket: 'daily'
    });
    assert.ok(rows.length > 0, 'daily data should be retained forever');
  });

  it('retention returns {deleted: N} with count', async () => {
    const result = await adapter.runRetention({
      now: new Date('2026-03-14T10:00:00Z'),
      retention: { rawDays: 7, fiveMinDays: 90, fifteenMinDays: 730, dailyDays: null }
    });
    assert.equal(typeof result.deleted, 'number');
  });

  it('compression runs VACUUM (SQLite equivalent)', async () => {
    const result = await adapter.runCompression({ now: new Date() });
    // Should not throw, compression is a no-error operation
    assert.ok(result === undefined || result === null || typeof result === 'object');
  });
});
