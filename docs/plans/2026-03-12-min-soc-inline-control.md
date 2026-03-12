# Minimum-SOC Inline Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the lower manual `Minimum-SOC (%)` write control with an inline dashboard control at `ANLAGE > ZUSATZWERTE`, including popup slider editing, explicit submit, and pending blink until readback confirms the change.

**Architecture:** Keep the existing `POST /api/control/write` path for `minSocPct` and move the interaction into the dashboard UI. Add a compact popup editor in `index.html`, style it in `styles.css`, and extend `app.js` with small pure helpers for popup state, pending write tracking, submit handling, and readback reconciliation. Cover the behavior with a new dashboard-focused `node:test` suite plus the existing application tests.

**Tech Stack:** Node.js, vanilla browser JavaScript, existing DVhub dashboard HTML/CSS, `node:test`, `vm`

---

### Task 1: Add dashboard test coverage for Minimum-SOC interaction helpers

**Files:**
- Create: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/app.js`

**Step 1: Write the failing test**

```js
test('createMinSocPendingState keeps the previous readback and submitted target together', () => {
  const helpers = loadDashboardHelpers();
  const pending = helpers.createMinSocPendingState({
    currentReadback: 14,
    submittedValue: 20,
    submittedAt: 1234
  });

  assert.deepEqual(pending, {
    previousReadback: 14,
    targetValue: 20,
    submittedAt: 1234
  });
});

test('resolveMinSocPendingState clears when a fresh readback confirms the submitted target', () => {
  const helpers = loadDashboardHelpers();
  const next = helpers.resolveMinSocPendingState({
    pendingState: { previousReadback: 14, targetValue: 20, submittedAt: 1234 },
    readbackValue: 20
  });

  assert.equal(next, null);
});
```

**Step 2: Run test to verify it fails**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: FAIL because the dashboard helper test file and exported helpers do not exist yet.

**Step 3: Write minimal implementation**

```js
function createMinSocPendingState({ currentReadback, submittedValue, submittedAt = Date.now() }) {
  return {
    previousReadback: currentReadback,
    targetValue: submittedValue,
    submittedAt
  };
}

function resolveMinSocPendingState({ pendingState, readbackValue }) {
  if (!pendingState) return null;
  if (readbackValue === pendingState.targetValue) return null;
  if (readbackValue !== pendingState.previousReadback) return null;
  return pendingState;
}
```

**Step 4: Run test to verify it passes**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/app.js dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "test: cover min soc dashboard helpers"
```

### Task 2: Add the inline Minimum-SOC editor markup and remove the old lower write block

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/index.html`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`

**Step 1: Write the failing test**

```js
test('dashboard markup exposes a single top-level Minimum-SOC editor and removes the old manual write block', () => {
  const html = fs.readFileSync(indexPath, 'utf8');

  assert.match(html, /id="minSocRow"/);
  assert.match(html, /id="minSocEditor"/);
  assert.match(html, /id="minSocSlider"/);
  assert.match(html, /id="minSocSubmitBtn"/);
  assert.doesNotMatch(html, /manualMinSocValue/);
  assert.doesNotMatch(html, /manualMinSocBtn/);
});
```

**Step 2: Run test to verify it fails**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: FAIL because the dashboard HTML still contains the lower manual control and no popup editor markup.

**Step 3: Write minimal implementation**

```html
<div id="minSocRow" class="metric-row metric-row-action" role="button" tabindex="0" aria-expanded="false" aria-controls="minSocEditor">
  <span>Minimum-SOC <small>Anpassen</small></span>
  <strong id="minSoc">-</strong>
</div>
<div id="minSocEditor" class="min-soc-editor" hidden>
  <label for="minSocSlider">Minimum-SOC</label>
  <input id="minSocSlider" type="range" min="0" max="100" step="1" value="20" />
  <strong id="minSocEditorValue">20 %</strong>
  <button id="minSocSubmitBtn" class="btn btn-primary" type="button">Absenden</button>
</div>
```

Remove:

```html
<label>Minimum-SOC (%) <input id="manualMinSocValue" type="number" value="20" /></label>
<button id="manualMinSocBtn">Schreiben</button>
```

**Step 4: Run test to verify it passes**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/index.html dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "feat: move min soc control into dashboard metric"
```

### Task 3: Style the editor, affordance, and pending blink state

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/styles.css`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`

**Step 1: Write the failing test**

```js
test('dashboard styles define interactive Minimum-SOC row, popup editor, and pending state classes', () => {
  const css = fs.readFileSync(stylesPath, 'utf8');

  assert.match(css, /\.metric-row-action/);
  assert.match(css, /\.min-soc-editor/);
  assert.match(css, /\.min-soc-pending/);
  assert.match(css, /@keyframes\s+minSocPulse/);
});
```

**Step 2: Run test to verify it fails**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: FAIL because the CSS has no Minimum-SOC specific editor or pending-state styles yet.

**Step 3: Write minimal implementation**

```css
.metric-row-action {
  cursor: pointer;
  position: relative;
}

.min-soc-editor {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 10px);
}

.min-soc-pending {
  animation: minSocPulse 1.2s ease-in-out infinite;
}

@keyframes minSocPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
```

**Step 4: Run test to verify it passes**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/styles.css dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "feat: style min soc inline editor"
```

### Task 4: Wire popup open/close, slider preview, and submit handling in the dashboard

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/app.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`

**Step 1: Write the failing test**

```js
test('submitMinSocUpdate posts minSocPct and requests popup close plus pending state', async () => {
  const helpers = loadDashboardHelpers({
    apiFetch: async (_url, options) => ({
      ok: true,
      json: async () => ({ ok: true, options })
    })
  });

  const result = await helpers.submitMinSocUpdate({
    sliderValue: '20',
    currentReadback: 14
  });

  assert.equal(result.ok, true);
  assert.equal(JSON.parse(result.request.body).target, 'minSocPct');
  assert.equal(JSON.parse(result.request.body).value, 20);
  assert.equal(result.closeEditor, true);
  assert.deepEqual(result.pendingState, {
    previousReadback: 14,
    targetValue: 20,
    submittedAt: result.pendingState.submittedAt
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: FAIL because there is no dashboard submit helper that isolates the write request and pending-state creation.

**Step 3: Write minimal implementation**

```js
async function submitMinSocUpdate({ sliderValue, currentReadback, apiFetchImpl = apiFetch }) {
  const value = Number(sliderValue);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Min SOC: Ungültiger Wert' };
  }
  const request = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target: 'minSocPct', value })
  };
  const response = await apiFetchImpl('/api/control/write', request);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    return { ok: false, error: `MinSOC Write Fehler: ${payload.error || response.status}` };
  }
  return {
    ok: true,
    request,
    closeEditor: true,
    pendingState: createMinSocPendingState({ currentReadback, submittedValue: value })
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/app.js dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "feat: wire min soc dashboard submit flow"
```

### Task 5: Reconcile pending state from readback and expose the blink class in the rendered dashboard

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/app.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`

**Step 1: Write the failing test**

```js
test('renderDashboardStatus clears pending blink after changed Minimum-SOC readback arrives', () => {
  const helpers = loadDashboardHelpers();
  const state = {
    pendingMinSocWrite: { previousReadback: 14, targetValue: 20, submittedAt: 1234 }
  };

  const result = helpers.computeMinSocRenderState({
    readbackValue: 20,
    pendingState: state.pendingMinSocWrite
  });

  assert.equal(result.pendingState, null);
  assert.equal(result.shouldBlink, false);
});

test('renderDashboardStatus keeps pending blink while readback still matches the old value', () => {
  const helpers = loadDashboardHelpers();
  const result = helpers.computeMinSocRenderState({
    readbackValue: 14,
    pendingState: { previousReadback: 14, targetValue: 20, submittedAt: 1234 }
  });

  assert.equal(result.shouldBlink, true);
});
```

**Step 2: Run test to verify it fails**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: FAIL because the dashboard render path does not yet derive the pending blink state from readback transitions.

**Step 3: Write minimal implementation**

```js
function computeMinSocRenderState({ readbackValue, pendingState }) {
  const nextPending = resolveMinSocPendingState({ pendingState, readbackValue });
  return {
    pendingState: nextPending,
    shouldBlink: Boolean(nextPending)
  };
}

function applyMinSocPendingVisualState(shouldBlink) {
  document.getElementById('minSoc')?.classList.toggle('min-soc-pending', shouldBlink);
}
```

Then update `renderDashboardStatus()` to:
- compute next pending state from `vic.minSocPct`
- persist the updated pending state
- toggle the CSS class on `#minSoc`

**Step 4: Run test to verify it passes**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/app.js dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "feat: confirm min soc writes from dashboard readback"
```

### Task 6: Hook the real DOM events and protect failure paths

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/app.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`

**Step 1: Write the failing test**

```js
test('invalid or failed submit does not leave Minimum-SOC in a pending state', async () => {
  const helpers = loadDashboardHelpers({
    apiFetch: async () => ({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'write failed' })
    })
  });

  const result = await helpers.submitMinSocUpdate({
    sliderValue: '20',
    currentReadback: 14
  });

  assert.equal(result.ok, false);
  assert.equal(result.pendingState, undefined);
});
```

**Step 2: Run test to verify it fails**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: FAIL because the submit flow does not yet explicitly guard the no-pending-on-error path.

**Step 3: Write minimal implementation**

```js
function bindMinSocControls() {
  document.getElementById('minSocRow')?.addEventListener('click', openMinSocEditor);
  document.getElementById('minSocSubmitBtn')?.addEventListener('click', handleMinSocSubmit);
  document.getElementById('minSocSlider')?.addEventListener('input', syncMinSocEditorPreview);
}

async function handleMinSocSubmit() {
  const outcome = await submitMinSocUpdate({
    sliderValue: document.getElementById('minSocSlider')?.value,
    currentReadback: dashboardState.lastMinSocReadback
  });
  if (!outcome.ok) return setControlMsg(outcome.error, true);
  dashboardState.pendingMinSocWrite = outcome.pendingState;
  closeMinSocEditor();
  setControlMsg(`Min SOC geschrieben: ${outcome.pendingState.targetValue} %`);
  await requestDashboardRefresh();
}
```

**Step 4: Run test to verify it passes**

Run: `cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test test/dashboard-min-soc-inline-control.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/app.js dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "feat: bind min soc inline dashboard controls"
```

### Task 7: Run regression verification across the touched dashboard paths

**Files:**
- Verify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/index.html`
- Verify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/app.js`
- Verify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/styles.css`
- Verify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-min-soc-inline-control.test.js`
- Verify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dashboard-chart-selection.test.js`
- Verify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/dv-control-readback-runtime.test.js`

**Step 1: Run the focused dashboard tests**

```bash
cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test \
  test/dashboard-min-soc-inline-control.test.js \
  test/dashboard-chart-selection.test.js \
  test/dv-control-readback-runtime.test.js
```

Expected: PASS

**Step 2: Run the full test suite**

```bash
cd '/Volumes/My Shared Files/CODEX/DVhub/dvhub' && node --test
```

Expected: PASS with no new failures.

**Step 3: Run diff hygiene**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' diff --check
```

Expected: no output.

**Step 4: Commit**

```bash
git -C '/Volumes/My Shared Files/CODEX/DVhub' add dvhub/public/index.html dvhub/public/app.js dvhub/public/styles.css dvhub/test/dashboard-min-soc-inline-control.test.js
git -C '/Volumes/My Shared Files/CODEX/DVhub' commit -m "feat: add inline min soc dashboard control"
```
