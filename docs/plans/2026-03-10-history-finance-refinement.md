# History Finance Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correct the feed-in revenue model, collapse aggregated history views into a single wide net-analysis card, and hide secondary details behind explicit user interaction.

**Architecture:** Start by proving the runtime revenue calculation against multi-slot export data with varying market prices. Then adapt the history page so that day view keeps detailed charts while week/month/year render a single combined analysis surface, a collapsed details section, and compact status metadata. Keep `avoidedImportGrossEur` visible as an informational value, but exclude it from the true net calculation.

**Tech Stack:** Node.js, vanilla JS frontend, server-rendered HTML/CSS, node:test

---

### Task 1: Prove and, if needed, fix slot-accurate feed-in revenue

**Files:**
- Modify: `dvhub/history-runtime.js`
- Test: `dvhub/test/history-runtime.test.js`

**Step 1: Write the failing test**

Add a runtime test with at least two export slots that have different:
- `exportKwh`
- `priceCtKwh`

Assert that:
- each slot gets the exact `exportRevenueEur` for its own price
- the KPI total equals the sum of the slot revenues
- the first aggregated row matches the sum of the underlying slot revenues

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js`
Expected: FAIL if price-to-slot mapping or aggregation is wrong.

**Step 3: Write minimal implementation**

In `dvhub/history-runtime.js`:
- trace how `priceByTs` is matched against energy slots
- correct slot-level `exportRevenueEur` if timestamps or aggregation are misaligned
- keep `Erlös Einspeisung` strictly limited to exported kWh times market price

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/history-runtime.js dvhub/test/history-runtime.test.js
git commit -m "fix: align history feed-in revenue calculation"
```

### Task 2: Rework aggregated finance data for the single net-analysis card

**Files:**
- Modify: `dvhub/history-runtime.js`
- Test: `dvhub/test/history-runtime.test.js`

**Step 1: Write the failing test**

Add assertions for week/month/year chart payloads that expect one combined aggregated finance model containing:
- `exportRevenueEur`
- `gridCostEur`
- `pvCostEur`
- `batteryCostEur`
- `avoidedImportGrossEur`
- energy context values like `importKwh`, `pvShareKwh`, `batteryShareKwh`, `exportKwh`

Also assert that `netEur` excludes `avoidedImportGrossEur`.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js`
Expected: FAIL because the current payload does not fully express the new analysis model.

**Step 3: Write minimal implementation**

In `dvhub/history-runtime.js`:
- adjust aggregated chart payloads to represent the new net-analysis card directly
- ensure `avoidedImportGrossEur` stays separate from true net
- keep day-view chart payloads unchanged unless required by runtime fixes

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/history-runtime.js dvhub/test/history-runtime.test.js
git commit -m "refactor: reshape aggregated history finance payloads"
```

### Task 3: Replace aggregated chart layout with one wide net-analysis card

**Files:**
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add page assertions for week/month/year that expect:
- one wide `Netto-Analyse` chart area
- no separate aggregated `Energie` chart
- no separate aggregated `Preise` chart
- visible labels for real money-flow series and energy context series
- visible `Netto` emphasis and separate `Vermiedene Bezugskosten` info value

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the current aggregated view still renders separate chart containers and legacy copy.

**Step 3: Write minimal implementation**

Update:
- `dvhub/public/history.html` to support a single aggregated analysis layout
- `dvhub/public/history.js` to render one combined chart in week/month/year
- `dvhub/public/styles.css` to give the analysis card more width and remove redundant panel spacing

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "feat: unify aggregated history net analysis"
```

### Task 4: Make the detail table collapsible by default

**Files:**
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add page assertions that expect:
- a toggle control for the detail section
- the table content to be collapsed by default
- the expanded state to render the same table when toggled on

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the table is currently always visible.

**Step 3: Write minimal implementation**

Update:
- `history.html` to add a details toggle shell
- `history.js` to track expanded/collapsed state and render accordingly
- `styles.css` to style the collapsed and expanded states

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "feat: collapse history detail table by default"
```

### Task 5: Reduce the status copy and move source details behind lightweight info UI

**Files:**
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add page assertions that expect:
- short status copy instead of the long explanatory banner text
- an info affordance for source and estimation metadata
- no verbose provenance sentence in the main banner

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the current banner still renders detailed provenance text inline.

**Step 3: Write minimal implementation**

Update:
- `history.js` to shorten the status line and populate a compact info element
- `history.html` to host the info trigger/content
- `styles.css` to style the compact metadata presentation

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "refactor: compact history status metadata"
```

### Task 6: Full verification

**Files:**
- Verify only

**Step 1: Run targeted tests**

Run:

```bash
node --test test/history-runtime.test.js
node --test test/history-page.test.js
```

Expected: PASS

**Step 2: Run full suite**

Run:

```bash
npm test
```

Expected: PASS with `0` failures.

**Step 3: Commit final polish if needed**

```bash
git add dvhub/history-runtime.js dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-runtime.test.js dvhub/test/history-page.test.js
git commit -m "fix: refine history finance follow-up"
```
