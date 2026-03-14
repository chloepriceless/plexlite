# Architektur

## Prozessmodell

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

## Datenfluss

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

## Modulübersicht

DVhub besteht aus **server.js** als zentralem Kern und **14 spezialisierten Modulen**, die jeweils eine klar abgegrenzte Aufgabe haben.

### Kern: `server.js` (~2800 Zeilen)

Der zentrale Monolith — enthält den kompletten Laufzeit-Zustand (`state`), den HTTP-Server, alle API-Routen, den DV-Modbus-Server, die Poll-Loop, die Schedule-Auswertung und die Orchestrierung aller Module.

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

### Transport-Schicht

| Modul | Aufgabe |
|-------|---------|
| **transport-modbus.js** | Modbus-TCP-Client für Victron-Kommunikation. Verwaltet einen Connection-Pool mit Idle-Timeout, serialisiert Anfragen über eine Queue, unterstützt FC3/FC4-Read und FC6/FC16-Write. |
| **transport-mqtt.js** | MQTT-Client für Venus OS. Push-basiert — subscribt auf `N/<portalId>/...`-Topics und cached Werte lokal. Writes gehen über `W/<portalId>/...`-Topics. Benötigt `npm install mqtt`. |

Beide Transports bieten dasselbe Interface (`readRegisters`, `writeSingleRegister`, `init`, `destroy`), sodass server.js den Transport per Config wählen kann.

---

### Konfiguration

| Modul | Aufgabe |
|-------|---------|
| **config-model.js** | Das umfangreichste Modul (~76k) — definiert alle Config-Felder mit Defaults, Typen, Validierung, UI-Sektionen und Beschreibungen. Stellt `loadConfigFile()`, `saveConfigFile()`, `getConfigDefinition()` bereit. Trennt `rawConfig` (was der User gespeichert hat) von `effectiveConfig` (mit allen Defaults aufgefüllt). Verwaltet auch die Zuordnung der Einstellungs-Arbeitsbereiche (quickstart, connection, control, services, advanced). |
| **app-version.js** | Liest Version aus `package.json` und Git-Revision aus `.git/HEAD`. Liefert `versionLabel` wie `v0.3.5.1+5b62066`. |

---

### Zeitplan und Automatik

| Modul | Aufgabe |
|-------|---------|
| **schedule-runtime.js** | Kleine Hilfsbibliothek für Schedule-Logik: `parseHHMM()` für Zeitstrings, `scheduleMatch()` prüft ob eine Regel zum aktuellen Zeitpunkt aktiv ist, `autoDisableExpiredScheduleRules()` und `autoDisableStopSocScheduleRules()` deaktivieren Regeln automatisch nach Ablauf oder wenn der SOC unter den Stop-Wert fällt. |
| **small-market-automation.js** | Der Optimizer für die Kleine Börsenautomatik. Rein funktional — berechnet aus Day-Ahead-Preisen, verfügbarer Batterieenergie und Konfiguration die optimalen Entlade-Slots. Kernfunktionen: `computeAvailableEnergyKwh()`, `buildChainVariants()`, `pickBestAutomationPlan()`, `filterFreeAutomationSlots()`. |
| **sun-times-cache.js** | Cacht Sonnenauf-/untergangszeiten pro Standort und Jahr in einer JSON-Datei unter `reference-data/`. Die SMA nutzt diese Zeiten, um Entladung auf sinnvolle Tageszeiten zu beschränken. |

Die Orchestrierung (wann wird neu geplant, wann werden Regeln regeneriert) liegt in server.js (`regenerateSmallMarketAutomationRules()`, `buildSmallMarketAutomationRules()`).

---

### Telemetrie und Speicherung

| Modul | Aufgabe |
|-------|---------|
| **telemetry-store.js** | SQLite-Datenbankschicht (nutzt Node.js `node:sqlite`). Verwaltet die `samples`-Tabelle mit Zeitreihen, baut materialisierte 15-Minuten-Slots (`materialized_slots`), führt Rollups durch (5min → 15min → 1h), bereinigt alte Rohdaten. |
| **telemetry-runtime.js** | Wandelt Live-Daten in Telemetrie-Samples um. `buildLiveTelemetrySamples()` macht aus dem aktuellen `state.meter` + `state.victron` ein Array von Datenpunkten. Auch Preisdaten und Optimizer-Ergebnisse werden hier in Samples konvertiert. |

---

### History und Datenquellen

| Modul | Aufgabe |
|-------|---------|
| **history-runtime.js** | Berechnet History-Ansichten (Tag/Woche/Monat/Jahr) aus der SQLite-Telemetrie. Pro 15-Minuten-Slot: Import/Export in kWh, Kosten nach Bezugspreis, Erlöse nach Marktpreis, Marktprämie. |
| **history-import.js** | Importiert historische Daten aus externen Quellen. VRM-Import: Holt Telemetrie-Daten von der Victron VRM-API (Chunk-weise, mit Retry und Rate-Limiting). Preis-Backfill: Lädt fehlende EPEX-Preise von Energy Charts nach. |
| **energy-charts-market-values.js** | Holt monatliche und jährliche Solar-Marktwerte von energy-charts.info. Nutzt die Marktwert-Zeitreihen für die Marktprämien-Berechnung in der History. |
| **bundesnetzagentur-applicable-values.js** | Lädt die offiziellen "anzulegenden Werte" (EEG-Vergütungssätze) von der BNetzA-Website. Parst die veröffentlichten Excel-Dateien (XLSX) direkt aus dem ZIP ohne externe Abhängigkeiten. |

---

### Laufzeit-Infrastruktur

| Modul | Aufgabe |
|-------|---------|
| **runtime-state.js** | Baut saubere, serialisierbare Snapshots aus dem `state`-Objekt. Wird sowohl für IPC (Worker → Web) als auch für `/api/status` verwendet. |
| **runtime-commands.js** | Definiert und validiert Befehle für den Runtime-Worker: `poll_now`, `control_write`, `history_import`, `history_backfill`, `service_health_snapshot`. |
| **runtime-performance.js** | `createSerialTaskRunner()` — serialisiert async Tasks, `createTelemetryWriteBuffer()` — puffert Samples und flusht alle 5s gebündelt in die DB. |
| **runtime-worker-protocol.js** | IPC-Nachrichtenprotokoll zwischen Web- und Worker-Prozess. Nachrichtentypen: `RUNTIME_SNAPSHOT`, `COMMAND_REQUEST/RESULT`, `RUNTIME_READY/ERROR`. Enthält `createRuntimeCommandQueue()`. |
| **runtime-worker.js** | Einstiegspunkt für den Worker-Prozess. Setzt `DVHUB_PROCESS_ROLE=runtime-worker` und importiert `server.js` — der dann nur die Runtime-Teile startet. |

---

### Netzwerk-Erkennung

| Modul | Aufgabe |
|-------|---------|
| **system-discovery.js** | Erkennt Victron-GX-Geräte im lokalen Netzwerk per mDNS (multicast-dns). Sucht nach `_http._tcp.local`-Services und filtert nach Victron-Hinweisen im Hostnamen. |

---

## Frontend

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

## Projektstruktur (Dateien)

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
