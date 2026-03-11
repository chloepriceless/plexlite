# History Finance Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split history revenue into feed-in revenue and avoided import costs, expose the PV and battery gross savings breakdown, and simplify the finance/price charts for aggregated views.

**Architecture:** Extend the history runtime to compute avoided import gross values alongside the existing feed-in revenue and cost fields. Then update the History UI to render the new KPI model and collapse aggregated finance visualizations into one combined chart while removing the low-value weekly/monthly/yearly price comparison chart.

**Tech Stack:** Node.js, vanilla JS frontend, server-rendered static HTML/CSS, node:test

---

### Task 1: Add runtime fields for avoided import gross values

**Files:**
- Modify: `dvhub/history-runtime.js`
- Test: `dvhub/test/history-runtime.test.js`

**Step 1: Write the failing test**

Add a test that expects:
- `avoidedImportGrossEur`
- `avoidedImportPvGrossEur`
- `avoidedImportBatteryGrossEur`

for a slot/summary that already has `pvShareKwh`, `batteryShareKwh`, and `userImportPriceCtKwh`.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js`
Expected: FAIL because the new fields are missing or `undefined`.

**Step 3: Write minimal implementation**

In `dvhub/history-runtime.js`:
- compute slot-level avoided gross values from `pvShareKwh` and `batteryShareKwh`
- add them to slot payloads
- aggregate them into row totals and KPI totals

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/history-runtime.js dvhub/test/history-runtime.test.js
git commit -m "feat: add avoided import history metrics"
```

### Task 2: Add KPI cards and savings breakdown in the History UI

**Files:**
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add page assertions for:
- renamed KPI `Erlös Einspeisung`
- new KPI card `Vermiedene Bezugskosten`
- sublabels/values for `PV brutto`, `Akku brutto`, `PV-Kosten`, `Akku-Kosten`

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the new card and texts are not rendered yet.

**Step 3: Write minimal implementation**

Update:
- `history.html` to add the new KPI structure
- `history.js` to bind the new values
- `styles.css` to keep the KPI cards compact and one-row on desktop

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "feat: add history avoided import kpi"
```

### Task 3: Simplify aggregated charts

**Files:**
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add assertions that:
- week/month/year no longer render the `Marktpreis` vs `Bezug` chart
- finance bars render in one combined chart block

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the old chart layout is still present.

**Step 3: Write minimal implementation**

In `history.js`:
- skip aggregated price chart rendering for week/month/year
- combine finance chart output into one shared chart flow for aggregated views

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.js dvhub/public/history.html dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "refactor: simplify history finance charts"
```

### Task 4: Full verification

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
git commit -m "fix: refine history finance presentation"
```
