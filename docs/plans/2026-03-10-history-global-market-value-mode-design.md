# History Global Market Value Mode Design

**Context:** Die History-Seite zeigt die Marktprämie inzwischen als `ct/kWh` und `EUR`, aber die Euro-Summe folgt in der Monats- und Jahresanzeige nicht immer derselben Marktwertlogik wie der ausgewiesene Satz. Sobald ein offizieller Jahresmarktwert vorliegt, fällt die aktuelle Berechnung in Teilen auf diesen Jahreswert zurück. Das ist fachlich falsch für Anlagen, die bewusst mit Monatsmarktwerten rechnen wollen. Gleichzeitig fehlt in den Einstellungen eine globale Auswahl, ob für die Marktprämie Jahresmarktwerte oder Monatsmarktwerte gelten sollen.

**Goal:** DVhub soll global zwischen zwei fachlichen Modi unterscheiden koennen: `Jahresmarktwert` behaelt das heutige Verhalten unveraendert bei, `Monatsmarktwert` erzwingt dagegen fuer Monats- und Jahresansichten eine durchgehend monatsbasierte Marktpraemienberechnung. Dadurch muessen `ct/kWh` und `EUR` in der History immer aus derselben Grundlage stammen.

## Configuration Model

Die Auswahl wird global unter `userEnergyPricing` gespeichert und nicht pro PV-Anlage.

Neues Feld:

- `userEnergyPricing.marketValueMode`

Zulaessige Werte:

- `annual`
- `monthly`

Default:

- `annual`

Der Default ist bewusst rueckwaertskompatibel, damit bestehende Installationen exakt das bisherige Verhalten behalten.

## Settings UX

Die bestehende Marktpraemien-Sektion unter `PV-Anlagen` bleibt der Einstiegspunkt.

Erweiterung oberhalb der Anlagenliste:

- globale Auswahl `Marktwert-Modus`
- Option `Jahresmarktwert`
- Option `Monatsmarktwert`

Erklaerungstexte:

- `Jahresmarktwert`: Verhalten wie bisher. Sobald ein offizieller Jahresmarktwert verfuegbar ist, darf DVhub fuer Monats- und Jahresansichten damit rechnen.
- `Monatsmarktwert`: Jeder Monat wird immer mit seinem Monatsmarktwert gerechnet. Jahressummen entstehen als Summe der einzeln berechneten Monatsbetraege.

Die Auswahl sitzt absichtlich in derselben Marktpraemien-Sektion wie die PV-Anlagen, weil beide Felder gemeinsam die Marktpraemienlogik definieren.

## Runtime Behavior

### Modus `annual`

Dieser Modus bleibt unveraendert:

- `Woche` bleibt monatsbasiert gewichtet.
- `Monat` darf bei vorhandenem offiziellem Jahresmarktwert auf den Jahresmarktwert zurueckfallen.
- `Jahr` darf den offiziellen Jahresmarktwert verwenden oder, falls noch nicht vorhanden und das Jahr aktuell ist, die bestehende vorlaeufige laufende Monatsableitung nutzen.

### Modus `monthly`

Dieser Modus ueberschreibt nur die Marktwertquelle, nicht die Grundlogik der foerderfaehigen Einspeisung oder des gewichteten anzulegenden Werts.

- `Woche`: bleibt wie heute monatsbasiert.
- `Monat`: die Marktpraemie wird immer mit dem Monatsmarktwert des ausgewaehlten Monats berechnet, auch wenn fuer dasselbe Jahr bereits ein offizieller Jahresmarktwert existiert.
- `Jahr`: die Marktpraemie wird als Summe monatlicher Teilbetraege berechnet. Jeder Teilbetrag nutzt den Monatsmarktwert seines Monats.

Jahresformel im Modus `monthly`:

- fuer jeden Monat: `foerderfaehige Einspeisung des Monats x (gewichteter anzulegender Wert - Monatsmarktwert des Monats)`
- Jahreswert: `Summe aller Monatsbetraege`

Der ausgewiesene `Marktpraemie ct/kWh`-Wert in der Jahresansicht bleibt ein gewichteter Durchschnitt ueber die mit Monatswerten bewertete foerderfaehige Einspeisung:

- `sum(monthExportKwh x monthPremiumCtKwh) / sum(monthExportKwh)`

So bleiben Euro-Wert und ausgewiesener Satz mathematisch konsistent.

## History Presentation

Die UI muss den fachlichen Modus sichtbar machen, ohne die Kachel neu aufzubauen.

Im Modus `monthly`:

- Monatsansicht labelt den Referenzwert immer als `Monatsmarktwert`.
- Jahresansicht soll nicht mehr implizit wie ein offizieller Jahresmarktwert wirken, wenn die Berechnung in Wahrheit aus Monatswerten stammt.

Empfohlene Anzeige in der Jahresansicht:

- der KPI-Platz fuer den Referenzwert zeigt weiterhin einen einzelnen `ct/kWh`-Wert
- dieser Wert ist der exportgewichtete Marktwert des angezeigten Jahres
- `meta.marketPremium.displaySource` kennzeichnet, dass die Anzeige aus Monatswerten abgeleitet wurde

Damit bleibt die Kachel kompakt, ohne falschen Jahresmarktwert vorzutaeuschen.

## Data Flow Changes

- `config-model.js` bekommt das neue globale Feld samt Default und Hilfe-Text.
- `public/settings.js` rendert und serialisiert die neue Auswahl innerhalb des Marktpraemien-Editors.
- `history-runtime.js` leitet aus `pricingConfig.marketValueMode` eine zentrale Marktwertstrategie ab, statt die Entscheidung ueber mehrere View-Zweige zu verstreuen.
- `public/history.js` verwendet die erweiterten `meta.marketPremium.displaySource`-Werte fuer korrekte Labels und Hinweise.

## Edge Cases

- Fehlt im Modus `monthly` ein Monatsmarktwert fuer einen Monat, darf dieser Monat nicht still auf den Jahresmarktwert zurueckfallen.
- Die foerderfaehige Einspeisung bleibt weiterhin nur fuer Slots mit Boersenpreis `>= 0` zaehlbar.
- Bestehende Installationen ohne neues Feld werden als `annual` interpretiert.

## Risks

- Jahres-KPIs koennen missverstaendlich werden, wenn ein aus Monatswerten gewichteter Referenzwert wie ein offizieller Jahresmarktwert aussieht. Das muss ueber `displaySource` klar markiert werden.
- Die Berechnung darf keine doppelte Gewichtung einfuehren: Monatsbetraege muessen direkt aus Monats-Export und Monatsmarktwert entstehen, nicht aus bereits aggregierten Jahreswerten plus Monatskorrektur.
- Settings und Runtime muessen denselben Default `annual` teilen, sonst entstehen stille Abweichungen zwischen UI und API.

## Verification

- Config-Tests fuer Default und Persistenz von `userEnergyPricing.marketValueMode`
- Settings-Tests fuer Rendering, Serialisierung und Default-Auswahl des neuen globalen Marktwert-Modus
- Runtime-Tests fuer:
  - Monatsansicht im Modus `monthly` trotz vorhandenem offiziellem Jahresmarktwert
  - Jahresansicht im Modus `monthly` als Summe einzelner Monatsbetraege
  - Rueckwaertskompatibilitaet des Modus `annual`
- History-Page-Tests fuer korrekte Labels und konsistente Anzeigequellen
- voller `npm test` Lauf im Repo `dvhub`
