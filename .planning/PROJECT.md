# DVhub v2 — Modulares Energie-Management-System

## What This Is

DVhub ist ein modulares Energie-Management-System fuer Direktvermarktung und Preisoptimierung von PV-Speicher-Anlagen. Es verbindet Wechselrichter, Batteriespeicher, E-Auto-Ladestationen und weitere Geraete ueber ein universelles Gateway und steuert diese basierend auf Boersenpreisen, Fahrplaenen und DV-Signalen. Zielgruppe sind Betreiber von PV-Anlagen mit Batteriespeicher, die an der Stromboerse teilnehmen und ihren Ertrag maximieren wollen.

## Core Value

Das System muss zuverlaessig und in Echtzeit die Direktvermarktungs-Schnittstelle bedienen (Messwert-Lieferung an den Direktvermarkter, Abregelungssignale umsetzen) UND gleichzeitig durch intelligente Preisoptimierung den Boersenertrag und Strombezug optimieren — alles aus einer Box.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing functionality from v1. -->

- ✓ Victron ESS Anbindung per ModbusTCP und MQTT — existing
- ✓ DV-Schnittstelle mit LUOX-Direktvermarkter (Modbus Slave, Messwert-Read, Abregelung) — existing
- ✓ Boersenpreis-Anzeige (EPEX Day-Ahead via energy-charts.info) — existing
- ✓ Zeitplan-basierte Anlagensteuerung (Schedule Rules) — existing
- ✓ Kleine Boersenautomatik (automatische Lade-/Entladezeitfenster) — existing
- ✓ Live-Dashboard mit Anlagenzustaenden und Steuerung — existing
- ✓ History-Daten mit VRM-Backfill in 15-Min-Bloecken — existing
- ✓ Telemetrie-Speicherung in SQLite — existing
- ✓ Hersteller-Profile als externe JSON-Config (victron.json) — existing
- ✓ Optional: InfluxDB-Export — existing
- ✓ API-Token-Authentifizierung — existing
- ✓ Systemd-basierte Installation (install.sh) — existing

### Active

<!-- Current scope — the v2 architectural redesign. -->

**Modul-Architektur:**
- [ ] Aufteilung in drei Module: Gateway-Basis, DV-Modul, Optimierungs-Modul
- [ ] Gateway-Basis ist immer vorhanden, mindestens ein weiteres Modul muss aktiv sein
- [ ] Module koennen im Setup/Einrichtungsmenue einzeln aktiviert/deaktiviert werden
- [ ] Klare Modul-Grenzen mit definierten internen APIs/Schnittstellen
- [ ] Shared Endpunkte wo sinnvoll, eigene Modul-Endpunkte wo noetig

**Gateway-Basis-Modul:**
- [ ] Universelle Geraete-Anbindung: ModbusTCP, MQTT, HTTP-Endpunkte, Webhooks
- [ ] Hersteller-Configs externalisiert (jeder Hersteller eigene Config-Datei mit Registern)
- [ ] Unterstuetzung fuer Victron, Deye, und generische Modbus/MQTT-Geraete
- [ ] Telemetrie-Sammlung in konfigurierbarer Aufloesung (hoch fuer Charts, 15min fuer Optimierung)
- [ ] Messpunkt-Verwaltung: Erfassung, Verarbeitung, Speicherung, Abruf
- [ ] Steuerungssignal-Weiterleitung an alle verbundenen Geraete (Speicher, Wechselrichter, etc.)
- [ ] IP-AllowList und optionale Token-Absicherung pro Schnittstelle

**DV-Modul:**
- [ ] Anbindung an verschiedene Direktvermarkter (aktuell LUOX, erweiterbar)
- [ ] Messwert-Uebermittlung an den Direktvermarkter (Read-Signal beantworten)
- [ ] Abregelungssignal-Verarbeitung (0%/100%, offen fuer Zwischenwerte)
- [ ] Steuerungsbefehle an verbundene Anlagen weiterleiten (Abschaltung/Freigabe)
- [ ] Unabhaengig vom Optimierungs-Modul betreibbar

**Optimierungs-Modul (HEMS):**
- [ ] EOS-Integration: Datenversorgung, Fahrplan-Empfang, Optimierungsvorschlaege
- [ ] EMHASS-Integration: Datenversorgung, Fahrplan-Empfang, Optimierungsvorschlaege
- [ ] EVCC-Integration: E-Auto-Planungsdaten und Ladedaten in Datenbasis
- [ ] Boersenertrag-Optimierung mit Fahrplaenen aus EOS/EMHASS
- [ ] Strombezug-Optimierung: Dynamische Tarife, Mehrzeitfenster-Tarife (Octopus), fixe Preise
- [ ] Zeitvariable Netzentgelte (Paragraph 14a, Modul 3)
- [ ] Vorbereitung fuer MISPEL/Pauschaloption (Graustrom-Bezug aus dem Netz)
- [ ] Fahrplan-Engine: Optimierte Plaene umsetzen (PV, Batterie, E-Auto, Waermepumpe, Netzbezug)
- [ ] Dashboard: Live-Daten, DV-Zustaende, Boersenpreise, Planungsengine, Schaltstatus
- [ ] History-Daten mit breiter Datenbasis von allen Endpunkten
- [ ] Plan-Scoring, Vergleich, automatische Winner-Auswahl zwischen Optimierern

**Datenarchitektur:**
- [ ] Optimale Datenbankstruktur recherchieren (PostgreSQL vs. TimeSeries-DB vs. Hybrid)
- [ ] Multi-Resolution-Datenhaltung (hochaufgeloest fuer Charts, 15min fuer Steuerung)
- [ ] Schema-Trennung nach Modulen (shared, dv, opt, exec — oder aequivalent)
- [ ] Sichere, leistungsfaehige, schnelle Datenstruktur

**Deployment:**
- [ ] Laeuft auf Raspberry Pi (ARM) und x86
- [ ] Container-Deployment moeglich (DVhub + EOS/EMHASS/EVCC als Compose-Stack)
- [ ] Native Installation weiterhin unterstuetzt
- [ ] Hybrid-Modus: DVhub nativ, Optimizer als Container
- [ ] EOS, EMHASS als mitgelieferte Installation ("alles aus einer Box")
- [ ] Minimaler Maintenance-Aufwand ueber alle Deployment-Varianten

**UI/Frontend:**
- [ ] UI-Framework-Wahl recherchieren (Vanilla vs. leichtes Framework)
- [ ] Einstellungs-Oberflaeche fuer alle Stellschrauben
- [ ] Modul-Aktivierung im Setup-Menue

### Out of Scope

<!-- Explicit boundaries — these come later or are deliberately excluded. -->

- GPIO-Pins fuer Funkrundsteuerempfaenger — spaeter, Architektur vorbereiten
- CLS-Steuerboxen — spaeter
- EEBUS-Kommunikation — spaeter
- Blend-Modus (Optimizer-Mixing auf Slot-Ebene) — erst nach genug Evidenz
- Weitere DV-Anbieter neben LUOX — erst wenn Schnittstellen bekannt
- SMA-Wechselrichter — v1 fokussiert auf Victron, Deye, generisch

## Context

**Bestehende Codebase:** Monolithischer Node.js Server (~2800 Zeilen server.js), ES Modules, kein Framework, node:sqlite fuer Telemetrie, Vanilla HTML/JS Frontend. Funktioniert produktiv mit Victron-Hardware und LUOX-Direktvermarkter.

**Vorhandene Architektur-Dokumente:** Vier detaillierte Design-Dokumente existieren unter `docs/plans/2026-03-10-*`:
- PostgreSQL Schema Blueprint (4 Schemas: shared, dv, opt, exec)
- Optimizer Orchestrator Implementation Plan (12 Tasks)
- Optimizer Orchestrator Design (6-Layer Architektur)
- Data Architecture Masterlist (MVP + Phase 2 Tabellen)

Diese Dokumente dienen als Referenz, sind aber nicht bindend — insbesondere die DB-Wahl (PostgreSQL vs. Alternativen) soll neu recherchiert werden.

**Codebase-Map:** Detaillierte Analyse unter `.planning/codebase/` (7 Dokumente, 1360 Zeilen).

**Externe Systeme:**
- EOS (Energieoptimierungssystem) — externer Optimizer, soll mitgeliefert werden
- EMHASS (Energy Management for Home Assistant) — zweiter Optimizer
- EVCC (Electric Vehicle Charge Controller) — EV-Ladedaten und -Steuerung
- Victron VRM API — groesste Datenbasis fuer Backfill
- energy-charts.info — EPEX Day-Ahead Preise
- Bundesnetzagentur — Anzulegender Wert

## Constraints

- **Platform**: Muss auf Raspberry Pi (ARM, begrenzte Ressourcen) UND x86 laufen — beeinflusst DB-Wahl und Performance-Budget
- **Node.js**: Node.js >= 22.5 als Runtime (wegen node:sqlite), Wechsel nur wenn Research Phase bessere Alternative zeigt
- **Echtzeit**: DV-Messwert-Lieferung und Abregelung muessen in Echtzeit funktionieren — keine Verzoegerung durch Optimizer-Logik
- **Wartbarkeit**: Modulare Struktur, keine zu komplexe Codestruktur, einzelne Teile austauschbar
- **Best Practices**: Jede Technologie und jeder Endpunkt nach Best Practices implementiert
- **Abwaertskompatibilitaet**: Bestehende Funktionalitaet (DV, Schedule, Dashboard) darf nicht brechen

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 3 Module: Gateway + DV + Optimierung | Universalitaet und unabhaengiger Betrieb, mindestens ein Modul neben Gateway aktiv | — Pending |
| Hersteller-Configs externalisiert | Keine hart-verdrahteten Register im Code, User kann eigene Configs anlegen | — Pending |
| DB-Wahl offen, Research erforderlich | TimeSeries-Daten koennten spezielle DB brauchen, nicht vorab auf PostgreSQL festlegen | — Pending |
| UI-Framework offen, Research erforderlich | Vanilla JS hat Grenzen bei wachsendem Dashboard, aber Framework-Overhead auf Pi beachten | — Pending |
| Deployment flexibel: nativ + Container | Container-Stack mit EOS/EMHASS/EVCC sinnvoll, aber nativer Betrieb auf Pi muss bleiben | — Pending |
| Modul-Trennung als erste Prioritaet | Architektur-Fundament muss stehen bevor Features drauf gebaut werden | — Pending |
| Victron + Deye + generisch fuer v1 | Victron als Hauptplattform, Deye als zweiter Hersteller, generisch fuer alles andere | — Pending |

---
*Last updated: 2026-03-14 after initialization*
