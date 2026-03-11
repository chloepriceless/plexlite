# History Finance Redesign Design

**Context:** Die Historie zeigt aktuell `Erlöse` nur als Einspeiseerlös, mischt aber die Einsparung durch Eigenverbrauch nicht als eigene Kennzahl aus. Gleichzeitig zeigt die UI für Woche/Monat/Jahr einen Preisvergleich `Markt vs. Bezug`, der wenig Mehrwert bringt, und der Finanzbereich ist visuell unnötig getrennt.

**Goal:** Die Historie soll Einspeiseerlös und vermiedene Bezugskosten klar trennen, die Eigenverbrauchsdeckung aus PV und Batterie transparent aufschlüsseln und den Finanzbereich für aggregierte Ansichten kompakter darstellen.

## Backend Design

- `exportRevenueEur` bleibt bestehen und wird in der UI als `Erlös Einspeisung` bezeichnet.
- Neue KPI- und Row-Felder:
  - `avoidedImportGrossEur`
  - `avoidedImportPvGrossEur`
  - `avoidedImportBatteryGrossEur`
- Berechnung:
  - PV-Bruttoeinsparung: `pvShareKwh * userImportPriceCtKwh / 100`
  - Batterie-Bruttoeinsparung: `batteryShareKwh * userImportPriceCtKwh / 100`
  - Gesamtwert: Summe beider Bruttoeinsparungen
- Bestehende `pvCostEur` und `batteryCostEur` bleiben erhalten und werden nicht in den Bruttowert eingerechnet; sie werden nur als Unterbau ausgewiesen.

## UI Design

- KPI-Bereich:
  - `Erlöse` wird ersetzt durch `Erlös Einspeisung`
  - neue Karte `Vermiedene Bezugskosten`
  - in der neuen Karte zusätzliche Subwerte:
    - `PV brutto`
    - `Akku brutto`
    - `PV-Kosten`
    - `Akku-Kosten`
- Grid wird auf 8 Karten verdichtet, damit alles weiter in einer Zeile bleibt.

## Chart Design

- `Markt vs. Bezug` unter `Preise` wird für Woche/Monat/Jahr entfernt.
- Tagesansicht behält den Preis-Chart.
- Der Finanzbereich für Woche/Monat/Jahr wird als gemeinsamer kombinierter Chart dargestellt:
  - Kosten
  - Einspeiseerlös
  - vermiedene Bezugskosten
  - Netto als hervorgehobener Wert im selben Chartkontext

## Risks

- Die neuen Einsparungswerte hängen an `userImportPriceCtKwh`; wenn Preiswerte fehlen, bleiben die Felder für betroffene Slots offen oder `0`.
- Die UI muss die neue KPI-Karte kompakt halten, ohne Mobilansichten zu verschlechtern.

## Verification

- Runtime-Tests für neue KPI-Aggregationen und Row-Felder
- Page-Tests für neue KPI-Karten, Subwerte und angepasste Charts
- Voller `npm test` Lauf
