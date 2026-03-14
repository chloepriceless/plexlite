# Phase 1: Foundation - Research

**Researched:** 2026-03-14
**Domain:** Node.js modular monolith decomposition, Fastify HTTP framework, RxJS event bus, Device HAL
**Confidence:** HIGH

## Summary

Phase 1 decomposes the monolithic `server.js` (~2800 lines) into a module-aware bootstrap (~200-250 lines) with a working Gateway core. The key technologies are Fastify 5 (replacing raw `node:http` with proper route registration, Ajv validation, and Pino logging), RxJS 7 (BehaviorSubject-based event bus for synchronous DV reads via `getValue()`), and `@fastify/websocket` (WebSocket endpoint with auth token validation and role-based filtering). The Device HAL formalizes the existing `hersteller/victron.json` pattern into a driver interface (`readMeter()`, `writeControl()`, `checkHealth()`). The module registry provides lifecycle hooks (`init()`, `destroy()`, `routes()`, `events()`) with config-driven activation.

The critical constraint is the DV real-time path: the measurement poll loop and the DV Modbus slave endpoint must remain synchronous within the same event loop. RxJS BehaviorSubject solves this by providing `getValue()` for zero-latency synchronous reads while also enabling reactive push subscriptions. All existing HTTP API endpoints must respond identically to v1 behavior -- no regressions.

**Primary recommendation:** Use Fastify 5.x as the HTTP foundation with modules registered as Fastify plugins, RxJS 7.x BehaviorSubjects as the internal event bus for telemetry streams, and a Strategy-pattern Device HAL with the Victron driver as the first implementation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Modular monolith within a single Node.js process (no microservices, no separate processes)
- Module registry with lifecycle hooks: `init()`, `destroy()`, `routes()`, `events()`
- Modules live in `dvhub/modules/{gateway,dv,optimizer}/`
- Config-driven activation: Gateway always active, DV and Optimizer toggled in config
- At least one of DV or Optimizer must be active alongside Gateway
- RxJS BehaviorSubject for telemetry streams -- synchronous reads via `getValue()` for DV real-time path
- ARCHITECTURAL RULE: DV measurement path must remain synchronous in-process. No async boundaries between poll loop and Modbus slave endpoint. Latency budget: 2x pollInterval
- RxJS Subjects for control intents, events, status changes
- RxJS operators (throttleTime, distinctUntilChanged, combineLatest) for complex event flows
- Fastify replaces raw `node:http` (~50 if/else routing branches in current server.js)
- Ajv schema validation on all API endpoints (built into Fastify)
- Pino structured logging (built into Fastify, replaces console.log)
- @fastify/websocket for WebSocket endpoint (wraps `ws` library)
- Route registration per module: each module exports its routes, Fastify registers them
- Existing API endpoints must respond identically to v1 behavior
- Standard WebSocket protocol (no Socket.io)
- Auth token validation on WebSocket handshake
- User role filtering on broadcast (readonly/user/admin see different data)
- Three roles: `readonly`, `user`, `admin`
- Auth token passed as query param in WebSocket handshake URL
- Fastify auth middleware on HTTP routes
- Device HAL driver interface: `readMeter()`, `writeControl()`, `checkHealth()`
- Manufacturer configs loaded from external JSON files (formalize existing `hersteller/victron.json`)
- Victron driver as first implementation through HAL interface
- Deye driver prepared as interface but implementation deferred
- No brand-specific code in business logic
- Modbus TCP proxy: IP AllowList, buffer size caps, specific interface binding
- Phase 1 does NOT change the database -- existing SQLite stays
- Database Adapter Pattern infrastructure prepared but TimescaleDB migration in Phase 2

### Claude's Discretion
- Internal file/folder structure within modules (index.js, routes.js, etc.)
- Fastify plugin organization pattern
- RxJS Subject naming conventions
- Error handling strategy within module lifecycle
- Config file format for module activation (YAML vs JSON vs env)
- Testing strategy for module boundaries

### Deferred Ideas (OUT OF SCOPE)
- Database migration to TimescaleDB -- Phase 2
- DV module extraction -- Phase 3
- Optimizer module extraction -- Phase 4
- Deye driver implementation -- Phase 3 or later (needs real hardware)
- Full RBAC with fine-grained permissions -- later phases
- Setup wizard UI for module activation -- Phase 8
- MQTT auto-discovery for Home Assistant -- later
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | Three modules: Gateway, DV, Optimizer | Module registry with factory functions, lifecycle hooks, dependency declaration. Gateway always active, DV/Optimizer toggled by config. Modules as Fastify plugins. |
| ARCH-02 | Gateway always present, at least one other active | Config validation at startup enforces constraint. Module registry checks dependencies before init. |
| ARCH-04 | Clear module boundaries with defined internal APIs | RxJS BehaviorSubject streams as inter-module data API. Per-module state ownership. Read-only cross-module access via `getValue()`. |
| ARCH-05 | Shared endpoints where universal, own where needed | Fastify plugin encapsulation. Gateway registers shared routes (/api/status, /api/config). Modules register prefixed routes (/api/dv/*, /api/optimizer/*). |
| GW-01 | Universal device connectivity (ModbusTCP, MQTT, HTTP, Webhooks) | Device HAL abstracts transport. Existing transport-modbus.js and transport-mqtt.js wrapped in HAL interface. |
| GW-02 | Externalized manufacturer configs | Existing `hersteller/victron.json` formalized into HAL driver config. JSON files loaded at startup. |
| GW-03 | Support Victron, Deye, generic Modbus/MQTT | Victron driver fully implemented. Deye driver interface defined but implementation deferred. Generic driver skeleton. |
| GW-05 | Messpunkt management (capture, process, store, retrieve) | RxJS BehaviorSubject streams for each measurement point (`meter$`, `soc$`, `gridPower$`). Existing telemetry buffer preserved. |
| GW-06 | Control signal forwarding to connected devices | Device HAL `writeControl()` interface. Existing `applyControlTarget()` wrapped through HAL. |
| GW-07 | IP AllowList and optional token auth per interface | Modbus TCP proxy gets IP allowlist check, buffer size cap (1024 bytes), configurable interface binding. |
| SEC-01 | Modbus TCP Proxy security (AllowList, binding, caps) | Implementation in Modbus server startup. Connection-level IP check before any frame processing. |
| SEC-04 | User roles: readonly, user, admin with permissions | Role enum, role-based route guards via Fastify preHandler hooks, role-filtered WebSocket broadcasts. |
| SEC-05 | Auth token for WebSocket handshake (VPN remote access) | @fastify/websocket preValidation hook validates token from query string. Connection rejected before upgrade if invalid. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.8.x | HTTP framework, route registration, Ajv validation, Pino logging | 5x faster than Express, built-in validation + logging, plugin encapsulation maps to module pattern. 1.9M weekly npm downloads. |
| rxjs | ^7.8.2 | Internal event bus, BehaviorSubject telemetry streams | Synchronous reads via `getValue()` for DV real-time path. Push + pull semantics. Operators (throttleTime, distinctUntilChanged, combineLatest) for complex flows. |
| @fastify/websocket | ^11.x | WebSocket endpoint | Wraps `ws@8`, integrates with Fastify hooks for auth. Same port as HTTP. |
| @fastify/static | ^9.x | Static file serving for frontend | Replaces custom `serveStatic()` in server.js. Fastify 5 compatible. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastify-plugin | ^5.x | Break plugin encapsulation for shared decorators | When a module plugin needs to expose decorators (e.g., auth, db) to the parent scope |
| pino-pretty | ^13.x | Human-readable log output in development | Dev dependency only. Never in production. |
| mqtt | ^5.10.0 | MQTT transport for Victron Venus OS | Existing optionalDependency. When `victron.transport = "mqtt"` |
| multicast-dns | ^7.2.5 | mDNS device discovery | Existing dependency. Victron system discovery. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fastify | Express 5 | Express lacks built-in validation and logging. Fastify's plugin system maps better to module pattern. |
| RxJS BehaviorSubject | Node.js EventEmitter | EventEmitter lacks synchronous current-value reads. No `getValue()` equivalent. Would require separate state object. |
| @fastify/websocket | Socket.io | Socket.io adds 60KB+ client, proprietary protocol, auto-reconnect logic. Overkill for LAN+VPN use case. |
| @fastify/static | Custom serveStatic() | Custom code is ~30 lines but lacks ETag, Range, caching headers. @fastify/static handles all edge cases. |

**Installation:**
```bash
cd dvhub
npm install fastify@^5.8.0 @fastify/websocket@^11.0.0 @fastify/static@^9.0.0 rxjs@^7.8.2 fastify-plugin@^5.0.0
npm install --save-dev pino-pretty@^13.0.0
```

## Architecture Patterns

### Recommended Project Structure

```
dvhub/
  server.js              # Bootstrap (~200 lines): create Fastify, load config, register modules, start
  core/
    module-registry.js    # Module loader, lifecycle management, dependency validation
    event-bus.js          # RxJS Subject/BehaviorSubject factory, typed stream registry
    auth.js               # Fastify auth plugin (preHandler hook, role checking)
    config.js             # Config loading, module config merging (wraps existing config-model.js)
  modules/
    gateway/
      index.js            # Module entry: exports factory function with lifecycle hooks
      plugin.js           # Fastify plugin: registers routes, decorators
      device-hal.js       # HAL interface + driver loading
      drivers/
        victron.js         # Victron driver implementation (wraps existing transport)
        deye.js            # Deye driver interface (stub)
      telemetry.js         # Telemetry collection, BehaviorSubject streams
      modbus-proxy.js      # Modbus TCP proxy server with security (AllowList, caps)
      routes/
        status.js          # /api/status, /api/config routes
        control.js         # /api/control/* routes
        meter.js           # /api/meter/* routes
        schedule.js        # /api/schedule/* routes
        integration.js     # /api/integration/* routes (EOS/EMHASS apply endpoints)
        websocket.js       # WebSocket upgrade + broadcast with role filtering
    dv/
      index.js             # DV module stub (Phase 3 implementation)
    optimizer/
      index.js             # Optimizer module stub (Phase 4 implementation)
  hersteller/
    victron.json           # Existing manufacturer config (unchanged)
  config-model.js          # Existing config schema (preserved, imported by core/config.js)
  telemetry-store.js       # Existing SQLite telemetry (preserved, unchanged)
  transport-modbus.js      # Existing Modbus transport (preserved, used by Victron driver)
  transport-mqtt.js        # Existing MQTT transport (preserved, used by Victron driver)
  # ... all other existing modules preserved as-is
```

### Pattern 1: Module as Fastify Plugin

**What:** Each module is a Fastify plugin registered via `fastify.register()`. The module factory function creates RxJS streams and registers routes. Fastify's encapsulation ensures modules are isolated.

**When to use:** Every module uses this pattern.

**Example:**
```javascript
// dvhub/modules/gateway/index.js
import fp from 'fastify-plugin';
import { BehaviorSubject, Subject } from 'rxjs';

export function createGatewayModule(config) {
  // Create telemetry streams
  const meter$ = new BehaviorSubject(null);
  const soc$ = new BehaviorSubject(null);
  const gridPower$ = new BehaviorSubject(null);

  return {
    name: 'gateway',
    requires: [],

    // Expose streams for other modules (synchronous reads)
    streams: { meter$, soc$, gridPower$ },

    // Fastify plugin
    plugin: fp(async function gatewayPlugin(fastify, opts) {
      // Register routes
      fastify.get('/api/status', statusHandler);
      fastify.post('/api/config', { schema: configSchema }, configHandler);

      // Start poll loop
      fastify.addHook('onReady', async () => { startPollLoop(); });
      fastify.addHook('onClose', async () => { stopPollLoop(); });
    }),

    async init(ctx) { /* load HAL driver, init transport */ },
    async destroy() { /* close transport, complete subjects */ },
  };
}
```

### Pattern 2: RxJS BehaviorSubject Event Bus

**What:** Telemetry data flows through RxJS BehaviorSubjects. The Gateway module publishes, other modules subscribe or read synchronously via `getValue()`.

**When to use:** All inter-module telemetry data. DV module reads `meter$.getValue()` for real-time Modbus slave responses.

**Example:**
```javascript
// dvhub/core/event-bus.js
import { BehaviorSubject, Subject } from 'rxjs';

export function createEventBus() {
  const streams = new Map();
  const events = new Subject(); // generic event channel

  return {
    // Typed telemetry streams (BehaviorSubject for sync reads)
    createStream(name, initialValue) {
      const subject = new BehaviorSubject(initialValue);
      streams.set(name, subject);
      return subject;
    },

    getStream(name) {
      return streams.get(name);
    },

    // Synchronous read of current value (for DV real-time path)
    getValue(name) {
      const stream = streams.get(name);
      if (!stream) throw new Error(`Stream "${name}" not registered`);
      return stream.getValue();
    },

    // Generic events (fire-and-forget)
    emit(event) { events.next(event); },
    on$(type) { return events.pipe(filter(e => e.type === type)); },

    destroy() {
      for (const s of streams.values()) s.complete();
      events.complete();
    }
  };
}
```

### Pattern 3: Device HAL with Strategy Pattern

**What:** A driver interface abstracts hardware communication. Each manufacturer gets a driver that translates between the canonical interface and device-specific protocols.

**When to use:** All hardware reads/writes go through HAL. No brand-specific code in business logic.

**Example:**
```javascript
// dvhub/modules/gateway/device-hal.js
import { readFile } from 'node:fs/promises';

/**
 * @typedef {Object} DeviceDriver
 * @property {string} manufacturer
 * @property {() => Promise<MeterReading>} readMeter
 * @property {(target: string, value: number) => Promise<WriteResult>} writeControl
 * @property {() => Promise<HealthStatus>} checkHealth
 */

export async function createDeviceHal(config, transport) {
  const manufacturer = config.manufacturer || 'victron';
  const profilePath = new URL(`../../hersteller/${manufacturer}.json`, import.meta.url);
  const profile = JSON.parse(await readFile(profilePath, 'utf-8'));

  // Dynamic import of manufacturer-specific driver
  const { createDriver } = await import(`./drivers/${manufacturer}.js`);
  return createDriver({ transport, profile, config });
}
```

### Pattern 4: Fastify Auth Middleware with Role Filtering

**What:** A preHandler hook validates auth tokens and attaches user role to the request. Route handlers check role for authorization. WebSocket broadcast filters messages by role.

**When to use:** All protected API routes and WebSocket connections.

**Example:**
```javascript
// dvhub/core/auth.js
import fp from 'fastify-plugin';
import crypto from 'node:crypto';

export default fp(async function authPlugin(fastify, opts) {
  const { apiToken, roles } = opts;

  fastify.decorateRequest('userRole', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth if no token configured
    if (!apiToken) { request.userRole = 'admin'; return; }

    const token = request.headers.authorization?.replace('Bearer ', '')
      || request.query.token;

    if (!token) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    // Timing-safe comparison
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(apiToken);
    if (tokenBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }

    request.userRole = resolveRole(token, roles);
  });
});
```

### Pattern 5: Module Registry with Lifecycle Management

**What:** A registry that holds all modules, validates dependencies, and manages lifecycle (init in dependency order, destroy in reverse order).

**When to use:** At application bootstrap in `server.js`.

**Example:**
```javascript
// dvhub/core/module-registry.js
export function createModuleRegistry() {
  const modules = new Map();

  return {
    register(mod) {
      modules.set(mod.name, mod);
    },

    async initAll(ctx) {
      // Validate dependencies
      for (const [name, mod] of modules) {
        for (const dep of (mod.requires || [])) {
          if (!modules.has(dep)) {
            throw new Error(`Module "${name}" requires "${dep}" which is not registered`);
          }
        }
      }

      // Init in registration order (Gateway first)
      for (const mod of modules.values()) {
        await mod.init(ctx);
      }
    },

    async destroyAll() {
      // Destroy in reverse order
      const mods = [...modules.values()].reverse();
      for (const mod of mods) {
        await mod.destroy();
      }
    },

    get(name) { return modules.get(name); },
    getAll() { return [...modules.values()]; },
  };
}
```

### Anti-Patterns to Avoid

- **Shared mutable state object:** The current `state` object must NOT be passed wholesale to modules. Each module owns its state slice. Cross-module data flows through RxJS streams.
- **Direct hardware writes from business logic:** All hardware writes go through the Device HAL, never `transport.mbWriteSingle()` directly from route handlers.
- **Optimizer/DV-specific code in Gateway routes:** Each module registers its own routes. Gateway only registers shared/common routes.
- **Synchronous file writes on hot path:** Replace `fs.writeFileSync` with async writes + debounce for config and energy state persistence.
- **Breaking DV real-time path with async boundaries:** The poll loop -> BehaviorSubject.next() -> getValue() path must stay synchronous within a single event loop tick.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP routing + validation | if/else chain with manual URL parsing | Fastify route registration + Ajv schemas | 50 if/else branches to maintain, no validation, no logging |
| JSON logging | console.log with string formatting | Pino (built into Fastify) | Structured JSON, log levels, request IDs, redaction |
| WebSocket server | Raw `ws` + manual upgrade handling | @fastify/websocket | Auth hooks, same-port, lifecycle management |
| Static file serving | Custom `serveStatic()` helper | @fastify/static | ETag, Range, caching headers, MIME types |
| Observable streams with sync reads | Custom EventEmitter + state cache | RxJS BehaviorSubject | getValue() for sync reads, operators for complex flows, completion semantics |
| Plugin encapsulation | Manual scope isolation | Fastify register() + fastify-plugin | DAG-based encapsulation, decoration scoping |

**Key insight:** The existing codebase has hand-rolled solutions for routing (~50 if/else), logging (console.log), WebSocket (raw node:http upgrade), and static serving (custom helper). Fastify provides all of these with less code and better behavior.

## Common Pitfalls

### Pitfall 1: DV Real-Time Path Broken by Module Boundaries
**What goes wrong:** Introducing async boundaries between poll loop and DV Modbus slave response. If the DV module reads stale data, the Direktvermarkter receives incorrect measurements (contractual compliance risk).
**Why it happens:** Module decomposition adds event propagation delays or copied state.
**How to avoid:** Use RxJS BehaviorSubject -- `pollMeter()` calls `meter$.next(reading)`, DV Modbus slave calls `meter$.getValue()`. Both are synchronous within the same process. Add staleness check: if `lastPollTs` is older than 2x pollInterval, log warning.
**Warning signs:** `getValue()` returns null or stale data. DV Modbus slave response timestamp > 10s behind poll timestamp.

### Pitfall 2: Fastify Plugin Encapsulation Confusion
**What goes wrong:** Decorators, hooks, or routes registered inside an encapsulated plugin are invisible to sibling plugins. Auth hooks don't apply to module routes.
**Why it happens:** Fastify's encapsulation model creates child contexts by default. Without `fastify-plugin`, parent scope doesn't see child decorations.
**How to avoid:** Use `fastify-plugin` (fp) for cross-cutting concerns (auth, db access). Use plain register for module-specific routes. Shared plugins registered at top level before module plugins.
**Warning signs:** `request.userRole` is undefined in module route handlers. Auth hook doesn't fire for module routes.

### Pitfall 3: WebSocket Connection Drops Without Cleanup
**What goes wrong:** WebSocket connections accumulate in the broadcast list. Disconnected clients cause `send()` errors that crash the broadcast loop.
**Why it happens:** No `close` event handler removes the connection from the active set.
**How to avoid:** Track active connections in a Set. Remove on `close` event. Wrap `send()` in try/catch. Use `socket.readyState === WebSocket.OPEN` check before sending.
**Warning signs:** Memory growth over time. "WebSocket is not open" errors in logs.

### Pitfall 4: RxJS BehaviorSubject Mutable References
**What goes wrong:** A consumer calls `getValue()` and mutates the returned object, affecting all other consumers.
**Why it happens:** BehaviorSubject stores and returns the exact reference passed to `next()`.
**How to avoid:** Always pass new objects to `next()` (spread operator or Object.assign). Document that `getValue()` returns a read-only snapshot. Consider `Object.freeze()` in development.
**Warning signs:** State appears to change without `next()` being called. Intermittent wrong values.

### Pitfall 5: Route Migration Regressions
**What goes wrong:** Migrating from raw `node:http` if/else routing to Fastify changes response behavior (different status codes, headers, body format).
**Why it happens:** Fastify adds Content-Type, Content-Length headers automatically. Error responses use Fastify's format. Security headers from the old SECURITY_HEADERS constant may be missing.
**How to avoid:** Write comparison tests: hit the same endpoints on v1 and v2, diff responses. Preserve SECURITY_HEADERS via Fastify `onSend` hook. Verify all existing endpoints one-by-one.
**Warning signs:** Dashboard or DV provider reports connection errors after migration.

### Pitfall 6: Modbus TCP Proxy Port Conflict
**What goes wrong:** Both old server.js and new Fastify server try to bind to the same Modbus proxy port.
**Why it happens:** The Modbus TCP proxy is a raw `net.Server`, not part of the HTTP server. During migration, both may attempt to start.
**How to avoid:** Extract the Modbus proxy into its own module (`modbus-proxy.js`) with explicit lifecycle. Start only once, after config is loaded. Bind to specific interface per config.
**Warning signs:** `EADDRINUSE` errors on Modbus proxy port.

## Code Examples

### Bootstrap server.js (~200 lines target)

```javascript
// dvhub/server.js (new bootstrap)
import Fastify from 'fastify';
import { loadConfigFile } from './config-model.js';
import { createEventBus } from './core/event-bus.js';
import { createModuleRegistry } from './core/module-registry.js';
import authPlugin from './core/auth.js';
import { createGatewayModule } from './modules/gateway/index.js';

const CONFIG_PATH = process.env.DV_APP_CONFIG || new URL('config.json', import.meta.url).pathname;
const { rawConfig, effectiveConfig: cfg } = loadConfigFile(CONFIG_PATH);

// Create Fastify instance with Pino logging
const fastify = Fastify({
  logger: {
    level: cfg.logLevel || 'info',
    // pino-pretty only in development
    ...(process.env.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z' } }
    })
  }
});

// Create shared infrastructure
const eventBus = createEventBus();
const registry = createModuleRegistry();

// Register cross-cutting plugins
await fastify.register(authPlugin, { apiToken: cfg.apiToken });
await fastify.register(import('@fastify/static'), {
  root: new URL('public', import.meta.url).pathname, prefix: '/'
});
await fastify.register(import('@fastify/websocket'));

// Register modules based on config
const gateway = createGatewayModule(cfg);
registry.register(gateway);

if (cfg.modules?.dv?.enabled) {
  const { createDvModule } = await import('./modules/dv/index.js');
  registry.register(createDvModule(cfg));
}
if (cfg.modules?.optimizer?.enabled) {
  const { createOptimizerModule } = await import('./modules/optimizer/index.js');
  registry.register(createOptimizerModule(cfg));
}

// Validate: at least one of DV or Optimizer must be active
// (Gateway is always active)

// Initialize all modules
const ctx = { fastify, eventBus, config: cfg, rawConfig };
await registry.initAll(ctx);

// Register module Fastify plugins
for (const mod of registry.getAll()) {
  if (mod.plugin) await fastify.register(mod.plugin, { prefix: '' });
}

// Start server
const address = await fastify.listen({ port: cfg.httpPort || 3000, host: '0.0.0.0' });
fastify.log.info(`DVhub v2 listening on ${address}`);

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down...`);
    await registry.destroyAll();
    await fastify.close();
    process.exit(0);
  });
}
```

### WebSocket Broadcast with Role Filtering

```javascript
// dvhub/modules/gateway/routes/websocket.js
export function registerWebSocketRoutes(fastify, { eventBus, config }) {
  const clients = new Set();

  fastify.get('/ws', { websocket: true,
    preValidation: async (request, reply) => {
      // Auth token from query string
      const token = request.query.token;
      if (config.apiToken && token !== config.apiToken) {
        reply.code(401).send({ error: 'Invalid token' });
        return;
      }
      request.userRole = resolveRoleFromToken(token, config);
    }
  }, (socket, request) => {
    const client = { socket, role: request.userRole };
    clients.add(client);

    socket.on('close', () => clients.delete(client));
    socket.on('error', () => clients.delete(client));
  });

  // Broadcast helper with role filtering
  function broadcast(data, minRole = 'readonly') {
    const roleHierarchy = { readonly: 0, user: 1, admin: 2 };
    const minLevel = roleHierarchy[minRole] || 0;
    const message = JSON.stringify(data);

    for (const client of clients) {
      if (roleHierarchy[client.role] >= minLevel &&
          client.socket.readyState === 1 /* OPEN */) {
        try { client.socket.send(message); } catch { clients.delete(client); }
      }
    }
  }

  return { broadcast, getClientCount: () => clients.size };
}
```

### Modbus TCP Proxy with Security

```javascript
// dvhub/modules/gateway/modbus-proxy.js
import net from 'node:net';

export function createModbusProxy({ config, eventBus, log }) {
  const MAX_BUFFER_SIZE = 1024; // Modbus TCP frame cap
  const allowList = new Set(config.modbusAllowList || []);
  const bindHost = config.modbusListenHost || '127.0.0.1'; // NOT 0.0.0.0 by default
  const bindPort = config.modbusListenPort || 1502;

  const server = net.createServer((socket) => {
    const remoteIp = socket.remoteAddress?.replace('::ffff:', '');

    // IP AllowList enforcement
    if (allowList.size > 0 && !allowList.has(remoteIp)) {
      log.warn({ remoteIp }, 'Modbus connection rejected: IP not in allowlist');
      socket.destroy();
      return;
    }

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Buffer size cap
      if (buffer.length > MAX_BUFFER_SIZE) {
        log.warn({ remoteIp, bufferSize: buffer.length }, 'Modbus buffer size exceeded');
        socket.destroy();
        return;
      }

      // Process complete Modbus TCP frames...
      processModbusFrame(buffer, socket, eventBus);
      buffer = Buffer.alloc(0);
    });
  });

  return {
    start() { server.listen(bindPort, bindHost); },
    stop() { return new Promise(r => server.close(r)); },
  };
}
```

## State of the Art

| Old Approach (v1) | Current Approach (v2) | When Changed | Impact |
|--------------------|-----------------------|--------------|--------|
| Raw `node:http` with if/else routing | Fastify 5 with route registration | Phase 1 | Eliminates ~50 if/else branches, adds validation + logging |
| `console.log` / `console.error` | Pino structured JSON logging | Phase 1 | Request IDs, log levels, redaction, file transport |
| Custom WebSocket via `ws` + raw upgrade | @fastify/websocket with auth hooks | Phase 1 | Same port, lifecycle management, preValidation auth |
| Node.js EventEmitter (planned in early research) | RxJS BehaviorSubject | Phase 1 decision | Synchronous getValue() for DV path, operators for complex flows |
| Global `state` object | Per-module state + RxJS streams | Phase 1 | Module isolation, testability, no god object |
| Custom `serveStatic()` | @fastify/static | Phase 1 | ETag, Range, caching, MIME types |

**Deprecated/outdated from earlier research:**
- Earlier STACK.md research recommended Node.js EventEmitter as the internal bus. This was superseded by the user's decision to use RxJS BehaviorSubject for the synchronous `getValue()` capability.
- Earlier STACK.md recommended "no framework" (raw node:http). This was superseded by the decision to use Fastify for proper validation, logging, and route management.

## Open Questions

1. **Config format for module activation**
   - What we know: Current config is JSON (`config.json`). Modules need an activation flag.
   - What's unclear: Whether to add a `modules` section to existing config.json or use a separate file.
   - Recommendation: Add a `modules` section to existing `config.json` for simplicity. Example: `{ "modules": { "dv": { "enabled": true }, "optimizer": { "enabled": true, "backends": ["eos"] } } }`. JSON matches existing config format; no reason to introduce YAML.

2. **RxJS Subject naming conventions**
   - What we know: BehaviorSubjects need names for the stream registry.
   - Recommendation: Use domain-prefixed names with `$` suffix convention: `gateway:meter$`, `gateway:soc$`, `gateway:gridPower$`, `gateway:pvPower$`. Use colon as namespace separator.

3. **Error handling in module lifecycle**
   - What we know: Current server.js catches errors defensively and never crashes.
   - Recommendation: Module `init()` failures should prevent startup (fail-fast). Module runtime errors (poll loop failures) should be caught and logged, never crash. Use Fastify's `onError` hook for route handler errors. Module `destroy()` should always complete (catch and log errors internally).

4. **Frontend WebSocket reconnect**
   - What we know: Current frontend uses polling. New WebSocket needs reconnect logic.
   - Recommendation: Simple reconnect in ~15 lines: on `close`, retry with exponential backoff (1s, 2s, 4s, max 30s). No library needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test` + `node:assert`) |
| Config file | None (uses `node --test` directly) |
| Quick run command | `cd dvhub && node --test test/module-registry.test.js` |
| Full suite command | `cd dvhub && node --test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Module registry creates and manages three module types | unit | `node --test test/module-registry.test.js` | No - Wave 0 |
| ARCH-02 | Config validation rejects zero non-Gateway modules | unit | `node --test test/module-registry.test.js` | No - Wave 0 |
| ARCH-04 | RxJS streams provide cross-module data access | unit | `node --test test/event-bus.test.js` | No - Wave 0 |
| ARCH-05 | Module routes register under correct prefixes | integration | `node --test test/fastify-routes.test.js` | No - Wave 0 |
| GW-01 | Device HAL wraps Modbus + MQTT transports | unit | `node --test test/device-hal.test.js` | No - Wave 0 |
| GW-02 | Manufacturer config loads from JSON | unit | `node --test test/manufacturer-profile.test.js` | Yes |
| GW-03 | Victron driver reads meter via HAL interface | unit | `node --test test/victron-driver.test.js` | No - Wave 0 |
| GW-05 | BehaviorSubject getValue() returns current meter reading | unit | `node --test test/event-bus.test.js` | No - Wave 0 |
| GW-06 | HAL writeControl() forwards to transport | unit | `node --test test/device-hal.test.js` | No - Wave 0 |
| GW-07 | Modbus proxy rejects IPs not in allowlist | unit | `node --test test/modbus-proxy.test.js` | No - Wave 0 |
| SEC-01 | Modbus proxy enforces buffer size cap | unit | `node --test test/modbus-proxy.test.js` | No - Wave 0 |
| SEC-04 | Auth hook attaches role to request | unit | `node --test test/auth.test.js` | No - Wave 0 |
| SEC-05 | WebSocket rejects unauthenticated connections | integration | `node --test test/websocket-auth.test.js` | No - Wave 0 |
| (regression) | Existing API endpoints respond identically | integration | `node --test test/api-regression.test.js` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd dvhub && node --test test/{changed-module}.test.js`
- **Per wave merge:** `cd dvhub && node --test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `dvhub/test/module-registry.test.js` -- covers ARCH-01, ARCH-02
- [ ] `dvhub/test/event-bus.test.js` -- covers ARCH-04, GW-05
- [ ] `dvhub/test/device-hal.test.js` -- covers GW-01, GW-06
- [ ] `dvhub/test/victron-driver.test.js` -- covers GW-03
- [ ] `dvhub/test/modbus-proxy.test.js` -- covers GW-07, SEC-01
- [ ] `dvhub/test/auth.test.js` -- covers SEC-04
- [ ] `dvhub/test/websocket-auth.test.js` -- covers SEC-05
- [ ] `dvhub/test/fastify-routes.test.js` -- covers ARCH-05
- [ ] `dvhub/test/api-regression.test.js` -- covers v1 API compatibility
- No new framework install needed -- `node:test` is already used by existing tests

## Sources

### Primary (HIGH confidence)
- [Fastify Official Docs - Plugins](https://fastify.dev/docs/latest/Reference/Plugins/) - Plugin registration, encapsulation model
- [Fastify Official Docs - Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) - Ajv schema validation
- [Fastify Official Docs - Logging](https://fastify.dev/docs/latest/Reference/Logging/) - Pino integration
- [Fastify V5 Migration Guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) - Breaking changes, Node 20+ requirement
- [RxJS Official - BehaviorSubject](https://rxjs.dev/api/index/class/BehaviorSubject) - getValue() API, synchronous reads
- [@fastify/websocket GitHub](https://github.com/fastify/fastify-websocket) - WebSocket plugin, preValidation hooks for auth
- [@fastify/static npm](https://www.npmjs.com/package/@fastify/static) - v9.0.0 for Fastify 5

### Secondary (MEDIUM confidence)
- [Fastify Fundamentals - Plugins and Encapsulation](https://blog.platformatic.dev/fastify-fundamentals-a-quick-guide-to-plugins-and-encapsulation-with-platformatic) - Plugin encapsulation patterns
- [Better Stack - Fastify WebSockets Guide](https://betterstack.com/community/guides/scaling-nodejs/fastify-websockets/) - WebSocket auth patterns
- [Better Stack - Pino Logging Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) - Pino configuration
- [LearnRxJS - BehaviorSubject](https://www.learnrxjs.io/learn-rxjs/subjects/behaviorsubject) - Usage patterns
- [LearnRxJS - throttleTime](https://www.learnrxjs.io/learn-rxjs/operators/filtering/throttletime) - Operator usage
- [LearnRxJS - distinctUntilChanged](https://www.learnrxjs.io/learn-rxjs/operators/filtering/distinctuntilchanged) - Operator usage

### Tertiary (LOW confidence)
- None -- all findings verified through official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm/official docs with current versions
- Architecture: HIGH - Patterns verified against Fastify plugin model, RxJS BehaviorSubject API, and existing codebase analysis
- Pitfalls: HIGH - DV real-time constraint well-documented in project research; Fastify encapsulation model verified in official docs

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- all libraries are stable releases)
