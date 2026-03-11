# VRM AC PV and PV Inverter Import Design

**Status:** Validiert am 2026-03-10

**Ziel:** Der VRM-Import soll AC-gekoppelte PV-Anlagen, insbesondere Fronius- und andere PV-Inverter auf der AC-Seite, deutlich besser abbilden. DVhub soll dafuer zusaetzliche PV-Inverter-Rohdaten speichern, AC-PV sauber in die kanonischen Energieserien uebernehmen und PV-/Export-Summen weniger aus Annahmen und staerker aus echten VRM-Daten aufbauen.

## Anforderungen

- AC-gekoppelte PV aus VRM muss im Import beruecksichtigt werden.
- Zusaetzliche PV-Inverter-Rohdaten sollen gespeichert werden, nicht nur abgeleitete Summen.
- `pv_total_w` soll aus DC-PV und AC-PV aufgebaut werden koennen.
- Export-/Eigenverbrauchsableitungen sollen AC-PV beruecksichtigen.
- Der Import muss robust bleiben, wenn eine Anlage keine separaten PV-Inverter- oder AC-PV-Daten liefert.
- Die History-UI soll zusaetzliche AC-PV-/PV-Inverter-Werte sichtbar machen, soweit sie auf Tagesebene sinnvoll zusammenfassbar sind.

## Problem

- Der bisherige Import nutzt `venus/Pdc` als primaere PV-Gesamtleistung.
- Fuer AC-gekoppelte Anlagen, etwa mit Fronius, reicht das nicht aus, weil relevante Erzeugung und Export auf AC-PV-/PV-Inverter-Seite liegen kann.
- Dadurch bleibt `pv_total_w` fuer solche Anlagen zu niedrig und DVhub weicht deutlich von VRM ab.
- Zusaetzlich fehlen Rohdaten, um Abweichungen zwischen DVhub und VRM pro Quelle nachvollziehen zu koennen.

## Designentscheidungen

- DVhub behaelt das bestehende kanonische Modell fuer Kosten, KPIs und Charts bei.
- Zusaetzliche AC-PV-/PV-Inverter-Daten werden sowohl roh als auch in kanonische Summen uebernommen.
- Wo moeglich, werden PV-Summen additiv aufgebaut:
  - `pv_total_w = pv_dc_w + pv_ac_w`
  - Falls keine direkte AC-PV-Leistung verfuegbar ist, wird auf Flussserien aus VRM zurueckgefallen.
- Rohdaten bleiben getrennt von kanonischen Serien, damit spaetere Vergleiche gegen VRM moeglich sind.

## Datenmodell

- Bestehende kanonische Serien bleiben:
  - `pv_total_w`
  - `grid_export_w`
  - `grid_import_w`
  - `load_power_w`
  - `battery_charge_w`
  - `battery_discharge_w`
- Neue bzw. staerker genutzte Serien:
  - `pv_dc_w`
  - `pv_ac_w`
  - `solar_to_grid_w`
  - `solar_direct_use_w`
  - `solar_to_battery_w`
- Neue Rohserien:
  - `vrm_venus_*` bleiben wie bisher erhalten
  - zusaetzliche PV-Inverter-Rohserien werden unter `vrm_pvinverter_*` oder einem vergleichbaren Namensraum gespeichert
  - pro Instanz soll die Herkunft aus VRM-Metadaten nachvollziehbar bleiben

## VRM-Import

- Bestehende Stats-Abfragen bleiben die Basis.
- AC-PV wird zunaechst ueber bekannte VRM-Codes im bestehenden Stats-Datenmodell integriert:
  - `venus/Pac` als AC-PV-Leistung
  - `consumption/Pg` als Solar-zu-Netz-Fluss fuer AC-PV-/PV-Inverter-Pfade
- Zusaetzlich soll der Import, soweit ueber VRM verfuegbar, PV-Inverter-/Widget-/Instanzdaten abrufen und als Rohdaten speichern.
- Wenn separate PV-Inverter-Instanzen verfuegbar sind, sollen sie pro Instanz persistiert werden statt sofort zusammenzufallen.

## Ableitungen

- `pv_total_w` wird additiv aus `Pdc` und `Pac` aufgebaut.
- Wenn keine direkte PV-Summe vorhanden ist, wird `pv_total_w` weiter aus `solar_direct_use_w + solar_to_battery_w + solar_to_grid_w` rekonstruiert.
- `grid_export_w` wird bevorzugt aus expliziten Export-/PV-Fluessen gebildet.
- Bei konkurrierenden Quellen gilt: echte direkte PV-Leistung vor rekonstruierten Summen.

## UI

- Die History bekommt zusaetzliche Darstellung fuer AC-PV:
  - Tagesinspector: `PV AC`
  - Tabellen/Rows: `PV AC` und, falls sinnvoll aggregierbar, `PV DC`
- Rohwerte pro PV-Inverter-Instanz bleiben zunaechst in der Telemetrie und API verfuegbar; die UI kann sie spaeter je nach Nutzwert detaillierter zeigen.

## Fehlerbehandlung und Fallback

- Wenn eine Anlage keine `Pac`- oder PV-Inverter-Daten liefert, bleibt das bisherige Verhalten aktiv.
- Wenn nur Flussserien vorhanden sind, werden Summen weiterhin daraus abgeleitet.
- Fehlende PV-Inverter-Detaildaten duerfen den Import nicht scheitern lassen.

## Tests

- Tests fuer additive PV-Summe aus `Pdc + Pac`.
- Tests fuer AC-PV-Export ueber `Pg`.
- Tests fuer Persistenz von AC-PV-Rohserien.
- Tests fuer Fallback auf bestehende Ableitungen, wenn keine AC-PV-Daten vorhanden sind.
- Tests fuer History-Runtime/UI mit sichtbaren AC-PV-Werten.
