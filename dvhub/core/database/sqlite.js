/**
 * SQLite backend adapter.
 *
 * Full implementation using node:sqlite DatabaseSync.
 * Features: WAL mode, monthly partitioned raw tables,
 * multi-resolution query routing, parameterized queries.
 *
 * @module core/database/sqlite
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Create a SQLite adapter instance.
 *
 * @param {object} dbConfig - Database configuration
 * @param {string} [dbConfig.dbPath='./data/dvhub-telemetry.sqlite'] - Path to SQLite file or ':memory:'
 * @returns {import('./adapter.js').DatabaseAdapter}
 */
export function createSqliteAdapter(dbConfig = {}) {
  const dbPath = dbConfig.dbPath || './data/dvhub-telemetry.sqlite';
  let db = null;
  let closed = false;
  const knownRawTables = new Set();

  // --- Internal helpers ---

  function assertOpen() {
    if (closed || !db) {
      throw new Error('Database is closed');
    }
  }

  /**
   * Derive monthly table name from a Date.
   * @param {Date} ts
   * @returns {string} e.g. 'telemetry_raw_2026_03'
   */
  function rawTableName(ts) {
    const y = ts.getUTCFullYear();
    const m = String(ts.getUTCMonth() + 1).padStart(2, '0');
    return `telemetry_raw_${y}_${m}`;
  }

  /**
   * Ensure the monthly raw table exists (CREATE TABLE IF NOT EXISTS).
   * Cached in knownRawTables set so we only run DDL once per table per session.
   */
  function ensureRawTable(tableName) {
    if (knownRawTables.has(tableName)) return;
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        ts_utc TEXT NOT NULL,
        series_key TEXT NOT NULL,
        value_num REAL,
        unit TEXT,
        source TEXT NOT NULL DEFAULT 'local_poll',
        quality TEXT NOT NULL DEFAULT 'raw',
        meta_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_ts_key ON ${tableName}(series_key, ts_utc)`);
    knownRawTables.add(tableName);
  }

  /**
   * List monthly raw tables that cover [start, end].
   * @param {Date} start
   * @param {Date} end
   * @returns {string[]}
   */
  function rawTablesForRange(start, end) {
    const tables = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cur <= endMonth) {
      const name = rawTableName(cur);
      tables.push(name);
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return tables;
  }

  /**
   * Check if a table exists in sqlite_master.
   */
  function tableExists(name) {
    const row = db.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name=?").get(name);
    return row.cnt > 0;
  }

  /**
   * Build a parameterized IN clause: (?,?,?)
   */
  function inClause(arr) {
    return '(' + arr.map(() => '?').join(',') + ')';
  }

  /**
   * Map a resolution string to rollup table name, or null for raw.
   */
  function rollupTable(resolution) {
    if (resolution === '5min') return 'telemetry_5min';
    if (resolution === '15min') return 'telemetry_15min';
    if (resolution === 'daily') return 'telemetry_daily';
    return null; // raw
  }

  // --- Adapter methods ---

  async function initialize() {
    // Ensure parent directory exists for file-backed DBs
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    db = new DatabaseSync(dbPath);

    // PRAGMAs - embedded from 001-pragmas.sql
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec('PRAGMA temp_store = MEMORY');
    db.exec('PRAGMA cache_size = -20000');
    db.exec('PRAGMA mmap_size = 268435456');
    db.exec('PRAGMA wal_autocheckpoint = 1000');

    // Rollup tables from 002-telemetry-tables.sql
    db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_5min (
        id INTEGER PRIMARY KEY,
        bucket TEXT NOT NULL,
        series_key TEXT NOT NULL,
        avg_value REAL,
        min_value REAL,
        max_value REAL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        unit TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(bucket, series_key)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_5min_series_bucket ON telemetry_5min(series_key, bucket)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_15min (
        id INTEGER PRIMARY KEY,
        bucket TEXT NOT NULL,
        series_key TEXT NOT NULL,
        avg_value REAL,
        min_value REAL,
        max_value REAL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        unit TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(bucket, series_key)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_15min_series_bucket ON telemetry_15min(series_key, bucket)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_daily (
        id INTEGER PRIMARY KEY,
        bucket TEXT NOT NULL,
        series_key TEXT NOT NULL,
        avg_value REAL,
        min_value REAL,
        max_value REAL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        unit TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(bucket, series_key)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_daily_series_bucket ON telemetry_daily(series_key, bucket)');

    // Shared tables from 003-shared-tables.sql
    db.exec(`
      CREATE TABLE IF NOT EXISTS shared_config (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS shared_event_log (
        id INTEGER PRIMARY KEY,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_shared_event_log_ts ON shared_event_log(ts)');
  }

  async function healthCheck() {
    assertOpen();
    const start = performance.now();
    db.prepare('SELECT 1').get();
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { ok: true, backend: 'sqlite', latencyMs };
  }

  async function close() {
    if (db && !closed) {
      db.close();
      closed = true;
      db = null;
    }
  }

  async function insertSamples(rows) {
    assertOpen();
    if (!rows || rows.length === 0) return;

    // Group rows by month
    const byTable = new Map();
    for (const row of rows) {
      const ts = row.ts instanceof Date ? row.ts : new Date(row.ts);
      const table = rawTableName(ts);
      if (!byTable.has(table)) byTable.set(table, []);
      byTable.get(table).push({ ...row, ts });
    }

    db.exec('BEGIN');
    try {
      for (const [table, tableRows] of byTable) {
        ensureRawTable(table);
        const stmt = db.prepare(
          `INSERT INTO ${table} (ts_utc, series_key, value_num, unit, source, quality, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        for (const row of tableRows) {
          stmt.run(
            row.ts.toISOString(),
            row.seriesKey,
            row.valueNum,
            row.unit || null,
            row.source || 'local_poll',
            row.quality || 'raw',
            row.metaJson ? JSON.stringify(row.metaJson) : null
          );
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  async function insertControlEvent(event) {
    assertOpen();
    const ts = event.ts instanceof Date ? event.ts.toISOString() : event.ts;
    db.prepare(
      'INSERT INTO shared_event_log (ts, event_type, source, severity, message, details_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      ts,
      event.type,
      event.source,
      event.severity || 'info',
      event.message || event.type,
      JSON.stringify(event.details || {})
    );
  }

  async function querySamples({ seriesKeys, start, end, resolution }) {
    assertOpen();
    const startIso = (start instanceof Date ? start : new Date(start)).toISOString();
    const endIso = (end instanceof Date ? end : new Date(end)).toISOString();

    const rollup = rollupTable(resolution);

    if (rollup) {
      // Query rollup table
      const sql = `SELECT bucket, series_key, avg_value, min_value, max_value, sample_count, unit
                    FROM ${rollup}
                    WHERE series_key IN ${inClause(seriesKeys)}
                      AND bucket >= ? AND bucket <= ?
                    ORDER BY bucket`;
      const params = [...seriesKeys, startIso, endIso];
      const rows = db.prepare(sql).all(...params);
      return rows.map(r => ({
        ts: r.bucket,
        seriesKey: r.series_key,
        value: r.avg_value,
        avgValue: r.avg_value,
        minValue: r.min_value,
        maxValue: r.max_value,
        sampleCount: r.sample_count,
        unit: r.unit
      }));
    }

    // Raw query: determine which monthly tables to query
    const tables = rawTablesForRange(
      start instanceof Date ? start : new Date(start),
      end instanceof Date ? end : new Date(end)
    );

    const allRows = [];
    for (const table of tables) {
      if (!tableExists(table)) continue;
      const sql = `SELECT ts_utc, series_key, value_num, unit, source, quality, meta_json
                    FROM ${table}
                    WHERE series_key IN ${inClause(seriesKeys)}
                      AND ts_utc >= ? AND ts_utc <= ?
                    ORDER BY ts_utc`;
      const params = [...seriesKeys, startIso, endIso];
      const rows = db.prepare(sql).all(...params);
      allRows.push(...rows);
    }

    return allRows.map(r => ({
      ts: r.ts_utc,
      seriesKey: r.series_key,
      value: r.value_num,
      unit: r.unit,
      source: r.source,
      quality: r.quality,
      meta: r.meta_json ? JSON.parse(r.meta_json) : null
    }));
  }

  async function queryAggregates({ seriesKeys, start, end, bucket }) {
    assertOpen();
    const table = rollupTable(bucket);
    if (!table) {
      throw new Error(`Unknown bucket resolution: ${bucket}`);
    }
    const startIso = (start instanceof Date ? start : new Date(start)).toISOString();
    const endIso = (end instanceof Date ? end : new Date(end)).toISOString();

    const sql = `SELECT bucket, series_key, avg_value, min_value, max_value, sample_count, unit
                  FROM ${table}
                  WHERE series_key IN ${inClause(seriesKeys)}
                    AND bucket >= ? AND bucket <= ?
                  ORDER BY bucket`;
    const params = [...seriesKeys, startIso, endIso];
    const rows = db.prepare(sql).all(...params);

    return rows.map(r => ({
      bucket: r.bucket,
      seriesKey: r.series_key,
      avgValue: r.avg_value,
      minValue: r.min_value,
      maxValue: r.max_value,
      sampleCount: r.sample_count,
      unit: r.unit
    }));
  }

  async function queryLatest(seriesKeys) {
    assertOpen();

    // Find all raw tables that exist and query the most recent per key
    const existingTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'telemetry_raw_%' ORDER BY name DESC"
    ).all().map(r => r.name);

    const results = [];
    for (const key of seriesKeys) {
      let found = null;
      for (const table of existingTables) {
        const row = db.prepare(
          `SELECT ts_utc, series_key, value_num, unit FROM ${table} WHERE series_key = ? ORDER BY ts_utc DESC LIMIT 1`
        ).get(key);
        if (row) {
          if (!found || row.ts_utc > found.ts_utc) {
            found = row;
          }
          // Since tables are ordered DESC, first match in most recent table is likely latest
          // but we check all to be safe (a newer insert could be in an older table theoretically)
        }
      }
      if (found) {
        results.push({
          seriesKey: found.series_key,
          ts: found.ts_utc,
          value: found.value_num,
          unit: found.unit
        });
      }
    }
    return results;
  }

  /**
   * Ensure the _rollup_state tracking table exists.
   */
  function ensureRollupState() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _rollup_state (
        resolution TEXT PRIMARY KEY,
        last_rolled_ts TEXT NOT NULL
      )
    `);
  }

  /**
   * Get the last rolled-up timestamp for a resolution, or a very old date.
   */
  function getLastRolledTs(resolution) {
    ensureRollupState();
    const row = db.prepare('SELECT last_rolled_ts FROM _rollup_state WHERE resolution = ?').get(resolution);
    return row ? row.last_rolled_ts : '1970-01-01T00:00:00Z';
  }

  /**
   * Update the last rolled-up timestamp for a resolution.
   */
  function setLastRolledTs(resolution, ts) {
    db.prepare('INSERT OR REPLACE INTO _rollup_state (resolution, last_rolled_ts) VALUES (?, ?)').run(resolution, ts);
  }

  /**
   * List all existing raw partition tables from sqlite_master.
   */
  function listRawTables() {
    return db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'telemetry_raw_%' ORDER BY name"
    ).all().map(r => r.name);
  }

  async function runRollups(opts = {}) {
    assertOpen();
    const now = opts.now ? (opts.now instanceof Date ? opts.now : new Date(opts.now)) : new Date();
    const nowIso = now.toISOString();
    let totalRolledUp = 0;

    // --- 5-minute rollups (raw -> telemetry_5min) ---
    const last5min = getLastRolledTs('5min');
    const rawTables = listRawTables();

    if (rawTables.length > 0) {
      db.exec('BEGIN');
      try {
        for (const table of rawTables) {
          const rows = db.prepare(`
            SELECT
              strftime('%Y-%m-%dT%H:', ts_utc) || printf('%02d', (CAST(strftime('%M', ts_utc) AS INTEGER) / 5) * 5) || ':00Z' AS bucket,
              series_key,
              AVG(value_num) AS avg_value,
              MIN(value_num) AS min_value,
              MAX(value_num) AS max_value,
              COUNT(*) AS sample_count,
              unit
            FROM ${table}
            WHERE value_num IS NOT NULL AND ts_utc >= ? AND ts_utc < ?
            GROUP BY bucket, series_key, unit
          `).all(last5min, nowIso);

          const stmt = db.prepare(`
            INSERT OR REPLACE INTO telemetry_5min (bucket, series_key, avg_value, min_value, max_value, sample_count, unit)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const r of rows) {
            stmt.run(r.bucket, r.series_key, r.avg_value, r.min_value, r.max_value, r.sample_count, r.unit);
            totalRolledUp++;
          }
        }
        setLastRolledTs('5min', nowIso);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }

    // --- 15-minute rollups (telemetry_5min -> telemetry_15min) ---
    const last15min = getLastRolledTs('15min');
    db.exec('BEGIN');
    try {
      const rows15 = db.prepare(`
        SELECT
          strftime('%Y-%m-%dT%H:', bucket) || printf('%02d', (CAST(strftime('%M', bucket) AS INTEGER) / 15) * 15) || ':00Z' AS bucket15,
          series_key,
          SUM(avg_value * sample_count) / SUM(sample_count) AS avg_value,
          MIN(min_value) AS min_value,
          MAX(max_value) AS max_value,
          SUM(sample_count) AS sample_count,
          unit
        FROM telemetry_5min
        WHERE bucket >= ? AND bucket < ?
        GROUP BY bucket15, series_key, unit
      `).all(last15min, nowIso);

      const stmt15 = db.prepare(`
        INSERT OR REPLACE INTO telemetry_15min (bucket, series_key, avg_value, min_value, max_value, sample_count, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of rows15) {
        stmt15.run(r.bucket15, r.series_key, r.avg_value, r.min_value, r.max_value, r.sample_count, r.unit);
        totalRolledUp++;
      }
      setLastRolledTs('15min', nowIso);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // --- Daily rollups (telemetry_15min -> telemetry_daily) ---
    const lastDaily = getLastRolledTs('daily');
    db.exec('BEGIN');
    try {
      const rowsDaily = db.prepare(`
        SELECT
          strftime('%Y-%m-%dT00:00:00Z', bucket) AS bucket_day,
          series_key,
          SUM(avg_value * sample_count) / SUM(sample_count) AS avg_value,
          MIN(min_value) AS min_value,
          MAX(max_value) AS max_value,
          SUM(sample_count) AS sample_count,
          unit
        FROM telemetry_15min
        WHERE bucket >= ? AND bucket < ?
        GROUP BY bucket_day, series_key, unit
      `).all(lastDaily, nowIso);

      const stmtDaily = db.prepare(`
        INSERT OR REPLACE INTO telemetry_daily (bucket, series_key, avg_value, min_value, max_value, sample_count, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of rowsDaily) {
        stmtDaily.run(r.bucket_day, r.series_key, r.avg_value, r.min_value, r.max_value, r.sample_count, r.unit);
        totalRolledUp++;
      }
      setLastRolledTs('daily', nowIso);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return { rolledUp: totalRolledUp };
  }

  async function runRetention(opts = {}) {
    assertOpen();
    const now = opts.now ? (opts.now instanceof Date ? opts.now : new Date(opts.now)) : new Date();
    const retention = opts.retention || dbConfig.retention || {
      rawDays: 7,
      fiveMinDays: 90,
      fifteenMinDays: 730,
      dailyDays: null
    };
    let totalDeleted = 0;

    // --- Raw data retention: drop partition tables older than rawDays ---
    if (retention.rawDays != null) {
      const rawCutoff = new Date(now.getTime() - retention.rawDays * 86400_000);
      const rawTables = listRawTables();
      for (const table of rawTables) {
        // Extract year/month from table name: telemetry_raw_YYYY_MM
        const match = table.match(/telemetry_raw_(\d{4})_(\d{2})/);
        if (!match) continue;
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        // End of that month
        const tableEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
        if (tableEnd < rawCutoff) {
          // Count rows before dropping
          const countRow = db.prepare(`SELECT count(*) as cnt FROM ${table}`).get();
          totalDeleted += countRow.cnt;
          db.exec(`DROP TABLE IF EXISTS ${table}`);
          knownRawTables.delete(table);
        }
      }
    }

    // --- 5-min data retention ---
    if (retention.fiveMinDays != null) {
      const fiveMinCutoff = new Date(now.getTime() - retention.fiveMinDays * 86400_000);
      const cutoffIso = fiveMinCutoff.toISOString();
      const result = db.prepare('DELETE FROM telemetry_5min WHERE bucket < ?').run(cutoffIso);
      totalDeleted += result.changes;
    }

    // --- 15-min data retention ---
    if (retention.fifteenMinDays != null) {
      const fifteenMinCutoff = new Date(now.getTime() - retention.fifteenMinDays * 86400_000);
      const cutoffIso = fifteenMinCutoff.toISOString();
      const result = db.prepare('DELETE FROM telemetry_15min WHERE bucket < ?').run(cutoffIso);
      totalDeleted += result.changes;
    }

    // --- Daily data: no deletion when dailyDays is null (retained forever) ---
    if (retention.dailyDays != null) {
      const dailyCutoff = new Date(now.getTime() - retention.dailyDays * 86400_000);
      const cutoffIso = dailyCutoff.toISOString();
      const result = db.prepare('DELETE FROM telemetry_daily WHERE bucket < ?').run(cutoffIso);
      totalDeleted += result.changes;
    }

    return { deleted: totalDeleted };
  }

  async function runCompression(_opts) {
    assertOpen();
    db.exec('PRAGMA optimize');
    // VACUUM only on file-backed databases (not :memory:)
    if (dbPath !== ':memory:') {
      db.exec('VACUUM');
    }
  }

  function getBackendInfo() {
    const info = { backend: 'sqlite' };
    // Check WAL mode if db is open
    if (db && !closed) {
      try {
        const mode = db.prepare('PRAGMA journal_mode').get();
        info.walMode = mode.journal_mode === 'wal';
      } catch {
        // ignore
      }
    }
    return info;
  }

  return {
    initialize,
    healthCheck,
    close,
    insertSamples,
    insertControlEvent,
    querySamples,
    queryAggregates,
    queryLatest,
    runRollups,
    runRetention,
    runCompression,
    getBackendInfo
  };
}
