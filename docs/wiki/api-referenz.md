# API-Referenz und Konfiguration

## Vollständige API-Referenz

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/dv/control-value` | DV Status: `0` = Abregelung, `1` = Einspeisung erlaubt |
| `GET` | `/api/status` | Vollständiger Systemstatus |
| `GET` | `/api/config` | Aktive Konfiguration (sensible Felder redaktiert) |
| `POST` | `/api/config` | Konfiguration aktualisieren |
| `POST` | `/api/config/import` | Konfiguration aus Datei importieren |
| `GET` | `/api/config/export` | Konfiguration als Datei exportieren |
| `GET` | `/api/costs` | Tages-Kostenübersicht |
| `GET` | `/api/log` | Letzte 300 Event-Log Einträge |
| `GET` | `/api/discovery/systems` | Erkannte Victron-GX-Systeme per mDNS |
| `GET` | `/api/admin/health` | Health-Check Status |
| `POST` | `/api/admin/service/restart` | systemd-Service über die GUI neu starten |
| `POST` | `/api/epex/refresh` | EPEX-Preise manuell aktualisieren |
| `GET` | `/api/meter/scan` | Scan-Ergebnisse abrufen |
| `POST` | `/api/meter/scan` | Modbus Register-Scan starten |
| `GET` | `/api/schedule` | Aktuelle Schedule-Regeln und Config |
| `POST` | `/api/schedule/rules` | Schedule-Regeln aktualisieren |
| `POST` | `/api/schedule/config` | Default-Werte aktualisieren |
| `GET` | `/api/schedule/automation/config` | SMA-Konfiguration lesen |
| `POST` | `/api/schedule/automation/config` | SMA-Konfiguration aktualisieren |
| `POST` | `/api/control/write` | Manueller Write |
| `GET` | `/api/history/summary` | History-Daten: `?view=day\|week\|month\|year&date=YYYY-MM-DD` |
| `POST` | `/api/history/backfill/prices` | Fehlende Marktpreise nachfüllen |
| `GET` | `/api/history/import/status` | Status des konfigurierten History-Imports |
| `POST` | `/api/history/import` | Historische Telemetrie-Daten importieren |
| `POST` | `/api/history/backfill/vrm` | VRM-basiertes Gap- oder Full-Backfill |
| `GET` | `/api/integration/home-assistant` | Home Assistant JSON |
| `GET` | `/api/integration/loxone` | Loxone Textformat |
| `GET` | `/api/integration/eos` | EOS Messwerte + EPEX-Preise |
| `POST` | `/api/integration/eos/apply` | EOS Optimierung anwenden |
| `GET` | `/api/integration/emhass` | EMHASS Messwerte + Preisarrays |
| `POST` | `/api/integration/emhass/apply` | EMHASS Optimierung anwenden |
| `GET` | `/api/keepalive/modbus` | Letzte Modbus-Abfrage |
| `GET` | `/api/keepalive/pulse` | 60s Uptime-Pulse |

---

## Bezugspreise nach Zeitraum

Unter `userEnergyPricing.periods` lassen sich mehrere Tarifzeiträume definieren:

- Zeiträume sind tageweise und inklusive `startDate` bis `endDate`
- Zeiträume dürfen sich nicht überschneiden
- pro Zeitraum ist `fixed` oder `dynamic` möglich
- wenn kein Zeitraum passt, greift die bestehende Legacy-Preislogik als Fallback

---

## §14a EnWG Modul 3

Unter `userEnergyPricing` lassen sich bis zu drei steuerbare Zeitfenster nach §14a EnWG Modul 3 konfigurieren:

- `usesParagraph14aModule3`: Aktiviert die Sonderpreisfenster
- `module3Windows`: Bis zu drei Fenster mit Start, Ende und Sonderpreis in ct/kWh

---

## Marktwert- und Marktprämien-Modus

Unter `userEnergyPricing` stehen für die History-Marktprämie zwei zusätzliche Felder bereit:

- `marketValueMode`: `annual` für das bisherige Verhalten oder `monthly` für Monatsmarktwerte auch in Monats- und Jahresansichten
- `pvPlants`: Liste der PV-Anlagen mit `kwp` und `commissionedAt`, damit die offiziellen anzulegenden Referenzwerte pro Anlage abgeleitet werden können

Die Einstellungsseite pflegt diese Werte zentral im Bereich Marktprämie.

---

## Wichtige Config-Sektionen

| Sektion | Beschreibung |
|---------|--------------|
| `manufacturer` | Aktives Herstellerprofil, aktuell `victron` |
| `victron` | Anlagenadresse (`host`) |
| `schedule` | Zeitplan-Regeln, Defaults und Kleine Börsenautomatik (`smallMarketAutomation`) |
| `epex` | Preiszone und Zeitzone |
| `influx` | InfluxDB-Anbindung (v2 oder v3) |
| `telemetry` | Lokale SQLite-Historie, Rollups, Preis-Backfill und VRM-History-Import |
| `userEnergyPricing` | Preislogik für Netz, PV und Akku, Tarifzeiträume, §14a-Fenster, Marktwert-/PV-Anlagen-Metadaten |
| `scan` | Modbus Scan-Parameter |

Zusätzlich erwartet DVhub ein Herstellerprofil neben der Betriebs-Config:

| Datei | Zweck |
|-------|-------|
| `/etc/dvhub/hersteller/victron.json` | Victron-spezifische Kommunikations- und Registerwerte |

---

## Hinweise

- Änderungen an Victron-Registern, Port, Unit-ID oder Timeout erfolgen bewusst nur in `/etc/dvhub/hersteller/victron.json`
- Die normale `config.json` bleibt damit klein und sicher und enthält nur Betriebs- und Anlagenwerte
- **InfluxDB v3** ist Default, v2 bleibt kompatibel
- `dvControl.enabled` ist standardmäßig deaktiviert und muss aktiv gesetzt werden
- `userEnergyPricing` erlaubt festen Endkundenpreis oder dynamische Preisbestandteile auf Basis von EPEX
- im MQTT-Modus wird `victron.mqtt.portalId` benötigt; ohne eigenen Broker nutzt DVhub den GX-Host
- `npm install mqtt` wird nur für MQTT-Betrieb benötigt
- API-Responses redaktieren sensible Felder (`apiToken`, `influx.token`, `vrmToken`)
- Config-Datei wird mit `0600`-Berechtigung geschrieben (Security-Hardening)
