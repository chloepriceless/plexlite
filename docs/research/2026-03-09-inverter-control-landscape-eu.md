# Wechselrichter-Hersteller in DE/EU: externe Abregelung und Steuerung

Stand: 2026-03-09

## Ziel

Diese Übersicht sammelt für DVhub die in Deutschland und Europa relevanten Wechselrichter-Hersteller mit offiziell dokumentierten externen Steuerpfaden. Bewertet werden nicht nur direkte Victron-artige Registerwrites, sondern auch:

- Modbus TCP / Modbus RTU
- SunSpec
- Logger / Gateway / Plant Controller / EMS
- Smart-Meter- oder CT-basierte Exportbegrenzung
- digitale I/O, DRM, ESTOP oder Rundsteuerempfänger

## Kurzfazit

Für DVhub sind vier Herstellergruppen wichtig:

1. **Direkt integrierbar per offener Modbus-/SunSpec-Steuerung**
   - Victron
   - SMA
   - Fronius
   - KOSTAL

2. **Gut integrierbar, aber typischerweise über Gateway/EMS statt direkt am Inverter**
   - Huawei
   - Sungrow
   - GoodWe
   - Solis
   - SolaX
   - Solplanet
   - FIMER
   - Hoymiles

3. **Messung/Monitoring offen, Leistungssteuerung aber eher indirekt oder produktserienabhängig**
   - SolarEdge
   - Enphase

4. **Im Markt relevant, aber mit derzeit zu wenig offen dokumentierter Sollwert-Schnittstelle für eine saubere DVhub-Erstintegration**
   - FoxESS
   - Growatt
   - Deye

## Empfohlene DVhub-Architektur

DVhub sollte künftige Hersteller nicht auf ein einzelnes Victron-Steuermodell reduzieren, sondern auf generische Steuer-Intents:

- `set_export_limit_w`
- `set_active_power_pct`
- `set_grid_setpoint_w`
- `enable_export(bool)`
- `enable_charge(bool)`
- `enable_discharge(bool)`
- `set_charge_current_a`
- `set_soc_floor_pct`
- `set_emergency_stop(bool)`

Dazu passen vier Adapterklassen:

1. **Direct Modbus/SunSpec Adapter**
   - direkter Sollwert auf Inverter oder GX/Controller

2. **Gateway/EMS Adapter**
   - Hersteller verlangt SmartLogger, DataHub, SEC, COM100, DTU oder ähnliches

3. **Digital-I/O Adapter**
   - Abregelung via DRM, ESTOP, Rundsteuerkontakt, CLS-Adapter

4. **Local Export Limiter Adapter**
   - Hersteller kann nur lokale Nulleinspeisung / Exportlimit mit Zähler oder CT; kein offener externer Sollwert

## Hersteller-Matrix

| Hersteller | Markt-/Produktlage DE/EU | Dokumentierte externe Steuerpfade | Externe Abregelung / Steuerung | Einschätzung für DVhub | Quellen |
|---|---|---|---|---|---|
| **Victron** | Sehr stark im ESS-/Hybrid-Segment in DE/EU | GX mit Modbus TCP, MQTT, D-Bus; ESS Mode 2/3 | **Ja, direkt.** Victron dokumentiert externe ESS-Steuerung mit Leistungs-/Ladevorgaben; sehr gut für DVhub geeignet. | **A** | [ESS Mode 2/3](https://www.victronenergy.com/live/ess:ess_mode_2_and_3), [Modbus TCP FAQ](https://www.victronenergy.com/live/ccgx:modbustcp_faq) |
| **SMA** | Einer der Kernhersteller im deutschen Markt | Modbus TCP/Speedwire, SunSpec, aktive Wirkleistungsvorgabe | **Ja, direkt.** SMA dokumentiert Modbus-Register und manuelle Wirkleistungsvorgabe; gut für direkte Setpoints. | **A** | [Modbus Technical Information PDF](https://files.sma.de/downloads/SMA-Modbus-TI-de-10.pdf), [Aktive Leistung per Vorgabe konfigurieren](https://manuals.sma.de/SI-13/en-US/1129302539.html) |
| **Fronius** | Starke DE/EU-Präsenz im Residential/Commercial-Segment | Modbus TCP, SunSpec, Smart Meter, externer Plant Controller | **Ja.** Direkte Kommunikation ist offen dokumentiert; Export-/Feed-in-Limitierung wird oft über Smart Meter oder Plant Controller aufgebaut. | **A-** | [Operating Instructions Fronius Modbus TCP SunSpec](https://www.fronius.com/~/downloads/Solar%20Energy/Operating%20Instructions/42,0410,2649.pdf), [Feed-In Limitation Guide](https://www.fronius.com/~/downloads/Solar%20Energy/Application%20Guides/SE_APG_Feed_In_Limitation_Fronius_Inverters_EN.pdf) |
| **KOSTAL** | Sehr relevant in Deutschland | Modbus TCP, SunSpec, Smart Energy Meter, Digital I/O, CLS/PPC | **Ja.** KOSTAL dokumentiert Modbus/SunSpec und nennt externe Batteriesteuerung bzw. Leistungsreduktion über Modbus oder I/O. | **A-** | [Modbus / SunSpec Interface Description](https://www.kostal-solar-electric.com/download/schnittstellenprotokolle/ba_kostal-interface-description-modbus-tcp_sunspec_piko-ci.pdf), [PLENTICORE plus Produktseite](https://www.kostal-solar-electric.com/de/produkte/hybrid-wechselrichter/plenticore-plus/), [PLENTICORE Manual (Leistungsreduktion per Rundsteuerempfänger oder Modbus)](https://www.kostal-solar-electric.com/fileadmin/downloadcenter/kse/BA/PLENTICORE_G1/PLENTICORE-plus_BA_DE.pdf), [KOSTAL Partner-Schulung mit Batteriemanagement extern via Digital I/O oder Modbus TCP](https://www.kostal-solar-electric.com/de/installateurportal/seminare/seminar-detailansicht/mehr-praxis-fuer-experten-nur-fuer-teilnehmer-des-kostal-partner-programms/) |
| **Huawei** | Sehr stark im DE/EU-C&I- und Residential-Markt | RS485/Modbus meist über SmartLogger, FusionSolar / NetEco / Plant Control | **Ja, aber meist gateway-basiert.** Huawei dokumentiert Modbus-Interface-Definitionen und Plant Active Power Control, typischerweise über SmartLogger. | **B+** | [SmartLogger Modbus Interface Definitions](https://support.huawei.com/enterprise/en/doc/EDOC1100111895/17414aa8/smartlogger-modbus-interface-definitions), [Plant Active Power Control](https://support.huawei.com/enterprise/en/doc/EDOC1100108365/c6ac6655/plant-active-power-control), [SUN2000 overview / support](https://support.huawei.com/enterprise/en/solar-energy/sun2000-pid-251128373) |
| **Sungrow** | Stark in Europa, besonders Hybrid und C&I | Modbus TCP/IP via EMS oder Control Box, COM100/Plant Controller | **Ja, aber typischerweise über Controller.** Offizielle Doku nennt externe Kommunikation mit EMS/Control Box und Plant Controller für Wirkleistungsregelung. | **B+** | [SH5.0/6.0RS User Manual](https://en.sungrowpower.com/upload/file/20201216/SH5K-20-UEN-Ver19-202007.pdf.pdf), [COM100E Communication Box](https://en.sungrowpower.com/productDetail/994), [COM100 User Manual](https://en.sungrowpower.com/upload/documentFile/COM100%20User%20Manual.pdf.pdf) |
| **GoodWe** | Sehr präsent in DE/EU | Power Limit Solution, SEC1000/3000, Smart Meter, Modbus in EMS-Umgebung | **Ja, meist via Gateway/EMS.** GoodWe beschreibt Leistungsbegrenzungslösungen und SEC als EMS-/Protokollzentrale. | **B** | [Power Limit Solution Manual](https://us.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_Power%20Limit%20Solution%20for%20Grid-Tied%20PV%20Inverters-EN.pdf), [SEC1000/3000 Product Page](https://www.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_SEC1000-3000_User%20Manual-EN.pdf) |
| **Solis (Ginlong)** | Breite Verfügbarkeit in Europa | Export Power Manager (EPM), Meter/CT, RS485/Modbus | **Ja, aber in der Praxis über EPM.** Die offizielle Steuerarchitektur setzt eher auf EPM/Export Manager als zentrale Instanz. | **B** | [Solis Export Power Manager 5G](https://www.solisinverters.com/uk/documentation/Export_Power_Manager_5G.html), [EPM5G Datasheet](https://www.solisinverters.com/uploads/file/Solis_EPM5G_Data_Sheet_UK.pdf), [EPM3-5G-PLUS manual](https://www.ginlong.com/uploads/file/Solis_EPM3-5G-PLUS_User_Manual.pdf) |
| **SolaX** | Im EU-Hybridmarkt gut vertreten | DataHub1000, RS485, Ethernet, Modbus Master/Slave, Export Control | **Ja, meist über DataHub.** Offizielle Doku beschreibt DataHub als Sammel- und Steuerpunkt mit Lese-/Schreibfunktion per Modbus. | **B** | [DataHub1000 User Manual](https://www.solaxpower.com/wp-content/uploads/2024/01/DataHub1000-User-Manual.pdf), [DataHub1000 Product Page](https://www.solaxpower.com/products/datahub1000/) |
| **Solplanet** | Starke Distribution in Europa | Third-party communication device, RS485/Modbus, aktive Leistungskontrolle | **Ja, aber meist controller-basiert.** Solplanet nennt aktive Leistungskontrolle und externe Kommunikationsgeräte explizit. | **B** | [ASW 3-20K LT-G2 Pro Manual](https://www.solplanet.net/wp-content/uploads/2024/04/UM0005_ASW-3-20K-LT-G2-Pro_UM_EN.pdf), [Product Page](https://www.solplanet.net/products/asw-3-20k-lt-g2-pro-series/) |
| **FIMER** | In Europa weiter relevant, v.a. ABB/FIMER-Bestand und C&I | Modbus TCP/RTU, SunSpec, Plant Controller / Power Control | **Ja, aber serienabhängig.** Bei PVS-/Utility-Serien ist die Regelung gut dokumentiert; bei Altgeräten stärker projektabhängig. | **B** | [PVS-10/33-TL Datasheet](https://www.fimer.com/sites/default/files/2023-02/PVS-10_33-TL-TL-US__datasheet_EN.pdf), [Export Limitation Solution](https://www.fimer.com/export-limitation/export-limitation-solution), [Export Limitation App Note](https://www.fimer.com/sites/default/files/APP-NOTE-ExportLimitation_EN_RevD.pdf) |
| **SolarEdge** | Sehr stark in DE/EU | SunSpec/Modbus, Power Control Devices, teils direkte Modbus-Doku je Serie | **Teilweise.** SolarEdge hat offene SunSpec-/Modbus-Doku, aber die Leistungsregelung ist je Produktlinie unterschiedlich; oft mit zusätzlichem Power-Control-Pfad. | **B-** | [SunSpec Implementation Technical Note](https://www.solaredge.com/sites/default/files/sunspec-implementation-technical-note.pdf), [Feed-in Limitation Application Note](https://www.solaredge.com/sites/default/files/feed-in_limitation_application_note.pdf), [Using SolarEdge Inverters with Power Control Devices](https://www.solaredge.com/sites/default/files/application_note_power_control_configuration.pdf) |
| **Hoymiles** | Relevanter Mikro-Wechselrichter-Anbieter in Europa | DTU-Pro / DTU-Pro-S, RS485 Modbus-RTU, Export Management System | **Ja, aber über DTU/Gateway.** Die Exportregelung wird über Meter plus DTU umgesetzt, nicht als klassischer direkter Inverter-Write. | **B-** | [DTU-Pro-S DE Produktseite](https://www.hoymiles.com/de/product/dtu-pro-s/), [Smart Power Export Management System](https://www.hoymiles.com/us/product/smart-power-export-management-system/), [DTU-Pro-S Datasheet / RS485 Modbus-RTU](https://www.hoymiles.com/uploadfile/1/202506/9ef828ae92.pdf) |
| **Enphase** | Stark bei Mikro-Wechselrichtern in Europa | IQ Gateway mit SunSpec/Modbus für Monitoring; Export-Limiting im IQ-System | **Nur bedingt.** Monitoring ist offen, aber externe Wirkleistungs-Sollwerte sind nicht so offen dokumentiert wie bei klassischen String-/Hybridgeräten. | **C+** | [IQ Gateway Metered Communication Guide](https://enphase.com/download/iq-gateway-metered-quick-install-guide), [Power Export Limiting overview](https://enphase.com/installers/storage/gen3/qig/iq-system-controller/commissioning/power-control/power-export-limiting) |
| **FoxESS** | Im EU-Residential-Markt vorhanden | RS485, Meter/CT, DRM0, ESTOP, integrierte Exportbegrenzung | **Lokal ja, extern offen nur eingeschränkt.** Die Geräte beherrschen Exportlimitierung, aber eine saubere offen dokumentierte Sollwertschnittstelle ist derzeit nicht belastbar genug gefunden. | **C** | [Germany contact / market presence](https://en.fox-ess.com/get-in-touch/), [H1-G2-WL Manual](https://www.fox-ess.com/Public/Uploads/uploadfile/files/Download/EN-H1-G2-WL-User-manual-V1.0.0-20250114.pdf), [TG3 Manual mit DRM/ESTOP](https://www.fox-ess.com/download/upfiles/EN-TG3-Manual-V1.5.pdf) |
| **Growatt** | Sehr verbreitet in Europa | Export limitation, Smart Meter, Monitoring Devices, ShineMaster | **Lokal ja, offene Sollwertpfade unklar.** Exportlimitierung ist dokumentiert, aber offener externer Regelpfad für DVhub ist noch nicht belastbar freigelegt. | **C** | [DE support](https://de.growatt.com/support), [MOD 3-33KTL3-X3 product page](https://en.growatt.com/products/mod-3-33ktl3-x3), [Smart Meter page](https://en.growatt.com/products/tpm-ct-e-us), [Product manual excerpt with ExportLimit](https://fr.growatt.com/upload/file/20220817/56597fbaab90b8c403dbcf1e47bde775.pdf) |
| **Deye** | Zunehmend im DE/EU-Markt sichtbar | Exportlimit und EMS-Funktionen vorhanden, offene Modbus-Steuerdoku schwer auffindbar | **Noch offen.** Marktpräsenz ist da, aber für eine seriöse DVhub-Integration fehlt bisher eine belastbare offene Hersteller-Doku zur externen Sollwertsteuerung. | **C-** | [DE product site](https://de.deyeinverter.com/), [Europe/Germany exhibition and certification news](https://www.deyeinverter.com/news/exhibition-news/Deye-at-The-smarter-E-Europe-2025-2615.html) |

## Bewertungslogik

- **A**: direkte offene Modbus-/SunSpec-Schnittstelle mit klarer externer Wirkleistungssteuerung
- **B**: steuerbar, aber meist über Logger/Gateway/EMS oder produktserienspezifische Architektur
- **C**: lokale Limitierung vorhanden, aber kein belastbarer offener Sollwertpfad für DVhub gefunden

## Konkrete nächste Schritte für DVhub

1. **Adapter-Reihenfolge**
   - Erst `Victron`, `SMA`, `Fronius`, `KOSTAL`
   - Danach `Huawei`, `Sungrow`, `GoodWe`, `SolaX`

2. **Transport-Schicht erweitern**
   - `modbus-tcp`
   - `modbus-rtu-over-tcp` bzw. RS485 via Gateway
   - `sunspec`
   - `gateway-api`
   - `digital-io`

3. **Capability-Modell je Hersteller**
   - `can_set_active_power_pct`
   - `can_set_export_limit_w`
   - `can_set_battery_charge_current`
   - `can_set_soc_floor`
   - `requires_meter`
   - `requires_gateway`
   - `supports_failsafe_zero_export`

4. **Hersteller-Freigabekriterium**
   - offizielle Doku verfügbar
   - reproduzierbarer lokaler Steuerpfad
   - definierter Failsafe bei Kommunikationsverlust
   - klarer Einfluss auf Speicher/BMS dokumentiert

## Offene Punkte für Folgerecherche

- **SolarEdge** pro Serie trennen: Home Hub / StorEdge / TerraMax / C&I
- **Huawei** genaue SmartLogger-Register oder EMS-Befehle pro SUN2000-Serie erfassen
- **Sungrow** Steuerregister pro SH-/SG-Serie und COM100/Plant Controller matrixieren
- **GoodWe / Solis / SolaX** Serien sauber in Residential und C&I teilen
- **FoxESS / Growatt / Deye** nur freigeben, wenn ein offiziell dokumentierter externer Sollwertpfad nachgezogen wird
