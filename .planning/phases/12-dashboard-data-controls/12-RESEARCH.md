# Phase 12: Dashboard Data & Controls - Research

**Researched:** 2026-03-15
**Domain:** Preact dashboard UI components, Fastify API integration, real-time WebSocket data display, inline editing state management
**Confidence:** HIGH

## Summary

Phase 12 is a frontend-heavy phase that adds three new KPI cards (EPEX prices, costs, system status) to the dashboard grid, enhances the control panel with Min SOC slider (pending-state blink animation), charge current input, and EPEX refresh button, and transforms the read-only schedule panel into an inline-editable table with default value inputs and active schedule value display.

All backend API endpoints already exist (Phase 11 completed backend integration). The work is purely UI: new Preact+HTM components consuming existing signals from `use-signal-store.js`, calling existing API routes (`/api/control/write`, `/api/schedule/rules`, `/api/schedule/config`, `/api/epex/refresh`), and rendering data from the WebSocket telemetry stream. The old `app.js` (vanilla JS, 1600+ lines) contains reference implementations for every feature -- the task is porting these to the Preact component architecture.

**Primary recommendation:** Build the three new card components first (pure data display, no interactivity), then enhance the control panel (slider + pending state), then tackle schedule inline editing last (most complex state management).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Decision 1: KPI-Karten Layout**
Three new panel cards as Row 2 in dashboard grid:
- EPEX-Preise (span-4): Current slot price, next slot price, today Min/Max in ct/kWh
- Kosten (span-4): Import costs, export revenue, net costs with color coding (green=profit, red=cost). Period: Today (since midnight), from costSummary()
- System-Status (span-4): 3-phase grid power (L1/L2/L3), DV feedback (DC/AC flags), neg-price status, Modbus keepalive timestamp

Layout:
```
Row 1: PowerFlow(6) | Kennzahlen(3) | Steuerung(3)   [existing]
Row 2: EPEX-Preise(4) | Kosten(4) | System-Status(4)  [NEW]
Row 3: Price Chart(12)                                 [existing]
...
```

**Decision 2: Control Panel Interaction**
- Min SOC Slider: Range 0-100%. After change blinks orange until API 200 returns. Then green 2s, then normal. On error red + error message.
- Charge Current Input: Free number field, min/max dynamic from config-model (NOT hardcoded). Enter to send.
- EPEX Refresh Button: Simple button "EPEX aktualisieren" in control panel, triggers POST /api/epex/refresh.

**Decision 3: Schedule Inline-Editing**
- Inline-Edit: Click on table row makes fields editable (inputs instead of text). Save/Cancel buttons appear. Delete button per row.
- New Rule: '+' button below table adds empty editable row.
- Default-Inputs: Two input fields ABOVE the rule table: "Standard Netz-Sollwert (W)" and "Standard Ladestrom (A)". Write via POST /api/schedule/config.
- API: Rules via POST /api/schedule/rules. Defaults via POST /api/schedule/config.

**Decision 4: Active Schedule Values Placement**
- In Schedule Panel below defaults, above rule table:
  - Grid Setpoint: current value + which rule sets it
  - Charge Current: current value
  - Min SOC: current value
  - Last Change: timestamp of last control-write
- Data from WebSocket telemetry (ctrl + schedule fields)

### New Files
- `dvhub/public/components/dashboard/epex-card.js`
- `dvhub/public/components/dashboard/cost-card.js`
- `dvhub/public/components/dashboard/status-card.js`

### Deferred Ideas (OUT OF SCOPE)
- Monthly cost view (Phase 16: History Parity)
- Chart-based schedule creation via drag (Phase 13: Chart Interactivity)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | 3-phase grid power (L1/L2/L3) display | status-card.js reads `status.meter.grid_l1_w`, `grid_l2_w`, `grid_l3_w` from telemetry signal |
| DATA-02 | DV DC/AC feedback indicators | status-card.js renders feedExcessDcPv/dontFeedExcessAcPv from `victron` or `ctrl.dvControl` fields |
| DATA-03 | Cost display: import costs, export revenue, net costs with color coding | cost-card.js reads `status.costs` (costEur, revenueEur, netEur) -- costSummary() already computed server-side |
| DATA-04 | EPEX price KPI card (current, next slot, min/max today/tomorrow) | epex-card.js reads `status.epex.summary` fields (current, next, todayMin/Max, tomorrowMin/Max) |
| DATA-05 | Negative price protection status display | status-card.js reads `status.ctrl.negativePriceActive` |
| DATA-06 | Active schedule values (gridSetpoint, chargeCurrent, minSoc) | schedule-panel.js reads `status.schedule.active` (gridSetpointW, chargeCurrentA, minSocPct) |
| DATA-07 | Last control-write timestamp display | schedule-panel.js reads `status.schedule.lastWrite` timestamps |
| DATA-08 | Modbus keepalive timestamp display | status-card.js reads `status.keepalive.modbusLastQuery.ts` |
| CTRL-01 | Min SOC slider with pending-state (blinking) and write function | Enhanced control-panel.js with range input, pending state machine, CSS blink animation |
| CTRL-02 | Manual charge current write button | Enhanced control-panel.js with number input + send button via POST /api/control/write target=chargeCurrentA |
| CTRL-03 | EPEX manual refresh button | Enhanced control-panel.js with button calling POST /api/epex/refresh |
| CTRL-04 | Schedule panel: inline edit/delete/add of schedule rules | Enhanced schedule-panel.js with editMode state per row, POST /api/schedule/rules on save |
| CTRL-05 | Default grid setpoint and default charge current input fields | schedule-panel.js header inputs, POST /api/schedule/config with defaultGridSetpointW/defaultChargeCurrentA |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | 10.x | UI rendering | Project decision -- 5KB, React-compatible API |
| HTM | 3.x | Tagged template JSX alternative | Project decision -- no build step |
| @preact/signals | bundled | Reactive state management | Already used in use-signal-store.js |
| Fastify | 5.x | HTTP server (backend) | Project decision -- routes already exist |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| preact/hooks | bundled | useState, useEffect, useRef, useCallback | Component lifecycle, local state |
| use-signal-store.js | project | Global signal store (telemetry, prices, etc.) | All data display components |
| use-api.js | project | apiFetch wrapper with auth | All API calls (control writes, schedule saves) |
| format.js | project | formatPower, formatPrice, formatTime etc. | All data formatting |

### No Additional Dependencies
All functionality can be built with the existing stack. No new npm packages needed.

## Architecture Patterns

### Component File Structure
```
dvhub/public/components/dashboard/
  dashboard-page.js   # Grid layout, imports all dashboard components
  power-flow.js       # [existing] Animated power flow diagram
  kpi-cards.js        # [existing] Autarky, self-consumption, PV, grid
  control-panel.js    # [MODIFY] Add MinSOC slider, charge input, EPEX refresh
  epex-card.js        # [NEW] EPEX price KPI card (span-4)
  cost-card.js        # [NEW] Cost card with color coding (span-4)
  status-card.js      # [NEW] System status card (span-4)
  price-chart.js      # [existing]
  energy-timeline.js  # [existing]
  forecast-chart.js   # [existing]
  schedule-panel.js   # [MODIFY] Inline editing, defaults, active values
  log-panel.js        # [existing]
```

### Pattern 1: Data Display Card (Pure Component)
**What:** A card that reads from signals and renders formatted data. No local state needed.
**When to use:** DATA-01 through DATA-08 (all data display requirements)
**Example:**
```javascript
// Source: existing kpi-cards.js pattern
import { html } from 'htm/preact';
import { telemetry } from '../shared/use-signal-store.js';
import { formatPower } from '../shared/format.js';

export function StatusCard() {
  const t = telemetry.value || {};
  const meter = t.meter || {};
  return html`
    <section class="panel span-4 reveal">
      <p class="card-title">System-Status</p>
      <div class="metric-row">
        <span>L1</span>
        <strong>${formatPower(meter.grid_l1_w)}</strong>
      </div>
      ...
    </section>
  `;
}
```

### Pattern 2: Pending Write State Machine (Min SOC Slider)
**What:** Optimistic UI with visual confirmation. Submit -> blink -> confirm/error.
**When to use:** CTRL-01 (Min SOC), can be applied to any write with readback verification.
**Reference implementation:** Old `app.js` lines 729-768 (`createMinSocPendingState`, `resolveMinSocPendingState`, `computeMinSocRenderState`).

State machine:
```
IDLE -> (user submits) -> PENDING(blink orange)
PENDING -> (readback matches target) -> CONFIRMED(green 2s) -> IDLE
PENDING -> (readback changed but not to target) -> IDLE (different value set)
PENDING -> (API error) -> ERROR(red) -> IDLE
```

**Implementation with Preact signals:**
```javascript
import { signal } from '@preact/signals';

const pendingWrite = signal(null); // { targetValue, previousReadback, submittedAt }
const writeStatus = signal('idle'); // 'idle' | 'pending' | 'confirmed' | 'error'

// On telemetry update, resolve pending state
function resolvePendingState(readbackValue) {
  const pending = pendingWrite.value;
  if (!pending) return;
  if (readbackValue === pending.targetValue) {
    writeStatus.value = 'confirmed';
    pendingWrite.value = null;
    setTimeout(() => { writeStatus.value = 'idle'; }, 2000);
  } else if (readbackValue !== pending.previousReadback) {
    // Value changed but not to our target -- someone else wrote
    pendingWrite.value = null;
    writeStatus.value = 'idle';
  }
}
```

### Pattern 3: Inline Edit Table Row
**What:** Table row toggles between display mode and edit mode.
**When to use:** CTRL-04 (schedule inline editing)
**Key state:** `editingRowId` signal tracks which row is in edit mode (null = none).

```javascript
const editingRowId = signal(null);
const editBuffer = signal({}); // temporary values while editing

function startEdit(rule) {
  editingRowId.value = rule.id;
  editBuffer.value = { ...rule };
}

function cancelEdit() {
  editingRowId.value = null;
  editBuffer.value = {};
}

async function saveEdit() {
  // Merge edited rule back into rules array, POST to API
}
```

### Pattern 4: WebSocket Data Path
**What:** Server broadcasts telemetry via WebSocket -> `use-websocket.js` dispatches to signal store -> components reactively re-render.
**Critical:** All DATA-* requirements rely on the telemetry signal containing the right fields. Phase 11 (INTEG-02) ensures WebSocket telemetry includes all dashboard-relevant fields.

**Data mapping (telemetry signal fields -> component usage):**
| Signal Field | Source in `/api/status` | Used By |
|-------------|----------------------|---------|
| `telemetry.value.meter.grid_l1_w` | `status.meter.grid_l1_w` | status-card (DATA-01) |
| `telemetry.value.meter.grid_l2_w` | `status.meter.grid_l2_w` | status-card (DATA-01) |
| `telemetry.value.meter.grid_l3_w` | `status.meter.grid_l3_w` | status-card (DATA-01) |
| `telemetry.value.victron.feedExcessDcPv` | `status.victron.feedExcessDcPv` | status-card (DATA-02) |
| `telemetry.value.victron.dontFeedExcessAcPv` | `status.victron.dontFeedExcessAcPv` | status-card (DATA-02) |
| `telemetry.value.costs` | `status.costs` (costSummary) | cost-card (DATA-03) |
| `telemetry.value.epex.summary` | `status.epex.summary` | epex-card (DATA-04) |
| `telemetry.value.ctrl.negativePriceActive` | `status.ctrl.negativePriceActive` | status-card (DATA-05) |
| `telemetry.value.schedule.active` | `status.schedule.active` | schedule-panel (DATA-06) |
| `telemetry.value.schedule.lastWrite` | `status.schedule.lastWrite` | schedule-panel (DATA-07) |
| `telemetry.value.keepalive.modbusLastQuery.ts` | `status.keepalive.modbusLastQuery.ts` | status-card (DATA-08) |

**Note:** If Phase 11 did not add these fields to the WebSocket broadcast, the signal store may need a `schedule`, `costs`, and `keepalive` signal added, or an initial fetch from `/api/status` to hydrate the store. The current WebSocket handler only dispatches `telemetry`, `config`, `prices`, `dv`, `exec` message types. Schedule, costs, and keepalive data may only be available via `/api/status` polling or via the full telemetry snapshot.

### Anti-Patterns to Avoid
- **Fetching /api/status on interval for data that comes via WebSocket:** Use the signal store. Only fall back to polling if WS does not carry the field.
- **Inline styles for color coding:** Use CSS classes (`cost-profit`, `cost-loss`) instead of inline style calculations. The design system defines semantic colors.
- **Hardcoding charge current min/max:** Inverter sizes vary massively (3A to 1000A+). Read limits from config if available, otherwise use sensible browser-input constraints only.
- **Storing schedule edit state in the signal store:** Edit state is local to the SchedulePanel component. Use `useState` or component-scoped signals, not global signals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pending write state machine | Custom event-based tracker | Port `createMinSocPendingState`/`resolveMinSocPendingState`/`computeMinSocRenderState` from old app.js | Battle-tested logic with edge cases handled |
| DV control indicator resolution | New DC/AC flag logic | Port `resolveDvControlIndicators()` from old app.js (lines 696-727) | Handles both legacy victron readback and new ctrl.dvControl format |
| Schedule rule grouping | Custom grouping | Port `groupScheduleRulesForDashboard()` from old app.js (lines 1083-1116) | Groups gridSetpoint + chargeCurrentA rules by timeslot |
| Schedule rule collection from UI | Custom serialization | Port `collectScheduleRulesFromRowState()` from old app.js (lines 1020-1081) | Serializes inline edit fields to API-compatible rule array |
| Price formatting (tenth-cent) | Custom formatter | Port `fmtCentFromTenthCt()` -- EPEX prices arrive as 10th-cent integers | Avoid float precision issues |
| CSS blink animation | JavaScript interval toggle | CSS `@keyframes` with `animation` property | GPU-accelerated, no JS overhead |

**Key insight:** The old `app.js` contains ~400 lines of tested schedule editing + MinSOC pending state logic. Porting this to Preact components is safer than rewriting from scratch.

## Common Pitfalls

### Pitfall 1: WebSocket Data Completeness
**What goes wrong:** New card components assume all fields exist in the telemetry signal, but the WebSocket only broadcasts certain message types (telemetry, config, prices, dv, exec).
**Why it happens:** Schedule active values, costs, and keepalive data may not be included in the `telemetry` WS message. They are available in `/api/status` but may need separate hydration.
**How to avoid:** Check what the gateway broadcasts via WebSocket. If costs/schedule/keepalive are not in the WS stream, add an initial `/api/status` fetch on component mount and update on each WS telemetry message, OR add new WS message types for these data categories.
**Warning signs:** Cards showing "--" or stale data on first load despite WS being connected.

### Pitfall 2: EPEX Price Unit Confusion
**What goes wrong:** EPEX summary fields use different units: `ct_kwh` (cents), but `todayMin`/`todayMax` use tenth-cent integers.
**Why it happens:** The old system stores EPEX data in 10th-cent resolution internally but displays in ct/kWh.
**How to avoid:** Use `fmtCentFromTenthCt()` for min/max fields, `fmtCentFromCt()` for current/next price fields. Check the exact field format from `/api/status` response.
**Warning signs:** Prices displayed 10x too high or too low.

### Pitfall 3: Schedule Rule ID Collisions with SMA
**What goes wrong:** User edits or deletes a schedule rule that belongs to Small Market Automation (SMA), breaking the automation.
**Why it happens:** SMA rules are auto-managed and should not be user-editable. The old system checks `rule.source === 'small_market_automation'` or `rule.id.startsWith('sma-')`.
**How to avoid:** Filter SMA rules from the editable set. Display them read-only with an "Auto" badge. The `POST /api/schedule/rules` endpoint already preserves automation rules separately.
**Warning signs:** Automation rules appearing in the editable table without protection.

### Pitfall 4: Min SOC Slider Rapid Submissions
**What goes wrong:** User drags slider quickly, sending multiple writes. Pending state gets confused about which write to track.
**Why it happens:** Each slider change could trigger a write if not debounced.
**How to avoid:** Only submit on slider release (`onchange` not `oninput` for the write). Use `oninput` only for preview. The old system uses separate open/close editor pattern -- click to open, explicit submit button.
**Warning signs:** Multiple concurrent pending states, values oscillating.

### Pitfall 5: Cost Color Coding Sign Convention
**What goes wrong:** Net costs color coded backwards (green for costs, red for revenue).
**Why it happens:** `netEur` is `revenueEur - costEur`. Positive = profit (green), negative = net cost (red). Confusion about which direction is which.
**How to avoid:** Old app.js uses: `c.netEur >= 0 ? 'ok' : 'off'` where ok=green, off=red. Follow same convention.
**Warning signs:** Green numbers when importing expensive grid power.

### Pitfall 6: Dashboard Grid CSS span-4 Not Defined
**What goes wrong:** New cards use `span-4` class but it may not exist in styles.css.
**Why it happens:** Existing grid uses span-3, span-6, span-12. span-4 may need to be added.
**How to avoid:** Check styles.css for existing grid classes. If `span-4` does not exist, add it: `.span-4 { grid-column: span 4; }`.
**Warning signs:** Cards stacking vertically or taking full width instead of 1/3.

## Code Examples

### Data Display Card (verified pattern from existing kpi-cards.js)
```javascript
import { html } from 'htm/preact';
import { telemetry } from '../shared/use-signal-store.js';
import { formatPower, formatPrice } from '../shared/format.js';

export function CostCard() {
  const t = telemetry.value || {};
  const c = t.costs || {};
  const netColor = (c.netEur || 0) >= 0 ? 'var(--dvhub-green)' : 'var(--dvhub-red)';

  return html`
    <section class="panel span-4 reveal">
      <p class="card-title">Kosten (heute)</p>
      <div class="metric-row">
        <span>Import</span>
        <strong>${c.costEur != null ? c.costEur.toFixed(2) + ' EUR' : '-- EUR'}</strong>
      </div>
      <div class="metric-row">
        <span>Export-Erloese</span>
        <strong style="color:var(--dvhub-green)">${c.revenueEur != null ? c.revenueEur.toFixed(2) + ' EUR' : '-- EUR'}</strong>
      </div>
      <div class="metric-row">
        <span>Netto</span>
        <strong class="big-value" style="color:${netColor}">${c.netEur != null ? c.netEur.toFixed(2) + ' EUR' : '-- EUR'}</strong>
      </div>
    </section>
  `;
}
```

### API Write with Pending State (reference from old app.js, adapted to Preact)
```javascript
import { signal } from '@preact/signals';
import { apiFetch } from '../shared/use-api.js';

// Pending state machine -- port from old app.js createMinSocPendingState
function createPendingState(currentReadback, submittedValue) {
  return { previousReadback: currentReadback, targetValue: submittedValue, submittedAt: Date.now() };
}

function resolvePending(pendingState, readbackValue) {
  if (!pendingState) return null;
  if (readbackValue == null) return pendingState;
  if (readbackValue === pendingState.targetValue) return null;  // confirmed
  if (readbackValue !== pendingState.previousReadback) return null;  // changed by something else
  return pendingState;  // still pending
}

async function submitMinSoc(value, currentReadback) {
  const res = await apiFetch('/api/control/write', {
    method: 'POST',
    body: JSON.stringify({ target: 'minSocPct', value })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return createPendingState(currentReadback, value);
}
```

### Schedule Inline Edit Row (pattern)
```javascript
function ScheduleRow({ rule, isEditing, onEdit, onSave, onCancel, onDelete }) {
  if (isEditing) {
    return html`
      <tr>
        <td><input type="time" value=${rule.start} onInput=${e => rule.start = e.target.value} /></td>
        <td><input type="time" value=${rule.end} onInput=${e => rule.end = e.target.value} /></td>
        <td><input type="number" value=${rule.value} onInput=${e => rule.value = Number(e.target.value)} /></td>
        <td>
          <button class="btn btn-ghost" onClick=${onSave}>Speichern</button>
          <button class="btn btn-ghost" onClick=${onCancel}>Abbrechen</button>
        </td>
      </tr>
    `;
  }
  return html`
    <tr onClick=${onEdit} style="cursor:pointer">
      <td>${rule.start}</td>
      <td>${rule.end}</td>
      <td>${rule.value}</td>
      <td><button class="btn btn-ghost" onClick=${onDelete}>Loeschen</button></td>
    </tr>
  `;
}
```

## State of the Art

| Old Approach (app.js) | Current Approach (Preact) | Impact |
|------------------------|--------------------------|--------|
| DOM manipulation via `setText(id, text)` | Signal-driven reactive rendering | No manual DOM updates needed |
| Global `dashboardState` object | Component-scoped `signal()` / `useState()` | Better encapsulation |
| `document.getElementById` for form values | Preact refs or controlled inputs | Type-safe, testable |
| innerHTML for schedule table rows | HTM templates with map() | XSS-safe, declarative |
| `window.DVhubDashboard` global export | ES module imports | Tree-shakeable, explicit deps |

**Key difference:** The old vanilla JS system works entirely via `/api/status` polling + DOM patching. The new Preact system uses WebSocket signals for live data and only calls REST APIs for writes. The rendering pattern is fundamentally different but the business logic (pending states, rule grouping, DV indicator resolution) is identical.

## Open Questions

1. **WebSocket telemetry content for costs/schedule/keepalive**
   - What we know: WS dispatches `telemetry`, `config`, `prices`, `dv`, `exec` types
   - What's unclear: Whether the full `/api/status` snapshot (including costs, schedule.active, schedule.lastWrite, keepalive) is included in the `telemetry` WS message or whether these are separate concerns
   - Recommendation: Check actual WS payload structure. If not included, add an initial `/api/status` fetch on mount and refresh on each telemetry WS message, or extend WS message types

2. **CSS grid span-4 class availability**
   - What we know: styles.css has span-3, span-6, span-12
   - What's unclear: Whether span-4 already exists or needs to be added
   - Recommendation: Check styles.css and add if missing (single line: `.span-4 { grid-column: span 4; }`)

3. **EPEX price field units in /api/status**
   - What we know: Old app.js uses `fmtCentFromCt()` for current/next and `fmtCentFromTenthCt()` for min/max
   - What's unclear: Whether Phase 11 normalized these units or preserved the old format
   - Recommendation: Verify actual `/api/status` response format before implementing formatters

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | none -- uses `node --test` directly |
| Quick run command | `node --test dvhub/test/ui-kpi.test.js` |
| Full suite command | `node --test dvhub/test/*.test.js` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | 3-phase grid power renders L1/L2/L3 from meter | unit | `node --test dvhub/test/status-card.test.js -x` | Wave 0 |
| DATA-02 | DV feedback flags resolve and render correctly | unit | `node --test dvhub/test/status-card.test.js -x` | Wave 0 |
| DATA-03 | Cost card shows import/export/net with color | unit | `node --test dvhub/test/cost-card.test.js -x` | Wave 0 |
| DATA-04 | EPEX card shows current/next/min/max prices | unit | `node --test dvhub/test/epex-card.test.js -x` | Wave 0 |
| DATA-05 | Negative price protection status renders | unit | `node --test dvhub/test/status-card.test.js -x` | Wave 0 |
| DATA-06 | Active schedule values display | unit | `node --test dvhub/test/schedule-panel-active.test.js -x` | Wave 0 |
| DATA-07 | Last control-write timestamp displays | unit | `node --test dvhub/test/schedule-panel-active.test.js -x` | Wave 0 |
| DATA-08 | Modbus keepalive timestamp renders | unit | `node --test dvhub/test/status-card.test.js -x` | Wave 0 |
| CTRL-01 | Min SOC slider pending state machine | unit | `node --test dvhub/test/dashboard-min-soc-inline-control.test.js -x` | Exists (old app.js tests) |
| CTRL-02 | Charge current write sends correct API call | unit | `node --test dvhub/test/control-panel-writes.test.js -x` | Wave 0 |
| CTRL-03 | EPEX refresh button calls POST /api/epex/refresh | unit | `node --test dvhub/test/control-panel-writes.test.js -x` | Wave 0 |
| CTRL-04 | Schedule inline edit/save/delete | unit | `node --test dvhub/test/schedule-panel-inline.test.js -x` | Wave 0 |
| CTRL-05 | Default grid/charge inputs save via API | unit | `node --test dvhub/test/schedule-panel-defaults.test.js -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test dvhub/test/<changed-module>.test.js`
- **Per wave merge:** `node --test dvhub/test/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `dvhub/test/status-card.test.js` -- covers DATA-01, DATA-02, DATA-05, DATA-08
- [ ] `dvhub/test/cost-card.test.js` -- covers DATA-03
- [ ] `dvhub/test/epex-card.test.js` -- covers DATA-04
- [ ] `dvhub/test/schedule-panel-active.test.js` -- covers DATA-06, DATA-07
- [ ] `dvhub/test/control-panel-writes.test.js` -- covers CTRL-02, CTRL-03
- [ ] `dvhub/test/schedule-panel-inline.test.js` -- covers CTRL-04
- [ ] `dvhub/test/schedule-panel-defaults.test.js` -- covers CTRL-05

Note: CTRL-01 tests partially exist in `dashboard-min-soc-inline-control.test.js` but test the OLD app.js functions. New Preact component tests will need separate test files OR the pending state logic can be extracted to a pure function module and tested independently (recommended).

### Testing Strategy for Preact Components
The project tests Preact components by testing **pure logic functions** separately from rendering. Following existing patterns:
- `ui-kpi.test.js` imports `computeAutarky`/`computeSelfConsumption` from `compute.js` (pure functions)
- `dashboard-min-soc-inline-control.test.js` tests `createMinSocPendingState`/`resolveMinSocPendingState` via `node:vm` sandbox

**Recommended approach for Phase 12:**
1. Extract all business logic into pure functions (e.g., `resolveDvControlIndicators`, `computeCostColor`, `groupScheduleRulesForDashboard`)
2. Test pure functions with `node:test` + `node:assert`
3. Keep component rendering thin (just signal reads + format calls)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `dvhub/public/components/dashboard/*.js` -- current Preact component structure
- Existing codebase: `dvhub/public/app.js` -- reference implementation for all features (vanilla JS)
- Existing codebase: `dvhub/modules/gateway/routes/control.js` -- control write API
- Existing codebase: `dvhub/modules/gateway/routes/schedule.js` -- schedule API (rules + config)
- Existing codebase: `dvhub/modules/gateway/routes/meter.js` -- EPEX refresh API
- Existing codebase: `dvhub/modules/gateway/routes/status.js` -- status API + costSummary()
- Existing codebase: `dvhub/runtime-commands.js` -- valid control targets (gridSetpointW, chargeCurrentA, minSocPct)

### Secondary (MEDIUM confidence)
- `dvhub/public/components/shared/use-signal-store.js` -- signal definitions (may need extension for costs/schedule/keepalive)
- `dvhub/public/components/shared/use-websocket.js` -- WS message type dispatch (may need new types)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - follows existing component patterns exactly
- Pitfalls: HIGH - identified from old app.js reference implementation and codebase analysis
- Data mapping: MEDIUM - depends on Phase 11 WebSocket field completeness (needs verification)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- all patterns are project-internal, no external API changes expected)
