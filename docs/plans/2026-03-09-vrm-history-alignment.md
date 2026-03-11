# VRM History Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Den VRM-Historienimport, die Aggregation und die UI so erweitern, dass DVhub auf 15-Minuten-Basis deutlich naeher an den VRM-Energieflussen arbeitet und zusaetzliche Erzeugungs-, Verbrauchs- und Eigenverbrauchswerte sichtbar macht.

**Architecture:** Der Importmanager normiert VRM-Stats immer auf `15mins` und mappt zusaetzliche VRM-Flusscodes in ein erweitertes kanonisches Energieflussmodell. Die Runtime nutzt diese Primaerserien bevorzugt gegenueber Rekonstruktionen und liefert reichhaltigere Rows/KPIs/Charts. Live-Telemetrie wird um fehlende Flussserien ergaenzt und die UI zeigt die neuen Werte in Importpanel, Historie und Inspector an.

**Tech Stack:** Node.js, `node:test`, Vanilla JS, HTML, CSS, SQLite

---

### Task 1: History-Import-UI und Requests auf 15 Minuten festziehen

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/settings-history-import.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/settings.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/tools.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/tools.html`

**Step 1: Write the failing test**

- Erwartung: `buildHistoryImportRequest()` sendet immer `15mins`.
- Erwartung: Die UI bietet kein frei waehlbares Intervall mehr an.

**Step 2: Run test to verify it fails**

Run: `node --test test/settings-history-import.test.js`

**Step 3: Write minimal implementation**

- Request builder auf `15mins` normieren.
- Interval-Selector entfernen oder als feste Info rendern.

**Step 4: Run test to verify it passes**

Run: `node --test test/settings-history-import.test.js`

### Task 2: VRM-Import-Mappings testgetrieben erweitern

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/history-import.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/history-import.js`

**Step 1: Write the failing test**

- Erwartung: zusaetzliche VRM-Fluesse wie `Bc`, `Bg`, `Gb`, `Pc`, `Pb`, `Gc` werden als Roh- und Hilfsserien gespeichert.
- Erwartung: Importmanager ignoriert abweichende Intervalle und nutzt intern `15mins`.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-import.test.js`

**Step 3: Write minimal implementation**

- VRM-Mapping verbreitern.
- Intervall serverseitig immer auf `15mins` normieren.
- Metadaten fuer Roh- vs. kanonische Ableitungen sauber markieren.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-import.test.js`

### Task 3: Live-Telemetrie erweitern

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/telemetry-runtime.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/telemetry-runtime.js`

**Step 1: Write the failing test**

- Erwartung: erweiterte Live-Flussserien werden gespeichert, wenn der Victron-State sie liefert oder ableitbar ist.

**Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-runtime.test.js`

**Step 3: Write minimal implementation**

- Zusätzliche Live-Samples schreiben.
- Nur stabile Serien aufnehmen, keine spekulativen Felder.

**Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-runtime.test.js`

### Task 4: History-Runtime und UI auf breitere Flussdaten umstellen

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/history-runtime.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/history-page.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/history-runtime.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/history.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/history.html`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/styles.css`

**Step 1: Write the failing test**

- Erwartung: Summary/Rows/KPIs enthalten breitere Eigenverbrauchs- und Flusswerte.
- Erwartung: History-Inspector und Tabelle zeigen neue VRM-nahe Werte sichtbar an.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js test/history-page.test.js`

**Step 3: Write minimal implementation**

- Runtime bevorzugt echte Flusssignale gegenueber Fallback-Rekonstruktionen.
- UI erweitert KPI-/Inspector-/Tabellenanzeige.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js test/history-page.test.js`

### Task 5: Gesamtverifikation

**Files:**
- Modify: keine weiteren Dateien geplant

**Step 1: Run targeted verification**

Run: `node --test test/settings-history-import.test.js test/history-import.test.js test/telemetry-runtime.test.js test/history-runtime.test.js test/history-page.test.js`

**Step 2: Run full relevant suite**

Run: `npm test`

**Step 3: Review output**

- Sicherstellen, dass VRM-Import, History und bestehende Chart-/Preislogik keine Regressionen zeigen.
