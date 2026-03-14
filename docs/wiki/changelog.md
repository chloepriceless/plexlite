# Changelog

## 0.3.5.1 (2026-03-14)

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
