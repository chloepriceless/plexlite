# History Summary And Market Premium Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the history KPI strip with one summary card that combines net, saved-money, and energy quantities, and add year-view market premium calculation from weighted plant metadata and official reference values.

**Architecture:** First extend configuration and runtime data so the year view can compute a weighted anzulegender Wert, a premium-eligible export quantity, and a market premium without guessing missing official data. Then replace the old KPI strip with a single summary card rendered consistently across all views, while keeping the existing chart/table analysis below it.

**Tech Stack:** Node.js, vanilla JS frontend, server-rendered HTML/CSS, node:test

---

### Task 1: Add failing tests for PV plant configuration metadata

**Files:**
- Modify: `dvhub/config.js`
- Test: `dvhub/test/config.test.js`
- Test: `dvhub/test/settings-page.test.js`

**Step 1: Write the failing test**

Add tests that expect configuration support for multiple PV plants with:
- `kwp`
- `commissionedAt`

Assert normalization, serialization, and settings exposure for multiple entries.

**Step 2: Run test to verify it fails**

Run: `node --test test/config.test.js test/settings-page.test.js`
Expected: FAIL because PV plant metadata is not yet part of the config model.

**Step 3: Write minimal implementation**

Update:
- `dvhub/config.js`
- any settings schema or page helpers that expose editable config fields

Add the minimum structure needed for multiple PV plants tied to inbetriebnahme-based premium lookup.

**Step 4: Run test to verify it passes**

Run: `node --test test/config.test.js test/settings-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/config.js dvhub/test/config.test.js dvhub/test/settings-page.test.js
git commit -m "feat: add pv plant premium metadata"
```

### Task 2: Add failing tests for weighted anzulegender Wert and premium-eligible export

**Files:**
- Modify: `dvhub/history-runtime.js`
- Test: `dvhub/test/history-runtime.test.js`

**Step 1: Write the failing test**

Add runtime tests for year view that prove:
- multiple PV plants produce one weighted anzulegender Wert by `kWp`
- only exports from slots with market price `>= 0` count toward the premium-eligible export quantity
- slots with negative market price are excluded from the premium quantity

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js`
Expected: FAIL because runtime does not yet compute these annual premium inputs.

**Step 3: Write minimal implementation**

In `dvhub/history-runtime.js`:
- compute weighted anzulegender Wert from configured PV plants
- compute premium-eligible annual export quantity from slot prices
- expose both values in the annual summary payload

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/history-runtime.js dvhub/test/history-runtime.test.js
git commit -m "feat: add annual premium eligibility inputs"
```

### Task 3: Add failing tests for year-view market premium calculation

**Files:**
- Modify: `dvhub/history-runtime.js`
- Test: `dvhub/test/history-runtime.test.js`

**Step 1: Write the failing test**

Add tests that expect year view to expose:
- `annualMarketValueCtKwh`
- `weightedApplicableValueCtKwh`
- `premiumEligibleExportKwh`
- `marketPremiumEur`

Assert:
- `marketPremiumEur = premiumEligibleExportKwh * (weightedApplicableValueCtKwh - annualMarketValueCtKwh) / 100`
- no premium is produced when official values are missing

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js`
Expected: FAIL because market premium is not yet part of the year summary.

**Step 3: Write minimal implementation**

Extend `dvhub/history-runtime.js` to compute and expose annual premium fields without changing non-year behavior.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/history-runtime.js dvhub/test/history-runtime.test.js
git commit -m "feat: calculate annual market premium"
```

### Task 4: Add failing tests for the unified history summary card

**Files:**
- Modify: `dvhub/public/history.html`
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add page assertions that expect:
- the old KPI grid to be absent from rendered history summaries
- one unified summary card instead
- the card to show:
  - `Bezugs-Kosten`
  - `Erlös aus Einspeisung`
  - `Netto`
  - `Vermiedene Bezugskosten`
  - `PV brutto`
  - `Akku brutto`
  - `PV Kosten`
  - `Akku Kosten`
  - `Gespartes Geld`
  - `Brutto-"Erlös"`
  - `Bezug`
  - `Verbrauch`
  - `PV erzeugt`
  - `Einspeisung`

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the UI still renders the legacy KPI strip.

**Step 3: Write minimal implementation**

Update:
- `dvhub/public/history.html`
- `dvhub/public/history.js`
- `dvhub/public/styles.css`

Replace the KPI strip with one summary card shared by all views.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "feat: replace history kpi strip with summary card"
```

### Task 5: Add failing tests for year-only premium fields in the summary card

**Files:**
- Modify: `dvhub/public/history.js`
- Modify: `dvhub/public/styles.css`
- Test: `dvhub/test/history-page.test.js`

**Step 1: Write the failing test**

Add page assertions for year view that expect the summary card to show:
- `Jahresmarktwert`
- `förderfähige Einspeisemenge`
- `Marktprämie`
- a graceful `noch nicht verfügbar` state when the reference values are absent

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`
Expected: FAIL because the year summary card does not yet render market premium values.

**Step 3: Write minimal implementation**

Render year-only premium fields inside the summary card using the runtime payload from Tasks 2 and 3.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-page.test.js
git commit -m "feat: show annual market premium in history summary"
```

### Task 6: Add official-value fetch/storage support for anzulegender Wert

**Files:**
- Create or modify: reference-data fetch/storage modules under `dvhub/`
- Modify: settings/runtime integration files as needed
- Test: `dvhub/test/*.test.js`

**Step 1: Write the failing test**

Add tests that expect official-value lookup or scrape integration to:
- resolve anzulegender Wert from plant commissioning metadata
- persist the resolved value in a reusable reference-data form

**Step 2: Run test to verify it fails**

Run: `node --test <targeted tests>`
Expected: FAIL because the reference-data source does not yet exist.

**Step 3: Write minimal implementation**

Create the smallest maintainable integration that:
- fetches/scrapes official applicable values
- keys them by the needed commissioning criteria
- feeds the weighted annual premium calculation

**Step 4: Run test to verify it passes**

Run: `node --test <targeted tests>`
Expected: PASS

**Step 5: Commit**

```bash
git add <touched files>
git commit -m "feat: import applicable values for market premium"
```

### Task 7: Full verification

**Files:**
- Verify only

**Step 1: Run focused tests**

Run:

```bash
node --test test/history-runtime.test.js
node --test test/history-page.test.js
node --test test/config.test.js test/settings-page.test.js
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
git add dvhub/config.js dvhub/history-runtime.js dvhub/public/history.html dvhub/public/history.js dvhub/public/styles.css dvhub/test/history-runtime.test.js dvhub/test/history-page.test.js dvhub/test/config.test.js dvhub/test/settings-page.test.js docs/plans/2026-03-10-history-summary-premium-design.md docs/plans/2026-03-10-history-summary-premium.md
git commit -m "feat: add history summary card and annual market premium"
```
