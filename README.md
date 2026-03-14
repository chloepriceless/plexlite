<p align="center">
  <img src="assets/dvhub.jpg" alt="DVhub Logo" width="640" />
</p>

```
██████╗ ██╗   ██╗██╗  ██╗██╗   ██╗██████╗
██╔══██╗██║   ██║██║  ██║██║   ██║██╔══██╗
██║  ██║██║   ██║███████║██║   ██║██████╔╝
██║  ██║╚██╗ ██╔╝██╔══██║██║   ██║██╔══██╗
██████╔╝ ╚████╔╝ ██║  ██║╚██████╔╝██████╔╝
╚═════╝   ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝
```

<p align="center">
  <strong>Hack the Grid</strong><br/>
  The unofficial DV interface — Direct Marketing Interface for Victron
</p>

> **Digitale Direktvermarktungsschnittstelle** auf Basis der PLEXLOG Modbus-Register,
> zugeschnitten auf Victron ESS-Systeme mit LUOX Energy (ehem. Lumenaza) als Direktvermarkter.

| | |
|---|---|
| **Status** | `main` — Version 0.3.5.1 |
| **Getestet mit** | LUOX Energy, Victron Ekrano-GX, Fronius AC-PV |
| **Lizenz** | Energy Community License (ECL-1.0) |

<p align="center">
  <a href="assets/screenshots/dashboard-live-full-2026-03-11.png"><img src="assets/screenshots/dashboard-live-full-2026-03-11.png" alt="DVhub Leitstand live" width="440" /></a>
  <a href="assets/screenshots/history-day-2026-03-10-full.png"><img src="assets/screenshots/history-day-2026-03-10-full.png" alt="DVhub History Tag 10.03.2026" width="440" /></a>
</p>
<p align="center">
  <a href="assets/screenshots/history-month-2026-03-full.png"><img src="assets/screenshots/history-month-2026-03-full.png" alt="DVhub History März 2026" width="440" /></a>
  <a href="assets/screenshots/history-year-2025-full.png"><img src="assets/screenshots/history-year-2025-full.png" alt="DVhub History Jahr 2025" width="440" /></a>
</p>

---

## Kurzüberblick

DVhub ersetzt bzw. ergänzt einen physischen Plexlog als DV-Schnittstelle. Die Modbus-Kommunikation
des Direktvermarkters wird in Software nachgebildet, während die Live-Daten direkt vom Victron-GX-System kommen.

DVhub auf `main` ist heute:

- **DV-Schnittstelle und Web-Leitstand** in einer Anwendung
- **Dashboard** für Live-Werte, Day-Ahead-Preise, Kosten und Steuerung
- **Kleine Börsenautomatik** für automatische Entladung in Hochpreisphasen mit energiebasierter Slot-Allokation
- **History-Seite** für Tag/Woche/Monat/Jahr direkt aus der SQLite-Telemetrie
- **Setup-Assistent** für den ersten Start mit blockierender Validierung
- **Einstellungsoberfläche** statt roher `config.json`-Bearbeitung
- **Victron-Anbindung per Modbus TCP oder MQTT**
- **Automatische Systemerkennung** per mDNS für Victron-GX-Geräte im Netzwerk
- **Telemetrie mit lokaler SQLite-Historie**, gezieltem Preis-Backfill und optionalem VRM-Nachimport
- **Integrationsplattform** für EOS, EMHASS, Home Assistant, Loxone und InfluxDB
- **Installierbare Service-Anwendung** mit `install.sh`, systemd und Health-/Restart-Funktionen

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [Was DVhub kann](#was-dvhub-kann)
- [Projektstruktur](#projektstruktur)
- [Oberflächen](#oberflächen)
- [Integrationen](#integrationen)
- [Direktvermarktung kompakt](#direktvermarktung-kompakt)
- [Installation im Detail](#installation-im-detail)
- [API und Konfiguration](#api-und-konfiguration)
- [Lizenz](#lizenz)

---

## Schnellstart

### Installer

```bash
curl -fsSL https://raw.githubusercontent.com/chloepriceless/dvhub/main/install.sh | sudo bash
```

Der Installer:

- installiert Node.js
- klont das Repo nach `/opt/dvhub`
- nutzt die App unter `/opt/dvhub/dvhub`
- migriert alte Installationen aus `/opt/dvhub/dv-control-webapp`
- richtet einen systemd-Service ein
- nutzt eine externe Config-Datei unter `/etc/dvhub/config.json`
- aktiviert Health-Checks und optionalen Restart aus der GUI
- legt die interne Telemetrie-Datenbank unter `/var/lib/dvhub/telemetry.sqlite` an
- startet `dvhub.service` nach dem Update automatisch neu

Wenn die Config-Datei noch fehlt oder ungültig ist, öffnet DVhub beim ersten Aufruf automatisch den Setup-Assistenten.

### Erster Aufruf

- Dashboard: `http://<host>:8080/`
- Historie: `http://<host>:8080/history.html`
- Einstellungen: `http://<host>:8080/settings.html`
- Setup: `http://<host>:8080/setup.html`
- Tools: `http://<host>:8080/tools.html`

---

## Was DVhub kann

### Kernfunktionen

- **DV-Modbus-Server** auf Standard-Port `1502` mit FC3/FC4 Read und FC6/FC16 Write
- **DV-Signalerkennung** inklusive Lease-Logik und sicherer Rückkehr in Freigabe
- **Victron-Steuerung** für Grid Setpoint, Charge Current und Min SOC
- **Negativpreis-Schutz** mit automatischer Reaktion auf EPEX-Preise
- **Day-Ahead-Preis-Engine** mit Heute-/Morgen-Daten, Hover-Details und Chart-Auswahl
- **Schedule-System** mit Defaults, manuellen Writes und Chart-zu-Schedule-Auswahl
- **Kosten- und Preislogik** für Netz, PV und Akku über `userEnergyPricing`
- **Datumsbasierte Bezugspreise** über `userEnergyPricing.periods`
- **§14a EnWG Modul 3** mit konfigurierbaren Zeitfenstern und Sonderpreisen
- **Kleine Börsenautomatik** für automatische Entladung in Hochpreisphasen mit energiebasierter Slot-Allokation und Multi-Stage-Ketten
- **Lokale Telemetrie** mit Persistenz, Rollups, historischem Nachimport und SQLite-basierter History-Analyse
- **Automatische Systemerkennung** per mDNS für Victron-GX-Geräte im lokalen Netz

### Kleine Börsenautomatik

Die Kleine Börsenautomatik (SMA) analysiert Day-Ahead-Preise und plant automatisch Entladung in Hochpreisphasen:

- **Energiebasierte Slot-Allokation** statt fester Slot-Anzahl — berücksichtigt verfügbare kWh aus SOC, Kapazität und Wirkungsgrad
- **Multi-Stage Chain-Varianten** für mehrstufige Entladestrategien mit Cooldown-Phasen
- **Transparente Planungsphase** mit Statusanzeige und Chart-Highlighting im Dashboard
- **Geschützte Automationsregeln** (read-only, automatisch regeneriert)
- **Sonnenauf-/untergangszeiten-Cache** für standortbasierte Optimierung
- Konfigurierbares Suchfenster, Min-SOC, Max-Entladeleistung und Aggressivitätsprämie
- Vollständige Konfiguration unter `schedule.smallMarketAutomation`

### Betriebsmodell

- **Modbus TCP oder MQTT** als Victron-Transport
- **Externe Konfiguration** statt fest eingebauter Runtime-Dateien
- **Herstellerprofile** trennen Victron-Kommunikationswerte von der Betriebskonfiguration
- **systemd-ready** für dauerhaften Betrieb
- **Health-/Service-Status** direkt in Einstellungen und Tools

---

## Architektur

### Prozessmodell

DVhub kann in zwei Modi laufen — als **Monolith** (Standard) oder im **Web + Worker**-Modus:

```
┌─────────────────────────────────────────────────────────────┐
│ Monolith-Modus (Standard)                                   │
│                                                             │
│  server.js  (PROCESS_ROLE = 'monolith')                     │
│  ├── HTTP-Server + API-Routen                               │
│  ├── DV-Modbus-Server (Port 1502)                           │
│  ├── Victron-Polling (Modbus TCP oder MQTT)                 │
│  ├── Schedule-Auswertung + Kleine Börsenautomatik           │
│  ├── Telemetrie-Schreiber + Rollups                         │
│  ├── EPEX-Preisabfrage                                      │
│  ├── InfluxDB-Export                                        │
│  └── History-Import + Backfill                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Web + Worker-Modus  (DVHUB_ENABLE_RUNTIME_WORKER=1)         │
│                                                             │
│  server.js  (PROCESS_ROLE = 'web')                          │
│  ├── HTTP-Server + API-Routen                               │
│  └── forkt → runtime-worker.js                              │
│              └── server.js (PROCESS_ROLE = 'runtime-worker')│
│                  ├── DV-Modbus-Server                       │
│                  ├── Victron-Polling                         │
│                  ├── Schedule-Auswertung                    │
│                  ├── Telemetrie + Rollups                   │
│                  └── EPEX + InfluxDB + Backfill             │
│                                                             │
│  Kommunikation: IPC-Kanal (process.send / process.on)       │
│  Protokoll:     runtime-worker-protocol.js                  │
│  Nachrichten:   RUNTIME_SNAPSHOT, COMMAND_REQUEST/RESULT,    │
│                 RUNTIME_READY, RUNTIME_ERROR                 │
└─────────────────────────────────────────────────────────────┘
```

Im Monolith-Modus macht ein einziger Prozess alles. Im Worker-Modus übernimmt der Web-Prozess nur HTTP und forkt einen Child-Prozess für die gesamte Laufzeit-Logik (Polling, Modbus-Server, Telemetrie). Die Kommunikation zwischen Web und Worker läuft über Node.js IPC mit einem festen Nachrichtenprotokoll.

### Datenfluss

```
Victron GX ──┬── Modbus TCP ──┐
             └── MQTT ─────── ┤
                               ▼
                    ┌─────────────────┐
                    │  Transport-Layer │  transport-modbus.js
                    │                 │  transport-mqtt.js
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  Poll-Loop      │  server.js: pollMeter()
                    │  → state.meter  │  Alle 2s (konfigurierbar)
                    │  → state.victron│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌─────────────┐
     │ Telemetrie │  │ Schedule   │  │ DV-Modbus   │
     │ Buffer     │  │ Evaluator  │  │ Server      │
     │ → SQLite   │  │ → Writes   │  │ Port 1502   │
     └────────────┘  └────────────┘  └─────────────┘
              │              │
              ▼              ▼
     ┌────────────┐  ┌─────────────────┐
     │ InfluxDB   │  │ Kleine Börsen-  │
     │ Export     │  │ automatik (SMA) │
     └────────────┘  └─────────────────┘
```

### Modulübersicht

DVhub besteht aus **server.js** als zentralem Kern und **14 spezialisierten Modulen**, die jeweils eine klar abgegrenzte Aufgabe haben:

#### Kern: `server.js` (~2800 Zeilen)

Der zentrale Monolith — enthält den kompletten Laufzeit-Zustand (`state`), den HTTP-Server, alle API-Routen, den DV-Modbus-Server, die Poll-Loop, die Schedule-Auswertung und die Orchestrierung aller Module. Alles was zusammenlaufen muss, passiert hier.

Wichtige Bereiche in server.js:
- **state-Objekt** (Zeile ~108): Zentraler In-Memory-Zustand — Meter, Victron, Schedule, Energie, EPEX, Telemetrie
- **pollMeter()**: Liest zyklisch Werte vom GX-Gerät über den konfigurierten Transport
- **evaluateSchedule()**: Wendet Schedule-Regeln an und steuert die Victron-Anlage
- **DV-Modbus-Server**: Beantwortet FC3/FC4-Reads und FC6/FC16-Writes vom Direktvermarkter
- **HTTP-Server + API**: Alle REST-Endpunkte, statische Dateien, Auth
- **EPEX-Preisabfrage**: Holt Day-Ahead-Preise und triggert SMA-Neuberechnung
- **InfluxDB-Export**: Schreibt Messwerte periodisch nach InfluxDB
- **Energiebilanz**: Berechnet Import/Export/Kosten/Erlöse pro Tag

---

#### Transport-Schicht

| Modul | Aufgabe |
|-------|---------|
| **transport-modbus.js** | Modbus-TCP-Client für Victron-Kommunikation. Verwaltet einen Connection-Pool mit Idle-Timeout, serialisiert Anfragen über eine Queue, unterstützt FC3/FC4-Read und FC6/FC16-Write. |
| **transport-mqtt.js** | MQTT-Client für Venus OS. Push-basiert — subscribt auf `N/<portalId>/...`-Topics und cached Werte lokal. Writes gehen über `W/<portalId>/...`-Topics. Benötigt `npm install mqtt`. |

Beide Transports bieten dasselbe Interface (`readRegisters`, `writeSingleRegister`, `init`, `destroy`), sodass server.js den Transport per Config wählen kann.

---

#### Konfiguration

| Modul | Aufgabe |
|-------|---------|
| **config-model.js** | Das umfangreichste Modul (~76k) — definiert alle Config-Felder mit Defaults, Typen, Validierung, UI-Sektionen und Beschreibungen. Stellt `loadConfigFile()`, `saveConfigFile()`, `getConfigDefinition()` bereit. Trennt `rawConfig` (was der User gespeichert hat) von `effectiveConfig` (mit allen Defaults aufgefüllt). Verwaltet auch die Zuordnung der Einstellungs-Arbeitsbereiche (quickstart, connection, control, services, advanced). |
| **app-version.js** | Liest Version aus `package.json` und Git-Revision aus `.git/HEAD`. Liefert `versionLabel` wie `v0.3.5.1+5b62066`. |

---

#### Zeitplan und Automatik

| Modul | Aufgabe |
|-------|---------|
| **schedule-runtime.js** | Kleine Hilfsbibliothek für Schedule-Logik: `parseHHMM()` für Zeitstrings, `scheduleMatch()` prüft ob eine Regel zum aktuellen Zeitpunkt aktiv ist, `autoDisableExpiredScheduleRules()` und `autoDisableStopSocScheduleRules()` deaktivieren Regeln automatisch nach Ablauf oder wenn der SOC unter den Stop-Wert fällt. |
| **small-market-automation.js** | Der Optimizer für die Kleine Börsenautomatik. Rein funktional — berechnet aus Day-Ahead-Preisen, verfügbarer Batterieenergie und Konfiguration die optimalen Entlade-Slots. Kernfunktionen: `computeAvailableEnergyKwh()` (wieviel kWh stehen zur Verfügung?), `buildChainVariants()` (Multi-Stage-Entladestrategien), `pickBestAutomationPlan()` (beste Slotkombination nach Erlös), `filterFreeAutomationSlots()` (Slots ohne Kollision mit manuellen Regeln). |
| **sun-times-cache.js** | Cacht Sonnenauf-/untergangszeiten pro Standort und Jahr in einer JSON-Datei unter `reference-data/`. Die SMA nutzt diese Zeiten, um Entladung auf sinnvolle Tageszeiten zu beschränken. |

Die Orchestrierung (wann wird neu geplant, wann werden Regeln regeneriert) liegt in server.js (`regenerateSmallMarketAutomationRules()`, `buildSmallMarketAutomationRules()`).

---

#### Telemetrie und Speicherung

| Modul | Aufgabe |
|-------|---------|
| **telemetry-store.js** | SQLite-Datenbankschicht (nutzt Node.js `node:sqlite`). Verwaltet die `samples`-Tabelle mit Zeitreihen, baut materialisierte 15-Minuten-Slots (`materialized_slots`), führt Rollups durch (5min → 15min → 1h), bereinigt alte Rohdaten. Stellt alle Abfragefunktionen für die History bereit. |
| **telemetry-runtime.js** | Wandelt Live-Daten in Telemetrie-Samples um. `buildLiveTelemetrySamples()` macht aus dem aktuellen `state.meter` + `state.victron` ein Array von Datenpunkten (grid_l1_w, battery_soc_pct, pv_total_w, etc.). Auch Preisdaten und Optimizer-Ergebnisse werden hier in Samples konvertiert. |

---

#### History und Datenquellen

| Modul | Aufgabe |
|-------|---------|
| **history-runtime.js** | Berechnet History-Ansichten (Tag/Woche/Monat/Jahr) aus der SQLite-Telemetrie. Pro 15-Minuten-Slot: Import/Export in kWh, Kosten nach Bezugspreis, Erlöse nach Marktpreis, Marktprämie. Aggregiert Slots zu Tages-/Wochen-/Monats-/Jahres-Summen mit Preisvergleich und Solar-Zusammenfassung. |
| **history-import.js** | Importiert historische Daten aus externen Quellen. VRM-Import: Holt Telemetrie-Daten von der Victron VRM-API (Chunk-weise, mit Retry und Rate-Limiting). Preis-Backfill: Lädt fehlende EPEX-Preise von Energy Charts nach. Gap- und Full-Backfill-Modi. |
| **energy-charts-market-values.js** | Holt monatliche und jährliche Solar-Marktwerte von energy-charts.info. Nutzt die Marktwert-Zeitreihen für die Marktprämien-Berechnung in der History. Persistiert Ergebnisse lokal im Telemetrie-Store. |
| **bundesnetzagentur-applicable-values.js** | Lädt die offiziellen "anzulegenden Werte" (EEG-Vergütungssätze) von der BNetzA-Website. Parst die veröffentlichten Excel-Dateien (XLSX) direkt aus dem ZIP ohne externe Abhängigkeiten. Cached die Ergebnisse lokal als JSON. Wird für die Marktprämien-Berechnung benötigt, um den Referenzwert pro PV-Anlage zu bestimmen. |

---

#### Laufzeit-Infrastruktur

| Modul | Aufgabe |
|-------|---------|
| **runtime-state.js** | Baut saubere, serialisierbare Snapshots aus dem `state`-Objekt. Definiert welche Felder in Meter/Victron/Schedule/Telemetrie-Snapshots enthalten sind. Wird sowohl für die IPC-Kommunikation (Worker → Web) als auch für die `/api/status`-Response verwendet. |
| **runtime-commands.js** | Definiert und validiert Befehle, die an den Runtime-Worker geschickt werden können: `poll_now`, `control_write`, `history_import`, `history_backfill`, `service_health_snapshot`. Stellt sicher, dass nur gültige Befehle durchkommen. |
| **runtime-performance.js** | Zwei Performance-Werkzeuge: `createSerialTaskRunner()` — serialisiert async Tasks (verhindert parallele Poll-Aufrufe), `createTelemetryWriteBuffer()` — puffert Telemetrie-Samples und flusht sie alle 5 Sekunden gebündelt in die DB. |
| **runtime-worker-protocol.js** | Definiert das IPC-Nachrichtenprotokoll zwischen Web- und Worker-Prozess. Nachrichtentypen: `RUNTIME_SNAPSHOT` (Worker → Web: aktueller Zustand), `COMMAND_REQUEST/RESULT` (Web → Worker: Befehle + Antworten), `RUNTIME_READY/ERROR`. Enthält auch die `createRuntimeCommandQueue()` für sequentielle Befehlsverarbeitung. |
| **runtime-worker.js** | Einstiegspunkt für den Worker-Prozess. Im Test-Modus (`DVHUB_RUNTIME_WORKER_TEST=1`): Simulierter Worker für Tests. Im Produktionsmodus: Setzt `DVHUB_PROCESS_ROLE=runtime-worker` und importiert `server.js` — der dann nur die Runtime-Teile startet (kein HTTP-Server). |

---

#### Netzwerk-Erkennung

| Modul | Aufgabe |
|-------|---------|
| **system-discovery.js** | Erkennt Victron-GX-Geräte im lokalen Netzwerk per mDNS (multicast-dns). Sucht nach `_http._tcp.local`-Services und filtert nach Victron-Hinweisen (victron, venus, cerbo, gx) im Hostnamen. Liefert IP, Hostname und Label für die Auswahl in Setup/Einstellungen. |

---

### Frontend

Das Frontend ist eine klassische Multi-Page-App ohne Build-Schritt — reines HTML + Vanilla JS + CSS:

| Datei | Seite | Aufgabe |
|-------|-------|---------|
| **index.html + app.js** | Dashboard | Live-Werte, Day-Ahead-Chart, Kostenübersicht, Schedule-Steuerung, SMA-Panel, Event-Log |
| **history.html + history.js** | Historie | Tag/Woche/Monat/Jahr-Ansichten, Balkendiagramme, Preislisten, Backfill-Trigger |
| **settings.html + settings.js** | Einstellungen | Alle Config-Felder in Arbeitsbereichen, Import/Export, Health-Checks |
| **setup.html + setup.js** | Setup-Assistent | Schrittweiser First-Run-Wizard mit Validierung |
| **tools.html + tools.js** | Tools | Modbus-Scanner, Schedule-Editor, VRM-Import |
| **common.js** | Shared | Gemeinsame Funktionen (Formatierung, API-Calls, UI-Helfer) |
| **styles.css** | Shared | Zentrales Stylesheet für alle Seiten |

---

### Projektstruktur (Dateien)

```
dvhub/
├── README.md                   Dieses Dokument
├── install.sh                  Installer-Skript
├── 20-dv-modbus.sh             iptables für Tunnel-Portforwarding
├── LICENSE.md / COMMERCIAL_LICENSE.md / CONTRIBUTING.md
│
├── dvhub/                      Hauptanwendung
│   ├── server.js               Zentraler Kern (HTTP, Modbus, Polling, State, API)
│   ├── config-model.js         Config-Schema, Defaults, Validierung
│   ├── transport-modbus.js     Victron Modbus-TCP Client
│   ├── transport-mqtt.js       Victron MQTT Client
│   ├── schedule-runtime.js     Schedule-Matching und Auto-Disable
│   ├── small-market-automation.js  SMA-Optimizer (reine Berechnung)
│   ├── telemetry-store.js      SQLite-Datenbankschicht
│   ├── telemetry-runtime.js    Live-Daten → Telemetrie-Samples
│   ├── history-runtime.js      History-Berechnung aus SQLite
│   ├── history-import.js       VRM-Import + Preis-Backfill
│   ├── energy-charts-market-values.js  Solar-Marktwerte
│   ├── bundesnetzagentur-applicable-values.js  BNetzA-Referenzwerte
│   ├── system-discovery.js     mDNS-Geräteerkennung
│   ├── sun-times-cache.js      Sonnenzeiten-Cache
│   ├── runtime-state.js        State-Snapshots
│   ├── runtime-commands.js     Worker-Befehlsvalidierung
│   ├── runtime-performance.js  Serial-Runner + Write-Buffer
│   ├── runtime-worker-protocol.js  IPC-Protokoll
│   ├── runtime-worker.js       Worker-Einstiegspunkt
│   ├── app-version.js          Version + Git-Revision
│   ├── util.js                 toFiniteNumber()
│   ├── config.example.json     Beispielkonfiguration
│   ├── package.json            Node.js Paketdefinition
│   ├── hersteller/victron.json Victron-Register und Kommunikationswerte
│   ├── public/                 Web-Frontend (HTML + JS + CSS)
│   └── test/                   32 Testdateien (Unit + Integration)
│
├── assets/                     Projekt-Assets und Screenshots
├── docs/                       Dokumentation und Planungsdateien
└── db/                         Datenbankschema und -Dateien
```

---

## Oberflächen

### Dashboard

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

### Einstellungen

Die Einstellungsseite ist in kompakte Arbeitsbereiche gegliedert:

- Schnellstart
- Anlage verbinden
- Steuerung
- Preise & Daten
- Erweitert

Dazu kommen Import/Export, Health-Checks, Service-Status und optional ein Restart-Button.

### Setup

Der First-Run-Setup-Assistent führt Schritt für Schritt durch:

- HTTP-Port und API-Token
- Victron-Verbindung per Modbus oder MQTT
- Meter- und DV-Basiswerte
- EPEX- und Influx-Grunddaten
- Review-Schritt mit Validierung vor dem Speichern
- Anzeige vererbter Meter- und DV-Register-Verbindungen im Review

### Tools

Die Tool-Seite enthält:

- Modbus Register Scan
- Schedule JSON Bearbeitung
- Health-/Service-Status
- VRM History-Import für Telemetrie-Nachfüllung

### Historie

Die History-Seite bündelt die interne SQLite-Historie zu einer eigenen Analyseansicht:

- Tag-, Wochen-, Monats- und Jahresansicht
- Bezug, Einspeisung, Kosten, Erlöse und Netto je Zeitraum
- Preisvergleich zwischen historischem Marktpreis und eigenem Bezugspreis
- Preisliste und Aggregat-Preishinweis in der Tagesansicht
- Solar-Zusammenfassung mit Jahres-Marktwert in der Jahresansicht
- Energie-Balkendiagramme in Wochen-/Monats-/Jahresansicht
- Kennzeichnung unvollständiger Slots bei fehlenden Marktpreisen oder Tarifzeiträumen
- gezielter Preis-Backfill nur für Telemetrie-Buckets ohne historischen Marktpreis

---

## Integrationen

DVhub stellt Daten bereit oder nimmt Optimierungsergebnisse entgegen für:

- **Home Assistant**
- **Loxone**
- **EOS (Akkudoktor)**
- **EMHASS**
- **InfluxDB v2/v3**

Zusätzlich kann DVhub historische Daten per **VRM** nachladen, wenn neue Installationen ältere Werte auffüllen sollen oder Lücken entstanden sind.
Für Marktpreise kann DVhub zusätzlich fehlende historische Börsenpreise gezielt über Energy Charts in die interne SQLite-Datenbank zurückschreiben.

---

## Direktvermarktung kompakt

### Wozu eine DV-Schnittstelle?

Eine Direktvermarktungs-Schnittstelle verbindet den Direktvermarkter mit deiner Anlage, damit:

- Live-Werte abgefragt werden können
- Steuersignale bei negativen Preisen oder Vermarktungsvorgaben ankommen

Der Direktvermarkter kann so Einspeisung bewerten, regeln und wirtschaftlich steuern.

### Warum DVhub statt Plexlog?

Der physische Plexlog kann Live-Daten liefern, aber die Steuerung moderner Victron-Setups ist in der Praxis oft unflexibel oder nicht vollständig nutzbar. DVhub liest die Daten direkt vom GX-Gerät und beantwortet die PLEXLOG-kompatiblen Modbus-Anfragen in Software.

### Wer braucht das?

Nach dem Solarspitzengesetz benötigen PV-Anlagen ab **25 kWp** typischerweise eine DV-Schnittstelle für die Direktvermarktung. Kleinere Anlagen können freiwillig teilnehmen.

### Warum ist das auch unter 30 kWp interessant?

Mit der diskutierten **Pauschaloption / MiSpeL** wird Direktvermarktung auch für kleinere Anlagen mit Speicher attraktiver, weil Speicher flexibler aus PV und Netz geladen werden dürfen und die Vermarktung wirtschaftlich interessanter wird.

### MiSpeL-Status

Stand **März 2026**:

- BNetzA-Festlegung soll bis **30. Juni 2026** finalisiert werden
- die **EU-beihilferechtliche Genehmigung** steht noch aus
- die Konsultationsphase wurde im **Oktober 2025** abgeschlossen

### Offizielle Links

- [BNetzA MiSpeL Festlegungsverfahren](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Aufsicht/MiSpeL/start.html)
- [BNetzA MiSpeL Artikel/Übersicht](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Aufsicht/MiSpeL/artikel.html)
- [BNetzA Pressemitteilung (19.09.2025)](https://www.bundesnetzagentur.de/SharedDocs/Pressemitteilungen/DE/2025/20250919_MiSpeL.html)
- [Anlage 2: Pauschaloption Eckpunkte (PDF)](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Aufsicht/MiSpeL/DL/Anlage2.pdf)
- [BMWK FAQ Solarspitzengesetz](https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Dossier/ErneuerbareEnergien/faq-zur-energierechtsnovelle-zur-vermeidung-von-stromspitzen-und-zum-biomassepaket.html)

### LUOX-Anbindung

Für LUOX brauchst du in der Praxis:

1. Meldung, dass eine PLEXLOG-kompatible DV-Schnittstelle vorhanden ist
2. OpenVPN-Tunnel zu LUOX
3. Portforwarding von Port `502` aus dem Tunnel auf Port `1502` von DVhub

**Unifi-Hinweis:** Falls die GUI das Tunnel-Portforwarding nicht sauber abbildet, hilft das Skript [`20-dv-modbus.sh`](20-dv-modbus.sh) für die iptables-Regeln.

---

## Installation im Detail

### Manuelle Installation

```bash
sudo apt update
sudo apt install -y curl ca-certificates git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install -y tcpdump jq
sudo mkdir -p /opt/dvhub /etc/dvhub /var/lib/dvhub
sudo useradd -r -s /usr/sbin/nologin dvhub
sudo git clone https://github.com/chloepriceless/dvhub.git /opt/dvhub
```

Danach:

```bash
sudo chown -R dvhub:dvhub /opt/dvhub /etc/dvhub /var/lib/dvhub
cd /opt/dvhub/dvhub
npm install --omit=dev
sudo cp config.example.json /etc/dvhub/config.json
sudo mkdir -p /etc/dvhub/hersteller
sudo cp hersteller/victron.json /etc/dvhub/hersteller/victron.json
sudo nano /etc/dvhub/config.json
```

Technische Victron-Werte wie Register, Port, Unit-ID oder Timeout werden nicht mehr in `/etc/dvhub/config.json` gepflegt.
Diese Werte liegen im Herstellerprofil unter `/etc/dvhub/hersteller/victron.json`.

Nur bei MQTT-Nutzung zusätzlich:

```bash
npm install mqtt
```

### systemd Service

Datei: `/etc/systemd/system/dvhub.service`

```ini
[Unit]
Description=DVhub DV Control
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dvhub
Group=dvhub
WorkingDirectory=/opt/dvhub/dvhub
ExecStart=/usr/bin/node --experimental-sqlite /opt/dvhub/dvhub/server.js
Environment=NODE_ENV=production
Environment=DV_APP_CONFIG=/etc/dvhub/config.json
Environment=DV_ENABLE_SERVICE_ACTIONS=1
Environment=DV_SERVICE_NAME=dvhub.service
Environment=DV_SERVICE_USE_SUDO=1
Environment=DV_DATA_DIR=/var/lib/dvhub
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Service aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dvhub
```

### Restart aus der GUI erlauben

```bash
SYSTEMCTL_PATH="$(command -v systemctl)"
echo "dvhub ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} restart dvhub.service" | sudo tee /etc/sudoers.d/dvhub-service-actions >/dev/null
echo "dvhub ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} is-active dvhub.service" | sudo tee -a /etc/sudoers.d/dvhub-service-actions >/dev/null
echo "dvhub ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} show dvhub.service *" | sudo tee -a /etc/sudoers.d/dvhub-service-actions >/dev/null
sudo chmod 440 /etc/sudoers.d/dvhub-service-actions
```

### Manueller Start

```bash
cd /opt/dvhub/dvhub
DV_APP_CONFIG=/etc/dvhub/config.json DV_DATA_DIR=/var/lib/dvhub npm start
```

---

## API und Konfiguration

### Vollständige API-Referenz

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

### Bezugspreise nach Zeitraum

Unter `userEnergyPricing.periods` lassen sich mehrere Tarifzeiträume definieren:

- Zeiträume sind tageweise und inklusive `startDate` bis `endDate`
- Zeiträume dürfen sich nicht überschneiden
- pro Zeitraum ist `fixed` oder `dynamic` möglich
- wenn kein Zeitraum passt, greift die bestehende Legacy-Preislogik als Fallback

### §14a EnWG Modul 3

Unter `userEnergyPricing` lassen sich bis zu drei steuerbare Zeitfenster nach §14a EnWG Modul 3 konfigurieren:

- `usesParagraph14aModule3`: Aktiviert die Sonderpreisfenster
- `module3Windows`: Bis zu drei Fenster mit Start, Ende und Sonderpreis in ct/kWh

### Marktwert- und Marktprämien-Modus

Unter `userEnergyPricing` stehen für die History-Marktprämie zwei zusätzliche Felder bereit:

- `marketValueMode`: `annual` für das bisherige Verhalten oder `monthly` für Monatsmarktwerte auch in Monats- und Jahresansichten
- `pvPlants`: Liste der PV-Anlagen mit `kwp` und `commissionedAt`, damit die offiziellen anzulegenden Referenzwerte pro Anlage abgeleitet werden können

Die Einstellungsseite pflegt diese Werte zentral im Bereich Marktprämie.

### Wichtige Config-Sektionen

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

### Hinweise

- Änderungen an Victron-Registern, Port, Unit-ID oder Timeout erfolgen bewusst nur in `/etc/dvhub/hersteller/victron.json`
- Die normale `config.json` bleibt damit klein und sicher und enthält nur Betriebs- und Anlagenwerte
- **InfluxDB v3** ist Default, v2 bleibt kompatibel
- `dvControl.enabled` ist standardmäßig deaktiviert und muss aktiv gesetzt werden
- `userEnergyPricing` erlaubt festen Endkundenpreis oder dynamische Preisbestandteile auf Basis von EPEX
- im MQTT-Modus wird `victron.mqtt.portalId` benötigt; ohne eigenen Broker nutzt DVhub den GX-Host
- `npm install mqtt` wird nur für MQTT-Betrieb benötigt
- API-Responses redaktieren sensible Felder (`apiToken`, `influx.token`, `vrmToken`)
- Config-Datei wird mit `0600`-Berechtigung geschrieben (Security-Hardening)

---

## Changelog

### 0.3.5.1 (2026-03-14)

**Kleine Börsenautomatik (neu):**

- Automatische Entladung in Hochpreisphasen basierend auf Day-Ahead-Preisen
- Energiebasierte Slot-Allokation statt fester Slot-Anzahl (verfügbare kWh aus SOC, Kapazität, Wirkungsgrad)
- Multi-Stage Chain-Varianten für mehrstufige Entladestrategien
- Transparente Planungsphase mit Statusanzeige im Dashboard
- Chart-Highlighting der geplanten Entlade-Slots im Day-Ahead-Chart
- Konfigurierbares Suchfenster, Min-SOC, Max-Entladeleistung und Aggressivitätsprämie
- Geschützte Automationsregeln (read-only, automatisch regeneriert)
- Sonnenauf-/untergangszeiten-Cache für standortbasierte Optimierung
- Constraint-Erzwingung für zusammenhängende Slot-Fenster und Stage-Cooldown
- Optimizer auf einzelne Perioden beschränkt mit tagweisem Preis-Highlighting
- Vollständige Konfiguration unter `schedule.smallMarketAutomation`
- Eigene API-Endpunkte unter `/api/schedule/automation/config`

**History und Marktwerte:**

- Marktwerte für Wochen- und Monatsansichten nachladen
- Lokale Persistenz der Marktwert-Referenzdaten
- Preisliste und Aggregat-Preishinweis in der Tagesansicht
- Solar-Zusammenfassung mit Jahres-Marktwert in der Jahresansicht
- Energie-Balkendiagramme in Wochen-/Monats-/Jahresansicht
- Cash-Netto in History-Summary wiederhergestellt
- VRM Full-Backfill durchläuft jetzt auch alte Lücken am Anfang
- Konfigurierbarer Lookback-Zeitraum für Full-Backfill
- Chart-Labels auf ganze Cent skaliert, Import-Linie bedingt gestrichelt

**Security-Hardening:**

- Timing-Safe Token-Vergleich (`crypto.timingSafeEqual`) statt String-Vergleich
- Content-Security-Policy Header zum Schutz vor XSS
- API-Responses redaktieren sensible Felder (`apiToken`, `influx.token`, `vrmToken`)
- Config-Datei wird mit `0600`-Berechtigung geschrieben
- SQL-Injection-Schutz in `countRows()` per Table-Allowlist
- Eingabevalidierung für Schedule-Regeln (`validateScheduleRule`)

**Weitere Verbesserungen:**

- `schedule.manualOverrideTtlMs` als neues Konfigurationsfeld
- Setup-Wizard: Anzeige vererbter Meter- und DV-Register-Verbindungen im Review-Schritt
- Einstellungen: Klappbare Gruppen klarer beschriftet
- kWh-Preise werden jetzt in Cent angezeigt
- Korrekte Import-Kostenberechnung mit konfiguriertem Bezugspreis
- Umfangreiche Testsuite (32 Testdateien: SMA Unit/Integration, Zeitformat, Sun-Times, History, Setup u.v.m.)

**Entfernt:**

- Opportunity-Blend-Slider aus der History-Seite (UI und Logik)
- `marketPremiumValueEur()` / `marketPremiumRateCtKwh()` Hilfsfunktionen
- `renderRevenueCostBars()` / `renderExportBars()` Chart-Funktionen
- `buildRegisterFieldGroup()` und zugehörige Meta-Konstanten (`POINT_META`, `CONTROL_WRITE_META`, `DV_CONTROL_META`)
- `buildWorkspaceDefaultCopy()` aus Settings, `collectConfig()` aus Setup, `escHtml()` Duplikat aus Tools
- `/api/setup/status` Endpunkt (redundant zu `/api/config`)
- Diverse Hilfsfunktionen internalisiert (nicht mehr exportiert)

---

## Lizenz

This project is licensed under the **Energy Community License (ECL-1.0)**.

The goal of this license is to support the renewable energy community
while preventing commercial reselling of the software.

### Allowed

* Operating energy systems using this software
* Generating revenue from energy production
* Hiring companies for installation or administration
* Community modifications and forks

### Not allowed

* Selling the software itself
* Selling hardware with the software preinstalled
* Commercial SaaS offerings based on this software
* Bundling the software into commercial products

If your company wants to integrate this software into a commercial
product, please request a **commercial license**.
