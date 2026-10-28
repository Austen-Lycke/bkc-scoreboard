# Automatische scoring met sensoren

Stand van zaken voor iedereen (mens of AI) die hieraan verder werkt. Laatst bijgewerkt: 2026-10-28.

**Kort:** we onderzoeken of een sensor in elke schijf kan zien of die geraakt is, en dat draadloos
naar het scorebord kan sturen. Het zit in de **testfase op de werkbank**: één piëzo op een
breadboard met een ESP32-S3 werkt, echte schoten zijn nog niet gemeten. **In het scorebord
(deze repo) is nog niets gebouwd.**

---

## 1. Waarom

Bij Spaanse knockdown telt een schijf die geraakt is maar **niet valt** toch mee. Dat geeft veel
discussie ("was hij nu geraakt?"): zachte schutters, schijven die zwaar vallen. Het doel is die
discussies beëindigen met een objectieve meting, niet de operator vervangen.

Gevolg: de discussie verschuift naar "wat is de drempel". De club moet afspreken dat de
gekalibreerde sensor beslist.

## 2. Wat vastligt (beslissingen)

| Beslissing | Waarom |
| --- | --- |
| Treffer meten = **trilling/schok** (piëzo), niet "ligt de schijf plat" | Geraakt-maar-blijft-staan moet ook tellen. Positiedetectie is afgewezen door de gebruiker. |
| Schijven zijn **3D-geprint TPU** (geen staal) | Zo zijn ze bij BKC. De piëzo of PVDF-film wordt tijdens het printen in de schijf ingebed. |
| **Eén controller per stand** (knockdown-kader) | Afgesproken 2026-10-22. Draden van elke schijf via het scharnier naar die ene module. |
| **ESP32-S3**, alleen **ADC1**-pinnen (GPIO1–10) | ADC2 werkt niet zolang de radio aan staat. Een klassieke ESP32-WROOM DevKit heeft maar 6 ADC1-pinnen; we hebben er 8 nodig (7 schijven + 1 kadersensor). |
| Eerst **testen op de werkbank**, pas daarna bouwen | Gekozen door de gebruiker. |

## 3. Ontwerp (gepland, nog niet gebouwd)

Denk aan een elektronisch drumstel: rubber pad + piëzo, één module die overspraak wegfiltert.

```
[TPU-schijf + piëzo] ×7 ─┐
[kadersensor]        ×1 ─┼─ draad via scharnier ─> ESP32-S3 per stand
                         │                          (ADC1, piekdetectie)
                                                         │ ESP-NOW (met ack + volgnummer)
                                                         v
                                            ontvanger-ESP32 op USB aan de laptop
                                                         │ Web Serial (alleen Chrome/Edge, niet iPad)
                                                         v
                                            operator-app (scorebord, offline laptop-hub)
```

Beslisregels per gebeurtenis:

- In een kort venster na de eerste klap wint **de schijf met de hoogste piek**.
- Is de **kadersensor** het hoogst, dan is het een kadertreffer (geen schijf).
- **Drempel per schijf** (ondergrens) en een **wachttijd** daarna, zodat stuiteren, natrillen of het
  vallen van de schijf geen tweede treffer geeft.
- Alleen **gewapend** terwijl een pass of timer loopt.
- **Twijfelgevallen** gaan naar de operator; de piekwaarden worden als bewijs getoond.

## 4. Hardware

### Besteld (Amazon, 2026-10-22) en geleverd (2026-10-26)

- diymore ESP32-S3 N16R8 ×2 (headers waren al gesoldeerd)
- Youmile piëzoschijfjes 27 mm ×20
- ALLECIN weerstandenkit (50 waarden)
- Luftschloss 1N4728A zenerdiode 3,3 V ×10
- MB-102 breadboard + jumperkabels

### Schakeling per kanaal

- Piëzo **−** naar GND, piëzo **+** naar het signaalpunt.
- **R1** (nu 1 MΩ) van signaalpunt naar GND: laadt de piëzo en bepaalt de gevoeligheid.
- **Zener 3,3 V** (1N4728A) van signaalpunt naar GND, streep (kathode) aan de signaalkant: beschermt
  de ESP32 tegen te hoge spanning.
- **1 kΩ** in serie van signaalpunt naar de ADC-pin (GPIO1).

### Huidige opstelling (1 kanaal)

Op het MB-102 breadboard: ESP32 helemaal links, USB naar links, de header GND/TX/RX/1/2 in rij b,
de schakeling in kolommen 15/20, GND naar de blauwe rail naast rij a. Uitleg met tekening:
<https://claude.ai/artifact/CGsV8u24nEEAEMpoB6bf2o> (één schijf; de tekening moet overeenkomen met
de echte opstelling).

## 5. Firmware

Sketch: `03_Working/automatisch-doelpunttreffer/bkc-doeltreffer-meter/bkc-doeltreffer-meter.ino`
(buiten deze repo). Een eenvoudige treffer-logger, één kanaal:

| Instelling | Waarde | Betekenis |
| --- | --- | --- |
| `PIN` | 1 (GPIO1) | de gele draad |
| `drempel` | 300 | onder dit getal geen treffer; aanpasbaar door een getal te typen in de Serial Monitor |
| `VENSTER` | 5 ms | zo lang wordt de piek van de eerste klap gezocht |
| `WACHTTIJD` | 500 ms | daarna alles negeren (stuiters, natrillen) |

Uitvoer: `treffer N: <piek>` op 115200 baud. ADC is 12 bit (0–4095).

Arduino IDE: board ESP32S3 Dev Module, Flash 16MB, PSRAM **OPI**, Flash mode **QIO**. Op deze
Apple-silicon Mac moest **Rosetta** geïnstalleerd worden (Arduino's ctags is alleen x86). Het bord
verschijnt als `/dev/cu.usbmodem…`.

Er is ook een KiCad-project `03_Working/automatisch-doelpunttreffer/automatisch-doelpunttreffer/`,
maar het schema is nog leeg (alleen titel en datum).

## 6. Meten

Werkboek: `03_Working/BKC-piezo-metingen.xlsx`

- **Metingen**: per regel datum, test (1–9), munitie (staal/klei/geen), R1, de geplakte regel uit de
  Serial Monitor, de piek (rekent zichzelf uit), "echt geraakt?" volgens **slow-motionvideo**
  (ja/nee/twijfel) en een opmerking.
- **Samenvatting**: per test laagste/gemiddelde/hoogste piek, filter op R1, en de marge tussen de
  laagste echte treffer en de hoogste niet-treffer. Voorgestelde drempel = halfweg daartussen.
- **Uitleg**: werkwijze in gewone taal.

Tests: 1 rust, 2 zachte tik (vinger), 3 harde tik (nagel), 4 klop op tafel ernaast, 5 schot zacht,
6 schot hard, 7 schot rand/schampen, 8 schot op het kader, 9 schot mis.

Ingevuld tot nu: alleen één rustmeting (26/10/2026, "geen ruis").

## 7. Bevindingen tot nu (2026-10-26)

- Upload werkt; vingertik op GPIO1 zichtbaar in de Serial Plotter.
- Rust: geen ruis.
- Eén harde nageltik gaf een piek rond **4000** bij R1 = 1 MΩ (dus bijna verzadigd), met 2 stuiters
  ±130 ms later die **groter** waren dan het eerste contact. Daarom meet de logger nu 5 ms vanaf de
  eerste klap en negeert hij daarna 500 ms.
- Met drempel 300 gaven tikken op **andere schijven van de stand geen uitvoer** op de
  sensorschijf: eerste goed teken voor overspraak, maar de marge is nog niet gemeten.

## 8. Nog niet gemeten / risico's

- Hoe goed het signaal door **TPU** komt (piëzo ingebed in plaats van los).
- Kleine schijven van **40 mm** (WSA).
- **Rand- en schampschoten**.
- **Kleimunitie** (zachter dan staal).
- **Overspraak op het echte kader** met 7 schijven + kadersensor.
- Hoe hard schoten verzadigen bij R1 = 1 MΩ.

## 9. Volgende stappen

1. Piekwaarden van **echte katapultschoten** loggen (tests 5–9) met slow-motionvideo als waarheid,
   in het werkboek.
2. **Lagere R1** proberen (470k, 220k, 100k) zodat harde schoten niet verzadigen. (Haalt een zachte
   treffer bijna altijd 4095: lager. Blijven harde treffers laag: hoger, bv. 2,2 M.)
3. Tweede kanaal op een buurschijf: **overspraakmarge** meten.
4. Piëzo **ingebed in een TPU-schijf** testen.
5. Pas als de marges goed zijn: 8 kanalen, ESP-NOW, ontvanger op USB, koppeling met het scorebord.

## 10. Koppeling met het scorebord (nog niets gebouwd)

Hoe het in de huidige code zou passen:

- Een pass wordt bewaard als event `pass.recorded` met `hits: string[]` (de target-id's die geraakt
  zijn), zie `lib/competition/events.ts`. Targets en presets: `lib/scoring/types.ts`,
  `lib/scoring/presets.ts`.
- De operator tikt schijven aan als **drafts** voordat een fase wordt opgeslagen:
  `app/operator/live/views/use-plate-scoring.ts`. Sensortreffers zouden **die drafts invullen**,
  niet zelf opslaan: de operator bevestigt, twijfelgevallen worden gemarkeerd, piekwaarden als
  bewijs erbij.
- Transport naar de browser: **Web Serial** vanaf de ontvanger-ESP32. Werkt alleen in Chrome/Edge op
  de laptop, **niet op iPad**. De operator-app draait offline op de laptop (IndexedDB, TV via
  tweede venster), dus dat past.
- WSA-dagen: daar typt de operator punten van scorekaarten (`entry: "points"`), tot 15 kaders
  tegelijk met elk 5 schijven. Sensoren daar betekenen 15 modules; nog niet besproken.

## 11. Werkafspraken

- De gebruiker heeft **nog nooit elektronica gebouwd**. Leg stap voor stap uit, in het Nederlands,
  met tekeningen die **overeenkomen met de echte opstelling** op het breadboard, en **één schijf
  tegelijk** (een tweede schijf in dezelfde uitleg was verwarrend).
- Commentaar in de sketches in het Nederlands, zoals de bestaande sketch.
- Meetresultaten horen in het werkboek, niet alleen in een chat.
- Werk dit document bij als er iets verandert (status, metingen, beslissingen).

## 12. Bestanden en links

| Wat | Waar |
| --- | --- |
| Dit document | `comp-scoreboard/docs/automatische-scoring-sensoren.md` |
| Test-sketch | `03_Working/automatisch-doelpunttreffer/bkc-doeltreffer-meter/bkc-doeltreffer-meter.ino` |
| KiCad-project (leeg) | `03_Working/automatisch-doelpunttreffer/automatisch-doelpunttreffer/` |
| Meetwerkboek | `03_Working/BKC-piezo-metingen.xlsx` |
| Bouwhandleiding (1 kanaal) | <https://claude.ai/artifact/CGsV8u24nEEAEMpoB6bf2o> |
| Wedstrijdregels | `README.md` en `lib/scoring/` in deze repo |
