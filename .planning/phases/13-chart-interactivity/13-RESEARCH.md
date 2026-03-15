# Phase 13: Chart Interactivity - Research

**Researched:** 2026-03-15
**Domain:** SVG chart interaction (mouse selection, tooltips, overlays) in Preact/htm SPA
**Confidence:** HIGH

## Summary

Phase 13 adds four interactive features to the existing `PriceChart` component: (1) mouse-drag slot selection with direct schedule rule creation, (2) floating tooltip with margin comparison data, (3) dashed import-price polyline overlay with zero baseline, and (4) dynamic margin summary above the chart. All features have a proven reference implementation in `dvhub/public/app.js` (lines 254-694) that uses imperative DOM manipulation. The new implementation must port this to Preact/htm with signals.

The critical data dependency is `userEnergyPricing` which is currently NOT in the WebSocket telemetry stream. It is only available via the `/api/status` endpoint. The implementation needs to either add a `pricing` signal + WebSocket message type, or fetch it on-demand. The existing `telemetry` broadcast (from `telemetry.js`) does not include `userEnergyPricing` -- it must be fetched via REST or added as a new WS message type.

**Primary recommendation:** Port old selection/tooltip/overlay logic to Preact signals + htm templates. Extend `price-chart-compute.js` with pure functions for selection windows, comparison lookups, and import overlay point computation. Add `userEnergyPricing` signal to the store and fetch it periodically or on price updates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mousedown + Drag over bars selects contiguous range. Single click = 1 slot.
- CSS class `is-selected` colors selected bars (reuse existing `chartSelectionState` pattern)
- Callout banner appears **in the Chart-Panel directly under the SVG** (no floating, no layout-shift)
- Callout shows: "X Balken markiert | 08:00-12:00 | 14:00-16:00" + "Schedule erstellen" Button
- Button saves **directly as rules** via POST /api/schedule/rules (not insert into panel first)
- New rules get **default values** from Schedule-Config (defaultGridSetpointW, defaultChargeCurrentA)
- After successful save, selection is **auto-cleared**
- Feedback: short controlMsg "X Regeln erstellt"
- Tooltip: **Floating next to cursor** (position: fixed, offset +12px X/Y), follows mouse
- Tooltip content per slot: Zeitslot | Boerse X ct | Bezug X ct | PV +/-X ct | Akku +/-X ct | Gemischt +/-X ct
- All margin data from `slotComparison()` backend fields
- Tooltip disappears on mouseleave from chart
- Import overlay: **dashed green polyline** (stroke-dasharray, --chart-import: #22c55e)
- **Null-baseline**: red reference line at 0 ct (--chart-negative, stroke-width 1.5)
- Import data from userEnergyPricing comparisons array (joined per slot timestamp)
- Margin summary **above SVG** in Chart-Panel
- Line 1: "Jetzt: Boerse X ct | Bezug X ct"
- Line 2: "Spread +/-X ct | PV +/-X ct | Akku +/-X ct | Gemischt +/-X ct | Beste Quelle: [Name]"
- **Dynamic hover-update**: Default shows current slot. Hover over bar switches summary temporarily. Mouseleave returns to current.
- **Best source colored**: PV=green, Akku=blue, Gemischt=orange, Netz=grey

### Claude's Discretion
- Exact CSS classes and color variables for selection highlight
- SVG rendering details (padding, scale function, grid lines)
- Tooltip styling (border-radius, background, font-size)
- Debouncing/Throttling for fast mouse-move

### Deferred Ideas (OUT OF SCOPE)
- Automation-Slot-Highlighting in chart (Phase 14: Kleine Boersenautomatik)
- Touch support for mobile devices (own phase or backlog)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHART-01 | User can click or drag-select price chart bars to select time slots, and selected slots can be used to create new schedule rules | Selection state via signals, buildScheduleWindowsFromSelection ported to compute.js, POST /api/schedule/rules with defaults |
| CHART-02 | Hovering over a price bar shows tooltip with slot time range, price, and import price comparison | Floating tooltip element with position:fixed following cursor, slotComparison data from userEnergyPricing |
| CHART-03 | Import price overlay line renders on the price chart | Dashed green polyline computed from comparison data, zero baseline red line |
| CHART-04 | Price comparison summary displays calculated margins for PV, battery, mixed vs grid import | Summary section above SVG using current slot data, dynamic hover-update |
| CHART-05 | (Implied) All interaction data comes from existing backend pricing API | userEnergyPricing signal/fetch integration |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | 10.x | Component framework | Already in use across SPA |
| htm | 3.x | Tagged template JSX alternative | Already in use, no build step |
| @preact/signals | 1.x | Reactive state management | Already used for telemetry, prices, config |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | All features use existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled SVG | d3.js, Chart.js | Existing chart is pure SVG/htm, adding a library would be inconsistent and unnecessary |
| Custom tooltip | tippy.js, floating-ui | Overkill for a single position:fixed element following cursor |

**Installation:**
```bash
# No new packages needed -- all features use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
dvhub/public/components/dashboard/
  price-chart.js              # Extended with selection, tooltip, overlay, summary
  price-chart-compute.js      # Extended with pure selection/comparison functions
  price-chart-selection.js    # (NEW) Selection state signals + callout component
  price-chart-tooltip.js      # (NEW) Tooltip component
  price-chart-overlay.js      # (NEW) Import overlay + zero baseline SVG elements
  price-chart-summary.js      # (NEW) Margin comparison summary component
```

### Pattern 1: Selection State via Module-Level Signals
**What:** Selection state (selectedIndices, anchorIndex, pointerDown, didDrag) as module-level Preact signals, matching the `editingRowIdx`/`editBuffer` pattern from `schedule-panel.js`.
**When to use:** For chart selection state that needs to persist across renders but does not need to be shared beyond the chart panel.
**Example:**
```javascript
// price-chart-selection.js
import { signal, computed } from '@preact/signals';

export const selectedTimestamps = signal(new Set());
export const anchorIndex = signal(null);
export const pointerDown = signal(false);
export const didDrag = signal(false);
export const hoveredIndex = signal(null);
```

### Pattern 2: Pure Compute Functions for All Logic
**What:** All selection-to-window conversion, comparison lookups, and overlay point computation as pure functions in `price-chart-compute.js`, matching the established `*-compute.js` pattern.
**When to use:** Every calculation that can be tested without DOM or Preact.
**Example:**
```javascript
// price-chart-compute.js (additions)
export function normalizeSelectionIndices(dataLength, indices) { ... }
export function buildScheduleWindows(data, indices) { ... }
export function buildSelectionRange(startIndex, endIndex) { ... }
export function computeImportOverlayPoints(data, comparisonByTs, xFn, yFn, barW) { ... }
export function resolveComparisonForSlot(ts, comparisonByTs) { ... }
```

### Pattern 3: userEnergyPricing Data Signal
**What:** Add a `userEnergyPricing` signal to `use-signal-store.js` and populate it. Two options:
- **(A) REST fetch on price update:** When `prices` signal changes, fetch `/api/status` and extract `userEnergyPricing`. Simple, no backend change.
- **(B) Add WS message type:** Backend broadcasts `{ type: 'pricing', data: userEnergyPricingSummary() }` alongside telemetry. More real-time but requires backend change.

**Recommendation:** Option (A) -- REST fetch. The pricing data changes only when EPEX prices change (every 15 min), not every telemetry tick. A periodic fetch is sufficient and avoids backend changes.
**Example:**
```javascript
// use-signal-store.js (addition)
export const userEnergyPricing = signal(null);

// In price-chart.js or a dedicated hook:
// Fetch on mount + when prices change
async function fetchPricing() {
  const res = await apiFetch('/api/status');
  if (res.ok) {
    const data = await res.json();
    userEnergyPricing.value = data.userEnergyPricing || null;
  }
}
```

### Pattern 4: Chart-to-Schedule Rule Creation
**What:** When user clicks "Schedule erstellen", build rules from selected windows using defaults, POST to `/api/schedule/rules`, show feedback.
**Key detail:** The POST replaces ALL manual rules. So the implementation must first GET existing rules, merge with new chart-created rules, then POST the combined set.
**Example:**
```javascript
async function createRulesFromSelection(data, selectedIndices) {
  // 1. Build windows from selection
  const windows = buildScheduleWindows(data, selectedIndices);
  // 2. Fetch current rules
  const current = await apiFetch('/api/schedule');
  const existingRules = (await current.json()).rules;
  // 3. Create new rules with defaults from schedule config
  const newRules = windows.map(w => ({
    start: w.start, end: w.end,
    target: 'gridSetpointW',
    value: scheduleConfig.defaultGridSetpointW,
    enabled: true
  }));
  // 4. Merge and POST
  const allRules = [...existingRules.filter(r => !isSmallMarketAutomationRule(r)), ...newRules];
  const flatRules = collectScheduleRulesFromRowState(allRules);
  await apiFetch('/api/schedule/rules', {
    method: 'POST',
    body: JSON.stringify({ rules: flatRules })
  });
  // 5. Clear selection + show feedback
}
```

### Anti-Patterns to Avoid
- **Imperative DOM manipulation for SVG elements:** The old system uses `document.createElementNS` and `.setAttribute`. The new system must use htm templates with conditional rendering via signals.
- **Global mutable state object:** The old `chartSelectionState` is a plain mutable object. Use Preact signals instead for reactivity.
- **Fetching full /api/status just for pricing:** Consider adding a lightweight `/api/pricing` endpoint if `/api/status` is too heavy. But the status endpoint is already used by the old system for this purpose.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schedule window grouping | Custom contiguous-range merger | Port `buildScheduleWindowsFromSelection` from app.js | Edge cases with gaps, slot duration inference already solved |
| Slot duration inference | Hardcoded 15-min assumption | Port `inferChartSlotMs` from app.js | Handles variable slot durations gracefully |
| Rule collection for API | Manual rule flattening | Reuse `collectScheduleRulesFromRowState` from schedule-compute.js | Already handles grid/charge/stopSoc splitting |
| Tooltip positioning | Custom math | `position: fixed; left: event.clientX + 12; top: event.clientY + 12` | Proven pattern from old system, simple and reliable |

**Key insight:** The old system's pure helper functions (normalizeChartSelectionIndices, buildScheduleWindowsFromSelection, buildChartSelectionRange, inferChartSlotMs, getChartSlotEndTimestamp) are well-tested and should be ported directly to `price-chart-compute.js` as ES module exports.

## Common Pitfalls

### Pitfall 1: POST /api/schedule/rules Replaces All Manual Rules
**What goes wrong:** Posting only the new chart-created rules wipes out existing manual schedule rules.
**Why it happens:** The API replaces all manual rules (preserving only automation rules). See `schedule.js` line 42-44.
**How to avoid:** Always GET existing rules first, merge new rules with existing manual rules, then POST the combined set.
**Warning signs:** Schedule panel shows only the newly created rules after chart selection.

### Pitfall 2: userEnergyPricing Data Not Available in WebSocket
**What goes wrong:** Chart tries to access comparison data from telemetry signal but it is not there.
**Why it happens:** The aggregate telemetry stream in `telemetry.js` does not include `userEnergyPricing`. It is only available from the full status endpoint.
**How to avoid:** Fetch pricing data separately via REST `/api/status` or add a dedicated `userEnergyPricing` signal with its own fetch cycle.
**Warning signs:** Tooltip shows "-" for all margin values, overlay does not render.

### Pitfall 3: Selection State Persists Through Re-renders
**What goes wrong:** SVG re-renders on signal change (e.g., price update) but selection visual state is lost because bars are recreated.
**Why it happens:** htm/preact re-renders SVG rects, losing CSS classes added imperatively.
**How to avoid:** Selection state must be in signals. Bar rendering reads from signals to apply `is-selected` / `is-hovered` classes declaratively in the template.
**Warning signs:** Selection disappears when prices update via WebSocket.

### Pitfall 4: Mouse Events Fire on Wrong Indices After Price Data Changes
**What goes wrong:** If the prices array changes length (e.g., day rollover), cached indices in closures point to wrong slots.
**Why it happens:** Event handler closures capture the bar index at render time.
**How to avoid:** Use the current bar index from the map function. Since htm re-renders on signal change, closures are recreated with correct indices.
**Warning signs:** Selecting bars near the end of the array triggers wrong time windows.

### Pitfall 5: Tooltip Positioned Off-Screen
**What goes wrong:** Tooltip extends beyond viewport when cursor is near the right or bottom edge.
**Why it happens:** Fixed positioning with positive offset without boundary checks.
**How to avoid:** Clamp tooltip position to `window.innerWidth - tooltipWidth` and `window.innerHeight - tooltipHeight`. Or use negative offset when near edges.
**Warning signs:** Tooltip is cut off or causes horizontal scroll on the last few bars.

### Pitfall 6: Schedule Panel Does Not Refresh After Chart Creates Rules
**What goes wrong:** New rules are saved but the schedule panel still shows old data.
**Why it happens:** Schedule panel uses `useApi('/api/schedule')` with its own fetch cycle. No shared signal triggers a refresh.
**How to avoid:** After chart creates rules, either: (a) export the schedule panel's `refresh` function, (b) use a shared signal that schedule panel watches, or (c) dispatch a custom event.
**Warning signs:** User must manually reload page to see chart-created rules in schedule panel.

## Code Examples

### Selection Event Handlers on SVG Bars
```javascript
// In price-chart.js template, inside bars.value.map:
<rect x=${bar.x} y=${bar.y} width=${bar.w} height=${bar.h}
  fill=${fill}
  class=${`price-bar ${i === hoveredIndex.value ? 'is-hovered' : ''} ${isSelected(i) ? 'is-selected' : ''}`}
  onMouseDown=${(e) => {
    e.preventDefault();
    pointerDown.value = true;
    anchorIndex.value = i;
    didDrag.value = false;
    setSelection(pricesArray, [i]);
  }}
  onMouseEnter=${(e) => {
    hoveredIndex.value = i;
    if (pointerDown.value && anchorIndex.value != null) {
      didDrag.value = didDrag.value || i !== anchorIndex.value;
      setSelection(pricesArray, buildSelectionRange(anchorIndex.value, i));
    }
    updateTooltip(e, bar, comparisonForSlot(i));
  }}
  onMouseMove=${(e) => { updateTooltip(e, bar, comparisonForSlot(i)); }}
/>
```

### SVG Mouseup/Mouseleave on Chart Container
```javascript
// On the SVG element itself:
onMouseUp=${() => { pointerDown.value = false; }}
onMouseLeave=${() => {
  hoveredIndex.value = null;
  pointerDown.value = false;
  hideTooltip();
}}
```

### Import Overlay Polyline (Dashed Green Line)
```javascript
// Computed from comparison data:
const importPoints = useComputed(() => {
  if (!pricingData.value?.slots) return '';
  const compMap = new Map(pricingData.value.slots.map(s => [Number(s.ts), s]));
  return pricesArray.map((p, i) => {
    const comp = compMap.get(Number(new Date(p.time).getTime()));
    if (!comp || !Number.isFinite(comp.importPriceCtKwh)) return null;
    const barX = bars.value[i]?.x + bars.value[i]?.w / 2;
    const barY = yScale(comp.importPriceCtKwh);
    return `${barX},${barY}`;
  }).filter(Boolean).join(' ');
});

// In template:
${importPoints.value && html`
  <polyline fill="none" stroke="var(--chart-import)" stroke-width="2.5"
    stroke-dasharray="6 3" stroke-linejoin="round" stroke-linecap="round"
    points=${importPoints.value} />
`}
```

### Zero Baseline
```javascript
${zeroY >= padT && zeroY <= chartH - padB && html`
  <line x1=${padL} x2=${chartW - padR} y1=${zeroY} y2=${zeroY}
    stroke="var(--chart-negative)" stroke-width="1.5" />
`}
```

### Margin Summary Component
```javascript
export function PriceChartSummary({ pricingData, hoveredIndex, pricesArray }) {
  const displaySlot = useComputed(() => {
    const pricing = pricingData.value;
    if (!pricing?.configured) return null;
    const idx = hoveredIndex.value;
    if (idx != null && pricing.slots?.[idx]) return pricing.slots[idx];
    return pricing.current || null;
  });
  // Render line 1 + line 2 from displaySlot
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Imperative DOM (createElementNS) | Declarative htm templates | Phase 8 | All new chart code uses htm/signals |
| Global mutable state (chartSelectionState) | Preact signals | Phase 8 | Selection state must be signal-based |
| Full-page polling for data | WebSocket + REST hybrid | Phase 9 | Prices arrive via WS, pricing comparison via REST |

**Deprecated/outdated:**
- Old `app.js` imperative chart rendering: still works in legacy UI, but new SPA uses declarative rendering
- `DVhubDashboard` global export: not used in new SPA (component imports instead)

## Open Questions

1. **Schedule panel refresh after chart creates rules**
   - What we know: Schedule panel uses `useApi('/api/schedule')` with a local `refresh` function
   - What's unclear: Best mechanism to trigger refresh from chart component
   - Recommendation: Export a `scheduleRefreshTrigger` signal from schedule-panel.js that, when incremented, triggers a re-fetch. Or use a lightweight custom event `dispatchEvent(new Event('schedule-updated'))`.

2. **Scale function compatibility**
   - What we know: Current `computeBarLayout` uses a simple midY-based scale (positive above, negative below). Old system uses `createPriceChartScale` with focus band logic.
   - What's unclear: Whether the simple scale is sufficient for import overlay alignment
   - Recommendation: The import overlay y-coordinates must use the SAME scale as the bars. Since `computeBarLayout` currently uses a midY-based linear scale, the overlay must match. If the scale needs to change (e.g., to support focus band), do it in this phase.

3. **Price data field format mismatch**
   - What we know: Old system uses `{ ts: epoch, ct_kwh: number }`. New system uses `{ time: ISO, price: number }`. The `userEnergyPricing.slots` array uses `{ ts: epoch, importPriceCtKwh, ... }`.
   - What's unclear: Whether `prices` signal data has a `ts` field or only `time`
   - Recommendation: The compute functions must handle the join between prices array timestamps and comparison slot timestamps. Use `new Date(time).getTime()` to normalize.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none (uses node --test) |
| Quick run command | `node --test dvhub/test/ui-price-chart.test.js` |
| Full suite command | `node --test dvhub/test/*.test.js` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHART-01 | Selection indices normalized, windows built from selection, range builder | unit | `node --test dvhub/test/ui-price-chart-selection.test.js -x` | No -- Wave 0 |
| CHART-02 | Comparison lookup per slot, tooltip content formatting | unit | `node --test dvhub/test/ui-price-chart-tooltip.test.js -x` | No -- Wave 0 |
| CHART-03 | Import overlay points computed, zero baseline position | unit | `node --test dvhub/test/ui-price-chart-overlay.test.js -x` | No -- Wave 0 |
| CHART-04 | Summary display slot resolution (current vs hovered) | unit | `node --test dvhub/test/ui-price-chart-summary.test.js -x` | No -- Wave 0 |
| CHART-05 | Rule creation from windows with defaults, merge with existing rules | unit | `node --test dvhub/test/ui-price-chart-rules.test.js -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test dvhub/test/ui-price-chart*.test.js`
- **Per wave merge:** `node --test dvhub/test/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `dvhub/test/ui-price-chart-selection.test.js` -- covers CHART-01 (normalizeSelectionIndices, buildScheduleWindows, buildSelectionRange, inferSlotMs)
- [ ] `dvhub/test/ui-price-chart-overlay.test.js` -- covers CHART-03 (computeImportOverlayPoints, zero baseline position)
- [ ] `dvhub/test/ui-price-chart-rules.test.js` -- covers CHART-05 (rule creation from windows with defaults, merge logic)

Note: CHART-02 (tooltip) and CHART-04 (summary) are primarily UI rendering concerns. The pure formatting functions (fmtCt, fmtSignedCt) already exist in dashboard-compute.js. Test any new pure compute functions only.

## Sources

### Primary (HIGH confidence)
- `dvhub/public/app.js` lines 254-694 -- reference implementation for all 4 features
- `dvhub/public/components/dashboard/price-chart.js` -- current chart component to extend
- `dvhub/public/components/dashboard/price-chart-compute.js` -- current pure compute module
- `dvhub/public/components/dashboard/schedule-panel.js` -- schedule refresh + default values pattern
- `dvhub/public/components/dashboard/schedule-compute.js` -- collectScheduleRulesFromRowState reuse
- `dvhub/public/components/shared/use-signal-store.js` -- existing signals (prices, telemetry)
- `dvhub/public/components/shared/use-api.js` -- apiFetch utility
- `dvhub/modules/gateway/index.js` -- slotComparison, userEnergyPricingSummary functions
- `dvhub/modules/gateway/telemetry.js` -- aggregate telemetry stream (does NOT include pricing)
- `dvhub/modules/gateway/routes/schedule.js` -- POST /api/schedule/rules (replaces manual rules)
- `dvhub/public/styles.css` -- existing .price-bar, .is-selected, .is-hovered, .chart-selection-callout CSS
- `dvhub/test/ui-price-chart.test.js` -- existing test for computeBarLayout
- `dvhub/test/dashboard-chart-selection.test.js` -- old system selection tests

### Secondary (MEDIUM confidence)
- (none)

### Tertiary (LOW confidence)
- (none)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, extending existing components
- Architecture: HIGH - all patterns established in prior phases (signals, compute modules, htm templates)
- Pitfalls: HIGH - verified by reading actual API implementation and data flow
- Data availability: HIGH - confirmed userEnergyPricing is in /api/status but NOT in WS telemetry stream

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no external dependencies changing)
