# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- JavaScript (ES Modules) - All application code: server, business logic, transports, UI

**Secondary:**
- SQL - PostgreSQL migration scripts in `db/postgres/migrations/`
- HTML/CSS - Static frontend in `dvhub/public/`
- Bash - Installer and Modbus helper scripts (`install.sh`, `20-dv-modbus.sh`)

## Runtime

**Environment:**
- Node.js >=18.0.0 (required — uses `node:sqlite` from Node 22.5+, `DatabaseSync` API)
- ES Module format (`"type": "module"` in `dvhub/package.json`)
- No transpilation or bundling — raw JS files served directly

**Package Manager:**
- npm (lockfile not present in repo — `package.json` only defines `optionalDependencies` and `dependencies`)
- Lockfile: not committed

## Frameworks

**Core:**
- None — application is built on raw Node.js built-in modules only (`node:http`, `node:net`, `node:fs`, `node:crypto`, `node:sqlite`, `node:zlib`)
- No Express, Fastify, Koa, or similar HTTP framework

**Testing:**
- Node.js built-in test runner (`node --test`) — no Jest, Vitest, or Mocha
- Test files located in `dvhub/test/`

**Build/Dev:**
- None — no build step, no bundler, no TypeScript compilation
- Start command: `node server.js` (from `dvhub/`)

## Key Dependencies

**Critical:**
- `mqtt` ^5.10.0 (optionalDependency) — MQTT transport for Victron Venus OS; loaded via dynamic `import('mqtt')` in `dvhub/transport-mqtt.js`, only needed when `victron.transport = "mqtt"` is configured
- `multicast-dns` ^7.2.5 — mDNS-based Victron system discovery in `dvhub/system-discovery.js`

**Infrastructure:**
- `node:sqlite` (Node built-in, 22.5+) — internal telemetry time-series storage via `DatabaseSync` in `dvhub/telemetry-store.js`
- `node:net` — raw Modbus TCP client (`dvhub/transport-modbus.js`) and Modbus TCP proxy server (`dvhub/server.js`)
- `node:crypto` — timing-safe Bearer token auth comparison in `dvhub/server.js`
- `globalThis.fetch` (Node 18+ built-in) — used for all outbound HTTP requests (EPEX, VRM API, energy-charts, Bundesnetzagentur, InfluxDB)

## Configuration

**Environment:**
- `DV_APP_CONFIG` — path to config JSON file (default: `dvhub/config.json`)
- `DV_ENABLE_SERVICE_ACTIONS` — set to `1` to enable systemd restart commands via API
- `DV_SERVICE_NAME` — systemd service name (default: `dvhub.service`)
- `DV_SERVICE_USE_SUDO` — set to `0` to skip `sudo` for `systemctl` calls
- `DV_DATA_DIR` — override directory for persistent data files (telemetry DB, reference-data cache)
- `DVHUB_ENABLE_RUNTIME_WORKER` — set to `1` to split into web + runtime-worker processes
- `DVHUB_PROCESS_ROLE` — explicit process role: `web`, `runtime-worker`, or `monolith` (default)

**Config File:**
- `dvhub/config.json` — runtime config (JSON). See `dvhub/config.example.json` for full schema
- Key sections: `manufacturer`, `httpPort`, `modbusListenPort`, `victron`, `schedule`, `epex`, `influx`, `telemetry`, `userEnergyPricing`, `scan`
- Config is validated and merged with manufacturer defaults from `dvhub/hersteller/victron.json`
- Config model defined in `dvhub/config-model.js`

**Build:**
- No build configuration files — no `tsconfig.json`, `webpack.config.js`, `vite.config.js`, etc.

## Platform Requirements

**Development:**
- Node.js 22.5+ (required for `node:sqlite` / `DatabaseSync` API)
- npm for dependency installation

**Production:**
- Linux with systemd (install.sh installs as `dvhub.service`)
- Install directory: `/opt/dvhub` (default)
- Config directory: `/etc/dvhub` (default)
- Data directory: `/var/lib/dvhub` (default)
- Service user: `dvhub` (dedicated system user created by installer)
- GitHub source: `https://github.com/chloepriceless/dvhub.git`

---

*Stack analysis: 2026-03-14*
