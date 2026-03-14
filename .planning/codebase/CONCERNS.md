# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**`energy_state.json` committed to repository:**
- Issue: A live runtime state file (`dvhub/energy_state.json`) containing real energy readings and epoch timestamps is tracked in git. The `.gitignore` only ignores `dv-control-webapp/energy_state.json` (old path) and not `dvhub/energy_state.json`.
- Files: `dvhub/energy_state.json`, `.gitignore`
- Impact: Every production run that writes energy state creates a modified tracked file, polluting git status and potentially committing real operational data into history.
- Fix approach: Add `dvhub/energy_state.json` (and `dvhub/config.json`) to `.gitignore`. Remove the committed file with `git rm --cached dvhub/energy_state.json`.

**Monolithic `server.js` (2807 lines):**
- Issue: The entire HTTP server, schedule evaluation, energy calculation, Modbus proxy server, poll loop, InfluxDB export, EPEX fetch, and all API routes are in a single file.
- Files: `dvhub/server.js`
- Impact: High cognitive overhead when modifying any single feature. Changes to unrelated areas create merge conflicts. Difficult to test individual HTTP handlers in isolation.
- Fix approach: Extract route handlers into dedicated modules (e.g., `routes/schedule.js`, `routes/control.js`, `routes/history.js`). Core business logic like `evaluateSchedule`, `applyControlTarget`, and `buildSmallMarketAutomationRules` could become standalone modules.

**Timezone offset computed by string-parsing (`buildSmallMarketAutomationRules`):**
- Issue: UTC offset for Berlin timezone is computed by formatting a reference date to a local string, then manually parsing day/month/year/time components and computing the offset in milliseconds.
- Files: `dvhub/server.js` lines 283–300
- Impact: Fragile parsing of locale-formatted date strings. Breaks if `Intl.DateTimeFormat` output format changes across Node versions. An alternative is `Temporal` API or the existing `formatLocalHHMM` helper that already uses `formatToParts` correctly.
- Fix approach: Replace manual offset computation with `Intl.DateTimeFormat` `timeZoneName: 'shortOffset'` or `longOffset` part extraction via `formatToParts`, consistent with `formatLocalHHMM`.

**`scheduleServiceRestart` uses `eval`-style inline Node.js script:**
- Issue: The service restart helper spawns a new Node.js process with `-e <inline-script>`, where the script source is interpolated via `JSON.stringify`. While the interpolated values are controlled (command and args come from `serviceCommandParts`), this is an unusual and fragile pattern.
- Files: `dvhub/server.js` lines 2262–2278
- Impact: Hard to audit, and the `require('node:child_process')` inside the inline script mixes CommonJS with the ESM-only codebase context. A minor Node version change could break this.
- Fix approach: Write the helper script to a temp file or use a small dedicated `restart-helper.js` script spawned by its path.

**`config-model.js` (2136 lines) with duplicated pricing logic:**
- Issue: `config-model.js` contains `configuredModule3Windows` and `resolveUserImportPriceCtKwhForSlot` functions that are also duplicated in `server.js` (lines 1533, 1553–1588). Both files compute the same logic from `cfg.userEnergyPricing`.
- Files: `dvhub/config-model.js`, `dvhub/server.js`
- Impact: Any change to pricing logic requires updating both files. Divergence already present: `config-model.js` uses `parseHHMMFromConfig` while `server.js` uses `parseHHMM` from `schedule-runtime.js`.
- Fix approach: Remove the duplicate from `server.js` and import from `config-model.js`, as `history-runtime.js` already does via `resolveUserImportPriceCtKwhForSlot`.

**`BERLIN_TIME_ZONE` constant defined in two modules:**
- Issue: The constant `const BERLIN_TIME_ZONE = 'Europe/Berlin'` is defined independently in both `dvhub/config-model.js` line 5 and `dvhub/history-runtime.js` line 3.
- Files: `dvhub/config-model.js`, `dvhub/history-runtime.js`
- Impact: Minor — cosmetic drift risk if one is updated.
- Fix approach: Export from a shared utility module or `config-model.js`.

---

## Known Bugs

**`energy_state.json` uses `lastTs` containing future epoch timestamp:**
- Symptoms: The committed `energy_state.json` contains `"lastTs":1773138217546` which is a timestamp in ~2026-03-10 — no bug in isolation, but if `loadEnergy()` uses this `lastTs` to decide whether energy delta integration should continue, a stale `lastTs` from a different run context can cause double-counting on restart.
- Files: `dvhub/server.js` lines 784–803, `dvhub/energy_state.json`
- Trigger: Restart server with a stale `energy_state.json` where `lastTs` is from a different day or time zone boundary.
- Workaround: The `day` check on line 789 (`if (data.day === today)`) prevents most cross-day issues.

---

## Security Considerations

**No authentication on `/dv/control-value` (DV control read endpoint):**
- Risk: The `/dv/control-value` endpoint is explicitly excluded from auth checks. The `checkAuth` guard covers `url.pathname.startsWith('/api/')` and `/dv/` — but wait: line 2318 checks `startsWith('/api/')` OR `startsWith('/dv/')`, so `/dv/control-value` IS protected. However, the endpoint at line 2322 runs `controlValue()` first, before the auth guard is applied due to ordering — auth is checked only at line 2319 before routes. Verify: line 2318–2322 shows `if (url.pathname.startsWith('/dv/')) { if (!checkAuth(req, res)) return; }` precedes the actual handler at line 2322. This is fine as written but fragile due to the placement.
- Files: `dvhub/server.js` lines 2318–2322
- Current mitigation: Auth guard at line 2318 covers `/dv/` prefix.
- Recommendations: Add a comment clarifying the auth order. Consider a refactor that applies auth middleware-style before any route handling.

**API token passed as URL query parameter (`?token=`):**
- Risk: Tokens in URLs are logged in browser history, server access logs, and may be captured by proxies or monitoring tools.
- Files: `dvhub/public/common.js` lines 44–50, `dvhub/server.js` lines 2037–2040
- Current mitigation: `crypto.timingSafeEqual` is used for comparison; token is also stored in `localStorage` and sent as `Authorization: Bearer` header on API calls.
- Recommendations: The URL token fallback is intentional for initial browser setup. Document this clearly as a convenience-only mechanism for trusted-network deployments. The `syncTokenFromUrl` function removes the token from the URL after storing it (line 61), which limits exposure.

**Modbus server listens on `0.0.0.0` by default (example config):**
- Risk: The example config sets `"modbusListenHost": "0.0.0.0"`, exposing the Modbus proxy on all network interfaces. The Modbus server accepts write signals (FC6/FC16) that control the feed-in/off state of the energy system.
- Files: `dvhub/config.example.json` line 7, `dvhub/server.js` lines 1088–1113
- Current mitigation: The Modbus server itself has no authentication. It is intended to be accessible only to the Direktvermarkter on a private network.
- Recommendations: Document the network isolation requirement prominently. Consider adding an optional allowlist for client IPs. The current buffer accumulation (`buffer = Buffer.concat([buffer, chunk])`) has no maximum size limit on the Modbus server side, which could enable memory exhaustion via a malicious local client.

**XSS risk in `settings.js` `innerHTML` with server-provided strings:**
- Risk: `settings.js` uses `innerHTML` to render `destination.label`, `destination.description`, `section.label`, `section.fieldCount`, `group.label`, and `section.description` (lines 849–897). These values originate from the config definition in `config-model.js`, not from user input, so they are static developer-controlled strings. However, the pattern creates a foothold for future XSS if dynamic user-provided values are ever passed through the same rendering path without escaping.
- Files: `dvhub/public/settings.js` lines 849–914
- Current mitigation: Values are from `SECTIONS`, `SETTINGS_DESTINATIONS`, and field definition constants in `config-model.js`, not user data. `history.js` and `app.js` use `escapeHtml` and `escapeAttr` consistently for user-originated data.
- Recommendations: Introduce an `escapeHtml` helper in `settings.js` consistent with `history.js` and apply it to all `innerHTML` template literals, even for currently-static strings. This prevents regression when dynamic content is added.

**`SERVICE_NAME` is user-configurable via environment variable:**
- Risk: `SERVICE_NAME` defaults to `dvhub.service` but can be overridden via `DV_SERVICE_NAME`. This value is passed directly to `systemctl` as an argument via `execFile`. Since `execFile` does not use a shell, argument injection is not possible, but an attacker who can set environment variables could redirect restart commands to a different service.
- Files: `dvhub/server.js` lines 75, 2153–2156, 2369
- Current mitigation: `SERVICE_ACTIONS_ENABLED` must be explicitly opted in via `DV_ENABLE_SERVICE_ACTIONS=1`. This is disabled by default.
- Recommendations: Consider validating `SERVICE_NAME` matches a safe pattern (e.g., `^[a-zA-Z0-9._@-]+\.service$`) before use.

---

## Performance Bottlenecks

**`Buffer.concat` in Modbus server accumulates without size cap:**
- Problem: In `startModbusServer`, each incoming data chunk is concatenated to a growing buffer via `Buffer.concat([buffer, chunk])`. There is no maximum buffer size check.
- Files: `dvhub/server.js` lines 1091–1105
- Cause: A slow or malicious client that opens a connection and sends partial frames without completing them will cause unbounded memory growth per socket.
- Improvement path: Add a maximum buffer size (e.g., 1024 bytes for a Modbus TCP frame) and drop the connection if exceeded.

**`state.log` in-memory ring buffer with 1000-entry limit:**
- Problem: All log entries are stored in-memory in `state.log` (max 1000 entries). The entire log array is serialized and sent on every `/api/log` and `/api/status` request.
- Files: `dvhub/server.js` lines 807–811, 2448–2451
- Cause: Polling-heavy dashboards requesting `/api/status` at high frequency carry this overhead on every response.
- Improvement path: Exclude `log` from status payload; only return it on explicit `/api/log` requests. Consider a ring buffer that avoids array `shift()` (O(n)) by using a circular index.

**SQLite WAL mode without explicit checkpoint management:**
- Problem: The telemetry SQLite database uses WAL journal mode (`PRAGMA journal_mode = WAL`) and `synchronous = NORMAL`. WAL files can grow large between checkpoints.
- Files: `dvhub/telemetry-store.js` lines 127–128
- Cause: Node's `node:sqlite` (experimental built-in) does not automatically run WAL checkpoints on idle. Under active write conditions (every 2–5 seconds), the WAL file grows continuously.
- Improvement path: Schedule periodic `PRAGMA wal_checkpoint(PASSIVE)` calls, e.g., attached to the existing 5-minute rollup interval.

---

## Fragile Areas

**Runtime worker IPC relies on `process.send` availability check:**
- Files: `dvhub/server.js` lines 693, 2696–2701`, `dvhub/runtime-worker-protocol.js`
- Why fragile: The runtime worker mode (`DVHUB_ENABLE_RUNTIME_WORKER=1`) separates the web and runtime processes via IPC. The web process depends on periodic `RUNTIME_SNAPSHOT` messages from the worker. If the worker crashes and exits, `runtimeWorkerState.ready = false` is set but the web process continues serving the last cached snapshot (`runtimeWorkerStatusPayload`) indefinitely with no staleness expiry.
- Safe modification: Any change to the IPC message protocol in `runtime-worker-protocol.js` must be coordinated with `server.js` message handlers (lines 722–737). The snapshot age (`snapshotAgeMs`) is exposed in the API but not acted upon server-side.
- Test coverage: `dvhub/test/runtime-process-boundary.test.js` covers basic IPC mechanics but not the stale-snapshot-after-crash scenario.

**Sun times cache is loaded fresh from disk on every planning call when stale:**
- Files: `dvhub/server.js` lines 211–238, `dvhub/sun-times-cache.js`
- Why fragile: `getSunTimesCacheForPlanning` reads from disk via `readSunTimesCacheStore` on every call when the in-memory cache is stale (location or year changed). If the cache file is missing or corrupt, `store?.entries?.[cacheKey]?.cache` silently returns `{}`, and planning succeeds with an empty cache. The automation will then use a fallback path but this failure mode is not logged.
- Safe modification: Add a log event when `readSunTimesCacheStore` returns null or the cache key is missing.

**In-memory `state` object is the single source of truth for live data:**
- Files: `dvhub/server.js` lines 107–178
- Why fragile: All live meter data, Victron readings, schedule rules, and energy integrals live in a single mutable global `state` object. There are no immutability guarantees, no version stamps, and no concurrent-access protection (though Node's single-threaded event loop provides implicit safety). A programming error that mutates `state.epex.data` during iteration would cause subtle bugs.
- Safe modification: Treat `state` properties as read-only except in their designated setter functions. Never modify `state.epex.data` or `state.schedule.rules` in-place; always replace the reference.

**`persistConfig` and `persistEnergy` are synchronous file writes on the hot path:**
- Files: `dvhub/server.js` lines 511–548, 767–782
- Why fragile: `persistConfig` calls `fs.writeFileSync` and is invoked on every schedule evaluation cycle (via `autoDisableExpiredScheduleRules`) and on every API write. Under high disk I/O or a full filesystem, synchronous writes block the event loop.
- Safe modification: Add a debounce/coalesce mechanism: queue a write and only flush after the current event loop tick completes, using `setImmediate` or `process.nextTick`.

---

## Scaling Limits

**Single-process, single-SQLite telemetry database:**
- Current capacity: Suitable for a single residential system with 2–5 second poll intervals. The telemetry database is a SQLite file with WAL mode.
- Limit: Multiple simultaneous writers (e.g., if the runtime worker feature is expanded) would serialize on SQLite's write lock. More than ~100 inserts/second would saturate write throughput on embedded hardware.
- Scaling path: For multi-system deployments, replace SQLite with a time-series database (InfluxDB integration already exists) or use PostgreSQL (migrations exist in `db/postgres/migrations/`).

**In-memory EPEX price data refreshed every 5 minutes:**
- Current capacity: Adequate for a single process. The EPEX data array holds ~96 slots (two days × 15-min intervals).
- Limit: If multiple instances share a network with rate-limited API access to `api.energy-charts.info`, independent polling may be throttled.
- Scaling path: An external caching proxy or shared Redis cache for EPEX data if multi-instance deployments are needed.

---

## Dependencies at Risk

**`node:sqlite` is a Node.js experimental built-in:**
- Risk: `telemetry-store.js` uses `import { DatabaseSync } from 'node:sqlite'`, which was introduced as an experimental API in Node.js 22 and stabilized in Node 23. The `package.json` specifies `"node": ">=18.0.0"`, but `node:sqlite` is not available in Node 18 or 20.
- Files: `dvhub/telemetry-store.js` line 3, `dvhub/package.json`
- Impact: Enabling telemetry on a Node 18 or 20 installation will crash the process on import with `ERR_UNKNOWN_BUILTIN_MODULE`. The setup wizard does not warn about this.
- Migration plan: Update `package.json` `engines.node` to `>=22.0.0` and document the Node version requirement. Add a startup check that logs a clear error before crashing if `node:sqlite` is unavailable.

**`mqtt` as an optional dependency:**
- Risk: The MQTT transport (`dvhub/transport-mqtt.js`) uses `import mqtt from 'mqtt'` but `mqtt` is declared as an `optionalDependency`. If `npm install` fails to install the optional package (e.g., on systems with restricted npm access or ARM32), the MQTT transport silently fails to load.
- Files: `dvhub/transport-mqtt.js`, `dvhub/package.json`
- Impact: The MQTT transport fails at runtime without a clear error message to the user.
- Migration plan: Add a try/catch around the dynamic import of `mqtt` in `transport-mqtt.js` with a clear user-facing error when the package is not available and MQTT transport is configured.

**No lockfile committed:**
- Risk: `.gitignore` explicitly ignores `package-lock.json`. The `multicast-dns` dependency (`^7.2.5`) has no version pinning in CI.
- Files: `.gitignore` line 8, `dvhub/package.json`
- Impact: Reproducible installs are not guaranteed. A breaking patch release of `multicast-dns` would only be discovered at install time.
- Migration plan: Reconsider the gitignore rule for `package-lock.json`. At minimum, document the expected `multicast-dns` version in the install script tests.

---

## Missing Critical Features

**No HTTP request rate limiting:**
- Problem: There is no rate limiting on any API endpoint. The `/api/meter/scan` endpoint triggers a potentially long-running Modbus scan and can be called repeatedly. The `/api/history/import` endpoint triggers VRM API calls with a 3-attempt retry loop.
- Blocks: A user-facing rate-limit UI or automatic protection against repeated trigger of expensive operations.
- Files: `dvhub/server.js` lines 2525–2532, 2457–2485

**No HTTPS support:**
- Problem: The web server is plain HTTP only. There is no TLS termination option. The API token is transmitted in plaintext when accessed over a non-localhost network.
- Blocks: Secure remote access without a reverse proxy.
- Files: `dvhub/server.js` lines 2310, 2679

**No startup check for Node version compatibility with `node:sqlite`:**
- Problem: See Dependencies at Risk above. There is no runtime gate that checks `process.versions.node` before initializing telemetry.
- Files: `dvhub/server.js` lines 550–575

---

## Test Coverage Gaps

**HTTP route handlers have no direct test coverage:**
- What's not tested: All routes defined in the `http.createServer` handler in `dvhub/server.js` lack unit or integration tests. There are no tests for `/api/config`, `/api/schedule/rules`, `/api/control/write`, `/api/integration/eos/apply`, or `/api/admin/service/restart`.
- Files: `dvhub/server.js` lines 2310–2637
- Risk: Breaking changes in route logic or auth bypass scenarios would only be caught by manual testing.
- Priority: High

**`transport-mqtt.js` has no tests:**
- What's not tested: MQTT transport connection, reconnection, value caching (`getCached`), and write (`mqttWrite`) behavior.
- Files: `dvhub/transport-mqtt.js`
- Risk: MQTT transport bugs are only discovered in production against live Victron hardware.
- Priority: Medium

**Modbus server frame parsing (`processModbusFrame`) has no dedicated tests:**
- What's not tested: Malformed frame handling, FC3/FC4/FC6/FC16 response construction, and write signal interpretation (`handleWriteSignal`).
- Files: `dvhub/server.js` lines 1025–1084
- Risk: Protocol changes or edge-case frames from Direktvermarkter systems could cause silent failures or incorrect responses.
- Priority: Medium

**Worker IPC stale-snapshot scenario is untested:**
- What's not tested: The web process's behavior when the runtime worker exits unexpectedly and the snapshot becomes stale.
- Files: `dvhub/server.js` lines 722–746, `dvhub/test/runtime-process-boundary.test.js`
- Risk: Stale data served to users without visibility into the failure.
- Priority: Medium

---

*Concerns audit: 2026-03-14*
