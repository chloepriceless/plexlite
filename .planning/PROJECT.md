# PlexLite

## What This Is

PlexLite ist eine webbasierte Direktvermarktungs-Schnittstelle fuer Victron-ESS-Systeme. Das Produkt verbindet Modbus-/MQTT-basierte Anlagensteuerung mit einer lokalen Weboberflaeche fuer Setup, Konfiguration, Monitoring und Diagnose. Im aktuellen Projektfokus geht es nicht um neue Energie-Features, sondern darum, die bestehende Oberflaeche fuer Laien und unerfahrene Nutzer deutlich einfacher, kompakter und besser gefuehrt zu machen.

## Core Value

Auch ein unerfahrener Nutzer soll PlexLite ohne Ueberforderung einrichten und die richtigen Einstellungen schnell finden koennen.

## Requirements

### Validated

- ✓ PlexLite emuliert die DV-/Plexlog-Schnittstelle ueber einen lokalen Modbus-TCP-Dienst und steuert Victron-seitige Werte ueber Modbus oder MQTT - existing
- ✓ PlexLite bietet ein Web-Dashboard fuer Status, Live-Werte und Schedule-bezogene Bedienung - existing
- ✓ PlexLite besitzt bereits eigene Oberflaechen fuer Setup, Settings und Tools - existing
- ✓ PlexLite kann Konfiguration laden, speichern, importieren und exportieren - existing
- ✓ PlexLite integriert Zusatzfunktionen wie EPEX-Daten, Health-/Service-Aktionen und optionale Integrationen in dieselbe Webapp - existing

### Active

- [ ] Die Settings-Seite wird in eine klar erkennbare, kompakte Informationsarchitektur mit fester Seitenleisten-Navigation ueberfuehrt.
- [ ] Erweiterte Optionen, einzelne Modbus-Register und Expertenwerte werden standardmaessig versteckt und gezielt ueber ausklappbare Bereiche zugaenglich gemacht.
- [ ] Das First-Run-Setup wird als gefuehrter Assistent mit wenigen Feldern pro Schritt und klaren Erklaerungen gestaltet.
- [ ] Die bestehende UI wird insgesamt kompakter, damit Nutzer weniger scrollen muessen und Zusammenhaenge schneller erfassen.
- [ ] Die wichtigsten Einstellungsbereiche werden fuer Einsteiger priorisiert, waehrend Spezialfaelle klar als erweitert erkennbar sind.

### Out of Scope

- Neue DV-, Modbus-, MQTT- oder Energieoptimierungs-Funktionen - nicht Teil dieses Vorhabens; der Fokus liegt auf Bedienbarkeit und Struktur.
- Kompletter technischer Rewrite oder Framework-Wechsel - unnoetig fuer das aktuelle Ziel; die vorhandene Webapp soll verbessert, nicht neu erfunden werden.
- Ausbau der Tools-Seite zu einem vollstaendigen Expertenarbeitsplatz - wuerde die UX-Ziele fuer Einsteiger verwaessern und ist nicht Kern des aktuellen Vorhabens.

## Context

PlexLite ist ein Brownfield-Projekt mit bestehender Node.js-Webapp unter `dv-control-webapp/`. Die wichtigsten UI-Einstiegspunkte liegen in `dv-control-webapp/public/index.html`, `dv-control-webapp/public/settings.html`, `dv-control-webapp/public/setup.html` und den zugehoerigen Browser-Skripten. Die aktuelle Codebase zeigt bereits viel Funktionalitaet, aber insbesondere die Settings-Seite ist fuer Einsteiger zu maechtig, zu lang und zu wenig gefuehrt. Der Nutzer hat klar priorisiert, dass Orientierung, Kompaktheit und progressive Offenlegung wichtiger sind als neue Features.

## Constraints

- **Brownfield**: Bestehende Funktionalitaet muss erhalten bleiben - die UX wird verbessert, ohne vorhandene Steuerungs- und Konfigurationsfaehigkeiten zu verlieren.
- **Target Users**: Auch Laien und unerfahrene Nutzer muessen zurechtkommen - deshalb muessen Begriffe, Struktur und Sichtbarkeit auf Einsteiger ausgerichtet sein.
- **Tech Stack**: Die bestehende statische HTML/CSS/JavaScript-Webapp in `dv-control-webapp/public/` bleibt die Basis - das Vorhaben soll in die bestehende Architektur passen.
- **Scope**: Fokus auf Setup und Settings - diese Bereiche erzeugen heute die groesste Ueberforderung und sind deshalb der Hebel fuer das Projektziel.
- **Usability**: Weniger Scrollen, klarere Orientierung und kompaktere Darstellung sind Pflicht - Erfolg misst sich am schnelleren Auffinden und Verstehen von Optionen.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Settings mit linker Seitenleiste statt langer Einzelseite strukturieren | Nutzer sollen schneller verstehen, wo bestimmte Einstellungen liegen, ohne die ganze Seite zu durchsuchen | - Pending |
| Erweiterte Optionen standardmaessig stark verstecken | Einsteiger sollen zuerst nur die wirklich wichtigen Einstellungen sehen | - Pending |
| Einzelne Modbus-Register und Spezialwerte ueber ausklappbare Bereiche zugaenglich machen | Expertenfunktionen bleiben erreichbar, ohne die Grundansicht zu ueberladen | - Pending |
| First-Run-Setup als gefuehrten Assistenten gestalten | Pflichtschritte sollen nacheinander erklaert und abgeschlossen werden koennen | - Pending |
| UI insgesamt kompakter gestalten | Die aktuelle Darstellung wirkt zu gross und unuebersichtlich; dichteres Layout verbessert den Ueberblick | - Pending |

---
*Last updated: 2026-03-08 after initialization*
