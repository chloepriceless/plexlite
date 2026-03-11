# History Finance Refinement Design

**Context:** Nach dem ersten History-Finance-Umbau bleiben fachliche und visuelle Probleme offen. `Erlös Einspeisung` soll strikt nur aus eingespeisten kWh und dem jeweiligen Börsenpreis pro Slot bestehen. Gleichzeitig sind die aggregierten Ansichten für Woche, Monat und Jahr noch zu kleinteilig, die Detailtabelle ist dauerhaft sichtbar, und die Herkunfts-/Schätzstatus nehmen zu viel Platz in der Oberfläche ein.

**Goal:** Die Historie soll in aggregierten Ansichten eine einzige breite `Netto-Analyse` zeigen, die echten Kosten und Erlöse klar trennt, `Vermiedene Bezugskosten` nur als separaten Orientierungswert ausweist und die Details bei Bedarf aufklappbar macht.

## Finance Model

- `Erlös Einspeisung` bleibt fachlich strikt definiert als:
  - `sum(exportKwh_slot * marketPriceCtKwh_slot / 100)`
- `Vermiedene Bezugskosten` bleibt ein separater Wert:
  - informativ sichtbar
  - nicht Teil des Konto-Netto
- `Netto` in der Analyse basiert nur auf realen Kosten und realem Einspeiseerlös:
  - Bezugskosten
  - PV-Kosten auf eigenverbrauchte und eingespeiste kWh
  - Akku-Kosten auf eigenverbrauchte und eingespeiste kWh
  - abzüglich `Erlös Einspeisung`
- Falls die aktuelle Runtime PV-/Akku-Kosten nur auf Eigenverbrauch statt auf alle relevanten Energiemengen rechnet, muss diese Logik im selben Zug fachlich geprüft und testgetrieben korrigiert werden.

## Layout Design

- `Tag` bleibt eine Detailansicht mit:
  - KPI-Zeile
  - separater Energie-Darstellung
  - separater Preis-Darstellung
  - bestehender Tabellen-/Detailtiefe
- `Woche`, `Monat` und `Jahr` zeigen nur:
  - KPI-Zeile
  - eine einzige breite Karte `Netto-Analyse`
  - einen einklappbaren Detailbereich für die tabellarische Historie
- Die bisherigen separaten Karten `Energie` und `Preise` entfallen in aggregierten Ansichten vollständig.

## Chart Design

- Die breite `Netto-Analyse` verwendet eine gemeinsame X-Achse pro Periode.
- Innerhalb derselben Karte werden zwei Ebenen gezeigt:
  - `Geldfluss`: Einspeiseerlös, Bezugskosten, PV-Kosten, Akku-Kosten
  - `Energie-Kontext`: Import, PV-Eigenverbrauch, Akku-Eigenverbrauch, Einspeisung
- `Vermiedene Bezugskosten` wird nicht als Teil des Geldfluss-Stacks behandelt, sondern als eigener Zusatzwert im Kopf- oder Inspector-Bereich der Karte.
- `Netto` wird in derselben Karte prominent hervorgehoben.
- `Preise` werden außerhalb der Tagesansicht gar nicht mehr als eigene Kachel oder Liste gerendert.

## Interaction Design

- `Historie als Tabelle` ist standardmäßig eingeklappt.
- Ein klarer Toggle steuert `Details anzeigen` / `Details ausblenden`.
- Die Banner-/Statuskopie wird stark reduziert.
- Herkunft, geschätzte Slots und bestätigte Slots wandern in ein kleines Info-Element oder Tooltip statt in langen Fließtext.
- Wenn keine geschätzten Daten vorliegen, soll die Oberfläche diesen Zustand nicht unnötig ausformulieren.

## Debugging Focus

- Vor der UI-Anpassung wird die Runtime mit einem gezielten Test auf mehrere Export-Slots mit unterschiedlichen Börsenpreisen geprüft.
- Dieser Test muss beweisen, dass `Erlös Einspeisung` wirklich slotgenau berechnet und korrekt aggregiert wird.
- Falls der Test fehlschlägt, wird zuerst das Preis-/Export-Mapping in der Runtime korrigiert, bevor UI-Änderungen erfolgen.

## Risks

- Die bestehende Kostenlogik für PV und Akku könnte fachlich noch auf einer engeren Definition beruhen als vom neuen Netto-Modell verlangt.
- Ein einzelner kombinierter Chart für aggregierte Ansichten muss mobil lesbar bleiben.
- Das Entfernen von Statuskopie darf keine wichtigen Debugging-Informationen unzugänglich machen.

## Verification

- Neue Runtime-Tests für slotgenauen Einspeiseerlös mit variierenden Börsenpreisen
- Runtime-Tests für die Netto-Zusammensetzung und die getrennte Behandlung vermiedener Bezugskosten
- Page-Tests für:
  - eine einzige breite Aggregat-Karte
  - fehlende Preis-/Energie-Kacheln in Woche/Monat/Jahr
  - eingeklappten Tabellenbereich
  - reduzierte Status-/Info-Anzeige
- Voller `npm test` Lauf
