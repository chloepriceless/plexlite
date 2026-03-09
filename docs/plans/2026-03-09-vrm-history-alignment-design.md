# VRM History Alignment Design

**Status:** Validiert am 2026-03-09

**Ziel:** Der VRM-Historienimport und die DVhub-History sollen die Energiefluesse deutlich naeher an VRM abbilden: immer auf 15-Minuten-Basis, mit breiterem VRM-Mapping fuer Erzeugung, Verbrauch, Netzfluss und Eigenverbrauch sowie zusaetzlichen Live-Serien in Telemetrie und UI.

## Anforderungen

- VRM-History-Import soll immer mit `15mins` arbeiten.
- Falls die UI oder API ein anderes Intervall sendet, muss serverseitig auf `15mins` normiert werden.
- Der UI-Import darf kein irrefuehrendes Intervall mehr anbieten.
- Die VRM-Mappings sollen ueber die bisherigen Teilmengen hinausgehen und Erzeugungs-, Verbrauchs-, Netz- und Eigenverbrauchsfluesse breiter erfassen.
- VRM-Rohserien sollen weiterhin gespeichert bleiben, damit Abweichungen nachvollziehbar bleiben.
- Die History-UI soll die zusaetzlichen Werte sichtbar machen.
- Das Live-Logging soll weitere vorhandene Energieflusswerte speichern, sofern sie bereits lokal aus Meter-/Victron-State verfuegbar sind.

## Root Cause

- Der aktuelle Import behandelt beliebige VRM-Intervalle als einzelne Stichprobe im importierten Slot.
- Die History-Runtime aggregiert anschliessend fest auf 15-Minuten-Slots.
- Dadurch werden Stunden- oder Tagesimporte massiv unterzaehlt.
- Zusaetzlich ist das bestehende Mapping fachlich zu schmal und verwendet einzelne VRM-Codes an Stellen, an denen fuer einen VRM-nahen Vergleich weitere Flussserien benoetigt werden.

## Datenmodell

- Kanonische Serien bleiben Basis fuer History und Kosten:
  - `load_power_w`
  - `pv_total_w`
  - `grid_import_w`
  - `grid_export_w`
  - `battery_charge_w`
  - `battery_discharge_w`
  - `battery_power_w`
- Neu kommen weitere kanonische Vergleichs- und Hilfsserien hinzu, soweit aus VRM oder Live-State verfuegbar:
  - `self_consumption_w`
  - `solar_direct_use_w`
  - `solar_to_battery_w`
  - `battery_direct_use_w`
  - `battery_to_grid_w`
  - `grid_direct_use_w`
  - `grid_to_battery_w`
- VRM-Rohserien bleiben unter `vrm_*` gespeichert.

## VRM-Mapping

- Der Import liest weiterhin die Stats-Typen `venus`, `consumption` und `kwh`.
- Zusaetzlich werden VRM-Fluesse aus den bekannten Attributcodes breiter gemappt:
  - `Pc`: Solar direct use
  - `Pb`: Solar to battery
  - `Gc`: Grid direct use
  - `Gb`: Grid to battery
  - `Bc`: Battery direct use
  - `Bg`: Battery to grid
- Diese Fluesse werden sowohl roh abgelegt als auch in kanonische Vergleichsserien uebernommen.
- `pv_total_w`, `load_power_w`, `grid_import_w`, `grid_export_w` und Eigenverbrauchsanteile werden bevorzugt aus echten VRM-Fluessen zusammengesetzt, statt nur aus Minimalannahmen rekonstruiert zu werden.

## Aggregation

- Der Import speichert nur noch 15-Minuten-Samples.
- Die History aggregiert weiter auf 15-Minuten-Slots, hat aber mehr primaere Flussdaten.
- Eigenverbrauch wird in die Anteile aus Netz, PV und Akku aufgespalten, bevorzugt aus expliziten VRM-Fluessen.
- Rekonstruktion bleibt nur Fallback fuer echte Luecken.

## UI

- History-Tabellen und Inspector zeigen zusaetzliche Herkunfts- und Eigenverbrauchswerte.
- KPI- und Chart-Daten werden um VRM-nahe Flusswerte erweitert.
- Die Settings-/Tools-Import-UI zeigt fest `15 Minuten` statt frei waehlbarem Intervall.
- Wenn zusaetzliche Live-Serien lokal vorliegen, werden sie auch im Leitstand bzw. in der History sichtbar gemacht.

## Live-Telemetrie

- Bestehende Live-Samples werden um noch fehlende Energieflussserien erweitert, wenn sie aus `meter` oder `victron` bereits vorliegen oder stabil ableitbar sind.
- Rohwerte und abgeleitete Werte bleiben in `meta` unterscheidbar.

## Tests

- Tests fuer erzwungenes 15-Minuten-Intervall in UI und Importmanager.
- Tests fuer breiteres VRM-Mapping und kanonische Serien.
- Tests fuer verbesserte History-KPIs/Rows/Charts mit Eigenverbrauchsanteilen.
- Tests fuer erweiterte Live-Telemetrie-Serien.
