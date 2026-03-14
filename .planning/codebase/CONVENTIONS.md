# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- `kebab-case.js` for all source modules: `small-market-automation.js`, `telemetry-store.js`, `history-runtime.js`
- `kebab-case.test.js` for all test files: `small-market-automation.test.js`, `telemetry-store.test.js`
- `kebab-name-context.test.js` for focused sub-tests of the same domain: `small-market-automation-integration.test.js`, `small-market-automation-time-format.test.js`
- Public browser scripts use `kebab-case.js` under `public/`: `app.js`, `settings.js`, `tools.js`

**Functions:**
- Exported functions: `camelCase`, verb-prefixed: `createTelemetryStore`, `buildAutomationRuleChain`, `computeAvailableEnergyKwh`, `expandChainSlots`, `filterFreeAutomationSlots`, `pickBestAutomationPlan`
- Factory functions use `create` prefix: `createTelemetryStore`, `createModbusTransport`, `createMqttTransport`, `createHistoryImportManager`, `createSerialTaskRunner`
- Builder functions use `build` prefix for value-object construction: `buildAutomationRuleChain`, `buildLiveTelemetrySamples`, `buildChainVariants`
- Private (non-exported) functions: same `camelCase`, typically descriptive verbs: `estimateSlotRevenueCt`, `ensureNegative`, `proportionalSourceShares`, `getMbConn`

**Variables:**
- `camelCase` throughout: `priceCtKwh`, `batteryCapacityKwh`, `maxDischargeW`
- Physics/unit variables include the unit as a suffix: `powerW`, `slotDurationH`, `availableKwh`, `minSocPct`, `priceCtKwh`, `priceEurMwh`
- Constants use `SCREAMING_SNAKE_CASE`: `SLOT_DURATION_HOURS`, `BERLIN_TIME_ZONE`, `FORBIDDEN_PATH_SEGMENTS`, `RUNTIME_MESSAGE_TYPES`, `SLOT_BUCKET_SECONDS`
- Env var names use `DV_` or `DVHUB_` prefix: `DV_APP_CONFIG`, `DV_DATA_DIR`, `DVHUB_PROCESS_ROLE`

**Module-level State:**
- Single mutable `state` object at module scope in `server.js`: `const state = { dvRegs, ctrl, keepalive, meter, victron, ... }`
- Exported constants declared at the top of module scope with `const`

## Code Style

**Formatting:**
- No Prettier or ESLint config file detected — style is enforced by convention/review
- 2-space indentation throughout all files
- Single quotes for strings: `'node:fs'`, `'Europe/Berlin'`, `'small_market_automation'`
- Trailing commas in multi-line object/array literals
- Arrow functions for short callbacks: `(entry) => entry.id`, `(left, right) => left - right`
- Traditional `function` keyword for named functions (both exported and private)
- Template literals only where string interpolation is needed: `` `${host}:${port}` ``

**Linting:**
- No ESLint config detected — no enforced rule set

## Import Organization

**Order:**
1. Node built-in modules with `node:` prefix: `import fs from 'node:fs'`, `import path from 'node:path'`, `import { DatabaseSync } from 'node:sqlite'`
2. Third-party packages (rare): `import mqtt from 'mqtt'`
3. Local modules with relative paths: `import { toFiniteNumber } from './util.js'`, `import { parseHHMM } from './schedule-runtime.js'`

**Module System:**
- ESM throughout: `"type": "module"` in `package.json`, all files use `import`/`export`
- No barrel files (`index.js`) — modules are imported directly
- Always use `.js` extension in import paths: `'./util.js'`, `'../telemetry-store.js'`
- `import.meta.url` used for `__dirname`/`__filename` equivalents

**Path Aliases:**
- None — all imports use relative paths

## Error Handling

**Patterns:**
- Null/undefined guard with early return: `if (!rule || typeof rule !== 'object') return false;`
- Numeric coercion via `toFiniteNumber(value, fallback)` from `dvhub/util.js` — always provide a fallback, never trust raw input
- `try/catch` blocks used at integration boundaries (file I/O, database, network)
- Async errors propagate as rejected Promises; callers use `try/finally` to clean up resources
- Error messages are plain strings: `new Error('connection closed')`, `new Error('worker message timeout')`
- Modbus exceptions surface as thrown errors with descriptive messages: `/modbus exception 2/`
- `catch {}` (empty catch) used when the failure is non-fatal and intentional: `readJson` in `app-version.js`

**Resource Cleanup:**
- `try/finally` consistently used for cleanup in test fixtures and production code:
  ```js
  try {
    // test body
  } finally {
    store.close();
  }
  ```
- Transport layers expose a `destroy()` method for teardown

## Logging

**Framework:** `console` (no external logging library)

**Patterns:**
- Production code uses `console.log` and `console.error` directly
- No structured logging format — plain text messages
- No log levels beyond `console.log` vs `console.error`

## Comments

**When to Comment:**
- Short inline comments for non-obvious constants: `export const SLOT_DURATION_HOURS = 0.25; // 15 minutes`
- JSDoc-style block comments on complex exported functions to explain intent:
  ```js
  /**
   * Generate progressive chain variants by taking 1-stage, 2-stage, … N-stage prefixes.
   * Each variant is a chain produced by buildAutomationRuleChain with that prefix of stages.
   * Optionally truncates chains to fit within an energy budget (kWh).
   */
  ```
- Section dividers in long files using `// ---` style: `// --- buildAutomationRuleChain ---`
- Module-level block comment describing module origin: `// Extrahiert aus server.js — reiner Modbus-Client`

**Language:**
- Comments and identifiers are English; user-facing labels and UI strings are German

## Function Design

**Size:** Functions are small and focused; complex logic is split into private helper functions. Large orchestration happens in `server.js`.

**Parameters:**
- Destructured named-parameter objects for functions with more than 2 args:
  ```js
  export function computeAvailableEnergyKwh({
    batteryCapacityKwh,
    currentSocPct,
    minSocPct,
    inverterEfficiencyPct = 85,
    safetyMarginPct = 5
  } = {}) { ... }
  ```
- Default parameter values declared in destructuring, not in function body
- Scalar primitives for 1-2 arg functions

**Return Values:**
- Functions return `null` (not `undefined`) when a value cannot be computed: `return null;`
- Functions return `[]` (empty array) not `null` for empty list results
- Factory functions (`create*`) return plain objects with methods — no classes

## Module Design

**Exports:**
- Named exports only; no default exports
- Constants exported with `export const`
- Functions exported with `export function`

**Barrel Files:**
- Not used — callers import directly from the source module file

**Public Browser Scripts:**
- Browser-side code in `dvhub/public/*.js` uses IIFE/namespace pattern exposing a single global:
  - `window.DVhubCommon`, `window.DVhubDashboard`, `window.DVhubSettingsShell`, `window.DVhubSetupWizard`, `window.DVhubToolsHistory`, `window.DVhubSettingsHistory`
- These scripts are tested via `node:vm` isolation in test files

---

*Convention analysis: 2026-03-14*
