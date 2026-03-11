# DVhub Optimizer Orchestrator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first production-ready orchestration layer in DVhub that can ingest normalized forecasts, run EOS and EMHASS in parallel through a canonical input/output model, score both plans, and automatically activate the better one.

**Architecture:** Extend DVhub around its existing telemetry and integration surfaces by adding a canonical optimizer domain model, forecast ingestion layer, optimizer run persistence, score-based plan selection, and an execution-facing active-plan runtime. Build the system incrementally behind small, testable modules instead of expanding `server.js` further.

**Tech Stack:** Node.js, existing DVhub HTTP server, SQLite telemetry store, plain JS modules, built-in test runner

---

### Task 1: Add a canonical optimizer domain model

**Files:**
- Create: `dvhub/optimizer-model.js`
- Create: `dvhub/test/optimizer-model.test.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSlotRange,
  buildCanonicalPlanSlot,
  validateCanonicalPlan
} from '../optimizer-model.js';

test('normalizeSlotRange aligns timestamps to 15 minute slot boundaries', () => {
  const range = normalizeSlotRange({
    start: '2026-03-10T10:07:00.000Z',
    end: '2026-03-10T11:02:00.000Z',
    resolutionSeconds: 900
  });

  assert.equal(range.start, '2026-03-10T10:00:00.000Z');
  assert.equal(range.end, '2026-03-10T11:15:00.000Z');
});

test('validateCanonicalPlan accepts a physically plausible slot', () => {
  const result = validateCanonicalPlan({
    slots: [
      buildCanonicalPlanSlot({
        start: '2026-03-10T10:00:00.000Z',
        end: '2026-03-10T10:15:00.000Z',
        gridImportWh: 500,
        batteryChargeGridWh: 300,
        batteryChargePvWh: 100,
        targetSocPct: 42
      })
    ]
  });

  assert.equal(result.ok, true);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-model.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function normalizeSlotRange({ start, end, resolutionSeconds = 900 }) {
  const stepMs = resolutionSeconds * 1000;
  const startMs = Math.floor(new Date(start).getTime() / stepMs) * stepMs;
  const endMs = Math.ceil(new Date(end).getTime() / stepMs) * stepMs;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    resolutionSeconds
  };
}

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
    meta: input.meta || null
  };
}

export function validateCanonicalPlan(plan = {}) {
  const slots = Array.isArray(plan.slots) ? plan.slots : [];
  const invalid = slots.find((slot) => !slot.start || !slot.end || Number(slot.targetSocPct) < 0 || Number(slot.targetSocPct) > 100);
  return invalid ? { ok: false, error: 'invalid_slot' } : { ok: true };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-model.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/optimizer-model.js dvhub/test/optimizer-model.test.js dvhub/server.js
git commit -m "feat: add canonical optimizer model"
```

### Task 2: Add forecast ingestion and canonical forecast snapshots

**Files:**
- Create: `dvhub/forecast-runtime.js`
- Create: `dvhub/test/forecast-runtime.test.js`
- Modify: `dvhub/telemetry-runtime.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForecastSeries } from '../forecast-runtime.js';

test('normalizeForecastSeries expands provider data into 15 minute slots', () => {
  const rows = normalizeForecastSeries({
    kind: 'pv',
    values: [
      { start: '2026-03-10T10:00:00.000Z', end: '2026-03-10T11:00:00.000Z', valueW: 4000 }
    ],
    resolutionSeconds: 900
  });

  assert.equal(rows.length, 4);
  assert.equal(rows[0].valueW, 4000);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/forecast-runtime.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function normalizeForecastSeries({ kind, values = [], resolutionSeconds = 900 }) {
  const out = [];
  for (const value of values) {
    const startMs = new Date(value.start).getTime();
    const endMs = new Date(value.end).getTime();
    for (let ts = startMs; ts < endMs; ts += resolutionSeconds * 1000) {
      out.push({
        kind,
        start: new Date(ts).toISOString(),
        end: new Date(ts + resolutionSeconds * 1000).toISOString(),
        valueW: Number(value.valueW || 0),
        source: value.source || 'import'
      });
    }
  }
  return out;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/forecast-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/forecast-runtime.js dvhub/test/forecast-runtime.test.js dvhub/telemetry-runtime.js dvhub/server.js
git commit -m "feat: add canonical forecast ingestion"
```

### Task 3: Add optimizer input snapshot builder

**Files:**
- Create: `dvhub/optimizer-input.js`
- Create: `dvhub/test/optimizer-input.test.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptimizerInputSnapshot } from '../optimizer-input.js';

test('buildOptimizerInputSnapshot returns canonical assets, live state, market data, and forecasts', () => {
  const snapshot = buildOptimizerInputSnapshot({
    liveState: { soc: 55, batteryPowerW: -1200 },
    market: { prices: [{ start: '2026-03-10T10:00:00.000Z', eurKwh: 0.18 }] },
    forecasts: { pv: [{ start: '2026-03-10T10:00:00.000Z', valueW: 3200 }], load: [] },
    assets: { batteryUsableKwh: 13.5 }
  });

  assert.equal(snapshot.assets.batteryUsableKwh, 13.5);
  assert.equal(snapshot.liveState.soc, 55);
  assert.equal(snapshot.market.prices.length, 1);
  assert.equal(snapshot.forecasts.pv.length, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-input.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function buildOptimizerInputSnapshot({ assets = {}, liveState = {}, market = {}, forecasts = {}, ev = {} } = {}) {
  return {
    createdAt: new Date().toISOString(),
    assets,
    liveState,
    market,
    forecasts: {
      pv: Array.isArray(forecasts.pv) ? forecasts.pv : [],
      load: Array.isArray(forecasts.load) ? forecasts.load : [],
      ev: Array.isArray(forecasts.ev) ? forecasts.ev : []
    },
    ev
  };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-input.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/optimizer-input.js dvhub/test/optimizer-input.test.js dvhub/server.js
git commit -m "feat: add optimizer input snapshots"
```

### Task 4: Add EOS and EMHASS adapter modules

**Files:**
- Create: `dvhub/optimizer-adapter-eos.js`
- Create: `dvhub/optimizer-adapter-emhass.js`
- Create: `dvhub/test/optimizer-adapter-eos.test.js`
- Create: `dvhub/test/optimizer-adapter-emhass.test.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEosPayload, normalizeEosPlan } from '../optimizer-adapter-eos.js';

test('buildEosPayload maps canonical snapshot to EOS structures', () => {
  const payload = buildEosPayload({
    liveState: { soc: 50, batteryPowerW: 0, gridImportW: 0, gridExportW: 0, pvTotalW: 1000, loadPowerW: 800 },
    market: { prices: [{ start: '2026-03-10T10:00:00.000Z', eurKwh: 0.12 }] }
  });

  assert.equal(Array.isArray(payload.measurement.battery_soc), true);
});

test('normalizeEosPlan returns canonical plan slots', () => {
  const plan = normalizeEosPlan({ optimizer: 'eos', slots: [] });
  assert.equal(plan.optimizer, 'eos');
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test dvhub/test/optimizer-adapter-eos.test.js dvhub/test/optimizer-adapter-emhass.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function buildEosPayload(snapshot = {}) {
  const live = snapshot.liveState || {};
  const prices = snapshot.market?.prices || [];
  return {
    measurement: {
      battery_soc: [Number(live.soc || 0) / 100],
      battery_power: [Number(live.batteryPowerW || 0)],
      grid_import_w: [Number(live.gridImportW || 0)],
      grid_export_w: [Number(live.gridExportW || 0)],
      pv_power: [Number(live.pvTotalW || 0)],
      load_power: [Number(live.loadPowerW || 0)]
    },
    prices
  };
}

export function normalizeEosPlan(result = {}) {
  return {
    optimizer: 'eos',
    slots: Array.isArray(result.slots) ? result.slots : []
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test dvhub/test/optimizer-adapter-eos.test.js dvhub/test/optimizer-adapter-emhass.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/optimizer-adapter-eos.js dvhub/optimizer-adapter-emhass.js dvhub/test/optimizer-adapter-eos.test.js dvhub/test/optimizer-adapter-emhass.test.js dvhub/server.js
git commit -m "feat: add optimizer adapters"
```

### Task 5: Persist optimizer runs and plan slots

**Files:**
- Modify: `dvhub/telemetry-store.js`
- Create: `dvhub/test/optimizer-store.test.js`
- Modify: `dvhub/telemetry-runtime.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryStore } from '../telemetry-store.js';

test('telemetry store persists optimizer run metadata and plan slots', () => {
  const store = createTelemetryStore({ dbPath: ':memory:' });
  store.writeOptimizerRun({
    optimizer: 'eos',
    status: 'applied',
    resultJson: { slots: [{ start: '2026-03-10T10:00:00.000Z', end: '2026-03-10T10:15:00.000Z' }] },
    series: []
  });

  const status = store.getStatus();
  assert.ok(status.optimizerRunRows >= 1);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-store.test.js`
Expected: FAIL because status metadata or storage is incomplete

**Step 3: Write minimal implementation**

```js
// Extend schema with optimizer_runs and optimizer_plan_slots tables.
// Add writeOptimizerRunPlan(runId, slots) helper.
// Extend getStatus() to return optimizerRunRows.
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-store.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/telemetry-store.js dvhub/test/optimizer-store.test.js dvhub/telemetry-runtime.js
git commit -m "feat: persist optimizer plans and runs"
```

### Task 6: Add plan feasibility checks and scoring

**Files:**
- Create: `dvhub/optimizer-score.js`
- Create: `dvhub/test/optimizer-score.test.js`
- Modify: `dvhub/optimizer-model.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidatePlan } from '../optimizer-score.js';

test('scoreCandidatePlan penalizes constraint violations and rewards expected profit', () => {
  const score = scoreCandidatePlan({
    plan: { slots: [{ expectedProfitEur: 1.2, targetSocPct: 55 }] },
    actual: null,
    constraints: { minSocPct: 10, maxSocPct: 90 }
  });

  assert.equal(typeof score.totalScore, 'number');
  assert.equal(score.violations.length, 0);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-score.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function scoreCandidatePlan({ plan = {}, constraints = {} } = {}) {
  const slots = Array.isArray(plan.slots) ? plan.slots : [];
  const violations = [];
  let total = 0;
  for (const slot of slots) {
    const soc = Number(slot.targetSocPct || 0);
    if (soc < Number(constraints.minSocPct || 0) || soc > Number(constraints.maxSocPct || 100)) {
      violations.push({ type: 'soc_bounds', slotStart: slot.start || null });
      total -= 100;
    }
    total += Number(slot.expectedProfitEur || 0) * 100;
  }
  return { totalScore: total, violations };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-score.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/optimizer-score.js dvhub/test/optimizer-score.test.js dvhub/optimizer-model.js dvhub/server.js
git commit -m "feat: add optimizer scoring"
```

### Task 7: Add automatic winner selection and active-plan runtime

**Files:**
- Create: `dvhub/optimizer-runtime.js`
- Create: `dvhub/test/optimizer-runtime.test.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseWinningPlan } from '../optimizer-runtime.js';

test('chooseWinningPlan picks the higher score and keeps losing candidate for analysis', () => {
  const result = chooseWinningPlan([
    { optimizer: 'eos', score: { totalScore: 120 } },
    { optimizer: 'emhass', score: { totalScore: 80 } }
  ]);

  assert.equal(result.active.optimizer, 'eos');
  assert.equal(result.rejected.length, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-runtime.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function chooseWinningPlan(candidates = []) {
  const ranked = [...candidates].sort((left, right) => Number(right?.score?.totalScore || 0) - Number(left?.score?.totalScore || 0));
  return {
    active: ranked[0] || null,
    rejected: ranked.slice(1)
  };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/optimizer-runtime.js dvhub/test/optimizer-runtime.test.js dvhub/server.js
git commit -m "feat: add winning plan selection"
```

### Task 8: Add forecast and optimizer APIs

**Files:**
- Modify: `dvhub/server.js`
- Create: `dvhub/test/optimizer-api.test.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('server exposes optimizer input and active plan APIs', async () => {
  const handlers = await import('../server.js');
  assert.ok(handlers);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-api.test.js`
Expected: FAIL because endpoints or test harness support do not exist yet

**Step 3: Write minimal implementation**

```js
// Add:
// GET /api/state/live
// GET /api/state/market
// GET /api/state/forecast/latest
// POST /api/import/forecast/pv
// POST /api/import/forecast/load
// POST /api/import/forecast/ev
// GET /api/optimizer/input?optimizer=eos
// GET /api/optimizer/input?optimizer=emhass
// GET /api/execution/active-plan
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-api.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/server.js dvhub/test/optimizer-api.test.js
git commit -m "feat: add optimizer orchestration APIs"
```

### Task 9: Add EVCC ingestion and execution hooks

**Files:**
- Create: `dvhub/evcc-runtime.js`
- Create: `dvhub/test/evcc-runtime.test.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvccState } from '../evcc-runtime.js';

test('normalizeEvccState extracts vehicle and loadpoint constraints', () => {
  const state = normalizeEvccState({
    result: {
      loadpoints: [{ mode: 'pv', vehicleSoc: 48, minCurrent: 6, maxCurrent: 16 }]
    }
  });

  assert.equal(state.loadpoints.length, 1);
  assert.equal(state.loadpoints[0].vehicleSoc, 48);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/evcc-runtime.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function normalizeEvccState(payload = {}) {
  const root = payload.result || payload;
  return {
    loadpoints: Array.isArray(root.loadpoints) ? root.loadpoints : [],
    vehicles: Array.isArray(root.vehicles) ? root.vehicles : [],
    site: root.site || {}
  };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/evcc-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/evcc-runtime.js dvhub/test/evcc-runtime.test.js dvhub/server.js
git commit -m "feat: add evcc normalization hooks"
```

### Task 10: Add optimizer comparison and active-plan UI surfaces

**Files:**
- Modify: `dvhub/public/index.html`
- Modify: `dvhub/public/app.js`
- Modify: `dvhub/public/styles.css`
- Create: `dvhub/test/optimizer-dashboard.test.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dashboard exposes optimizer comparison shell', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /Optimierer|Optimizer/i);
  assert.match(html, /Aktiver Plan/i);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/optimizer-dashboard.test.js`
Expected: FAIL because the comparison shell is not rendered yet

**Step 3: Write minimal implementation**

```html
<section class="panel">
  <p class="card-title">Optimierer</p>
  <div id="optimizerStatus"></div>
</section>
<section class="panel">
  <p class="card-title">Aktiver Plan</p>
  <div id="activePlanTimeline"></div>
</section>
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/optimizer-dashboard.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/index.html dvhub/public/app.js dvhub/public/styles.css dvhub/test/optimizer-dashboard.test.js
git commit -m "feat: add optimizer dashboard surfaces"
```

### Task 11: Add rolling backtest and leaderboard views

**Files:**
- Create: `dvhub/backtest-runtime.js`
- Create: `dvhub/test/backtest-runtime.test.js`
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/server.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOptimizerLeaderboard } from '../backtest-runtime.js';

test('summarizeOptimizerLeaderboard ranks optimizers by realized score and win rate', () => {
  const board = summarizeOptimizerLeaderboard([
    { optimizer: 'eos', totalScore: 120, winner: true },
    { optimizer: 'eos', totalScore: 90, winner: false },
    { optimizer: 'emhass', totalScore: 80, winner: false }
  ]);

  assert.equal(board[0].optimizer, 'eos');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test dvhub/test/backtest-runtime.test.js`
Expected: FAIL with missing module or missing exports

**Step 3: Write minimal implementation**

```js
export function summarizeOptimizerLeaderboard(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const current = grouped.get(row.optimizer) || { optimizer: row.optimizer, totalScore: 0, wins: 0, runs: 0 };
    current.totalScore += Number(row.totalScore || 0);
    current.runs += 1;
    if (row.winner) current.wins += 1;
    grouped.set(row.optimizer, current);
  }
  return [...grouped.values()].sort((left, right) => right.totalScore - left.totalScore);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test dvhub/test/backtest-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/backtest-runtime.js dvhub/test/backtest-runtime.test.js dvhub/public/history.html dvhub/public/history.js dvhub/server.js
git commit -m "feat: add optimizer backtest leaderboard"
```

### Task 12: Update docs and example config for new orchestration features

**Files:**
- Modify: `README.md`
- Modify: `dvhub/config.example.json`
- Modify: `dvhub/config-model.js`

**Step 1: Write the failing doc test or assertion**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('README documents optimizer orchestration and forecast imports', () => {
  const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  assert.match(readme, /EOS/i);
  assert.match(readme, /EMHASS/i);
  assert.match(readme, /Forecast/i);
  assert.match(readme, /EVCC/i);
});
```

**Step 2: Run test to verify it fails if docs are not updated**

Run: `node --test dvhub/test/readme-installation.test.js`
Expected: FAIL or no coverage for the new orchestration docs

**Step 3: Write minimal implementation**

```json
{
  "optimizer": {
    "enabled": true,
    "resolutionSeconds": 900,
    "optimizers": {
      "eos": { "enabled": true, "baseUrl": "http://eos.local" },
      "emhass": { "enabled": true, "baseUrl": "http://emhass.local" }
    }
  }
}
```

**Step 4: Run tests to verify docs/config pass**

Run: `node --test`
Expected: PASS for updated documentation and configuration coverage

**Step 5: Commit**

```bash
git add README.md dvhub/config.example.json dvhub/config-model.js
git commit -m "docs: add optimizer orchestration configuration"
```
