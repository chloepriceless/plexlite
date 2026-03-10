# History Summary And Market Premium Design

**Context:** Die bisherige KPI-Zeile der Historie verteilt zentrale Kennzahlen auf mehrere kleine Karten. Das erschwert die fachliche Lesbarkeit, weil `Netto`, vermiedene Bezugskosten, echte Kosten und Energiemengen nicht als zusammenhängendes Modell sichtbar sind. Zusätzlich fehlt in der Jahresansicht noch die Marktprämien-Logik für Anlagen in der Direktvermarktung.

**Goal:** Die Historie soll die komplette KPI-Zeile durch eine einzige Summary-Kachel ersetzen, die reale Erlöse, gespartes Geld und Energiemengen in einem Block zusammenfasst. In der Jahresansicht soll diese Kachel zusätzlich die Marktprämie auf Basis des offiziellen Jahresmarktwerts, eines anlagenspezifisch gewichteten anzulegenden Werts und einer förderfähigen Einspeisemenge ausweisen.

## Summary Card Model

Die bisherige KPI-Zeile entfällt vollständig. Stattdessen gibt es oberhalb der Analyse eine einzige große Kachel.

Die Kachel enthält drei inhaltliche Ebenen:

### 1. Finanz-Kern

- `Bezugs-Kosten`
- `Erlös aus Einspeisung`
- `Netto`

Definition:

- `Netto = Erlös aus Einspeisung - Bezugs-Kosten`

`Netto` ist bewusst nur die reale Geldbilanz aus Einspeiseerlös und Netzbezugskosten. Vermiedene Bezugskosten bleiben davon getrennt.

### 2. Gespart / Brutto

- `Vermiedene Bezugskosten`
- `PV brutto`
- `Akku brutto`
- `PV Kosten`
- `Akku Kosten`
- `Gespartes Geld`
- `Brutto-"Erlös"`

Definitionen:

- `Gespartes Geld = Vermiedene Bezugskosten - PV Kosten - Akku Kosten`
- `Brutto-"Erlös" = Netto + Gespartes Geld`

`PV brutto` und `Akku brutto` bleiben als transparente Aufschlüsselung der vermiedenen Bezugskosten sichtbar.

### 3. Energiemengen

- `Bezug`
- `Verbrauch`
- `PV erzeugt`
- `Einspeisung`

Diese Werte sitzen als ruhige dritte Ebene in derselben Kachel und ersetzen die heutige separierte KPI-Optik.

## View Behavior

- `Tag`, `Woche`, `Monat`, `Jahr` nutzen alle dieselbe Summary-Kachel.
- Die Summary-Kachel ersetzt überall die alte KPI-Zeile.
- Die bestehende Analyse darunter bleibt erhalten, wird aber visuell nicht mehr als von den KPIs getrennte Oberseite gelesen.

## Jahresansicht: Marktprämie

In der Jahresansicht kommt eine zusätzliche Erlöskomponente hinzu:

- `Marktprämie`

Die Berechnung wird nur aktiv, wenn folgende Werte vorliegen:

- offizieller `Jahresmarktwert`
- anlagenspezifisch gewichteter `anzulegender Wert`
- förderfähige Jahres-Einspeisemenge

### Förderfähige Einspeisemenge

Die förderfähige Einspeisemenge umfasst nur Viertelstunden mit Börsenpreis `>= 0`.

- Marktpreis `>= 0`: Einspeisemenge zählt
- Marktpreis `< 0`: Einspeisemenge zählt nicht für die Marktprämie

### Anlagenmodell

Es wird eine neue Konfiguration für mehrere PV-Anlagen eingeführt.

Pro Anlage:

- `kWp`
- `Inbetriebnahmedatum`

Für die erste Version reicht eine gewichtete Gesamtrechnung über alle konfigurierten PV-Anlagen.

### Gewichteter anzulegender Wert

Der `anzulegende Wert` hängt vom Inbetriebnahmedatum der jeweiligen Anlage ab. Er wird nicht manuell gepflegt, sondern von offizieller Stelle abgefragt bzw. gescraped, sobald die Referenzwerte bekannt sind.

Für mehrere Anlagen:

- `gewichteter anzulegender Wert = Summe(kWp × anzulegender Wert je Anlage) / Summe(kWp)`

### Marktprämien-Formel

- `Marktprämie = förderfähige Jahreseinspeisemenge × (gewichteter anzulegender Wert - Jahresmarktwert)`

Zusätzliche Jahreswerte in der Summary-Kachel:

- `Jahresmarktwert`
- `förderfähige Einspeisemenge`
- `Marktprämie`
- optional `Gesamterlös inkl. Marktprämie`

## Data And Runtime Changes

- Neue Settings-Konfiguration für mehrere PV-Anlagen
- Neue Referenzdatenquelle für anzulegende Werte
- Persistenz für offizielle/gescrapte anzulegende Werte
- Runtime-Erweiterung für:
  - förderfähige Einspeisemenge
  - gewichteten anzulegenden Wert
  - Marktprämie
  - Gesamterlös inkl. Marktprämie

Wenn Jahresmarktwert oder anzulegender Wert fehlen, wird die Marktprämie nicht geschätzt, sondern klar als `noch nicht verfügbar` ausgewiesen.

## Risks

- Der Scrape-Pfad für anzulegende Werte kann sich strukturell ändern.
- Die Jahresansicht braucht eine klare Trennung zwischen Spot-Erlös und Marktprämie, damit keine Doppelzählung entsteht.
- Die neue Summary-Kachel darf trotz vieler Kennzahlen nicht wieder in visuelle Kleinteiligkeit kippen.

## Verification

- Page-Tests für die neue einteilige Summary-Kachel statt KPI-Zeile
- Runtime-Tests für:
  - `Netto`
  - `Gespartes Geld`
  - `Brutto-"Erlös"`
  - förderfähige Einspeisemenge mit Ausschluss negativer Preise
  - gewichteten anzulegenden Wert
  - Marktprämie in der Jahresansicht
- Settings-Tests für mehrere PV-Anlagen mit `kWp` und `Inbetriebnahmedatum`
- Voller `npm test` Lauf
