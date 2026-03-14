# Oberflächen

## Dashboard

Das Dashboard bündelt die laufenden Betriebsdaten:

- DV-Schaltstatus
- Börsenpreis mit Negativpreis-Schutz
- Netzleistung pro Phase
- Victron-Zusatzwerte wie SOC, Akku-Leistung und PV
- Kostenübersicht für den aktuellen Tag
- Day-Ahead-Chart mit Hover, Highlight und Schedule-Auswahl
- Kleine Börsenautomatik mit Planungsanzeige, Chart-Highlighting und Statusübersicht
- Steuerung mit aktiven Werten, Defaults und manuellen Writes
- letzte Events aus dem Systemlog

## Einstellungen

Die Einstellungsseite ist in kompakte Arbeitsbereiche gegliedert:

- Schnellstart
- Anlage verbinden
- Steuerung
- Preise & Daten
- Erweitert

Dazu kommen Import/Export, Health-Checks, Service-Status und optional ein Restart-Button.

## Setup

Der First-Run-Setup-Assistent führt Schritt für Schritt durch:

- HTTP-Port und API-Token
- Victron-Verbindung per Modbus oder MQTT
- Meter- und DV-Basiswerte
- EPEX- und Influx-Grunddaten
- Review-Schritt mit Validierung vor dem Speichern
- Anzeige vererbter Meter- und DV-Register-Verbindungen im Review

## Tools

Die Tool-Seite enthält:

- Modbus Register Scan
- Schedule JSON Bearbeitung
- Health-/Service-Status
- VRM History-Import für Telemetrie-Nachfüllung

## Historie

Die History-Seite bündelt die interne SQLite-Historie zu einer eigenen Analyseansicht:

- Tag-, Wochen-, Monats- und Jahresansicht
- Bezug, Einspeisung, Kosten, Erlöse und Netto je Zeitraum
- Preisvergleich zwischen historischem Marktpreis und eigenem Bezugspreis
- Preisliste und Aggregat-Preishinweis in der Tagesansicht
- Solar-Zusammenfassung mit Jahres-Marktwert in der Jahresansicht
- Energie-Balkendiagramme in Wochen-/Monats-/Jahresansicht
- Kennzeichnung unvollständiger Slots bei fehlenden Marktpreisen oder Tarifzeiträumen
- gezielter Preis-Backfill nur für Telemetrie-Buckets ohne historischen Marktpreis
