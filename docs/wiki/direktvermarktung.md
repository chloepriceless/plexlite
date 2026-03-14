# Direktvermarktung

## Wozu eine DV-Schnittstelle?

Eine Direktvermarktungs-Schnittstelle verbindet den Direktvermarkter mit deiner Anlage, damit:

- Live-Werte abgefragt werden können
- Steuersignale bei negativen Preisen oder Vermarktungsvorgaben ankommen

Der Direktvermarkter kann so Einspeisung bewerten, regeln und wirtschaftlich steuern.

## Warum DVhub statt Plexlog?

Der physische Plexlog kann Live-Daten liefern, aber die Steuerung moderner Victron-Setups ist in der Praxis oft unflexibel oder nicht vollständig nutzbar. DVhub liest die Daten direkt vom GX-Gerät und beantwortet die PLEXLOG-kompatiblen Modbus-Anfragen in Software.

## Wer braucht das?

Nach dem Solarspitzengesetz benötigen PV-Anlagen ab **25 kWp** typischerweise eine DV-Schnittstelle für die Direktvermarktung. Kleinere Anlagen können freiwillig teilnehmen.

## Warum ist das auch unter 30 kWp interessant?

Mit der diskutierten **Pauschaloption / MiSpeL** wird Direktvermarktung auch für kleinere Anlagen mit Speicher attraktiver, weil Speicher flexibler aus PV und Netz geladen werden dürfen und die Vermarktung wirtschaftlich interessanter wird.

---

## MiSpeL-Status

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

---

## LUOX-Anbindung

Für LUOX brauchst du in der Praxis:

1. Meldung, dass eine PLEXLOG-kompatible DV-Schnittstelle vorhanden ist
2. OpenVPN-Tunnel zu LUOX
3. Portforwarding von Port `502` aus dem Tunnel auf Port `1502` von DVhub

**Unifi-Hinweis:** Falls die GUI das Tunnel-Portforwarding nicht sauber abbildet, hilft das Skript [`20-dv-modbus.sh`](../../20-dv-modbus.sh) für die iptables-Regeln.
