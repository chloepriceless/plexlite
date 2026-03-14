# External Integrations

**Analysis Date:** 2026-03-14

## Hardware / Device Protocols

**Victron Energy ESS (primary device integration):**
- Protocol: Modbus TCP (default) or MQTT (optional)
- Modbus client: custom implementation in `dvhub/transport-modbus.js` using `node:net`
- MQTT client: `mqtt` npm package, implemented in `dvhub/transport-mqtt.js`
- Device profile (register map): `dvhub/hersteller/victron.json`
- Modbus default port: 502, Unit ID: 100
- MQTT broker: typically `mqtt://<victron-host>:1883`, Venus OS topics (`N/`, `W/`, `R/` prefixes)
- Configured via `config.json` `victron` section: `host`, `transport`, `port`, `unitId`, `mqtt.portalId`

**Modbus TCP Proxy Server (outbound integration):**
- DVhub listens as a Modbus TCP server on `modbusListenPort` (default: 1502)
- Exposes DV register values (registers 0, 1, 3, 4) to external Modbus clients (e.g. EMS systems)
- Implemented in `dvhub/server.js` `startModbusServer()`

## APIs & External Services

**energy-charts.info (EPEX Day-Ahead prices):**
- URL: `https://api.energy-charts.info/price?bzn={bzn}&start={day}&end={day2}`
- Used for: real-time EPEX spot prices, 15-minute slots (Day-Ahead)
- Fetched in: `dvhub/server.js` (`fetchEpexDay()`)
- Also used in: `dvhub/history-import.js` (`ENERGY_CHARTS_PRICE_API_BASE`) for historical price backfill
- Config: `epex.enabled`, `epex.bzn` (default `DE-LU`), `epex.timezone`
- Refresh: every 5 minutes, or when date changes; forced refresh via `POST /api/epex/refresh`
- Auth: none

**energy-charts.info (Solar Market Values):**
- URL: `https://www.energy-charts.info/charts/market_values/data/de/month_cent_kwh_{year}.json` and `year_cent_kwh.json`
- Used for: Marktwert Solar (monthly + annual, ct/kWh) for revenue calculations
- Implemented in: `dvhub/energy-charts-market-values.js`
- Fetched via: `dvhub/server.js` (`startAutomaticMarketValueBackfill()`)
- Cache: stored in `node:sqlite` telemetry DB via `dvhub/telemetry-store.js`
- Auth: none

**Victron VRM API (history import):**
- URL: `https://vrmapi.victronenergy.com`
- Used for: historical energy data backfill (15-minute intervals, up to 365 days)
- Implemented in: `dvhub/history-import.js`
- Config: `telemetry.historyImport.enabled`, `telemetry.historyImport.provider = "vrm"`, `telemetry.historyImport.vrmPortalId`, `telemetry.historyImport.vrmToken`
- Auth: Bearer token (`vrmToken` in config, redacted in API responses)
- Triggered: automatic backfill on startup + gap backfill; manual via `POST /api/history/import` and `POST /api/history/backfill/vrm`

**Bundesnetzagentur (EEG feed-in tariff data):**
- URL: `https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Foerderung/Archiv_VergSaetze/start.html`
- Used for: parsing applicable EEG feed-in rates (Vergütungssätze) from HTML/XLSX
- Implemented in: `dvhub/bundesnetzagentur-applicable-values.js`
- Cache: stored as JSON file at `{DATA_DIR}/reference-data/bundesnetzagentur-applicable-values.json`
- Refresh: on startup
- Auth: none

## Data Storage

**Databases:**
- SQLite (Node built-in `node:sqlite` / `DatabaseSync`)
  - Purpose: internal telemetry time-series (live samples, rollups, price slots, optimizer runs, control events, market values)
  - Location: configurable via `telemetry.dbPath` or defaults to `{DATA_DIR}/dvhub-telemetry.sqlite`
  - Schema: created inline in `dvhub/telemetry-store.js` (`CREATE TABLE IF NOT EXISTS`)
  - WAL mode + NORMAL synchronous for performance
  - Tables: `timeseries_samples`, `timeseries_rollups`, `price_slots`, `optimizer_runs`, `control_events`, `market_values_monthly`, `market_values_annual`

- PostgreSQL (planned/migration-ready, not active in runtime)
  - Migrations: `db/postgres/migrations/0001_bootstrap.sql` through `0006_updated_at_triggers.sql`
  - Schemas: `shared`, `dv`, `opt`, `exec`
  - Extension: `pgcrypto`
  - Status: SQL migrations committed, no active runtime connection in current code

**File Storage:**
- Local filesystem for:
  - `config.json` — runtime config
  - `energy_state.json` — persisted energy counters (import/export Wh, cost/revenue EUR)
  - `{DATA_DIR}/reference-data/bundesnetzagentur-applicable-values.json` — BNetzA data cache
  - `{DATA_DIR}/reference-data/sun-times-cache.json` — sunrise/sunset cache (lat/lon/year keyed)

**Caching:**
- In-memory: EPEX price data in `state.epex`, Victron readings in `state.victron`, meter readings in `state.meter`
- File-based: BNetzA data and sun-times data (JSON files on disk, see above)
- SQLite: telemetry rollups serve as persistent data cache

## Authentication & Identity

**Auth Provider:**
- Custom static Bearer token — no third-party auth provider
- Implementation: `checkAuth()` in `dvhub/server.js`
  - Checks `Authorization: Bearer <token>` header OR `?token=<token>` query parameter
  - Uses `crypto.timingSafeEqual` to prevent timing attacks
- Config: `apiToken` in `config.json` (if absent, auth is disabled)
- Applied to: all `/api/*` and `/dv/*` routes
- Redacted paths in API responses: `apiToken`, `influx.token`, `telemetry.historyImport.vrmToken`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- In-memory ring buffer: `state.log[]` — last N events with type + payload
- Exposed via `GET /api/log`
- Written via `pushLog(type, payload)` throughout `dvhub/server.js`
- Console logging via `console.log` / `console.error`

## InfluxDB (Optional Time-Series Export)

**InfluxDB v2 or v3:**
- Purpose: optional export of live meter/Victron readings as line protocol
- Config: `influx.enabled`, `influx.apiVersion` (`v2` or `v3`, default `v3`), `influx.url`, `influx.db` / `influx.bucket`, `influx.token`, `influx.measurement`
- Implementation: `flushInflux()` in `dvhub/server.js`
- Auth: `Authorization: Token <token>` (v2) or `Authorization: Bearer <token>` (v3)
- Flush interval: every 10 seconds (`INFLUX_FLUSH_MS`)

## Home Automation Integrations (Outgoing Data APIs)

DVhub exposes read endpoints for external home automation systems to pull data:

**Home Assistant:**
- Endpoint: `GET /api/integration/home-assistant`
- Returns: JSON with DV control value, grid power, SOC, battery, PV, schedule, costs, pricing summary

**Loxone:**
- Endpoint: `GET /api/integration/loxone`
- Returns: same data as Home Assistant but as `key=value` plaintext lines

**EOS (Akkudoktor):**
- Read endpoint: `GET /api/integration/eos` — returns measurement data + EPEX prices in EOS format
- Write endpoint: `POST /api/integration/eos/apply` — receives optimizer result, applies `gridSetpointW`, `chargeCurrentA`, `minSocPct`
- Optimizer runs logged to telemetry store via `writeOptimizerRun()`

**EMHASS:**
- Read endpoint: `GET /api/integration/emhass` — returns `soc_init`, power values, EPEX price/timestamp arrays
- Write endpoint: `POST /api/integration/emhass/apply` — receives optimizer result, applies control targets

## CI/CD & Deployment

**Hosting:**
- Linux server with systemd (Raspberry Pi, small server, or VM)
- Install path: `/opt/dvhub` (default)

**CI Pipeline:**
- None detected in repository

**Installer:**
- `install.sh` — Bash installer that clones from GitHub, creates systemd service and dedicated user
- Git repository: `https://github.com/chloepriceless/dvhub.git`

## System Discovery

**mDNS / Bonjour:**
- Uses `multicast-dns` package in `dvhub/system-discovery.js`
- Discovers Victron devices (Cerbo GX, Venus GX) on local network via `_modbus._tcp.local` service records
- Exposed via `GET /api/discovery/systems?manufacturer=victron`

## Webhooks & Callbacks

**Incoming:**
- None (DVhub does not receive webhooks)

**Outgoing:**
- None (DVhub does not push webhooks; all integrations are pull-based)

## Environment Configuration

**Required config keys (in `config.json`):**
- `manufacturer` — device manufacturer profile (`"victron"`)
- `victron.host` — IP/hostname of Victron device
- `httpPort` — HTTP server port (default 8080)

**Optional config keys with sensitive values (redacted in API):**
- `apiToken` — static Bearer token for API auth
- `influx.token` — InfluxDB API token
- `telemetry.historyImport.vrmToken` — Victron VRM API token

**Secrets location:**
- Stored in `config.json` (at `DV_APP_CONFIG` path, default `/etc/dvhub/config.json` in production)
- No `.env` file support — all configuration is JSON-only

---

*Integration audit: 2026-03-14*
