# History Slot Materialization Design

**Status:** Validiert am 2026-03-10

**Ziel:** DVhub soll lokale Live-Daten sofort in nutzbare 15-Minuten-History-Slots ueberfuehren und spaeter mit VRM-Daten abgleichen, statt vergangene Zeitraeume nur aus Backfill zu bedienen.

## Problem

- Live-Daten werden aktuell als Rohsamples mit `scope = 'live'` gespeichert.
- VRM-Import schreibt spaeter getrennte `history`-Samples.
- Vergangene Tage haengen damit fachlich von VRM ab.
- Die History muss ausserdem Rohdaten zur Laufzeit aggregieren oder zwischen `live` und `history` umschalten.
- Das ist fehleranfaellig, teuer und erschwert den Vergleich zwischen lokalen Daten und VRM.

## Zielbild

DVhub bekommt drei Ebenen:

- `raw samples`
  - append-only Rohdaten aus Live, VRM und Preisen
- `provisional slots`
  - lokal aus Live-Werten gebildete 15-Minuten-Slots
- `reconciled slots`
  - spaeter durch VRM bestaetigte oder ersetzte 15-Minuten-Slots

Die History liest primaer aus materialisierten 15-Minuten-Slots statt Rohdaten.

## Datenmodell

### Bestehend

- `timeseries_samples`
  - bleibt Rohdatenablage
  - weiter fuer Debug, Nachvollziehbarkeit und spaetere Rekonstruktionen

### Neu

- `energy_slots_15m`
  - materialisierte 15-Minuten-Slots fuer Energie- und Flusswerte

Vorgeschlagene Spalten:

- `slot_start_utc TEXT NOT NULL`
- `series_key TEXT NOT NULL`
- `source_kind TEXT NOT NULL`
  - `local_live`
  - `vrm_import`
  - `reconciled`
- `quality TEXT NOT NULL`
  - `raw_derived`
  - `backfilled`
  - `verified`
- `value_num REAL`
- `unit TEXT`
- `meta_json TEXT`
- `created_at TEXT`
- `updated_at TEXT`

Eindeutigkeit:

- `UNIQUE(slot_start_utc, series_key, source_kind)`

Optional spaeter:

- `coverage_ratio REAL`
- `sample_count INTEGER`
- `reconciled_with TEXT`

## Schreibpfade

### Live

- Live-Polling schreibt weiter Rohsamples in `timeseries_samples`.
- Zusaetzlich aktualisiert es den betroffenen 15-Minuten-Slot in `energy_slots_15m`.
- Diese Slots tragen `source_kind = 'local_live'`.
- Die Slot-Bildung erfolgt inkrementell innerhalb des offenen 15-Minuten-Fensters.

### VRM

- VRM-Import schreibt weiter Roh-History in `timeseries_samples`.
- Zusaetzlich schreibt er dieselben 15-Minuten-Werte in `energy_slots_15m` mit `source_kind = 'vrm_import'`.
- Wenn fuer denselben Slot bereits lokale Werte existieren, wird eine Reconciliation-Regel angewendet.

## Reconciliation

Regel fuer dieselbe 15-Minuten-Periode:

- Wenn nur `local_live` vorhanden ist, wird dieser Slot fuer die History verwendet.
- Wenn `vrm_import` vorhanden ist, gewinnt VRM fachlich gegen lokal aggregierte Schaetzungen.
- Optional wird ein dritter Datensatz `reconciled` geschrieben, wenn:
  - Werte identisch oder nahe genug sind und wir den Slot als bestaetigt markieren wollen
  - oder wir eine kombinierte Entscheidung dokumentieren wollen

Startversion:

- History liest bevorzugt `vrm_import`, sonst `local_live`.
- `reconciled` kann als spaetere Ausbaustufe vorbereitet werden, muss aber nicht im ersten Schritt voll genutzt werden.

## Lesepfad

- History-API liest primaer aus `energy_slots_15m`.
- Rohdatenaggregation aus `timeseries_samples` bleibt nur:
  - fuer Debug-Endpunkte
  - fuer Rueckrechnungen
  - fuer Migration/Recovery

Vorteile:

- keine teure Neuaggregation bei jedem Request
- klare Prioritaet zwischen lokal und VRM
- vergangene Tage bleiben auch ohne sofortigen VRM-Backfill sichtbar

## API- und UI-Auswirkungen

- History-Responses koennen pro Slot/Row die Herkunft ausgeben:
  - `local_live`
  - `vrm_import`
  - spaeter `reconciled`
- Die UI kann unbestaetigte lokale Tage markieren.
- Nach VRM-Abgleich kann die UI denselben Zeitraum als bestaetigt anzeigen.

## Migration

- Schemaerweiterung erfolgt additive per neuer Tabelle.
- Bestehende `timeseries_samples` bleiben unveraendert nutzbar.
- Ein einmaliger Backfill-Job kann vorhandene Rohdaten in `energy_slots_15m` materialisieren.
- Ohne Migration kann die neue Tabelle leer starten und sich zunaechst nur aus neuen Daten fuellen.

## SQLite-Einschaetzung

- SQLite bleibt passend.
- Das Hauptproblem ist aktuell nicht die Datenbank-Engine, sondern dass 15-Minuten-History nicht materialisiert ist.
- Mit einer separaten Slot-Tabelle, WAL und klaren Indizes ist SQLite fuer eine Einzelanlage fachlich und technisch ausreichend.
- Ein Wechsel auf InfluxDB, Postgres oder Timeseries-DB wuerde die Modellschwaechen nicht automatisch loesen und waere fuer den aktuellen Umfang ueberdimensioniert.

## Risiken

- Doppelte Wahrheit zwischen Rohdaten und Slots, wenn Reconciliation-Regeln unsauber sind.
- Offene Slots des laufenden Quartals muessen stabil aktualisiert werden, ohne Race Conditions.
- Historische Abweichungen zwischen lokal und VRM muessen sichtbar, aber nicht verwirrend dargestellt werden.

## Tests

- Tests fuer inkrementelles Schreiben lokaler 15-Minuten-Slots.
- Tests fuer Priorisierung `vrm_import` vor `local_live`.
- Tests fuer History-Lesen aus der neuen Slot-Tabelle.
- Tests fuer Rueckfall auf lokale Slots, wenn VRM fehlt.
- Tests fuer Migrations-/Backfill-Helfer aus vorhandenen Rohsamples.
