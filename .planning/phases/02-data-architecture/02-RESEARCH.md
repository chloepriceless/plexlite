# Phase 2: Data Architecture - Research

**Researched:** 2026-03-14
**Domain:** Database Adapter Pattern, TimescaleDB, SQLite, Multi-Resolution Telemetry
**Confidence:** HIGH

## Summary

Phase 2 replaces the existing monolithic `telemetry-store.js` (1069 lines, tightly coupled to `node:sqlite` DatabaseSync) with a Database Adapter Pattern that abstracts two backends: TimescaleDB/PostgreSQL (default) and SQLite (fallback). The existing codebase already uses `node:sqlite` DatabaseSync with WAL mode, prepared statements, and a basic rollup engine -- this code serves as the functional specification for the SQLite backend adapter.

The TimescaleDB backend leverages Hierarchical Continuous Aggregates (available since TimescaleDB 2.9) to automatically maintain 5min, 15min, and daily rollups without manual aggregation code. The SQLite backend requires a manual rollup engine (the existing `buildRollups` function provides a starting point but needs enhancement for multi-resolution output). Both backends sit behind a factory function `createDatabaseAdapter(config)` that returns the same interface regardless of backend.

The existing `telemetry-store.js` contains significant domain logic (energy calculations, materialized slots, solar market values, optimizer runs) that must be preserved. The adapter should handle storage primitives while domain-specific query logic can live in thin layers above.

**Primary recommendation:** Build a minimal adapter interface (insert, query, aggregate, healthCheck, close) with backend-specific implementations. Start with the SQLite backend by refactoring the existing code, then implement the TimescaleDB backend using `pg` 8.x with connection pooling and native hypertable/continuous aggregate features.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- TimescaleDB/PostgreSQL is the **default** backend (x86 primary platform)
- SQLite is the **fallback** for lightweight/edge deployments
- Selection via config: `database.backend: "timescaledb" | "sqlite"` (default: "timescaledb")
- Both backends behind the same Database Adapter interface
- `pg` npm package is a core dependency (not optional)
- `node:sqlite` (built-in) for SQLite backend -- no extra dependency
- Adapter methods: insert, query, aggregate, rollup, retention, health-check
- Factory pattern: `createDatabaseAdapter(config)` returns the correct backend
- Hypertables for raw telemetry data (automatic partitioning by time)
- Continuous Aggregates for 5-min, 15-min, and daily rollups
- Native compression and retention policies for TimescaleDB
- WAL mode, optimized PRAGMAs for SQLite
- Monthly partitioned raw tables for SQLite: telemetry_raw_YYYY_MM
- Manual rollup engine for SQLite (scheduled aggregation)
- Retention: raw 7d, 5min 90d, 15min 2y, daily forever
- Schema prefixes: shared_, dv_, opt_, exec_, telemetry_
- 30-day queries < 500ms on x86
- `pg` is a core dependency (always installed), `node:sqlite` is built-in

### Claude's Discretion
- Internal adapter method signatures and return types
- Connection pool configuration for PostgreSQL
- Continuous Aggregate refresh intervals
- Compression policy thresholds
- SQLite PRAGMA tuning values
- Error handling and retry strategy for database connections
- Migration script format (SQL files vs programmatic)
- Whether to use a migration library or raw SQL for schema setup

### Deferred Ideas (OUT OF SCOPE)
- PostgreSQL replication / HA setup
- InfluxDB backend
- Multi-site database synchronization
- GraphQL API for database queries
- Real-time streaming of database changes (CDC)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Database Adapter Pattern (TimescaleDB Default, SQLite Fallback) | Factory pattern with `createDatabaseAdapter(config)`, pg 8.x Pool for TimescaleDB, node:sqlite DatabaseSync for SQLite |
| DATA-02 | Multi-resolution data retention (raw 7d, 5min 90d, 15min 2y, daily forever) | TimescaleDB: native retention policies via `add_retention_policy()`. SQLite: scheduled cleanup with cutoff dates |
| DATA-03 | Schema separation via table prefix (shared_, dv_, opt_, exec_, telemetry_) | TimescaleDB: actual PostgreSQL schemas (`CREATE SCHEMA`). SQLite: table name prefixes. Adapter abstracts the difference |
| DATA-04 | Monthly partitioned raw telemetry (SQLite) / Hypertables (TimescaleDB) | TimescaleDB: `create_hypertable()` with automatic chunk partitioning. SQLite: `telemetry_raw_YYYY_MM` tables with programmatic rotation |
| DATA-05 | Rollup engine (manual for SQLite, Continuous Aggregates for TimescaleDB) | TimescaleDB: Hierarchical Continuous Aggregates (5min -> 15min -> daily). SQLite: manual aggregation job based on existing `buildRollups` |
| DATA-06 | Secure, performant, fast data structure | Parameterized queries (both backends), connection pooling (pg), WAL+PRAGMAs (SQLite), indexes on time columns |
| GW-04 | Multi-resolution telemetry collection | Adapter insert method accepts samples at any resolution; rollup engine produces 5min/15min/daily from raw |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | ^8.20.0 | PostgreSQL/TimescaleDB driver | Standard Node.js PostgreSQL client, 13K+ dependents, ESM support, parameterized queries, built-in Pool |
| node:sqlite | Node 22.5+ built-in | SQLite backend | Zero dependencies, DatabaseSync for synchronous ops, already used in existing codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg-pool | (bundled with pg) | Connection pooling | Always -- used internally by pg.Pool |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg | postgres (npm) | Faster in benchmarks, but pg has larger ecosystem, more docs, more battle-tested |
| node:sqlite | better-sqlite3 | ~20% faster, but adds native dependency; node:sqlite is sufficient and zero-dep |
| Raw SQL migrations | knex/umzug | Adds dependency; raw SQL files + idempotent statements are simpler for this project |

**Installation:**
```bash
npm install pg
```

Note: `pg` becomes a regular dependency (not optional). `node:sqlite` requires no installation.

## Architecture Patterns

### Recommended Project Structure
```
dvhub/core/
  database/
    adapter.js           # Interface definition + factory: createDatabaseAdapter(config)
    timescaledb.js       # TimescaleDB backend implementation
    sqlite.js            # SQLite backend implementation
    migrations/
      timescaledb/
        001-schemas.sql          # CREATE SCHEMA shared, dv, opt, exec
        002-telemetry-raw.sql    # Hypertable for raw telemetry
        003-continuous-aggs.sql  # 5min, 15min, daily continuous aggregates
        004-policies.sql         # Compression, retention, refresh policies
        005-shared-tables.sql    # shared_config, shared_event_log, etc.
      sqlite/
        001-pragmas.sql          # WAL, synchronous, cache, mmap
        002-telemetry-tables.sql # telemetry_raw template, rollup tables
        003-shared-tables.sql    # shared_config, etc.
```

### Pattern 1: Database Adapter Factory
**What:** Factory function that returns a backend-specific adapter based on config
**When to use:** Always -- this is the single entry point for database access
**Example:**
```javascript
// dvhub/core/database/adapter.js
export function createDatabaseAdapter(config) {
  const backend = config.database?.backend || 'timescaledb';

  if (backend === 'timescaledb') {
    const { createTimescaleAdapter } = await import('./timescaledb.js');
    return createTimescaleAdapter(config.database);
  }

  if (backend === 'sqlite') {
    const { createSqliteAdapter } = await import('./sqlite.js');
    return createSqliteAdapter(config.database);
  }

  throw new Error(`Unknown database backend: ${backend}`);
}
```

### Pattern 2: Adapter Interface Contract
**What:** Both backends implement identical method signatures
**When to use:** Every database interaction from modules
**Example:**
```javascript
// Adapter interface (both backends implement this):
const adapter = {
  // Lifecycle
  async initialize(),       // Run migrations, create tables/hypertables
  async healthCheck(),      // Returns { ok: boolean, backend, latencyMs }
  async close(),            // Graceful shutdown

  // Write operations
  async insertSamples(rows),           // Bulk insert telemetry samples
  async insertControlEvent(event),     // Single control event

  // Read operations
  async querySamples({ seriesKeys, start, end, resolution }),
  async queryAggregates({ seriesKeys, start, end, bucket }),
  async queryLatest(seriesKeys),

  // Maintenance
  async runRollups({ now }),            // SQLite: manual aggregation. TimescaleDB: no-op (CA handles it)
  async runRetention({ now }),          // Delete expired data per retention policy
  async runCompression({ now }),        // SQLite: VACUUM. TimescaleDB: no-op (policy handles it)

  // Metadata
  getBackendInfo(),                    // { backend: 'timescaledb'|'sqlite', version, ... }
};
```

### Pattern 3: TimescaleDB Hypertable + Hierarchical Continuous Aggregates
**What:** Raw data in hypertable, auto-rollups via stacked continuous aggregates
**When to use:** TimescaleDB backend only
**Example:**
```sql
-- Raw telemetry hypertable
CREATE TABLE telemetry_raw (
  ts TIMESTAMPTZ NOT NULL,
  series_key TEXT NOT NULL,
  value_num DOUBLE PRECISION,
  unit TEXT,
  source TEXT NOT NULL DEFAULT 'local_poll',
  quality TEXT NOT NULL DEFAULT 'raw',
  meta_json JSONB DEFAULT '{}'::jsonb
);
SELECT create_hypertable('telemetry_raw', 'ts');
CREATE INDEX idx_telemetry_raw_series_ts ON telemetry_raw(series_key, ts DESC);

-- 5-minute continuous aggregate (base layer)
CREATE MATERIALIZED VIEW telemetry_5min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', ts) AS bucket,
  series_key,
  AVG(value_num) AS avg_value,
  MIN(value_num) AS min_value,
  MAX(value_num) AS max_value,
  COUNT(*) AS sample_count
FROM telemetry_raw
GROUP BY bucket, series_key
WITH NO DATA;

-- 15-minute continuous aggregate (stacked on 5min)
CREATE MATERIALIZED VIEW telemetry_15min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', bucket) AS bucket,
  series_key,
  AVG(avg_value) AS avg_value,
  MIN(min_value) AS min_value,
  MAX(max_value) AS max_value,
  SUM(sample_count) AS sample_count
FROM telemetry_5min
GROUP BY 1, series_key
WITH NO DATA;

-- Daily continuous aggregate (stacked on 15min)
CREATE MATERIALIZED VIEW telemetry_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket) AS bucket,
  series_key,
  AVG(avg_value) AS avg_value,
  MIN(min_value) AS min_value,
  MAX(max_value) AS max_value,
  SUM(sample_count) AS sample_count
FROM telemetry_15min
GROUP BY 1, series_key
WITH NO DATA;

-- Refresh policies
SELECT add_continuous_aggregate_policy('telemetry_5min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('telemetry_15min',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes');

SELECT add_continuous_aggregate_policy('telemetry_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- Compression (raw data older than 7 days)
ALTER TABLE telemetry_raw SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'series_key',
  timescaledb.compress_orderby = 'ts DESC'
);
SELECT add_compression_policy('telemetry_raw', compress_after => INTERVAL '7 days');

-- Retention policies
SELECT add_retention_policy('telemetry_raw', drop_after => INTERVAL '7 days');
SELECT add_retention_policy('telemetry_5min', drop_after => INTERVAL '90 days');
SELECT add_retention_policy('telemetry_15min', drop_after => INTERVAL '2 years');
-- telemetry_daily: no retention (kept forever)
```

### Pattern 4: SQLite Monthly Partitioning
**What:** Separate tables per month for raw data, single tables for rollups
**When to use:** SQLite backend only
**Example:**
```javascript
// Table naming: telemetry_raw_2026_03
function getRawTableName(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `telemetry_raw_${y}_${m}`;
}

function ensureRawTable(db, tableName) {
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_series_ts
      ON ${tableName}(series_key, ts_utc);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_ts
      ON ${tableName}(ts_utc);
  `);
}
```

### Pattern 5: Connection Pool Configuration (pg)
**What:** Recommended Pool settings for a single-site HEMS
**When to use:** TimescaleDB backend initialization
**Example:**
```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: config.database.connectionString
    || 'postgresql://dvhub:dvhub@localhost:5432/dvhub',
  max: 10,                        // Max connections (single-site, low concurrency)
  min: 2,                         // Keep 2 warm connections
  idleTimeoutMillis: 30000,       // Close idle after 30s
  connectionTimeoutMillis: 5000,  // Fail connect after 5s
  maxUses: 7500,                  // Recycle connections to prevent memory leaks
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});
```

### Anti-Patterns to Avoid
- **Leaking backend-specific SQL into modules:** Modules must never import `pg` or `node:sqlite` directly. All access goes through the adapter.
- **Mixing sync and async in adapter interface:** The adapter interface should be fully async (Promise-based). The SQLite backend wraps synchronous DatabaseSync calls in resolved promises.
- **Creating new Pool instances per request:** Use a single Pool instance for the lifetime of the application.
- **Refreshing continuous aggregates over deleted data:** Always ensure retention policy intervals are longer than continuous aggregate refresh windows (already handled by the recommended policy setup above).
- **AVG of AVGs for rollups:** When stacking aggregates, use weighted averages or track sample_count. The continuous aggregate pattern above correctly preserves min/max and delegates averaging to the database.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-series partitioning (TimescaleDB) | Manual partition management | `create_hypertable()` | Handles chunk creation, routing, index management automatically |
| Multi-resolution rollups (TimescaleDB) | Manual aggregation jobs | Hierarchical Continuous Aggregates | Automatic, incremental, handles edge cases like late-arriving data |
| Data compression (TimescaleDB) | Custom archival logic | `add_compression_policy()` | 90%+ compression, transparent to queries |
| Data retention (TimescaleDB) | Manual DELETE jobs | `add_retention_policy()` | Chunk-level drops are orders of magnitude faster than row deletes |
| Connection pooling | Custom connection manager | `pg.Pool` | Handles lifecycle, errors, timeouts, recycling |
| SQL injection prevention | String concatenation + escaping | Parameterized queries (`$1`, `?`) | Both `pg` and `node:sqlite` support parameterized queries natively |
| Migration ordering | Custom dependency resolver | Numbered SQL files (001-, 002-, ...) | Simple, predictable, no library needed |

**Key insight:** TimescaleDB's native features (hypertables, continuous aggregates, compression, retention) eliminate most of the complexity that would otherwise require hand-built infrastructure. The SQLite backend is inherently simpler but does require manual rollup and retention code.

## Common Pitfalls

### Pitfall 1: Continuous Aggregate Refresh Window vs Retention Policy Conflict
**What goes wrong:** Deleting raw data that the continuous aggregate refresh window still covers causes the aggregate to delete its materialized data too.
**Why it happens:** When a continuous aggregate refreshes, it checks the underlying data. If raw data was deleted, the aggregate removes its corresponding rows.
**How to avoid:** Set retention policy `drop_after` to be LONGER than the continuous aggregate `start_offset`. In our case: raw retention is 7 days, CA refresh start_offset is 1 hour -- this is safe.
**Warning signs:** Gaps appearing in continuous aggregate data after retention runs.

### Pitfall 2: node:sqlite Is Still Experimental
**What goes wrong:** API changes between Node.js versions could break the SQLite backend.
**Why it happens:** `node:sqlite` was introduced in Node 22.5 as experimental (Stability 1.1). As of Node 25.x it is at Stability 1.2 (Release Candidate). The project targets Node >= 22.5.
**How to avoid:** Pin Node.js version in deployment. Write the SQLite adapter with a thin wrapper around DatabaseSync so that API changes require minimal modifications. The existing `telemetry-store.js` already works with the current API.
**Warning signs:** Deprecation warnings on `node:sqlite` import.

### Pitfall 3: SQLite Single-Writer Contention
**What goes wrong:** Concurrent write attempts from multiple parts of the application block each other, causing SQLITE_BUSY errors.
**Why it happens:** SQLite allows only one writer at a time, even in WAL mode. WAL enables concurrent readers but not concurrent writers.
**How to avoid:** Batch writes in transactions (already done in existing code). Use a write queue or serialize all write operations through the adapter. The existing `writeSamples` function already uses BEGIN/COMMIT transactions.
**Warning signs:** SQLITE_BUSY errors in logs, increasing write latency.

### Pitfall 4: AVG-of-AVGs Statistical Error in Hierarchical Rollups
**What goes wrong:** Rolling up AVG values from a lower-resolution aggregate produces incorrect averages because buckets may have different sample counts.
**Why it happens:** AVG(AVG(x)) is not the same as AVG(x) unless all groups have equal sample counts.
**How to avoid:** Track `sample_count` in every rollup level. For TimescaleDB continuous aggregates, the `AVG()` on the materialized view handles this correctly internally. For SQLite manual rollups, use weighted averaging: `SUM(avg_value * sample_count) / SUM(sample_count)`.
**Warning signs:** Discrepancies between raw-data queries and rollup queries for the same time range.

### Pitfall 5: Forgetting to Create Monthly Tables (SQLite)
**What goes wrong:** Inserts fail at month boundaries because the new month's table doesn't exist yet.
**Why it happens:** Monthly partitioned tables (`telemetry_raw_YYYY_MM`) must be created before first insert.
**How to avoid:** Use `CREATE TABLE IF NOT EXISTS` on every insert batch, or pre-create tables for current + next month via a scheduled job.
**Warning signs:** Insert failures at midnight UTC on the 1st of each month.

### Pitfall 6: Missing TimescaleDB Extension
**What goes wrong:** `create_hypertable()` fails with "function does not exist".
**Why it happens:** TimescaleDB extension not installed or not enabled in the database.
**How to avoid:** The `initialize()` method must run `CREATE EXTENSION IF NOT EXISTS timescaledb` before any hypertable operations. Include a check in `healthCheck()`.
**Warning signs:** Migration failures during first startup.

### Pitfall 7: pg Pool Exhaustion
**What goes wrong:** All pool connections are checked out and never returned, causing the application to hang.
**Why it happens:** Forgetting to call `client.release()` after `pool.connect()`, especially in error paths.
**How to avoid:** Use `pool.query()` for simple queries (auto-releases). For transactions, always use try/finally with `client.release()`.
**Warning signs:** `pool.waitingCount` growing, requests timing out.

## Code Examples

### Database Config Schema
```javascript
// In dvhub/config.json (or equivalent)
{
  "database": {
    "backend": "timescaledb",                          // or "sqlite"
    "connectionString": "postgresql://dvhub:dvhub@localhost:5432/dvhub",
    // SQLite-specific:
    "dbPath": "./data/telemetry.sqlite",
    // Retention (both backends):
    "retention": {
      "rawDays": 7,
      "fiveMinDays": 90,
      "fifteenMinDays": 730,
      "dailyDays": null  // null = forever
    }
  }
}
```

### Adapter Usage from Module Code
```javascript
// In any module (e.g., gateway/index.js)
export async function register({ config, eventBus, database }) {
  // database is the adapter instance -- modules never know which backend

  const samples = buildLiveTelemetrySamples({ ts, resolutionSeconds, meter, victron });
  await database.insertSamples(samples);

  const history = await database.querySamples({
    seriesKeys: ['grid_import_w', 'grid_export_w'],
    start: new Date(Date.now() - 30 * 24 * 3600_000),
    end: new Date(),
    resolution: '15min'  // adapter picks the right table/view
  });
}
```

### SQLite PRAGMA Configuration
```sql
-- Optimal PRAGMAs for HEMS telemetry workload
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -20000;      -- 20MB cache
PRAGMA mmap_size = 268435456;    -- 256MB mmap
PRAGMA page_size = 8192;         -- 8KB pages (must be set before first write)
PRAGMA wal_autocheckpoint = 1000; -- Checkpoint every 1000 pages
```

### SQLite Manual Rollup Engine
```javascript
// Simplified rollup for SQLite backend
async function buildRollup(db, { interval, sourceTable, targetTable, now }) {
  const bucketEnd = floorToInterval(now, interval);
  const bucketStart = new Date(bucketEnd.getTime() - interval * 1000);

  db.exec('BEGIN');
  try {
    const rows = db.prepare(`
      SELECT series_key,
             AVG(value_num) AS avg_value,
             MIN(value_num) AS min_value,
             MAX(value_num) AS max_value,
             COUNT(*) AS sample_count,
             unit
      FROM ${sourceTable}
      WHERE value_num IS NOT NULL
        AND ts_utc >= ? AND ts_utc < ?
      GROUP BY series_key, unit
    `).all(bucketStart.toISOString(), bucketEnd.toISOString());

    for (const row of rows) {
      insertRollupStmt.run(
        bucketStart.toISOString(),
        row.series_key,
        row.avg_value,
        row.min_value,
        row.max_value,
        row.sample_count,
        row.unit
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node:sqlite experimental flag required | No flag needed (Stability 1.2) | Node.js 25.x (mid-2025) | Can use without --experimental-sqlite on newer Node |
| Single-level continuous aggregates | Hierarchical continuous aggregates | TimescaleDB 2.9 (2023) | 5min -> 15min -> daily stacking is native |
| Manual refresh ordering for hierarchical CAs | Multiple concurrent refresh policies | TimescaleDB 2.21 (2025) | Non-overlapping ranges can refresh in parallel |
| pg@7 (CommonJS only) | pg@8 (ESM + CommonJS) | pg 8.x (2024) | Native ESM import support -- aligns with project conventions |

**Deprecated/outdated:**
- `better-sqlite3` is not needed -- `node:sqlite` is sufficient and avoids native compilation
- TimescaleDB "old format" continuous aggregates (pre-2.7) -- all new CAs use the finalized format

## Open Questions

1. **Existing telemetry-store.js migration strategy**
   - What we know: The existing `telemetry-store.js` has 1069 lines with domain logic (energy_slots_15m materialization, solar_market_values, optimizer_runs, import_jobs). Some of this is storage logic (adapter scope), some is domain logic (module scope).
   - What's unclear: How much of the existing domain logic should be preserved in the adapter vs. moved to module-level code?
   - Recommendation: The adapter handles generic telemetry storage. Domain tables (solar_market_values, optimizer_runs, schedule_snapshots) become module-specific and each module manages its own tables through the adapter's generic query interface, or registers its own schema extensions.

2. **TimescaleDB version requirement**
   - What we know: Hierarchical continuous aggregates require TimescaleDB >= 2.9. The latest is 2.x (early 2026).
   - What's unclear: What version ships with common Linux distributions / Docker images.
   - Recommendation: Document minimum TimescaleDB version as 2.9+ in setup requirements. Use the official `timescale/timescaledb` Docker image.

3. **Async wrapper for SQLite backend**
   - What we know: `node:sqlite` DatabaseSync is synchronous. The adapter interface should be async (Promise-based) for consistency.
   - What's unclear: Whether wrapping sync calls in `Promise.resolve()` or `queueMicrotask` is sufficient, or if worker threads are needed.
   - Recommendation: Use `Promise.resolve()` wrappers for now. The data volumes are modest (~86K rows/day) and sync operations complete in microseconds. Worker threads add complexity without measurable benefit at this scale.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in test runner) |
| Config file | None -- uses `node --test` convention |
| Quick run command | `node --test dvhub/test/database-adapter.test.js` |
| Full suite command | `cd dvhub && node --test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Adapter factory returns correct backend | unit | `node --test dvhub/test/database-adapter.test.js` | No -- Wave 0 |
| DATA-01 | SQLite adapter insert + query roundtrip | unit | `node --test dvhub/test/database-sqlite.test.js` | No -- Wave 0 |
| DATA-01 | TimescaleDB adapter insert + query roundtrip | integration | `node --test dvhub/test/database-timescaledb.test.js` | No -- Wave 0 |
| DATA-02 | Retention policy deletes expired data | unit | `node --test dvhub/test/database-retention.test.js` | No -- Wave 0 |
| DATA-03 | Schema prefix tables are created correctly | unit | `node --test dvhub/test/database-schema.test.js` | No -- Wave 0 |
| DATA-04 | SQLite monthly partition creation | unit | `node --test dvhub/test/database-sqlite.test.js` | No -- Wave 0 |
| DATA-05 | SQLite manual rollup produces correct aggregates | unit | `node --test dvhub/test/database-rollup.test.js` | No -- Wave 0 |
| DATA-05 | Rollup sample_count is correct for weighted avg | unit | `node --test dvhub/test/database-rollup.test.js` | No -- Wave 0 |
| DATA-06 | Parameterized queries prevent SQL injection | unit | `node --test dvhub/test/database-adapter.test.js` | No -- Wave 0 |
| GW-04 | Multi-resolution query returns appropriate resolution | unit | `node --test dvhub/test/database-adapter.test.js` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test dvhub/test/database-adapter.test.js dvhub/test/database-sqlite.test.js`
- **Per wave merge:** `cd dvhub && node --test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `dvhub/test/database-adapter.test.js` -- covers DATA-01, DATA-06, GW-04 (factory, interface contract, injection prevention)
- [ ] `dvhub/test/database-sqlite.test.js` -- covers DATA-01, DATA-04 (SQLite insert/query, monthly partitions)
- [ ] `dvhub/test/database-rollup.test.js` -- covers DATA-05 (manual rollup correctness, weighted averages)
- [ ] `dvhub/test/database-retention.test.js` -- covers DATA-02 (retention cleanup)
- [ ] `dvhub/test/database-schema.test.js` -- covers DATA-03 (prefix/schema creation)
- [ ] TimescaleDB integration tests require a running PostgreSQL+TimescaleDB instance -- consider conditional skip

## Sources

### Primary (HIGH confidence)
- Existing codebase: `dvhub/telemetry-store.js` -- current SQLite implementation (1069 lines), proven in production
- Existing codebase: `dvhub/telemetry-runtime.js` -- sample building patterns
- Existing codebase: `dvhub/modules/gateway/telemetry.js` -- RxJS telemetry streams
- [TimescaleDB Hierarchical Continuous Aggregates docs](https://docs.timescale.com/use-timescale/latest/continuous-aggregates/hierarchical-continuous-aggregates/) -- stacked CA feature
- [TimescaleDB Retention with Continuous Aggregates](https://github.com/timescale/docs/blob/latest/use-timescale/data-retention/data-retention-with-continuous-aggregates.md) -- retention + CA interaction
- [node-postgres pooling docs](https://node-postgres.com/features/pooling) -- Pool API and patterns
- [pg npm package v8.20.0](https://www.npmjs.com/package/pg) -- current version verified
- [Node.js SQLite API docs](https://nodejs.org/docs/latest-v22.x/api/sqlite.html) -- DatabaseSync API reference

### Secondary (MEDIUM confidence)
- [node:sqlite stabilization tracking](https://github.com/nodejs/node/issues/57445) -- stabilization progress (Stability 1.2 as of Node 25.x)
- `docs/plans/2026-03-10-dvhub-postgres-schema-blueprint.md` -- PostgreSQL schema blueprint (reference, not directly used for adapter)
- `docs/plans/2026-03-10-dvhub-data-architecture-masterlist.md` -- data architecture with MVP tables

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pg and node:sqlite are well-documented, versions verified
- Architecture: HIGH -- adapter pattern is straightforward, TimescaleDB hierarchical CAs are well-documented, existing SQLite code provides proven patterns
- Pitfalls: HIGH -- documented from official sources (CA refresh + retention interaction), production experience (SQLite WAL), and standard Node.js patterns (pool management)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain, 30-day validity)
