# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Monolithic Node.js server with optional process-split for runtime isolation

**Key Characteristics:**
- Single `server.js` entry point (~2800 lines) containing HTTP routing, control loops, and business logic
- Pluggable transport layer: Modbus TCP or MQTT for Victron ESS communication
- Optional runtime-worker mode: the same `server.js` can run as a `web` process (serves HTTP) or a `runtime-worker` process (polls hardware, runs schedules), controlled by `DVHUB_PROCESS_ROLE` env var
- All configuration state is kept in a single in-memory `state` object, persisted to `config.json` on mutation
- Internal telemetry uses Node.js built-in `node:sqlite` (no external DB dependency for the app layer); InfluxDB and PostgreSQL are optional

## Layers

**Transport Layer:**
- Purpose: Abstract communication with the Victron ESS hardware
- Location: `dvhub/transport-modbus.js`, `dvhub/transport-mqtt.js`
- Contains: Connection pooling, read/write operations, keep-alive logic
- Depends on: Node.js `net` module (Modbus), optional `mqtt` npm package
- Used by: `dvhub/server.js` (primary and scan transport instances)

**Configuration Layer:**
- Purpose: Load, validate, merge, and persist application configuration
- Location: `dvhub/config-model.js`
- Contains: Config schema definition, `loadConfigFile`, `saveConfigFile`, `collectChangedPaths`, `detectRestartRequired`
- Depends on: `dvhub/util.js`
- Used by: `dvhub/server.js` at startup and on every config-save API call

**Runtime State Layer:**
- Purpose: Snapshot and sanitize live runtime state for API responses and IPC
- Location: `dvhub/runtime-state.js`
- Contains: `buildRuntimeSnapshot`, `buildWorkerBackedStatusResponse`, `buildHistoryImportStatusResponse`
- Depends on: Nothing (pure functions)
- Used by: `dvhub/server.js`, `dvhub/runtime-worker.js`

**Business Logic Layer:**
- Purpose: Schedule evaluation, market automation, energy tracking, pricing
- Location: `dvhub/server.js` (inline), `dvhub/schedule-runtime.js`, `dvhub/small-market-automation.js`
- Contains: Schedule rule matching, EPEX slot selection, energy integral calculation, DV control signal application
- Depends on: Transport layer, config layer, telemetry layer
- Used by: Periodic `evaluateSchedule` loop in `server.js`

**Telemetry Layer:**
- Purpose: Store time-series measurements, rollups, and optimizer runs in SQLite
- Location: `dvhub/telemetry-store.js`, `dvhub/telemetry-runtime.js`
- Contains: `createTelemetryStore` (SQLite CRUD), sample builders, rollup logic
- Depends on: `node:sqlite` (Node.js built-in >= 22.5)
- Used by: `dvhub/server.js`, `dvhub/history-import.js`, `dvhub/history-runtime.js`

**History Layer:**
- Purpose: Import historical energy data from VRM API and compute aggregated history views
- Location: `dvhub/history-import.js`, `dvhub/history-runtime.js`
- Contains: `createHistoryImportManager` (VRM API + backfill), `createHistoryRuntime` (query/aggregate), `createHistoryApiHandlers`
- Depends on: Telemetry layer, config layer, external VRM API
- Used by: `dvhub/server.js` (initialized on startup, exposed via `/api/history/*`)

**External Data Layer:**
- Purpose: Fetch market prices and regulatory reference values from external APIs
- Location: `dvhub/energy-charts-market-values.js`, `dvhub/bundesnetzagentur-applicable-values.js`
- Contains: HTTP fetch clients with local file caching
- Depends on: Node.js `fetch`, `node:fs`, `node:zlib`
- Used by: `dvhub/server.js`, `dvhub/history-runtime.js`

**Frontend Layer:**
- Purpose: Web UI served as static files over HTTP
- Location: `dvhub/public/` (dashboard, history, settings, setup, tools pages)
- Contains: Vanilla JS SPA pages, one CSS file, no build step
- Depends on: `/api/*` endpoints from `server.js`
- Used by: End users via browser

## Data Flow

**Live Measurement Poll:**
1. `schedulePollLoop` in `server.js` fires every `cfg.meterPollMs` ms
2. `pollMeter()` calls `transport.mbRequest()` or reads from MQTT cache
3. Raw register values decoded via manufacturer profile (`dvhub/hersteller/victron.json`)
4. `state.meter` and `state.victron` updated in memory
5. `liveTelemetryBuffer.capture(snapshot)` queues data for SQLite write
6. Every 5 s: `liveTelemetryBuffer.flush()` writes to `telemetryStore.writeSamples()`
7. Every 5 min: `telemetryStore.buildRollups()` aggregates raw rows

**Schedule Evaluation:**
1. `scheduleEvaluateLoop` fires every `cfg.schedule.evaluateMs` ms (default 15 s)
2. `evaluateSchedule()` calls `scheduleMatch()` for each rule against current time
3. If active rule found: `applyControlTarget()` writes to Victron via transport
4. `runSmallMarketAutomationIfNeeded()` optionally regenerates automation rules from EPEX data

**API Request Handling:**
1. HTTP request arrives at `http.createServer` handler in `server.js`
2. `checkAuth()` validates Bearer token or `?token=` query param (if `cfg.apiToken` set)
3. Route matched by `url.pathname` + `req.method` (no routing framework; plain if/else chain)
4. Response sent via `json()`, `text()`, or `serveStatic()` helpers with `SECURITY_HEADERS`

**Config Save Flow:**
1. `POST /api/config` receives JSON body
2. `saveAndApplyConfig()` calls `saveConfigFile()` → writes `config.json`
3. `loadConfigFile()` re-reads file, recomputes `cfg` (effective config)
4. `collectChangedPaths()` returns changed keys; `detectRestartRequired()` flags transport-restart paths
5. If restart not required, in-memory state immediately reflects new config

**Runtime Worker IPC (optional):**
1. Web process forks `runtime-worker.js` via `child_process.fork`
2. Worker runs `server.js` with `DVHUB_PROCESS_ROLE=runtime-worker`
3. Worker sends `RUNTIME_SNAPSHOT` messages to web process over IPC
4. Web process caches `runtimeWorkerSnapshot` and serves it from `/api/status`
5. Commands sent from web → worker as `COMMAND_REQUEST`, replies as `COMMAND_RESULT`

**State Management:**
- Single module-level `state` object in `server.js` holds all live runtime data
- Config state in `rawCfg` (raw JSON) and `cfg` (effective/defaulted config) loaded at startup
- Energy accumulators persisted to `dvhub/energy_state.json` every 60 s and on shutdown
- Schedule rules persisted to `config.json` on change via `persistConfig()`
- No reactive/observable framework; direct mutation + IPC snapshot broadcasting

## Key Abstractions

**Transport Interface:**
- Purpose: Unified read/write API for Victron hardware, regardless of protocol
- Examples: `dvhub/transport-modbus.js`, `dvhub/transport-mqtt.js`
- Pattern: Factory function (`createModbusTransport`, `createMqttTransport`) returns object with `{ type, mbRequest, mbWriteSingle, mqttWrite, init, destroy }`

**SerialTaskRunner:**
- Purpose: Ensure only one async meter-poll runs at a time, queuing at most one pending run
- Examples: `dvhub/runtime-performance.js` — `createSerialTaskRunner`
- Pattern: Closure with `inFlight` promise tracking

**TelemetryWriteBuffer:**
- Purpose: Debounce high-frequency telemetry writes to SQLite
- Examples: `dvhub/runtime-performance.js` — `createTelemetryWriteBuffer`
- Pattern: Capture → flush on interval or force-flush on shutdown

**RuntimeCommandQueue:**
- Purpose: Serial command processing for IPC-based runtime worker
- Examples: `dvhub/runtime-worker-protocol.js` — `createRuntimeCommandQueue`
- Pattern: FIFO queue with active-flag, resolves via IPC `sendMessage`

**Manufacturer Profile:**
- Purpose: Device-specific register maps for different inverter brands
- Examples: `dvhub/hersteller/victron.json`
- Pattern: JSON descriptor loaded at config time; contains register addresses, scaling, unit IDs

## Entry Points

**Primary Application Server:**
- Location: `dvhub/server.js`
- Triggers: `node server.js` (via `npm start`)
- Responsibilities: Loads config, initializes transport, starts HTTP server, starts poll and schedule loops, optionally forks runtime worker

**Runtime Worker:**
- Location: `dvhub/runtime-worker.js`
- Triggers: Forked by web process when `DVHUB_ENABLE_RUNTIME_WORKER=1`; also runs in test mode when `DVHUB_RUNTIME_WORKER_TEST=1`
- Responsibilities: Imports and runs `server.js` with `DVHUB_PROCESS_ROLE=runtime-worker`; handles IPC command queue

**Install Script:**
- Location: `install.sh` (root)
- Triggers: `bash install.sh` on a Linux host
- Responsibilities: Creates system user, installs to `/opt/dvhub`, registers systemd service

## Error Handling

**Strategy:** Defensive — errors caught locally, logged to in-memory `state.log` ring buffer, never crash the process

**Patterns:**
- Transport failures: caught in `pollMeter`, stored as `state.meter.error` / `state.victron.errors[name]`
- Telemetry writes: `telemetrySafeWrite()` wrapper catches all SQLite errors, sets `state.telemetry.ok = false`
- HTTP handler: outer `try/catch` in the `http.createServer` callback; responds with 500 if headers not yet sent
- Validation errors: thrown with `error.statusCode = 400`, caught by HTTP handler
- Worker crashes: `worker.on('exit')` sets `runtimeWorkerState.ready = false`, no automatic restart

## Cross-Cutting Concerns

**Logging:** Ring-buffer in `state.log` (max configurable entries), entries written via `pushLog(event, payload)`. Exposed at `GET /api/log`. Also `console.log` / `console.error` for startup and fatal events.

**Validation:** Input validated inline per route. Config schema validated in `config-model.js`. Runtime commands validated in `runtime-commands.js` before execution.

**Authentication:** Optional Bearer token (`cfg.apiToken`). All `/api/*` and `/dv/*` routes go through `checkAuth()`. Timing-safe comparison via `crypto.timingSafeEqual`. Token also accepted as `?token=` query param.

**Security Headers:** `SECURITY_HEADERS` constant applied to all responses: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`.

**Timezone Handling:** All schedule and EPEX logic uses `Europe/Berlin` (or `cfg.schedule.timezone`) via `Intl.DateTimeFormat`. Energy-day boundaries computed in Berlin local time.

---

*Architecture analysis: 2026-03-14*
