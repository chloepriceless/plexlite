# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
project-root/
├── dvhub/                  # Main application (Node.js server + frontend)
│   ├── server.js           # Primary entry point — HTTP server, control loops, all routes
│   ├── config-model.js     # Config schema, load/save/validate, field definitions
│   ├── telemetry-store.js  # SQLite time-series store (node:sqlite)
│   ├── telemetry-runtime.js # Telemetry sample builders (live + historical)
│   ├── history-import.js   # VRM API import, backfill manager
│   ├── history-runtime.js  # History query/aggregate API handlers
│   ├── small-market-automation.js  # EPEX slot selection, automation rule builder
│   ├── schedule-runtime.js # Schedule rule matching, expiry, stop-SoC logic
│   ├── transport-modbus.js # Modbus TCP client transport
│   ├── transport-mqtt.js   # MQTT client transport (optional dep)
│   ├── runtime-state.js    # Snapshot builders for IPC and API serialization
│   ├── runtime-worker.js   # Child-process entry point for runtime-worker role
│   ├── runtime-worker-protocol.js  # IPC message types, fork helper, command queue
│   ├── runtime-commands.js # Runtime command validation (control_write, history_*)
│   ├── runtime-performance.js      # SerialTaskRunner, TelemetryWriteBuffer, poll interval
│   ├── energy-charts-market-values.js  # energy-charts.info API client + cache
│   ├── bundesnetzagentur-applicable-values.js  # BNetzA EEG reference value fetcher
│   ├── system-discovery.js # mDNS/multicast-dns based device discovery
│   ├── sun-times-cache.js  # Sunrise/sunset cache for automation planning
│   ├── app-version.js      # Read version from package.json + git revision
│   ├── util.js             # Minimal utility (toFiniteNumber)
│   ├── config.example.json # Example configuration file
│   ├── energy_state.json   # Runtime-persisted daily energy accumulators (gitignored)
│   ├── package.json        # Node.js package manifest
│   ├── hersteller/         # Manufacturer device profiles
│   │   └── victron.json    # Victron ESS register map
│   ├── public/             # Static frontend files served over HTTP
│   │   ├── index.html      # Dashboard (Leitstand)
│   │   ├── history.html    # History page
│   │   ├── settings.html   # Settings page
│   │   ├── setup.html      # Setup wizard
│   │   ├── tools.html      # Maintenance tools
│   │   ├── app.js          # Dashboard JS
│   │   ├── history.js      # History page JS
│   │   ├── settings.js     # Settings page JS
│   │   ├── setup.js        # Setup wizard JS
│   │   ├── tools.js        # Tools page JS
│   │   ├── common.js       # Shared frontend utilities
│   │   ├── styles.css      # Full application CSS (~60 kB)
│   │   └── assets/         # Frontend image assets (logo files)
│   └── test/               # Co-located unit/integration tests
│       └── *.test.js       # One test file per module under test
├── db/
│   └── postgres/
│       └── migrations/     # PostgreSQL schema (multi-site future model, not used by app)
│           ├── 0001_bootstrap.sql
│           ├── 0002_shared.sql
│           ├── 0003_dv.sql
│           ├── 0004_opt.sql
│           ├── 0005_exec.sql
│           └── 0006_updated_at_triggers.sql
├── docs/
│   ├── plans/              # Design and planning documents
│   └── research/           # Research notes
├── assets/
│   └── screenshots/        # UI screenshots
├── test/                   # Root-level integration tests (install script, README)
│   ├── install-script.test.js
│   └── readme-installation.test.js
├── install.sh              # Linux systemd installer script
├── 20-dv-modbus.sh         # Modbus udev/startup helper script
├── README.md               # Project README
├── LICENSE.md              # License
├── COMMERCIAL_LICENSE.md   # Commercial license
└── DVhub_design_system_for_codex.md  # UI design guidelines
```

## Directory Purposes

**`dvhub/` (application root):**
- Purpose: The entire runnable Node.js application. All server-side modules live here.
- Contains: ES modules only (`"type": "module"` in `package.json`); no transpilation; no framework
- Key files: `server.js` (entry), `config-model.js` (config), `telemetry-store.js` (SQLite)

**`dvhub/public/`:**
- Purpose: Static web UI served directly by `server.js` via `serveStatic()`
- Contains: Vanilla JS pages (no bundler, no framework), one shared CSS, HTML per page
- Key files: `index.html` (dashboard), `app.js` (dashboard logic), `styles.css`
- Note: Each page (`history`, `settings`, `setup`, `tools`) has its own `.html` and `.js` pair

**`dvhub/hersteller/`:**
- Purpose: Per-manufacturer device profiles as JSON descriptors
- Contains: Register maps, default connection parameters, transport hints
- Key files: `victron.json` (Victron Venus OS / Cerbo GX profile)
- Note: "Hersteller" = manufacturer (German). New manufacturer support adds a JSON file here.

**`dvhub/test/`:**
- Purpose: All unit and integration tests for server-side modules
- Contains: `*.test.js` files, one per module; uses Node.js built-in test runner (`node --test`)
- Key files: `history-runtime.test.js` (~55 kB), `history-import.test.js` (~51 kB)
- Note: Test files sit at `dvhub/test/` not co-located with sources

**`db/postgres/migrations/`:**
- Purpose: PostgreSQL schema for a future multi-site/multi-tenant architecture (not active)
- Contains: Numbered SQL migration files for `shared`, `dv`, `opt`, `exec` schemas
- Note: The running application uses `node:sqlite` in-process, not PostgreSQL

**`test/` (root):**
- Purpose: Integration tests for the install script and README documentation
- Contains: `install-script.test.js`, `readme-installation.test.js`

**`docs/plans/`:**
- Purpose: Archived design plans and feature planning documents
- Note: Not consumed by the application; for developer reference only

## Key File Locations

**Entry Points:**
- `dvhub/server.js`: Main process entry point; start with `node server.js`
- `dvhub/runtime-worker.js`: Child process entry, forked automatically by `server.js`
- `install.sh`: Installer for Linux/systemd deployment

**Configuration:**
- `dvhub/config-model.js`: Full config schema with defaults, validators, section metadata
- `dvhub/config.example.json`: Reference configuration template
- Config file at runtime: `$DV_APP_CONFIG` env or `dvhub/config.json` (not committed)

**Transport:**
- `dvhub/transport-modbus.js`: Modbus TCP client (used by default)
- `dvhub/transport-mqtt.js`: MQTT client (requires `npm install mqtt`, opt-in via config)

**Telemetry & History:**
- `dvhub/telemetry-store.js`: SQLite store — `writeSamples`, `buildRollups`, `cleanupRawSamples`
- `dvhub/history-import.js`: VRM API importer — `createHistoryImportManager`
- `dvhub/history-runtime.js`: History query engine — `createHistoryRuntime`, `createHistoryApiHandlers`

**Automation:**
- `dvhub/small-market-automation.js`: EPEX-price-based discharge slot selector
- `dvhub/schedule-runtime.js`: Time-based schedule rule evaluator

**External APIs:**
- `dvhub/energy-charts-market-values.js`: energy-charts.info market value fetcher
- `dvhub/bundesnetzagentur-applicable-values.js`: BNetzA EEG feed-in tariff reference data

**Frontend:**
- `dvhub/public/index.html` + `app.js`: Live dashboard (Leitstand)
- `dvhub/public/history.html` + `history.js`: Historical energy charts
- `dvhub/public/settings.html` + `settings.js`: Configuration UI
- `dvhub/public/setup.html` + `setup.js`: First-run setup wizard
- `dvhub/public/tools.html` + `tools.js`: Modbus scanner and maintenance tools

**Testing:**
- `dvhub/test/*.test.js`: All module tests
- `test/install-script.test.js`: Installer smoke tests

## Naming Conventions

**Files:**
- Lowercase with hyphens: `telemetry-store.js`, `history-import.js`, `small-market-automation.js`
- `*-runtime.js` suffix: modules containing runtime loops or live-state helpers (e.g., `schedule-runtime.js`, `telemetry-runtime.js`)
- `*-store.js` suffix: persistence layer modules
- `transport-*.js`: transport protocol implementations
- `*.test.js`: test files (Node.js `--test` runner convention)

**Directories:**
- All lowercase, no hyphens at the root level (`dvhub`, `db`, `docs`, `test`, `assets`)
- German words used in domain-specific directories: `hersteller/` (manufacturer)

**Exports:**
- Factory functions prefixed with `create`: `createTelemetryStore`, `createHistoryRuntime`, `createModbusTransport`
- Builder functions prefixed with `build`: `buildRuntimeSnapshot`, `buildSmallMarketAutomationRules`
- Named exports throughout; no default exports in server-side modules

## Where to Add New Code

**New API endpoint:**
- Add route handler inline in `dvhub/server.js` in the `http.createServer` block
- Follow the existing `if (url.pathname === '/api/...' && req.method === '...')` pattern
- Use `json(res, code, payload)` or `text(res, code, payload)` response helpers

**New backend module (service/utility):**
- Create `dvhub/<module-name>.js` as an ES module with named exports
- Add corresponding test at `dvhub/test/<module-name>.test.js`
- Import into `dvhub/server.js` at the top-level import block

**New config section:**
- Add schema definition in `dvhub/config-model.js` (new entry in `SECTIONS` array + field definitions)
- Update `dvhub/config.example.json` with example values

**New manufacturer profile:**
- Add JSON file at `dvhub/hersteller/<manufacturer-name>.json`
- Follow the structure of `dvhub/hersteller/victron.json`

**New frontend page:**
- Add `dvhub/public/<page>.html` and `dvhub/public/<page>.js`
- Add navigation link in all existing `*.html` files (the `<nav>` block in each)
- Add test at `dvhub/test/<page>-page.test.js` using JSDOM pattern

**New test:**
- Add `dvhub/test/<module>.test.js`
- Use Node.js built-in `node:test` and `node:assert` — no external test dependencies

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents (phases, codebase analysis)
- Generated: By GSD commands
- Committed: Yes (planning artifacts tracked in git)

**`dvhub/public/assets/`:**
- Purpose: Static image assets for frontend UI (logo files)
- Generated: No
- Committed: Yes

**`db/postgres/migrations/`:**
- Purpose: Future PostgreSQL schema; not consumed by the current application
- Generated: No
- Committed: Yes (schema is version-controlled)

**`reference-data/` (runtime-created):**
- Purpose: Cached external API data (`bundesnetzagentur-applicable-values.json`, `sun-times-cache.json`)
- Generated: Yes — created at runtime under `$DV_DATA_DIR` or `dvhub/` directory
- Committed: No — runtime data, excluded by `.gitignore`

---

*Structure analysis: 2026-03-14*
