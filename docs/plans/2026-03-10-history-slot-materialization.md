# History Slot Materialization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lokale Live-Daten in materialisierte 15-Minuten-History-Slots ueberfuehren und spaeter mit VRM-Daten priorisiert zusammenfuehren, sodass die History nicht mehr allein vom Backfill abhaengt.

**Architecture:** `timeseries_samples` bleibt die append-only Rohdatenquelle. Zusaetzlich fuehrt eine neue Tabelle `energy_slots_15m` materialisierte Slot-Werte mit Herkunft (`local_live`, `vrm_import`) ein. Live-Polling aktualisiert offene Slots inkrementell; VRM schreibt spaeter denselben Slot mit hoeherer fachlicher Prioritaet. Die History liest primaer aus dieser Slot-Tabelle.

**Tech Stack:** Node.js, SQLite, `node:test`, Vanilla JS

---

### Task 1: Schema fuer materialisierte Slots anlegen

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/telemetry-store.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/telemetry-store.js`

**Step 1: Write the failing test**

- Erwartung: `energy_slots_15m` wird beim Store-Setup angelegt.
- Erwartung: eindeutige Schluessel und Grundschema sind vorhanden.

**Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-store.test.js`

**Step 3: Write minimal implementation**

- Neue Tabelle und Indizes anlegen.
- Keine bestehende Rohdatenlogik entfernen.

**Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-store.test.js`

### Task 2: Live-Rohdaten in 15-Minuten-Slots materialisieren

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/telemetry-store.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/telemetry-runtime.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/telemetry-store.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/server.js`

**Step 1: Write the failing test**

- Erwartung: Live-Samples aktualisieren den offenen 15-Minuten-Slot.
- Erwartung: Slot-Werte stimmen fuer Import, Export, PV, Akku und Last.

**Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-store.test.js test/telemetry-runtime.test.js`

**Step 3: Write minimal implementation**

- Slot-Upsert fuer `local_live` einbauen.
- Nur betroffene 15-Minuten-Slots aktualisieren.

**Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-store.test.js test/telemetry-runtime.test.js`

### Task 3: VRM-Import in dieselbe Slot-Tabelle schreiben

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/history-import.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/history-import.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/telemetry-store.js`

**Step 1: Write the failing test**

- Erwartung: VRM-Import schreibt `vrm_import`-Slots.
- Erwartung: vorhandene `local_live`-Slots bleiben vorhanden, werden aber fachlich uebersteuerbar.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-import.test.js test/telemetry-store.test.js`

**Step 3: Write minimal implementation**

- Slot-Upsert fuer `vrm_import` ergaenzen.
- Prioritaetslogik fuer spaeteres Lesen vorbereiten.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-import.test.js test/telemetry-store.test.js`

### Task 4: History-Lesepfad auf materialisierte Slots umstellen

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/history-runtime.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/history-runtime.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/telemetry-store.js`

**Step 1: Write the failing test**

- Erwartung: History liest vergangene Tage und den laufenden Tag aus `energy_slots_15m`.
- Erwartung: `vrm_import` gewinnt vor `local_live`.
- Erwartung: ohne VRM faellt History auf `local_live` zurueck.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-runtime.test.js`

**Step 3: Write minimal implementation**

- Neue Slot-Lesefunktion einfuehren.
- Bestehende Rohdatenaggregation nur als Fallback/Debug erhalten.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-runtime.test.js`

### Task 5: Herkunft in UI/API sichtbar machen

**Files:**
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/test/history-page.test.js`
- Modify: `/Volumes/My Shared Files/CODEX/DVhub/dvhub/public/history.js`

**Step 1: Write the failing test**

- Erwartung: UI kann lokale provisorische und durch VRM bestaetigte Werte unterscheiden.

**Step 2: Run test to verify it fails**

Run: `node --test test/history-page.test.js`

**Step 3: Write minimal implementation**

- Slot-Herkunft in Response und Banner/Statusanzeige aufnehmen.

**Step 4: Run test to verify it passes**

Run: `node --test test/history-page.test.js`

### Task 6: Gesamtverifikation

**Files:**
- Modify: keine weiteren Dateien geplant

**Step 1: Run targeted verification**

Run: `node --test test/telemetry-store.test.js test/telemetry-runtime.test.js test/history-import.test.js test/history-runtime.test.js test/history-page.test.js`

**Step 2: Run full verification**

Run: `npm test`

**Step 3: Review output**

- Sicherstellen, dass Rohdaten, Slot-Materialisierung, VRM-Priorisierung und History-UI konsistent bleiben.
