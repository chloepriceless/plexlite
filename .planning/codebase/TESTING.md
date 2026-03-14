# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no external framework
- Node.js v18+ required (`"engines": { "node": ">=18.0.0" }`)
- `node:sqlite` (Node.js built-in) used directly in database tests

**Assertion Library:**
- `node:assert/strict` — Node.js built-in strict assertions

**Run Commands:**
```bash
cd dvhub && node --test          # Run all tests in dvhub/test/
```

No watch mode or coverage command configured. Test output goes to stdout.

## Test File Organization

**Locations:**
- Primary tests: `dvhub/test/*.test.js` (co-located under a `test/` subdirectory)
- Repo-level tests: `test/*.test.js` — for install script and README validation

**Naming:**
- `{subject}.test.js` — tests for a single module: `schedule-runtime.test.js`, `telemetry-store.test.js`
- `{subject}-{aspect}.test.js` — focused sub-area tests for one module: `small-market-automation-integration.test.js`, `small-market-automation-time-format.test.js`
- `{domain}-{layer}.test.js` — cross-cutting domain tests: `history-runtime.test.js`, `telemetry-runtime.test.js`

**Structure:**
```
dvhub/
├── test/
│   ├── app-version.test.js
│   ├── bnetza-applicable-values.test.js
│   ├── branding.test.js
│   ├── config-telemetry.test.js
│   ├── dashboard-chart-selection.test.js
│   ├── dashboard-min-soc-inline-control.test.js
│   ├── dashboard-price-chart-focus-band.test.js
│   ├── dv-control-readback-runtime.test.js
│   ├── energy-charts-market-values.test.js
│   ├── epex-summary-runtime.test.js
│   ├── history-import.test.js
│   ├── history-page.test.js
│   ├── history-runtime.test.js
│   ├── manufacturer-profile.test.js
│   ├── runtime-performance.test.js
│   ├── runtime-process-boundary.test.js
│   ├── schedule-runtime.test.js
│   ├── settings-history-import.test.js
│   ├── settings-pricing-periods.test.js
│   ├── settings-pv-plants.test.js
│   ├── settings-shell.test.js
│   ├── setup-wizard.test.js
│   ├── small-market-automation.test.js
│   ├── small-market-automation-integration.test.js
│   ├── small-market-automation-time-format.test.js
│   ├── sun-times-cache.test.js
│   ├── system-discovery.test.js
│   ├── telemetry-runtime.test.js
│   ├── telemetry-store.test.js
│   ├── tools-history-backfill.test.js
│   ├── transport-modbus.test.js
│   └── user-energy-pricing-runtime.test.js
test/
├── install-script.test.js
└── readme-installation.test.js
```

## Test Structure

**Suite Organization:**

There are no `describe` blocks. Each test is a flat top-level `test()` call. Related tests are grouped by comment sections:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomationRuleChain, computeAvailableEnergyKwh } from '../small-market-automation.js';

// --- buildAutomationRuleChain ---

test('buildAutomationRuleChain caps stage power at the global max discharge', () => {
  assert.deepEqual(
    buildAutomationRuleChain({ maxDischargeW: -18000, stages: [...] }),
    [{ powerW: -18000, slots: 1 }, { powerW: -8000, slots: 1 }]
  );
});

// --- computeAvailableEnergyKwh ---

test('computeAvailableEnergyKwh ...', () => { ... });
```

**Test Names:**
- Sentence-style descriptions in English stating the behaviour: `'buildAutomationRuleChain caps stage power at the global max discharge'`
- Names describe the specific scenario, not just the function: `'computeDynamicAutomationMinSocPct returns automationMin before sunset'`

**Setup / Teardown:**
- No `before`/`after` hooks; setup is done inline in each test
- `try/finally` for resource teardown (stores, servers, workers):
  ```js
  test('...', () => {
    const store = createTelemetryStore({ dbPath: createTempDbPath() });
    try {
      // assertions
    } finally {
      store.close();
    }
  });
  ```

## Mocking

**Framework:** No mock library. All doubles are hand-written plain objects or functions.

**Patterns:**

*Dependency injection via function parameters:*
```js
// Production function accepts an optional fetchImpl
createEnergyChartsMarketValueService({ store, fetchImpl: successfulFetchFixture })
```

*Inline async stub:*
```js
const fetchImpl = async (url) => {
  calls.push(url);
  return { ok: true, async json() { return [...]; } };
};
```

*Real TCP server for transport tests* (`dvhub/test/transport-modbus.test.js`):
```js
function startModbusServer(handler) {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.on('data', (chunk) => {
        const response = handler(chunk);
        if (response) socket.write(response);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, async close() {...} }));
  });
}
```

*`node:vm` sandbox for browser-side scripts:*
```js
function loadSettingsShell() {
  const source = fs.readFileSync(settingsPath, 'utf8');
  const sandbox = {
    console,
    globalThis: {},
    window: { DVhubCommon: {}, addEventListener() {}, setTimeout() {} }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'settings.js' });
  return sandbox.DVhubSettingsShell;
}
```

*`extractFunction` helper for testing private functions inside `server.js`:*
```js
function extractFunction(source, name) {
  // Parses brace-balanced function body from source text
  // Used in: epex-summary-runtime.test.js, user-energy-pricing-runtime.test.js, dv-control-readback-runtime.test.js
}
const helpers = loadPricingHelpers(); // vm.runInNewContext with extracted snippets
```

**What to Mock:**
- External HTTP fetch calls: replace with an inline async function
- File system operations that require temp directories: use `fs.mkdtempSync`
- Worker/process boundaries: use the real `fork` via `startRuntimeWorker` but in an isolated environment
- `Date.now()` / wall time: inject via a `now` parameter or a `FakeDate` subclass in vm sandbox

**What NOT to Mock:**
- SQLite database (use a real temp file: `fs.mkdtempSync` + `node:sqlite` `DatabaseSync`)
- Node.js built-in modules (`fs`, `path`, `net`, etc.)
- Pure domain logic (tested directly without any doubles)

## Fixtures and Factories

**Test Data:**

Inline factory helper functions defined at the top of each test file:

```js
// dvhub/test/small-market-automation.test.js
const SLOT_MS = 15 * 60 * 1000;
const BASE_TS = Date.parse('2026-03-13T14:00:00Z');
function slotAt(index, ctKwh) {
  return { ts: BASE_TS + index * SLOT_MS, ct_kwh: ctKwh };
}

// dvhub/test/small-market-automation-integration.test.js
function slotAt(iso, ctKwh = 0) {
  return { ts: Date.parse(iso), ct_kwh: ctKwh };
}
```

Store fixtures use real SQLite in temp dirs:
```js
function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dvhub-telemetry-'));
  return path.join(dir, 'telemetry.sqlite');
}
```

Config fixtures use `createDefaultConfig()` and write a temp JSON file to disk for server.js import:
```js
// dvhub/test/system-discovery.test.js
const config = createDefaultConfig();
fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
process.env.DV_APP_CONFIG = configPath;
```

**Location:** All fixtures are inline per test file — no shared fixtures directory.

## Coverage

**Requirements:** None enforced. No coverage tooling configured.

**View Coverage:**
Not configured.

## Test Types

**Unit Tests:**
- Core domain logic tested directly with no I/O: `dvhub/test/small-market-automation.test.js`, `dvhub/test/schedule-runtime.test.js`, `dvhub/test/telemetry-runtime.test.js`
- Browser-side helpers extracted via `node:vm` sandbox: `dvhub/test/settings-shell.test.js`, `dvhub/test/setup-wizard.test.js`, `dvhub/test/dashboard-price-chart-focus-band.test.js`
- Private server functions tested via `extractFunction` + `node:vm`: `dvhub/test/epex-summary-runtime.test.js`, `dvhub/test/user-energy-pricing-runtime.test.js`, `dvhub/test/dv-control-readback-runtime.test.js`

**Integration Tests:**
- Real SQLite database: `dvhub/test/telemetry-store.test.js`, `dvhub/test/history-import.test.js`
- Real TCP socket server: `dvhub/test/transport-modbus.test.js`
- Real child process (forked worker): `dvhub/test/runtime-process-boundary.test.js`
- Real mDNS discovery with injected providers: `dvhub/test/system-discovery.test.js`
- Full server.js module loaded into a test process: `dvhub/test/system-discovery.test.js`

**E2E Tests:**
- Not used

**Shell/Script Tests:**
- `test/install-script.test.js` — validates `install.sh` text patterns using `assert.match`
- `test/readme-installation.test.js` — validates README installation instructions

## Common Patterns

**Async Testing:**
```js
test('...', async () => {
  const server = await startModbusServer(handler);
  const transport = createModbusTransport();
  try {
    await assert.rejects(
      () => transport.mbWriteSingle({ ... }),
      /modbus exception 2/
    );
  } finally {
    await transport.destroy();
    await server.close();
  }
});
```

**Worker / Process Boundary Testing:**
```js
function waitForWorkerMessage(worker, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('worker message timeout')); }, 2000);
    function handleMessage(message) { if (!predicate(message)) return; cleanup(); resolve(message); }
    function handleExit(code, signal) { cleanup(); reject(new Error(`worker exited...`)); }
    function cleanup() { clearTimeout(timeout); worker.off('message', handleMessage); worker.off('exit', handleExit); }
    worker.on('message', handleMessage);
    worker.on('exit', handleExit);
  });
}
```

**Error Testing:**
```js
// Assertion of thrown errors
await assert.rejects(
  () => transport.mbWriteSingle({ ... }),
  /modbus exception 2/   // regex matched against error message
);
```

**Snapshot-style deep equality:**
```js
assert.deepEqual(
  buildAutomationRuleChain({ maxDischargeW: -18000, stages: [...] }),
  [{ powerW: -18000, slots: 1 }, { powerW: -8000, slots: 1 }]
);
```

**Regex-based text assertions (install/README tests):**
```js
assert.match(source, /APP_DIR="\$\{APP_DIR:-\$INSTALL_DIR\/dvhub\}"/, 'description of requirement');
assert.doesNotMatch(source, /legacy_pattern/, 'must not keep legacy pattern');
```

---

*Testing analysis: 2026-03-14*
