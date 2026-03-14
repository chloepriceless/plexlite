# Phase 4: Optimizer Core - Research

**Researched:** 2026-03-14
**Domain:** Optimizer orchestration, external system adapters (EOS/EMHASS), plan engine, scoring
**Confidence:** HIGH

## Summary

Phase 4 builds the Optimizer module that orchestrates external optimizers (EOS, EMHASS) through pluggable adapters, normalizes their output to canonical 15-minute slot plans, scores them, and selects a winner. The architecture follows the same modular monolith pattern established in Phases 1-3: factory functions, fp-wrapped Fastify plugins, event bus integration, and node:test for testing.

The key design challenge is separating concerns: the optimizer module must NOT block the poll loop (fire-and-forget HTTP with 5s timeouts), must validate external responses against known schemas (SEC-02), and must version-pin optimizer containers (SEC-03). The existing v1 integration endpoints in gateway/routes/integration.js already provide EOS/EMHASS data exchange -- this phase elevates that to a proper adapter registry with canonical plan format, schema validation, and automatic winner selection.

**Primary recommendation:** Follow the DV module pattern exactly (factory function in index.js, fp-wrapped plugin, routes directory, state module), add three new core files: adapter-registry.js, plan-engine.js, plan-scorer.js. Use the existing telemetry-store optimizer_runs/optimizer_run_series tables for persistence. All outbound HTTP to EOS/EMHASS uses native fetch() with AbortSignal.timeout(5000).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OPT-01 | EOS integration | EOS adapter translates canonical input to EOS v1 API format, sends via fetch(), validates response against JSON schema, normalizes to 15-min slots |
| OPT-02 | EMHASS integration | EMHASS adapter does equivalent translation for EMHASS REST API (dayahead-optim action), validates and normalizes output |
| OPT-04 | Market price optimization with schedules | Plan engine receives optimization plans containing per-slot battery/grid targets; plan scorer uses configurable metric (default: economic score) |
| OPT-08 | Schedule engine (plan execution) | Plan engine stores winning plan, exposes active plan via API endpoint and event bus for Phase 6 arbitration layer to consume |
| OPT-11 | Plan scoring, comparison, winner selection | Plan scorer computes feasibility + economic + SOC scores, winner-takes-all selection, rejected plans stored for backtesting |
| SEC-02 | Adapter pattern with schema validation | Each adapter validates response against a JSON schema before normalization; malformed responses logged and rejected |
| SEC-03 | Container version pinning (never :latest) | Adapter config includes expectedVersion field; startup health check logs warning if detected version is untested |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js native fetch | built-in | HTTP calls to EOS/EMHASS | No external dependency needed; supports AbortSignal.timeout() |
| AbortSignal.timeout() | Node 18+ | 5-second HTTP timeout | Built-in, no dependency; prevents event loop blocking |
| Ajv | via Fastify | Response schema validation | Already available through Fastify; SEC-02 compliance |
| RxJS BehaviorSubject | 7.x | Active plan stream | Already in stack; enables synchronous reads and subscriptions |
| node:test | built-in | Test runner | Project convention |
| fastify-plugin (fp) | via Fastify | Plugin encapsulation | Project convention from DV module |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pino (via Fastify) | built-in | Structured logging | Adapter startup version warnings, optimizer run logging |
| node:crypto | built-in | UUID generation for run IDs | randomUUID() for optimizer run tracking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | axios/got | Extra dependency; native fetch sufficient for simple POST+GET with timeout |
| Ajv standalone | zod | Ajv already in Fastify; no additional dependency needed |
| Custom scheduler | node-cron | Optimizer runs are triggered by existing poll loop, not cron; no scheduler needed |

**Installation:**
```bash
# No new dependencies required -- everything uses existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
dvhub/modules/optimizer/
  index.js              # Module lifecycle (createOptimizerModule) -- expand existing stub
  plugin.js             # fp-wrapped Fastify plugin for route registration
  adapter-registry.js   # Adapter registration, discovery, health check
  adapters/
    eos.js              # EOS adapter: buildInput(), normalizeOutput(), healthCheck()
    emhass.js           # EMHASS adapter: buildInput(), normalizeOutput(), healthCheck()
  plan-engine.js        # Plan storage, active plan management, plan lifecycle
  plan-scorer.js        # Scoring algorithms, winner selection
  schemas/              # Ajv JSON schemas for validation
    eos-response.json   # Expected EOS optimization response structure
    emhass-response.json # Expected EMHASS response structure
    canonical-plan.json  # Internal canonical plan schema
  routes/
    optimizer-routes.js  # API endpoints: /api/optimizer/*, /api/plans/*
```

### Pattern 1: Adapter Interface Contract
**What:** Every optimizer adapter exports the same interface: `{ name, buildInput(snapshot), normalizeOutput(raw), validateResponse(raw), healthCheck() }`
**When to use:** For every new optimizer integration
**Example:**
```javascript
// Source: Project conventions from DV provider pattern (modules/dv/providers/luox.js)
export function createEosAdapter(config) {
  const baseUrl = config.baseUrl || 'http://localhost:8503';
  const expectedVersion = config.expectedVersion || '0.2.0';
  const timeoutMs = config.timeoutMs || 5000;

  return {
    name: 'eos',

    buildInput(snapshot) {
      // Translate canonical snapshot to EOS measurement format
      return {
        measurement: {
          battery_soc: [snapshot.soc / 100],
          pv_power: [snapshot.pvTotalW],
          load_power: [snapshot.loadPowerW],
          // ... EOS-specific fields
        },
        prices: snapshot.prices
      };
    },

    validateResponse(raw) {
      // Ajv schema validation against eos-response.json
      // Returns { valid: true } or { valid: false, errors: [...] }
    },

    normalizeOutput(raw) {
      // Convert EOS result to canonical 15-min slot plan
      return {
        optimizer: 'eos',
        slots: raw.result.map(slot => ({
          start: slot.start,
          end: slot.end,
          gridImportWh: slot.grid_import_wh || 0,
          gridExportWh: slot.grid_export_wh || 0,
          batteryChargeWh: slot.battery_charge_wh || 0,
          batteryDischargeWh: slot.battery_discharge_wh || 0,
          targetSocPct: slot.soc_target || 0,
          expectedProfitEur: slot.profit_eur || 0
        }))
      };
    },

    async healthCheck() {
      // GET /v1/health with timeout
      // Check version, log warning if untested
    }
  };
}
```

### Pattern 2: Fire-and-Forget with Timeout (Non-Blocking Optimizer Calls)
**What:** All outbound HTTP to optimizers uses AbortSignal.timeout(5000) and runs independently of the poll loop
**When to use:** Every optimizer HTTP call
**Example:**
```javascript
// Source: Node.js fetch API + AbortSignal.timeout (built-in since Node 18)
async function callOptimizer(adapter, snapshot, log) {
  const input = adapter.buildInput(snapshot);
  try {
    const response = await fetch(`${adapter.baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      log?.warn({ optimizer: adapter.name, status: response.status }, 'Optimizer HTTP error');
      return null;
    }
    const raw = await response.json();
    const validation = adapter.validateResponse(raw);
    if (!validation.valid) {
      log?.warn({ optimizer: adapter.name, errors: validation.errors }, 'Optimizer response validation failed');
      return null;
    }
    return adapter.normalizeOutput(raw);
  } catch (err) {
    // TimeoutError or network error -- log and continue
    log?.warn({ optimizer: adapter.name, err: err.message }, 'Optimizer call failed');
    return null;
  }
}
```

### Pattern 3: Module Lifecycle (matching DV module)
**What:** Optimizer module follows exact same lifecycle as DV module
**When to use:** Module init/destroy
**Example:**
```javascript
// Source: dvhub/modules/dv/index.js (established pattern)
export function createOptimizerModule(config) {
  const optConfig = config.modules?.optimizer || {};
  let adapterRegistry = null;
  let planEngine = null;

  return {
    name: 'optimizer',
    requires: ['gateway'],
    plugin: null,

    async init(ctx) {
      // 1. Create adapter registry with configured adapters
      // 2. Create plan engine (uses telemetry store or database adapter)
      // 3. Run adapter health checks (version warnings)
      // 4. Subscribe to event bus for optimization triggers
      // 5. Create Fastify plugin wrapper
      this.plugin = async function optimizerPluginWrapper(fastify) {
        await fastify.register(optimizerPlugin, pluginOpts);
      };
    },

    async destroy() {
      // Reverse cleanup
    }
  };
}
```

### Anti-Patterns to Avoid
- **Await optimizer calls in poll loop:** NEVER await fetch() in the measurement poll path. Optimizer calls are fire-and-forget, results processed asynchronously via callback or event bus
- **Direct hardware writes from optimizer module:** Optimizer produces plans/intents only. Hardware control deferred to Phase 6 arbitration layer
- **Optimizer-specific state in gateway:** No EOS/EMHASS-specific fields in gateway state. Canonical plan format only
- **Using :latest Docker tags:** Always version-pin in config: `{ "eos": { "image": "akkudoktor/eos:0.2.0" } }`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Custom object shape checks | Ajv (already in Fastify) | Edge cases in nested objects, type coercion, error reporting |
| HTTP timeout | Manual setTimeout + abort | AbortSignal.timeout(5000) | Built-in, handles cleanup correctly, no memory leaks |
| UUID generation | Math.random hex strings | crypto.randomUUID() | Cryptographically strong, built-in since Node 19 |
| Plan slot time alignment | Custom modular arithmetic | Reuse normalizeSlotRange from design docs | 15-min boundary alignment is error-prone with DST |

**Key insight:** The existing telemetry-store.js already has optimizer_runs and optimizer_run_series tables. Extend rather than replace. The gateway already builds eosState() and emhassState() -- extract and move into adapter modules.

## Common Pitfalls

### Pitfall 1: Blocking the Poll Loop with Optimizer HTTP
**What goes wrong:** Await-ing fetch() to EOS/EMHASS in the poll cycle blocks measurement delivery
**Why it happens:** Developer puts optimizer call inline with telemetry collection
**How to avoid:** Optimizer runs are triggered on a separate timer (e.g. every 15 min) or event-driven, never inside the poll loop. Use Promise-based fire-and-forget -- no await in the hot path
**Warning signs:** Poll interval increases when optimizer is slow; DV measurement staleness exceeds 2x pollInterval

### Pitfall 2: Trusting External Optimizer Response Format
**What goes wrong:** EOS/EMHASS update their API, field names change, response structure shifts
**Why it happens:** APIs evolve (EOS is at 0.2.x, still pre-1.0; EMHASS at 0.17.x)
**How to avoid:** Ajv schema validation on every response. Log validation failures with full raw payload for debugging. Adapter handles missing optional fields with defaults
**Warning signs:** Sporadic plan creation failures after optimizer container update

### Pitfall 3: Version Drift Between Adapter and Optimizer
**What goes wrong:** Adapter expects v0.2.0 API but container runs v0.3.0 with breaking changes
**Why it happens:** Container auto-updates or user changes tag
**How to avoid:** Health check reads optimizer version endpoint; log.warn if version not in tested set. Config has `expectedVersion` field. Never use `:latest` tag
**Warning signs:** Schema validation failures increase after container restart

### Pitfall 4: Plan Scoring Without Feasibility Check
**What goes wrong:** Infeasible plan wins because it has highest economic score
**Why it happens:** SOC exceeds battery limits, grid import exceeds connection capacity
**How to avoid:** Two-phase scoring: feasibility check first (binary pass/fail), then economic scoring only for feasible plans. Infeasible plans stored but never selected as winner
**Warning signs:** Hardware commands fail because plan requests impossible setpoints

### Pitfall 5: DST Boundary Errors in Slot Alignment
**What goes wrong:** 15-minute slots misalign during DST transitions (Europe/Berlin: last Sunday of March and October)
**Why it happens:** Naive Date arithmetic without timezone awareness
**How to avoid:** All slot boundaries in UTC internally. Display conversion uses Intl.DateTimeFormat with Europe/Berlin timezone (existing project convention)
**Warning signs:** Missing or duplicate slots around 2:00 AM on DST transition days

### Pitfall 6: Moving Integration Endpoints Breaks External Systems
**What goes wrong:** EOS/EMHASS that call DVhub's /api/integration/eos endpoint stop working
**Why it happens:** Routes move from gateway to optimizer module
**How to avoid:** Keep existing /api/integration/eos and /api/integration/emhass routes in gateway for backward compatibility. New optimizer module adds new /api/optimizer/* endpoints. Phase 7 deployment docs can migrate external callers
**Warning signs:** 404 errors from external optimizers after upgrade

## Code Examples

Verified patterns from the existing codebase:

### Canonical Plan Slot (from design doc, adapted to project conventions)
```javascript
// Source: docs/plans/2026-03-10-dvhub-optimizer-orchestrator.md (adapted)
export function buildCanonicalPlanSlot(input = {}) {
  return {
    start: input.start,
    end: input.end,
    gridImportWh: Number(input.gridImportWh || 0),
    gridExportWh: Number(input.gridExportWh || 0),
    batteryChargeGridWh: Number(input.batteryChargeGridWh || 0),
    batteryChargePvWh: Number(input.batteryChargePvWh || 0),
    batteryDischargeLoadWh: Number(input.batteryDischargeLoadWh || 0),
    batteryDischargeExportWh: Number(input.batteryDischargeExportWh || 0),
    evChargeWh: Number(input.evChargeWh || 0),
    targetSocPct: Number(input.targetSocPct || 0),
    expectedProfitEur: Number(input.expectedProfitEur || 0),
    meta: input.meta || null
  };
}
```

### Existing EOS State Builder (for adapter reference)
```javascript
// Source: dvhub/modules/gateway/index.js line ~1755 (eosState function)
// This is the current format EOS expects from DVhub:
{
  measurement: {
    battery_soc: [soc / 100],   // EOS expects 0-1 fraction
    battery_power: [batteryPowerW],
    grid_import_w: [gridImportW],
    grid_export_w: [gridExportW],
    pv_power: [pvTotalW],
    load_power: [loadPowerW]
  },
  victron: {
    grid_setpoint_w: gridSetpointW,
    min_soc_pct: minSocPct,
    self_consumption_w: selfConsumptionW
  },
  prices: epexPriceArray()   // Array of { ts, ct_kwh }
}
```

### Existing EMHASS State Builder (for adapter reference)
```javascript
// Source: dvhub/modules/gateway/index.js line ~1797 (emhassState function)
{
  soc_init: soc / 100,         // EMHASS expects 0-1 fraction
  battery_power_w: batteryPowerW,
  pv_power_w: pvTotalW,
  load_power_w: selfConsumptionW,
  grid_power_w: gridTotalW,
  prices: epexPriceArray(),     // EPEX prices
  timestamps: [...]             // ISO timestamps for price slots
}
```

### Module Plugin Pattern (from DV module)
```javascript
// Source: dvhub/modules/dv/plugin.js
import fp from 'fastify-plugin';
import { createOptimizerRoutes } from './routes/optimizer-routes.js';

export default fp(async function optimizerPlugin(fastify, opts) {
  const { planEngine, adapterRegistry, scorer } = opts;
  const registerRoutes = createOptimizerRoutes({ planEngine, adapterRegistry, scorer });
  registerRoutes(fastify);
}, { name: 'optimizer-plugin' });
```

### Winner Selection (from design doc)
```javascript
// Source: docs/plans/2026-03-10-dvhub-optimizer-orchestrator.md (Task 7)
export function chooseWinningPlan(candidates = []) {
  // Filter to feasible plans only
  const feasible = candidates.filter(c => c.score?.feasible !== false);
  if (feasible.length === 0) return { active: null, rejected: candidates };

  const ranked = feasible.sort((a, b) =>
    Number(b.score?.totalScore || 0) - Number(a.score?.totalScore || 0)
  );
  return {
    active: ranked[0],
    rejected: [...ranked.slice(1), ...candidates.filter(c => c.score?.feasible === false)]
  };
}
```

## EOS API Reference (Current)

| Endpoint | Method | Purpose | Phase 4 Use |
|----------|--------|---------|-------------|
| `/v1/health` | GET | Health check | Adapter startup version check |
| `/v1/measurement/data` | PUT | Push measurement data | Adapter sends live state |
| `/v1/prediction/update` | POST | Trigger prediction update | Before optimization run |
| `/v1/config` | GET/PUT | Configuration | Read optimizer version |
| `/optimize` | POST | Run optimization (deprecated) | Legacy endpoint, check v1 alternative |
| `/v1/energy-management/optimization/solution` | GET | Get optimization result | Fetch plan after run |
| `/v1/energy-management/plan` | GET | Get energy management plan | Fetch active plan |

**EOS Version:** 0.2.x (pre-1.0, API still evolving)
**Docker Image:** `akkudoktor/eos:0.2.0` (pin to tested version)
**Default Port:** 8503

## EMHASS API Reference (Current)

| Endpoint | Method | Purpose | Phase 4 Use |
|----------|--------|---------|-------------|
| `/action/dayahead-optim` | POST | Run day-ahead optimization | Primary optimization trigger |
| `/action/naive-mpc-optim` | POST | Run MPC optimization | Alternative optimization |
| `/action/publish-data` | POST | Publish optimization results | Get results to HA sensors |

**EMHASS Version:** 0.17.x
**Docker Image:** `ghcr.io/davidusb-geek/emhass:0.17.0` (pin to tested version)
**Default Port:** 5000

**Note:** EMHASS is primarily designed for Home Assistant integration. DVhub adapter must handle EMHASS's action-based API (POST params as JSON) rather than a RESTful resource API. The `--costfun profit` parameter should be default for revenue optimization use cases.

## State of the Art

| Old Approach (v1 monolith) | Current Approach (v2 modular) | Impact |
|---------------------------|-------------------------------|--------|
| EOS/EMHASS push results to DVhub via /apply endpoints | DVhub pulls from optimizers via adapter pattern | DVhub controls optimization lifecycle |
| Results stored as flat JSON in optimizer_runs | Canonical plan with typed slot fields | Enables scoring, comparison, backtesting |
| No schema validation on incoming data | Ajv validation on every response | SEC-02 compliance, API drift protection |
| Single optimizer result applied immediately | Multi-optimizer scoring and winner selection | OPT-11 plan comparison |
| Container tags unmanaged | Version pinning with health check warnings | SEC-03 compliance |

**Note on existing /api/integration/* endpoints:** These endpoints are currently in the gateway module and are used by external EOS/EMHASS instances to push data TO DVhub. The Phase 4 optimizer module adds the reverse direction: DVhub pulls FROM optimizers. Both directions coexist. The existing endpoints must NOT be removed (backward compatibility).

## Open Questions

1. **EOS v1 vs v2 API**
   - What we know: EOS docs show `/optimize` (deprecated) and `/v1/energy-management/*` (new). Current DVhub v1 uses the push model (EOS pushes to DVhub).
   - What's unclear: Exact JSON schema for `/v1/energy-management/optimization/solution` response. EOS is pre-1.0, format may change.
   - Recommendation: Build adapter against current docs, include schema validation. Make adapter version-aware. Test with real EOS 0.2.x container.

2. **EMHASS Output Format**
   - What we know: EMHASS uses action-based API. Output goes to HA sensors by default.
   - What's unclear: Exact JSON structure returned by `/action/dayahead-optim` when called standalone (without HA).
   - Recommendation: Build adapter with flexible response parsing. Test with real EMHASS container. Schema starts permissive, tightens once format is confirmed.

3. **Optimization Trigger Timing**
   - What we know: Optimizers should run periodically (e.g., every 15 min or hourly). Must not block poll loop.
   - What's unclear: Optimal trigger cadence for a residential PV+battery system.
   - Recommendation: Configurable interval with default 15 min. Trigger also on significant state change (e.g., EPEX price update, large SoC change).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none -- convention: `cd dvhub && node --test` |
| Quick run command | `node --test dvhub/test/optimizer-*.test.js` |
| Full suite command | `cd dvhub && node --test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-01 | EOS adapter builds input, validates response, normalizes output | unit | `node --test dvhub/test/optimizer-adapter-eos.test.js -x` | Wave 0 |
| OPT-02 | EMHASS adapter builds input, validates response, normalizes output | unit | `node --test dvhub/test/optimizer-adapter-emhass.test.js -x` | Wave 0 |
| OPT-04 | Plan engine stores plans with slot-level targets | unit | `node --test dvhub/test/optimizer-plan-engine.test.js -x` | Wave 0 |
| OPT-08 | Active plan exposed via API and event bus | integration | `node --test dvhub/test/optimizer-routes.test.js -x` | Wave 0 |
| OPT-11 | Scorer computes scores, chooseWinningPlan selects highest feasible | unit | `node --test dvhub/test/optimizer-plan-scorer.test.js -x` | Wave 0 |
| SEC-02 | Schema validation rejects malformed optimizer responses | unit | `node --test dvhub/test/optimizer-adapter-eos.test.js -x` | Wave 0 |
| SEC-03 | Version check logs warning for untested versions | unit | `node --test dvhub/test/optimizer-adapter-registry.test.js -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test dvhub/test/optimizer-*.test.js`
- **Per wave merge:** `cd dvhub && node --test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `dvhub/test/optimizer-adapter-eos.test.js` -- covers OPT-01, SEC-02
- [ ] `dvhub/test/optimizer-adapter-emhass.test.js` -- covers OPT-02
- [ ] `dvhub/test/optimizer-adapter-registry.test.js` -- covers SEC-03
- [ ] `dvhub/test/optimizer-plan-engine.test.js` -- covers OPT-04, OPT-08
- [ ] `dvhub/test/optimizer-plan-scorer.test.js` -- covers OPT-11
- [ ] `dvhub/test/optimizer-routes.test.js` -- covers OPT-08 (API)
- [ ] `dvhub/test/optimizer-module-lifecycle.test.js` -- covers module init/destroy

## Sources

### Primary (HIGH confidence)
- Existing codebase: `dvhub/modules/dv/index.js` -- module lifecycle pattern
- Existing codebase: `dvhub/modules/gateway/routes/integration.js` -- current EOS/EMHASS integration
- Existing codebase: `dvhub/modules/gateway/index.js` -- eosState() and emhassState() builders
- Existing codebase: `dvhub/telemetry-store.js` -- optimizer_runs and optimizer_run_series tables
- Existing codebase: `dvhub/core/database/adapter.js` -- database adapter pattern
- Design doc: `docs/plans/2026-03-10-dvhub-optimizer-orchestrator-design.md` -- 6-layer architecture
- Design doc: `docs/plans/2026-03-10-dvhub-optimizer-orchestrator.md` -- 12-task implementation plan
- Design doc: `docs/plans/2026-03-10-dvhub-postgres-schema-blueprint.md` -- opt.* schema tables

### Secondary (MEDIUM confidence)
- EOS API docs: https://akkudoktor-eos.readthedocs.io/en/latest/ -- REST API endpoints, version 0.2.x
- EMHASS docs: https://emhass.readthedocs.io/ -- Action-based API, version 0.17.x

### Tertiary (LOW confidence)
- EOS exact response schema for `/v1/energy-management/optimization/solution` -- not fully documented, needs container testing
- EMHASS standalone (non-HA) response format -- not fully documented, needs container testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses only existing project dependencies, no new installs
- Architecture: HIGH -- follows established DV module pattern exactly, design docs provide detailed guidance
- Pitfalls: HIGH -- based on existing codebase analysis and well-understood async/timeout patterns
- EOS API details: MEDIUM -- docs available but pre-1.0 API, exact schemas need container validation
- EMHASS API details: MEDIUM -- docs available but standalone mode less documented than HA integration

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- stack is stable; EOS/EMHASS APIs may evolve)
