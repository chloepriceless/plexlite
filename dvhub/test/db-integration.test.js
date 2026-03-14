import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../core/config.js';
import { createDatabaseAdapter } from '../core/database/adapter.js';

/**
 * Database Integration Tests
 *
 * End-to-end tests: config loading -> adapter creation -> insert -> rollup -> query -> retention.
 */

describe('Database Integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dvhub-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function writeConfig(obj) {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(obj));
    return configPath;
  }

  it('config loads database defaults', () => {
    const configPath = writeConfig({});
    const { config } = loadConfig(configPath);

    assert.equal(config.database.backend, 'timescaledb');
    assert.equal(config.database.retention.rawDays, 7);
    assert.equal(config.database.retention.fiveMinDays, 90);
    assert.equal(config.database.retention.fifteenMinDays, 730);
    assert.equal(config.database.retention.dailyDays, null);
    assert.ok(config.database.connectionString, 'should have default connection string');
    assert.ok(config.database.dbPath, 'should have default dbPath');
  });

  it('config respects database.backend override', () => {
    const configPath = writeConfig({ database: { backend: 'sqlite' } });
    const { config } = loadConfig(configPath);

    assert.equal(config.database.backend, 'sqlite');
    // Retention defaults should still be present
    assert.equal(config.database.retention.rawDays, 7);
    assert.equal(config.database.retention.fiveMinDays, 90);
  });

  it('createDatabaseAdapter with sqlite config returns working adapter', async () => {
    const adapter = await createDatabaseAdapter({
      database: { backend: 'sqlite', dbPath: ':memory:' }
    });
    await adapter.initialize();

    try {
      // Insert 5 samples
      const now = new Date('2026-03-14T10:00:00Z');
      const samples = [];
      for (let i = 0; i < 5; i++) {
        samples.push({
          ts: new Date(now.getTime() + i * 1000),
          seriesKey: 'grid_import_w',
          valueNum: 100 + i,
          unit: 'W'
        });
      }
      await adapter.insertSamples(samples);

      // Query them back
      const result = await adapter.querySamples({
        seriesKeys: ['grid_import_w'],
        start: new Date('2026-03-14T09:00:00Z'),
        end: new Date('2026-03-14T11:00:00Z')
      });
      assert.equal(result.length, 5, 'should return all 5 inserted samples');
    } finally {
      await adapter.close();
    }
  });

  it('full pipeline: insert -> rollup -> query aggregates', async () => {
    const adapter = await createDatabaseAdapter({
      database: { backend: 'sqlite', dbPath: ':memory:' }
    });
    await adapter.initialize();

    try {
      // Insert 30 raw samples across 15 minutes (2 per minute)
      const base = new Date('2026-03-14T10:00:00Z');
      const samples = [];
      for (let i = 0; i < 30; i++) {
        samples.push({
          ts: new Date(base.getTime() + i * 30_000), // every 30 seconds
          seriesKey: 'grid_import_w',
          valueNum: 100 + i,
          unit: 'W'
        });
      }
      await adapter.insertSamples(samples);

      // Run rollups
      const rollupResult = await adapter.runRollups({ now: new Date('2026-03-14T10:20:00Z') });
      assert.ok(rollupResult.rolledUp > 0, 'should have rolled up rows');

      // Query 5-min aggregates
      const aggs = await adapter.queryAggregates({
        seriesKeys: ['grid_import_w'],
        start: new Date('2026-03-14T10:00:00Z'),
        end: new Date('2026-03-14T10:15:00Z'),
        bucket: '5min'
      });

      assert.equal(aggs.length, 3, 'should have 3 five-minute buckets');
      // First bucket: 10 samples (0-9), values 100-109, avg=104.5, count=10
      assert.equal(aggs[0].sampleCount, 10);
      // Second bucket: 10 samples (10-19), values 110-119, avg=114.5, count=10
      assert.equal(aggs[1].sampleCount, 10);
      // Third bucket: 10 samples (20-29), values 120-129, avg=124.5, count=10
      assert.equal(aggs[2].sampleCount, 10);
    } finally {
      await adapter.close();
    }
  });

  it('retention removes old data', async () => {
    const adapter = await createDatabaseAdapter({
      database: { backend: 'sqlite', dbPath: ':memory:' }
    });
    await adapter.initialize();

    try {
      // Insert samples with old timestamps (Feb 2026)
      const oldDate = new Date('2026-02-01T10:00:00Z');
      await adapter.insertSamples([
        { ts: oldDate, seriesKey: 'grid_import_w', valueNum: 100, unit: 'W' },
        { ts: new Date(oldDate.getTime() + 60_000), seriesKey: 'grid_import_w', valueNum: 200, unit: 'W' }
      ]);

      // Rollup first
      await adapter.runRollups({ now: new Date('2026-02-01T10:10:00Z') });

      // Run retention with rawDays=0 (immediate expiry for testing)
      const result = await adapter.runRetention({
        now: new Date('2026-03-14T10:00:00Z'),
        retention: { rawDays: 0, fiveMinDays: 90, fifteenMinDays: 730, dailyDays: null }
      });

      assert.ok(result.deleted >= 2, 'should have deleted raw data');

      // Raw data should be gone
      const rawRows = await adapter.querySamples({
        seriesKeys: ['grid_import_w'],
        start: new Date('2026-02-01T00:00:00Z'),
        end: new Date('2026-02-28T23:59:59Z')
      });
      assert.equal(rawRows.length, 0, 'raw data should be deleted after retention');

      // Rollup data should still exist (within 90 day window)
      const rollupRows = await adapter.queryAggregates({
        seriesKeys: ['grid_import_w'],
        start: new Date('2026-02-01T00:00:00Z'),
        end: new Date('2026-02-28T23:59:59Z'),
        bucket: '5min'
      });
      assert.ok(rollupRows.length > 0, '5min rollup data should be preserved');
    } finally {
      await adapter.close();
    }
  });

  it('adapter healthCheck returns ok', async () => {
    const adapter = await createDatabaseAdapter({
      database: { backend: 'sqlite', dbPath: ':memory:' }
    });
    await adapter.initialize();

    try {
      const health = await adapter.healthCheck();
      assert.equal(health.ok, true);
      assert.equal(health.backend, 'sqlite');
      assert.equal(typeof health.latencyMs, 'number');
    } finally {
      await adapter.close();
    }
  });

  it('querySamples for 30 days returns within 500ms (DATA-06)', async () => {
    const adapter = await createDatabaseAdapter({
      database: { backend: 'sqlite', dbPath: ':memory:' }
    });
    await adapter.initialize();

    try {
      // Insert 30 days of 5-min rollup data: 30 * 24 * 12 = 8640 rows
      const now = new Date('2026-03-14T10:00:00Z');
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);

      // Insert raw data day by day and rollup
      // For efficiency, insert directly into the 5min table
      const batchSize = 500;
      let batch = [];
      for (let d = 0; d < 30; d++) {
        for (let h = 0; h < 24; h++) {
          for (let m = 0; m < 60; m += 5) {
            const ts = new Date(thirtyDaysAgo.getTime() + d * 86400_000 + h * 3600_000 + m * 60_000);
            batch.push({
              ts,
              seriesKey: 'grid_import_w',
              valueNum: 1000 + Math.random() * 500,
              unit: 'W'
            });
            if (batch.length >= batchSize) {
              await adapter.insertSamples(batch);
              batch = [];
            }
          }
        }
      }
      if (batch.length > 0) {
        await adapter.insertSamples(batch);
      }

      // Rollup all data
      await adapter.runRollups({ now });

      // Measure 30-day query on 5min resolution
      const start = Date.now();
      const result = await adapter.querySamples({
        seriesKeys: ['grid_import_w'],
        start: thirtyDaysAgo,
        end: now,
        resolution: '5min'
      });
      const elapsed = Date.now() - start;

      assert.ok(result.length > 0, 'should return rollup data');
      assert.ok(elapsed < 500, `30-day query should complete in <500ms, took ${elapsed}ms`);
    } finally {
      await adapter.close();
    }
  });
});
