# Phase 1: Foundation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** Orchestrator conversation (architecture discussion)

<domain>
## Phase Boundary

Phase 1 decomposes the monolithic `server.js` (~2800 lines) into a module-aware bootstrap (~200-250 lines) with a working Gateway core. It establishes the module registry, RxJS event bus, Fastify HTTP server, Device HAL, and user role system. All existing functionality must be preserved -- no regressions.

This phase does NOT implement the DV module or Optimizer module as separate modules yet -- it extracts the Gateway foundation and creates the infrastructure (module registry, event bus, HAL interface) that Phases 2-4 will build upon.

</domain>

<decisions>
## Implementation Decisions

### Module System
- Modular monolith within a single Node.js process (no microservices, no separate processes)
- Module registry with lifecycle hooks: `init()`, `destroy()`, `routes()`, `events()`
- Modules live in `dvhub/modules/{gateway,dv,optimizer}/`
- Config-driven activation: Gateway always active, DV and Optimizer toggled in config
- At least one of DV or Optimizer must be active alongside Gateway

### Internal Event Bus: RxJS
- RxJS BehaviorSubject for telemetry streams -- enables synchronous reads via `getValue()` for DV real-time path
- **ARCHITECTURAL RULE:** DV measurement path must remain synchronous in-process. No async boundaries between poll loop and Modbus slave endpoint. Latency budget: 2x pollInterval.
- RxJS Subjects for control intents, events, status changes
- RxJS operators (throttleTime, distinctUntilChanged, combineLatest) for complex event flows
- No external message broker needed

### HTTP Framework: Fastify
- Fastify replaces raw `node:http` (~50 if/else routing branches in current server.js)
- Ajv schema validation on all API endpoints (built into Fastify)
- Pino structured logging (built into Fastify, replaces console.log)
- @fastify/websocket for WebSocket endpoint (wraps `ws` library)
- Route registration per module: each module exports its routes, Fastify registers them
- Existing API endpoints must respond identically to v1 behavior

### WebSocket: ws via @fastify/websocket
- Standard WebSocket protocol (no Socket.io -- overkill for LAN+VPN use case)
- Auth token validation on WebSocket handshake
- User role filtering on broadcast (readonly/user/admin see different data)
- Reconnect logic in browser (~15 lines, trivial)
- Broadcast helper (~8 lines) with role-based filtering

### User Roles & Authentication
- Three roles: `readonly` (view only), `user` (can control dashboard), `admin` (all settings)
- Auth token passed as query param in WebSocket handshake URL
- Fastify auth middleware on HTTP routes
- Designed for VPN remote access (iPhone via VPN tunnel)
- Grundstruktur in Phase 1, full RBAC can be refined later

### Device HAL (Hardware Abstraction Layer)
- Driver interface: `readMeter()`, `writeControl()`, `checkHealth()`
- Manufacturer configs loaded from external JSON files (existing `hersteller/victron.json` pattern formalized)
- Victron driver as first implementation through HAL interface
- No brand-specific code in business logic -- all hardware access through HAL
- Deye driver prepared as interface but implementation deferred

### Modbus TCP Proxy Security
- IP AllowList enforcement (configurable per interface)
- Buffer size caps to prevent oversized requests
- Specific interface binding (not 0.0.0.0 by default)
- These are security-critical and must be in Phase 1 (existing vulnerability)

### Database
- Phase 1 does NOT change the database -- existing SQLite stays for now
- Database Adapter Pattern infrastructure is prepared but TimescaleDB migration happens in Phase 2
- Phase 1 focuses on module architecture, not data architecture

### Claude's Discretion
- Internal file/folder structure within modules (index.js, routes.js, etc.)
- Fastify plugin organization pattern
- RxJS Subject naming conventions
- Error handling strategy within module lifecycle
- Config file format for module activation (YAML vs JSON vs env)
- Testing strategy for module boundaries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Architecture
- `docs/plans/2026-03-10-dvhub-data-architecture-masterlist.md` -- Data architecture with table schemas, MVP tables, and Phase 2 extensions
- `docs/plans/2026-03-10-dvhub-optimizer-orchestrator-design.md` -- 6-layer orchestrator architecture (relevant for module boundary design)
- `docs/plans/2026-03-10-dvhub-postgres-schema-blueprint.md` -- PostgreSQL schema blueprint (4 schemas: shared, dv, opt, exec) -- reference for table prefix convention

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` -- Current monolithic architecture analysis
- `.planning/codebase/STRUCTURE.md` -- File structure and code organization
- `.planning/codebase/STACK.md` -- Current technology stack
- `.planning/codebase/CONCERNS.md` -- Known issues and technical debt
- `.planning/codebase/INTEGRATIONS.md` -- External system integrations

### Research
- `.planning/research/STACK.md` -- Technology recommendations (Fastify, RxJS, Preact+HTM)
- `.planning/research/ARCHITECTURE.md` -- Architecture patterns, decomposition strategy
- `.planning/research/PITFALLS.md` -- 15 domain-specific pitfalls with prevention strategies
- `.planning/research/FEATURES.md` -- Feature landscape and MVP prioritization

### Current Server
- `server.js` -- The monolithic file to decompose (~2800 lines)
- `hersteller/victron.json` -- Existing manufacturer config pattern (becomes HAL reference)

</canonical_refs>

<specifics>
## Specific Ideas

- The existing `server.js` poll loop that reads Modbus and publishes to the DV Modbus slave must remain in the same synchronous execution path -- this is the DV real-time constraint
- `hersteller/victron.json` already contains register mappings -- formalize this into the Device HAL driver interface
- Fastify's plugin system naturally maps to the module concept -- each module can be a Fastify plugin
- RxJS BehaviorSubject for `meter$`, `soc$`, `gridPower$` etc. provides both push (subscribe) and pull (getValue) semantics
- The ~50 if/else branches in server.js for routing can be extracted 1:1 into Fastify route handlers
- Pino logger replaces all console.log/warn/error calls with structured JSON logging

</specifics>

<deferred>
## Deferred Ideas

- Database migration to TimescaleDB -- Phase 2
- DV module extraction -- Phase 3
- Optimizer module extraction -- Phase 4
- Deye driver implementation -- Phase 3 or later (needs real hardware)
- Full RBAC with fine-grained permissions -- later phases
- Setup wizard UI for module activation -- Phase 8
- MQTT auto-discovery for Home Assistant -- later

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-14 via orchestrator conversation*
