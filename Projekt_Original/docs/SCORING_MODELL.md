# Scoring-Modell des Gesundheitschecks

**Stand:** Juli 2026
**Zweck:** Verbindliche, verständliche Beschreibung der Standortbestimmung, der Risikosignale und der Empfehlungspriorisierung.

## 1. Kurzfassung

Der Gesundheitscheck verarbeitet die Antworten auf zwei getrennten Wegen:

```text
Antworten
   ├──> fünf Dimensionsscores ──> Gesamtscore 0–100 und Status
   └──> Risikosignale und Antwortmuster ──> personalisierte Empfehlungen / Top 3
```

- Bewertete Antworten werden grundsätzlich auf die interne Skala **−2 bis +2** abgebildet.
- Die fünf Dimensionen zählen im Gesamtscore je **20 %**.
- Innerhalb einer Dimension sind die Fragen nicht immer gleich gewichtet.
- Medizinische oder nicht beeinflussbare Angaben können eine wichtige Empfehlung auslösen, ohne den Standortscore direkt zu senken.
- Gegenchecks verhindern in klar definierten Widerspruchsfällen eine zu positive Einordnung.
- Der Wert ist eine **orientierende Standortbestimmung**, kein klinisch validierter Risiko-, Diagnose-, Mortalitäts- oder «Longevity»-Score.

## 2. Verbindliche Implementierungsquellen

| Bestandteil | Verbindliche Datei |
|---|---|
| Fragen, IDs, Antwortwerte, Pflichtfelder und Antwortbereinigung | [`questions.js`](../js/questions.js) |
| Normwerte, Formeln, Messwertreferenzen, Scores und Risikosignale | [`scoring.js`](../js/scoring.js) |
| Empfehlungsregeln, Muster und Top-3-Priorisierung | [`recommendations.js`](../js/recommendations.js) |
| Reihenfolge und Metadaten der fünf Dimensionen | [`questions.js`](../js/questions.js) |
| Sichtbare personalisierte Texte | [`content/result-texts/`](../content/result-texts/) |
| Auslöser, Bündelung und Priorisierung der Empfehlungen | [`EMPFEHLUNGSLOGIK.md`](EMPFEHLUNGSLOGIK.md) |
| Wissenschaftliche Quellen und fachliche Grenzen | [`QUELLEN.md`](QUELLEN.md) |
| Noch offene Go-live-Entscheidungen | [`GO_LIVE_CHECKLIST.md`](GO_LIVE_CHECKLIST.md) |
| Regressionstests des Fachvertrags | [`integration.test.js`](../tests/integration.test.js) |

Diese Dokumentation erklärt den implementierten Vertrag. Bei einem Widerspruch ist der getestete Code massgebend; Dokumentation und Tests müssen dann gemeinsam korrigiert werden.

## 3. Interne Skala und Umrechnung

### 3.1 Grundskala

| Interner Normwert | Bedeutung | Wert auf 0–100 |
|---:|---|---:|
| +2 | sehr günstig | 100 |
| +1 | eher günstig | 75 |
| 0 | neutral | 50 |
| −1 | eher ungünstig | 25 |
| −2 | deutlich ungünstig | 0 |

Für einen gegebenenfalls gewichteten Mittelwert \(x\) gilt:

\[
Score = \operatorname{runden}\left(\frac{x+2}{4}\cdot100\right)
\]

Beispiel: \(x=0{,}6\) ergibt \(65\) Punkte.

Nicht jede Frage nutzt zwingend alle fünf Stufen. Beispielsweise werden aktuelles gelegentliches und regelmässiges Rauchen beide mit −2 bewertet; der Wandsitz verwendet vier sichtbare Orientierungsstufen von −1 bis +2. Die vollständige Zuordnung der stabilen Antwortwerte steht im Objekt `NORMS` in [`scoring.js`](../js/scoring.js).

### 3.2 Statusbänder

| Score | Status |
|---:|---|
| 80–100 | Stark |
| 60–79 | Solide Basis |
| 40–59 | Ausbaufähig |
| 0–39 | Erhöhte Aufmerksamkeit |

Die Statusbänder sind allgemeine Produktkategorien. Sie sind keine klinischen Grenzwerte.

## 4. Gesamtscore

Die fünf Dimensionsscores werden gleichgewichtet gemittelt:

\[
Gesamt = \operatorname{runden}\left(
\frac{Einfluss+Fitness+Ernährung+Schlaf+Mental}{5}
\right)
\]

Jede Dimension trägt damit **20 %** zum numerischen Gesamtscore bei.

Im normalen Nutzerfluss sind alle nicht optionalen Fragen vollständig beantwortet. Falls an der technischen Scoring-Grenze trotzdem kein berechenbarer Wert für eine Dimension vorliegt, verwendet die defensive Runtime für diese Dimension 50 statt abzustürzen oder stillschweigend die übrigen Dimensionen höher zu gewichten.

### Sicherheitsregel für den Gesamtstatus

Die Zahl bleibt der unveränderte Mittelwert. Liegt jedoch mindestens eine Dimension unter 40, kann der sichtbare Gesamtstatus höchstens **«Solide Basis»** sein. Dadurch kann beispielsweise die Kombination `100 / 100 / 100 / 100 / 0` zwar weiterhin den rechnerischen Gesamtwert 80 ergeben, aber nicht den widersprüchlichen Status «Stark».

Diese Regel verändert keine Dimension und keine Empfehlung. Sie schützt ausschliesslich die sprachliche Gesamteinordnung vor dem mathematischen Überdecken einer Dimension mit erhöhter Aufmerksamkeit.

## 5. Dimension 1: Einflussfaktoren

### 5.1 Formel und Gewichte

Der Dimensionswert ist der gleichgewichtete Mittelwert aus sechs Bestandteilen:

\[
E=\frac{
Stabilität+Sitzzeit+Rauchen+Alkohol+Social\ Media+Körperzusammensetzung
}{6}
\]

| Bestandteil | Anteil an «Einflussfaktoren» | Anteil am Gesamtscore |
|---|---:|---:|
| Stabilität | 16,67 % | 3,33 % |
| Sitzzeit | 16,67 % | 3,33 % |
| Rauchen | 16,67 % | 3,33 % |
| Alkohol | 16,67 % | 3,33 % |
| Social-Media-Nutzung | 16,67 % | 3,33 % |
| Körperzusammensetzung | 16,67 % | 3,33 % |

**Gegencheck:** Aktuelles Rauchen (−2) oder eine deutlich ungünstige Körperzusammensetzung (−2) begrenzen einen ansonsten positiven Dimensionsmittelwert auf Norm 0 beziehungsweise 50 Punkte.

### 5.2 Einheitliche Körperzusammensetzung

Ein zentrales Profil wird für Score, Risikosignal und kardiovaskuläres Antwortmuster verwendet. Damit können diese drei Ausgaben einen Messwert nicht unterschiedlich interpretieren.

Priorität der Datengrundlage:

1. bei Erwachsenen ab 18 mit BMI ≥ 35: BMI, auch wenn eine Taille vorliegt;
2. andernfalls bei vorhandenem Taillenumfang und Körpergrösse:
   geschlechtsneutrales Taille-Grösse-Verhältnis (WHtR);
3. ohne Taillenangabe: BMI als Fallback.

Eine Taille-Hüfte-Ratio wird nicht berechnet, weil der Check keinen Hüftumfang
erhebt. Der verwendete Quotient lautet:

\[
WHtR=\frac{Taillenumfang\;(cm)}{Körpergrösse\;(cm)}
\]

Grenzentscheidungen erfolgen mit dem ungerundeten Wert. Die sichtbare Ausgabe hat
locale-gerecht normalerweise zwei Dezimalstellen. Würde eine Rundung den Wert über
0,40, 0,50 oder 0,60 heben, werden zusätzliche Stellen gezeigt, bis Anzeige und
technisches Band übereinstimmen.

#### Taille-Grösse-Verhältnis

| WHtR | Norm |
|---:|---:|
| < 0,40 | +2; bei gleichzeitigem BMI < 18,5 nur 0 und separates Untergewichtssignal |
| 0,40 bis < 0,50 | +2 |
| 0,50 bis < 0,60 | 0 |
| ≥ 0,60 | −2 |

Die Stufe 0,50 bis < 0,60 verändert den Score bereits: Der Körperbaustein fällt
von 100 auf 50 Punkte. Da er ein Sechstel der Einflussdimension ausmacht, sinkt
diese bei sonst optimalen Antworten von 100 auf 92 und der gleichgewichtete
Gesamtscore um rund 1,7 Punkte. Ab 0,60 erhält der Körperbaustein −2; zusätzlich
begrenzt der bestehende Schutzvertrag die Dimension «Einflussfaktoren» auf 50.
Der Marker wird nicht parallel zu einem zweiten Taillen- oder BMI-Malus gezählt.

Werte unter 0,40 werden nicht als «noch besser» als das höchste Scoreband behandelt.
Ein gleichzeitig niedriger BMI verhindert dort eine positive Körperbewertung und
löst unabhängig davon den bestehenden medizinischen Untergewichtshinweis aus.

Für 16- und 17-Jährige verwendet der Check gemäss der NICE-Aktualisierung 2026
dieselben WHtR-Bänder; die BMI-35-Ausnahme gilt im Code erst ab 18. Bei Erwachsenen
mit BMI ≥ 35 wird WHtR zwar berechnet und angezeigt, aber weder klassifiziert noch
zusätzlich gescort. In der Schwangerschaft soll der optionale Taillenumfang nicht
verwendet werden; darauf weist die Messhilfe hin.

#### BMI-Fallback

| BMI | Norm |
|---:|---:|
| < 18,5 | 0; Untergewicht wird separat medizinisch eingeordnet |
| 18,5 bis < 25 | +2 |
| 25 bis < 30 | 0 |
| ≥ 30 | −2 |

Für die Signalstärke erzeugt WHtR 0,50 bis < 0,60 das Signal `tief`, ab 0,60
gilt `mittel`. Beim BMI-Fallback erzeugt BMI ≥ 30 das Signal `mittel`. Ein
isolierter BMI von 25 bis unter 30 erzeugt ohne Tailleninformation kein Körpersignal.
Alle BMI-Grenzen werden mit dem ungerundeten Rechenwert geprüft. Die sichtbare
Ausgabe hat normalerweise eine Nachkommastelle; unmittelbar unter einer
Klassengrenze bleiben zur widerspruchsfreien Darstellung bei Bedarf weitere
Stellen sichtbar.

Der BMI unterscheidet Fett- und Muskelmasse nicht. Der Check erkennt deshalb einen
vorsichtigen möglichen Muskelmassen-Kontext, wenn gleichzeitig mindestens drei
Krafttrainingstage, das WHO-Bewegungsziel und mindestens ein auswertbarer starker
Kraft-Kurztest vorliegen und kein ausgefüllter auswertbarer Krafttest darunter
liegt. Dieser Vertrag verändert **weder Norm, Score, Signalstärke noch die
WHtR-Priorität**. Er wählt nur eine präzisere Formulierung und fordert bei deutlich
erhöhten oder widersprüchlichen Markern weiterhin die fachliche Einordnung. Die
Kurztests sind kein Verfahren zur Messung von Fett- oder Muskelmasse.

### 5.3 Scorefreie medizinische und Vorsorgeangaben

Die tatsächliche Familiengeschichte, die Aktualität einer professionellen
Risikoeinschätzung und das Wissen über persönlich passende Vorsorge sowie
Bluthochdruck sind keine regulären Plus- oder Minuspunkte. Sie können stattdessen
medizinische beziehungsweise informationsbezogene Signale, sichtbare
Haupthandlungsfelder und Empfehlungen auslösen. So bleibt der 0–100-Wert eine
Standortbestimmung und gibt sich nicht als klinischer Risikorechner aus. Insbesondere
bleibt ein Einflussfaktoren-Score von 100 möglich, während die getrennte
Sicherheitslogik trotzdem eine noch offene Familien- oder Vorsorgeabklärung anzeigt.

Die Familienklärung bleibt aus Gründen der Fragebogenlänge eine Empfehlung und wird
nicht als Folgefrage erhoben: Kunden sollen nach Möglichkeit klären, **welche
Erkrankung bei wem und ungefähr in welchem Alter diagnostiziert wurde**, und diese
Angaben zu einem professionellen Vorsorgegespräch mitnehmen. Teilweises oder
fehlendes Wissen wird nicht als Erkrankung interpretiert und senkt den Score nicht.

Untergewicht wird ebenfalls separat als medizinischer Klärungshinweis behandelt. Untergewicht und ein auffälliges Körperprofil erhalten in «Grösste Handlungsfelder» eine vorsichtige Summary-Einordnung, aber aus BMI oder Taillenumfang allein bewusst keinen standardisierten 4-Wochen-Therapieplan.

### 5.4 Integration des Körperprofils in Empfehlungen

Die frühere separate blaue Zeile mit BMI, Taillenumfang und WHtR wurde aus dem
Dimensionskopf entfernt. Die Rechenwerte bleiben im Ergebnisobjekt verfügbar;
bei einem Körpersignal werden sie entscheidungsnah verwendet:

1. Erreicht ein Mehrfaktorenmuster die Schwelle für den kardiovaskulären
   Vorsorge-Check, nennt dessen Begründung den persönlichen WHtR- beziehungsweise
   BMI-Wert samt Einordnung. Der ausführliche Körperprofil-Hinweis und der
   gleichnamige Kurzlistenhebel werden dann beide dedupliziert.
2. Ohne abdeckenden Vorsorge-Check bleibt das persönliche `summaryOnly`-
   Handlungsfeld `lv_koerperprofil` mit Messwert, Einordnung und sicherem nächsten
   Schritt sichtbar. Aus dem Einzelmarker entsteht kein pauschaler Gewichts- oder
   Therapieplan.
3. Besteht in Fitness, Ernährung, Schlaf oder Mentalem bereits eine passende
   Empfehlung, erhält höchstens die erste davon einen kurzen Körperprofil-Bezug.
   Das erklärt einen möglichen zusätzlichen Nutzen, ohne Kausalität zu behaupten.
   Der Körpermarker allein erzeugt dort keine Empfehlung, kein Defizit und keinen
   Punkteabzug.

Damit wird zentrale Fettverteilung als dimensionsübergreifend relevanter Kontext
sichtbar, ohne aus WHtR oder BMI abzuleiten, eine Person bewege sich zu wenig,
ernähre sich schlecht, schlafe schlecht oder sei psychisch belastet.

## 6. Dimension 2: Körperliche Fitness

### 6.1 Oberstruktur

\[
F=\frac{2\cdot Kondition+2\cdot Muskulatur+Balance/Funktion}{5}
\]

| Teilbereich | Anteil an «Fitness» | Anteil am Gesamtscore |
|---|---:|---:|
| Kondition | 40 % | 8 % |
| Muskulatur | 40 % | 8 % |
| Balance/Funktion | 20 % | 4 % |

### 6.2 Kondition und Aktivitätskomposit

Moderate und intensive Aktivität sind zwei alternative beziehungsweise kombinierbare Wege zum Bewegungsziel. Fehlende Aktivität in der jeweils anderen Intensität soll eine erreichte Aktivitätsstufe deshalb nicht wieder abwerten.

Zuerst wird ein gemeinsamer Aktivitätswert gebildet:

\[
A=\max(Norm_{moderat},Norm_{intensiv})
\]

Danach gilt:

\[
Kondition=\frac{2\cdot A+Treppenbelastung}{3}
\]

| Bestandteil | Anteil an «Fitness» | Anteil am Gesamtscore |
|---|---:|---:|
| Gemeinsamer Aktivitätswert | 26,67 % | 5,33 % |
| Atemnot/Belastung beim Treppensteigen | 13,33 % | 2,67 % |

Die zusätzliche Funktion `activityStatus()` ordnet die Zielerreichung für Signale und Empfehlungen ein. Wegen der breiten Antwortintervalle wird keine scheinpräzise Addition moderater und intensiver Minuten vorgenommen.

### 6.3 Muskulatur

Ohne auswertbaren Liegestütz- oder Wandsitz-Test gilt:

\[
Muskulatur=\frac{Krafttraining+Tragen}{2}
\]

Sobald mindestens ein auswertbarer Muskeltest vorliegt, wird die Hälfte des Muskulaturblocks durch den Testwert präzisiert:

\[
Muskulatur=\frac{Fragebogenwert+Testwert}{2}
\]

Dabei ist `Fragebogenwert` der Mittelwert aus Krafttraining und dem Tragen von Einkaufstaschen. Sind Liegestütz und Wandsitz auswertbar, teilen sie sich die Testhälfte.

| Situation | Anteil innerhalb des Fitnessscores |
|---|---|
| kein Test | Krafttraining 20 %, Tragen 20 % |
| ein Muskeltest | Krafttraining 10 %, Tragen 10 %, Test 20 % |
| zwei Muskeltests | Krafttraining 10 %, Tragen 10 %, Liegestütz 10 %, Wandsitz 10 % |

### 6.4 Balance und Funktion

Ohne auswertbaren Einbeinstand bildet die Frage zum Aufstehen vom Boden den gesamten 20-%-Block ab. Mit auswertbarem Einbeinstand teilen sich Frage und Test den Block zu je 10 % des Fitnessscores beziehungsweise je 2 % des Gesamtscores.

### 6.5 Wann Kurztests den Score verändern

Ein optionaler Test wird nie als schlecht behandelt, wenn er ausgelassen wurde. Ein eingetragener Rohwert bleibt sichtbar, ist aber nur bei passendem Referenzvertrag score- und empfehlungswirksam:

| Test | Scorewirksamer Referenzvertrag |
|---|---|
| Einbeinstand | 18–99 Jahre; geschlechtsunabhängige direkte Referenz, damit Alter 94 abgedeckt ist |
| Liegestütze | einheitlicher Standard-Liegestütz: Frauen 18–24 kleine direkte Adams-Orientierung, 25–65 praktische Topend-Orientierung und 66–94 modelliert; Männer 20–69 direkte CSEP-Referenz und 70–94 modelliert |
| Wandsitz | 18–94 Jahre, weiblich oder männlich; vierstufige, ab 70 extrapolierte Trainingsorientierung |

Der Check kann ab 16 Jahren verwendet werden. Bei 16- und 17-Jährigen werden eingetragene Kurztestwerte nur als persönliche Rohwerte gezeigt; sie verändern weder Score noch Empfehlung. Ab 95 bleiben Liegestütz und Wandsitz wegen der begrenzten Modellbasis ebenfalls Rohwerte; der direkt untersuchte Einbeinstand reicht bis 99.

Die Referenztabellen und ihre fachlichen Grenzen stehen in [`scoring.js`](../js/scoring.js) und ausführlicher in [`QUELLEN.md`](QUELLEN.md).
Die Ergebnisansicht zeigt bewusst keine zusätzlichen blauen Methoden- oder
Referenzboxen in den drei Kurztestkarten; Einordnung, Rohwert, Bedeutung,
Relevanz und gegebenenfalls die nächste Orientierung bleiben erhalten.

### 6.6 Referenztabellen der optionalen Fitness-Kurztests

Die folgenden Tabellen zeigen direkt, welcher Rohwert in welchen internen Normwert
einfliesst. Für den einzelnen Test bedeutet +2 = 100 Punkte, +1 = 75 Punkte,
0 = 50 Punkte, −1 = 25 Punkte und −2 = 0 Punkte. Dieser Testwert fliesst danach
nur mit dem in 6.3 beziehungsweise 6.4 beschriebenen Anteil in den Fitnessscore ein.

Die App zeigt nicht fünf verschiedene Farbstufen: +2 erscheint als **Stark**, +1
als **Solide Basis**, 0 als **Ausbaufähig** und −1/−2 gemeinsam als **Erhöhte
Aufmerksamkeit**. `—` bedeutet, dass die jeweilige Referenz keine eigene fünfte
Kategorie hergibt. Eine solche Grenze wird nicht frei erfunden.

Die Tabellen verwenden für die Lesbarkeit kompakte Ganzzahlbereiche. Technisch ist
jede Untergrenze inklusive und die nächste höhere Untergrenze exklusiv: `29–35`
bedeutet `29 ≤ Wert < 36`, `18–24` beim Alter bedeutet `18 ≤ Alter < 25`, und eine
einzelne Angabe wie `2` steht für `2 ≤ Wert < 3`. Dadurch sind auch zulässige
Dezimalwerte ohne Lücke eindeutig eingeordnet.

#### Einbeinstand – Frauen und Männer identisch

Gemessen wird der beste Versuch mit offenen Augen in Sekunden. Die Referenz ist
altersabhängig, laut Springer et al. jedoch nicht geschlechtsabhängig.

| Alter | +2 | +1 | 0 | −1 | −2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 18–39 | ≥ 45 s | 30–44 s | 20–29 s | 10–19 s | 0–9 s |
| 40–49 | ≥ 40 s | 27–39 s | 18–26 s | 9–17 s | 0–8 s |
| 50–59 | ≥ 37 s | 24–36 s | 15–23 s | 8–14 s | 0–7 s |
| 60–69 | ≥ 30 s | 20–29 s | 12–19 s | 6–11 s | 0–5 s |
| 70–79 | ≥ 20 s | 14–19 s | 8–13 s | 4–7 s | 0–3 s |
| 80–99 | ≥ 10 s | 6–9 s | 4–5 s | 2–3 s | 0–1 s |

#### Standard-Liegestütze – Männer

Es zählen maximale korrekte Wiederholungen von den Zehen. Die Bänder 20–69 sind
direkte CSEP-/Payne-Referenzen; 70–94 sind altersadjustiert modelliert.

| Alter | +2 | +1 | 0 | −1 | −2 | Referenzqualität |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 20–29 | ≥ 36 | 29–35 | 22–28 | 17–21 | 0–16 | direkt |
| 30–39 | ≥ 30 | 22–29 | 17–21 | 12–16 | 0–11 | direkt |
| 40–49 | ≥ 25 | 17–24 | 13–16 | 10–12 | 0–9 | direkt |
| 50–59 | ≥ 21 | 13–20 | 10–12 | 7–9 | 0–6 | direkt |
| 60–69 | ≥ 18 | 11–17 | 8–10 | 5–7 | 0–4 | direkt |
| 70–79 | ≥ 16 | 10–15 | 7–9 | 4–6 | 0–3 | modelliert |
| 80–89 | ≥ 15 | 9–14 | 6–8 | 4–5 | 0–3 | modelliert |
| 90–94 | ≥ 12 | 7–11 | 5–6 | 3–4 | 0–2 | modelliert |

#### Standard-Liegestütze – Frauen

Auch hier gilt ausschliesslich die Standardausführung von den Zehen. 18–24 basiert
auf der kleinen Adams-Studie, 25–65 auf der praktischen Topend-Orientierung und
66–94 auf einer altersadjustierten Modellierung.

| Alter | +2 | +1 | 0 | −1 | −2 | Referenzqualität |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 18–24 | ≥ 18 | 8–17 | 5–7 | 0–4 | — | kleine direkte Orientierung |
| 25–29 | ≥ 33 | 14–32 | 9–13 | 5–8 | 0–4 | praktische Topend-Orientierung |
| 30–39 | ≥ 29 | 13–28 | 7–12 | 3–6 | 0–2 | praktische Topend-Orientierung |
| 40–49 | ≥ 21 | 10–20 | 5–9 | 2–4 | 0–1 | praktische Topend-Orientierung |
| 50–59 | ≥ 17 | 9–16 | 4–8 | 2–3 | 0–1 | praktische Topend-Orientierung |
| 60–65 | ≥ 13 | 6–12 | 3–5 | 2 | 0–1 | praktische Topend-Orientierung |
| 66–69 | ≥ 12 | 6–11 | 3–5 | 2 | 0–1 | modelliert |
| 70–79 | ≥ 11 | 5–10 | 3–4 | 2 | 0–1 | modelliert |
| 80–89 | ≥ 10 | 5–9 | 3–4 | 2 | 0–1 | modelliert |
| 90–94 | ≥ 9 | 4–8 | 3 | 2 | 0–1 | modelliert |

**Warum fehlte −2 bisher scheinbar bei Topend?** Im Code werden je Altersband nur
die vier Untergrenzen für +2, +1, 0 und −1 gespeichert. Alles unter der
−1-Untergrenze wird automatisch −2. Bei den Topend-Zeilen 25–65 war −2 daher
bereits vollständig implementiert; bei 25–29 sind dies beispielsweise 0–4
Wiederholungen. Nur die separate Adams-Skala 18–24 besitzt unterhalb
«ausreichend» lediglich eine gemeinsame Kategorie «Verbesserungsbedarf». Sie wird
vorsichtig als −1 abgebildet, statt sie ohne Grundlage in −1 und −2 aufzuteilen.

#### Wandsitz – Männer

Gemessen wird die korrekte beidbeinige Haltezeit bei ungefähr 90° in Sekunden.
Die harmonisierte Orientierung besitzt drei herleitbare Grenzen und damit vier
Normstufen; −2 bleibt bewusst ungenutzt.

| Alter | +2 | +1 | 0 | −1 | −2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 18–29 | ≥ 135 s | 95–134 s | 75–94 s | 0–74 s | — |
| 30–39 | ≥ 120 s | 85–119 s | 65–84 s | 0–64 s | — |
| 40–49 | ≥ 100 s | 70–99 s | 50–69 s | 0–49 s | — |
| 50–59 | ≥ 85 s | 60–84 s | 40–59 s | 0–39 s | — |
| 60–69 | ≥ 65 s | 45–64 s | 30–44 s | 0–29 s | — |
| 70–79 | ≥ 50 s | 35–49 s | 20–34 s | 0–19 s | — |
| 80–89 | ≥ 35 s | 25–34 s | 12–24 s | 0–11 s | — |
| 90–94 | ≥ 25 s | 15–24 s | 5–14 s | 0–4 s | — |

#### Wandsitz – Frauen

| Alter | +2 | +1 | 0 | −1 | −2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 18–29 | ≥ 110 s | 80–109 s | 60–79 s | 0–59 s | — |
| 30–39 | ≥ 100 s | 72–99 s | 55–71 s | 0–54 s | — |
| 40–49 | ≥ 67 s | 50–66 s | 33–49 s | 0–32 s | — |
| 50–59 | ≥ 61 s | 45–60 s | 30–44 s | 0–29 s | — |
| 60–69 | ≥ 45 s | 30–44 s | 20–29 s | 0–19 s | — |
| 70–79 | ≥ 35 s | 22–34 s | 12–21 s | 0–11 s | — |
| 80–89 | ≥ 25 s | 15–24 s | 8–14 s | 0–7 s | — |
| 90–94 | ≥ 15 s | 8–14 s | 3–7 s | 0–2 s | — |

Beim Wandsitz würde ein zusätzliches −2-Band eine vierte, nicht aus den
publizierten Perzentilen ableitbare Grenze verlangen. Deshalb werden sehr tiefe
Werte weiterhin als −1 beziehungsweise sichtbar als «Erhöhte Aufmerksamkeit»
behandelt. Die Evidenzqualität, Extrapolationen und Sicherheitsgrenzen sind in
[`QUELLEN.md`](QUELLEN.md) dokumentiert.

## 7. Dimension 3: Ernährung

### 7.1 Formel und Gewichte

\[
N=\frac{Protein+Pflanzenvielfalt+Verarbeitete\ Lebensmittel+Omega3+Zuckergetränke}{5}
\]

| Kernfrage | Anteil an «Ernährung» | Anteil am Gesamtscore |
|---|---:|---:|
| Regelmässige Proteinquellen | 20 % | 4 % |
| Pflanzenvielfalt | 20 % | 4 % |
| Stark verarbeitete Lebensmittel | 20 % | 4 % |
| Omega-3-Quellen | 20 % | 4 % |
| Zuckerhaltige Getränke | 20 % | 4 % |

Die Sättigungsfrage ist ein ergänzender Kontext und kann eine Empfehlung auslösen. Sie ist **kein sechster Scorebestandteil und kein Scoredeckel**. Für einen eigenständigen harten Scoreeingriff ist diese Frage nicht hinreichend spezifisch.

## 8. Dimension 4: Schlaf

### 8.1 Formel und Gewichte

\[
S=\frac{Schlafqualität+Schlafdauer+Schlafrhythmus}{3}
\]

| Kernfrage | Anteil an «Schlaf» | Anteil am Gesamtscore |
|---|---:|---:|
| Schlafqualität | 33,33 % | 6,67 % |
| Schlafdauer | 33,33 % | 6,67 % |
| Schlafrhythmus | 33,33 % | 6,67 % |

### 8.2 Abgestufter Gegencheck Alltagsbeeinträchtigung

Die Frage nach der Auswirkung auf den Alltag wird nicht als vierte gleichgewichtete Kernfrage behandelt. Sie schützt aber vor einer offensichtlich zu positiven Einordnung:

| Antwort | Wirkung auf den Schlafscore | Signalwirkung |
|---|---|---|
| gar nicht / kaum | kein Deckel | keine alleinige Eskalation |
| spürbar | höchstens Norm +1 = 75 Punkte | Empfehlung kann ausgelöst werden |
| deutlich | höchstens Norm 0 = 50 Punkte | Empfehlung kann ausgelöst werden |
| massiv | höchstens Norm 0 = 50 Punkte | medizinisches Signal mittlerer Schwere und Abklärungsempfehlung |

## 9. Dimension 5: Mentale Gesundheit

### 9.1 Formel und Gewichte

Acht Aussagen werden gleichgewichtet gemittelt:

\[
M=\frac{x_1+x_2+\ldots+x_8}{8}
\]

| Aussage | Anteil an «Mentale Gesundheit» | Anteil am Gesamtscore |
|---|---:|---:|
| Belastbarkeit | 12,5 % | 2,5 % |
| Selbstwirksamkeit | 12,5 % | 2,5 % |
| Sinnhaftigkeit | 12,5 % | 2,5 % |
| Bewältigungsstrategien (Coping) | 12,5 % | 2,5 % |
| Verbundenheit | 12,5 % | 2,5 % |
| Selbstfürsorge | 12,5 % | 2,5 % |
| Zukunft | 12,5 % | 2,5 % |
| Positive Emotionen | 12,5 % | 2,5 % |

### 9.2 Gemeinsamer Sicherheitsvertrag

Eine schwere mentale Konstellation liegt vor, wenn mindestens eine der folgenden Bedingungen erfüllt ist:

- Belastbarkeit = −2;
- Coping = −2;
- Selbstwirksamkeit = −2;
- Sinnhaftigkeit = −2 **und gleichzeitig** positive Emotionen = −2.

Dieselbe zentrale Definition steuert beide Folgen:

1. medizinisches Risikosignal mit hoher Schwere;
2. Deckel des Mentalscores auf Norm 0 beziehungsweise 50 Punkte.

Damit können ein hoher Mentalstatus und das kritische Unterstützungssignal nicht mehr aufgrund voneinander abweichender Regeln nebeneinander stehen.

## 10. Gegenchecks und Schutzregeln im Überblick

| Ebene | Auslöser | Wirkung |
|---|---|---|
| Einflussfaktoren | aktuelles Rauchen −2 oder Körperprofil −2 | Dimensionsscore höchstens 50 |
| Ernährung | keine harte Scoredeckelung | Sättigung wirkt nur auf Empfehlungen |
| Schlaf | Alltagsbeeinträchtigung «spürbar» | Dimensionsscore höchstens 75 |
| Schlaf | Alltagsbeeinträchtigung «deutlich» oder «massiv» | Dimensionsscore höchstens 50 |
| Mental | zentrale schwere mentale Konstellation | Dimensionsscore höchstens 50 und hohes medizinisches Signal |
| Gesamtstatus | mindestens eine Dimension < 40 | sichtbarer Status höchstens «Solide Basis»; Zahl bleibt unverändert |

Ein Deckel wirkt nur, wenn der reguläre Mittelwert darüber liegt. Er kann einen bereits tieferen Score nie erhöhen.

## 11. Risikosignale

Risikosignale sind ein separater Sicherheits- und Routingvertrag. Sie werden nicht mit einem pauschalen Punkteabzug in den Gesamtscore übersetzt.

| Signalgruppe | Implementierter Auslöser | Einordnung |
|---|---|---|
| Hohe mentale Belastung | zentrale schwere mentale Konstellation | medizinisch, hoch |
| Mentale Belastung | sofern nicht schwer: Belastbarkeit, Coping oder Selbstwirksamkeit ≤ −1 oder positive Emotionen ≤ −1 | Lebensstil, mittel |
| Einsamkeit | Verbundenheit ≤ −1 | Lebensstil, mittel |
| Bluthochdruck | bekannt | medizinisch, hoch |
| Blutdruck unbekannt | «weiss nicht» | medizinisch, mittel |
| Familiäre Erkrankung | Frage `familie_hk` = ja | medizinisch, mittel |
| Risikoeinschätzung fehlt | `vorsorge` = nein | medizinisch, mittel |
| Risikoeinschätzung veraltet oder unklar | `vorsorge` = aelter_unsicher oder weiss_nicht | medizinisch, tief |
| Untergewicht | BMI < 18,5 | medizinisch, mittel |
| Rauchen | gelegentlich oder regelmässig | Lebensstil, hoch |
| Alkohol | höchste Frequenzstufe | Lebensstil, mittel |
| Körperzusammensetzung | WHtR 0,50 bis < 0,60 beziehungsweise ≥ 0,60; beim BMI-Fallback BMI ≥ 30 | Lebensstil, tief beziehungsweise mittel |
| Bewegungsmangel | moderate Aktivität < 30 Minuten, intensive Aktivität keine/< 30 Minuten und Krafttraining höchstens neutral | Lebensstil, hoch |
| Keine Kraft | kein Krafttraining (−2), sofern nicht schon das kombinierte Bewegungsmangelsignal greift | Lebensstil, mittel |
| Viel Sitzen | 9 Stunden oder mehr | Lebensstil, mittel |
| Stabilität | «unsicher» oder «sehr unsicher» | Lebensstil, mittel |
| Balance | starke Einschränkung beim Aufstehen oder scorebarer Einbeinstand mit Norm −2 | Lebensstil, mittel |
| Schlaf | schlechte/sehr schlechte Schlafqualität oder weniger als 5 Stunden Schlaf | Lebensstil, mittel |
| Massive Schlafbeeinträchtigung | Alltag massiv beeinträchtigt | medizinisch, mittel |
| Social Media | oft oder sehr oft | Lebensstil, mittel |
| Ernährung | täglich Zuckergetränke oder mehrmals täglich stark Verarbeitetes | Lebensstil, mittel |

Die Typen beschreiben die gewünschte nächste Einordnung – selbst beeinflussbarer Ansatz oder medizinische Abklärung. Sie stellen keine Diagnose dar.

`familie_hk = teilweise/weiss_nicht` und `familienwissen = teilweise/nein`
erzeugen bewusst kein Risikosignal. Sie werden direkt über scorefreie
Empfehlungsregeln geroutet: unvollständige Familieninformationen über
`ei_familienwissen`, fehlendes Vorsorgewissen über `ei_vorsorgewissen`.

## 12. Kardiovaskuläres Antwortmuster

Das kardiovaskuläre Muster dient ausschliesslich dazu, bei mehreren zusammenkommenden Faktoren einen Vorsorge-Check hoch zu priorisieren. Es ist **kein validierter Herz-Kreislauf-Risikorechner**.

| Faktor | Mustergewicht |
|---|---:|
| bekannter Bluthochdruck | +2 |
| Blutdruck unbekannt | +0,5 |
| aktuelles Rauchen | +2 |
| Körperprofil mit Signalstärke `mittel` (inklusive BMI-Fallback) | +1,5 |
| Körperprofil mit Signalstärke `tief` (WHtR 0,50 bis < 0,60) | +0,5 |
| 9 Stunden oder mehr Sitzen | +1 |
| sehr niedrige Aktivität | +1 |
| Ernährungsscore < 45 | +1 |
| höchste Alkoholfrequenz | +1 |

Ab einem Musterwert von 3 kann der kardiovaskuläre Vorsorge-Check als zentraler Hebel erscheinen.

Ist das Körperprofil Teil des Musters, erscheint in der Begründung nicht nur der
generische Begriff, sondern der persönliche WHtR- oder BMI-Wert samt sichtbarer
Kategorie. Ein isolierter Körpermarker reicht mit +0,5 beziehungsweise +1,5 nicht
für den Vorsorge-Check; er wird erst zusammen mit weiteren erhobenen Faktoren zum
Muster. Eine mögliche hohe Muskelmasse wird beim BMI sprachlich kenntlich gemacht,
aber nicht als rechnerischer Rabatt behandelt.

Die breite Familienfrage zählt bewusst **nicht** als zwei Punkte in diesem Muster:
Sie umfasst neben Herz-Kreislauf-Erkrankungen auch Typ-2-Diabetes, Krebs und andere
erblich bedingte Erkrankungen. Eine Ja-Antwort bleibt ein eigenes medizinisches
Signal und löst weiterhin die fachlich passende Familien-/Vorsorgeempfehlung aus.

Die Familienempfehlung fordert als nächsten Schritt, Erkrankung, betroffene Person
und ungefähres Diagnosealter zu klären. Diese Details werden bewusst nicht als
Folgefrage im kurzen Assessment erhoben. Nur falls tatsächlich früh aufgetretene
Herz-Kreislauf-Erkrankungen vorliegen, nennt die Empfehlung konditional Blutdruck,
Lipidprofil und die Frage nach einer einmaligen Lp(a)-Bestimmung. ApoB bleibt eine
vom individuellen Risikoprofil abhängige Zusatzfrage und wird nicht als Standardtest
für alle ausgegeben.

Die vorhandenen Textvarianten mit dem technischen Suffix `family_history` bleiben als
redaktionell gepflegte Reserve für eine künftig differenzierte, ausdrücklich
kardiovaskuläre Familienfrage erhalten. Mit der heutigen breiten Frage werden sie
nicht ausgewählt.

Die Zahlen in dieser Tabelle sind nachvollziehbare Priorisierungsregeln, keine klinisch kalibrierten Risikokoeffizienten. Änderungen benötigen medizinische Freigabe, Versionierung und Tests mit definierten Beispielprofilen.

Wie die drei scorefreien Vorsorgefragen, das Kardio-Muster und andere Trigger zu
sichtbaren Karten zusammengeführt und dedupliziert werden, beschreibt
[`EMPFEHLUNGSLOGIK.md`](EMPFEHLUNGSLOGIK.md).

## 13. Empfehlungssystem und «Ihre nächsten drei Schritte»

Score und Empfehlungen werden bewusst getrennt berechnet. Empfehlungen dürfen deshalb auf eine wichtige medizinische Angabe reagieren, auch wenn diese keine Scorepunkte erhält.

### 13.1 Katalog und Regeln

Der Katalog in [`recommendations.js`](../js/recommendations.js) definiert pro Empfehlung:

- stabile ID und Dimension;
- Auslösebedingung;
- `impact`, `urgency` und `ease`;
- Thema für die Deduplizierung;
- optional passendes Helsana-Angebot;
- bei kritischen Fällen ein Sicherheitskennzeichen.

Die normale Katalogpriorität lautet:

\[
Priorität=2{,}2\cdot Impact+2{,}6\cdot Dringlichkeit+1{,}2\cdot Umsetzbarkeit
\]

Kritische Empfehlungen erhalten technisch einen sehr grossen Vorrang, damit sie nicht von einem bequemeren Lifestyle-Schritt verdrängt werden.

### 13.2 Auswahl der Top 3

Die Auswahl folgt vereinfacht dieser Reihenfolge:

1. zutreffende kritische Empfehlungen;
2. dimensionsübergreifende, antwortbasierte Haupthandlungshebel;
3. Auffüllen aus dem Katalog nach Priorität;
4. Deduplizierung gleicher Themen und abgedeckter Empfehlungen;
5. normalerweise höchstens ein Schritt pro Dimension, ausser ein fachlich gerechtfertigter zweiter Hebel; mehr als zwei Schritte derselben Dimension sind ausgeschlossen.

Die Kurzliste «Grösste Handlungsfelder» verwendet dieselben Lever-Regeln. Ein zweiter Hebel derselben Dimension bleibt dort ab Priorität 8 oder als eigenständiger scorefreier beziehungsweise `summaryOnly`-Klärungshinweis sichtbar; mehr als zwei werden nie gewählt. Dadurch kann ein medizinischer Kardio-Check neben Rauchstopp bestehen, während zum Beispiel Familienrisiko und Untergewicht bei einem freien Platz ebenfalls gemeinsam sichtbar bleiben. Der Kardio-Hebel absorbiert ein bereits in seiner Begründung genanntes Körperprofil; Familienrisiko, offene Risikoeinschätzung, unvollständige Familienkenntnis und fehlendes Vorsorgewissen werden bei gemeinsamem Auftreten über die spezifischere Familienkarte beziehungsweise das gemeinsame Thema `vorsorge` gebündelt.

Eine bewusst dokumentierte Ausnahme sind `lv_untergewicht` und `lv_koerperprofil`: Sie erscheinen als `summaryOnly`, weil die vorhandenen Messwerte eine sichere Einordnung, aber ohne Verlauf, Beschwerden und Ursachen keinen pauschalen Therapie- oder 4-Wochen-Plan erlauben. Falls nur solche Hinweise vorliegen, erklärt ein eigener Klärungszustand den fehlenden standardisierten Plan; der allgemeine Leerzustand «kein Handlungsfeld» wird nicht verwendet. Der ausführliche Signalhinweis bleibt im Dimensionsdetail erhalten. Scorefreie medizinische Hebel erhalten in der Übersicht zudem einen neutralen Markenpunkt statt einer irreführenden grünen Scorefarbe.

Dadurch ist der Aktionsplan kein blosses Ranking der fünf tiefsten Dimensionsscores. Er kann zum Beispiel einen kardiovaskulären Vorsorge-Check vor einen Lifestyle-Hebel setzen.

### 13.3 Auswahl und Rangfolge der persönlichen Stärken

Die Stärkenkarte ist ein eigener Präsentationsvertrag. Sie verändert weder den
Dimensions- oder Gesamtscore noch die Auswahl des Aktionsplans. Angezeigt werden
höchstens drei Stärken und grundsätzlich höchstens eine pro Dimension. Eine Stärke
aus einer insgesamt klar schwachen Dimension mit Score unter 45 wird nicht gezeigt;
ohne passenden Treffer dient die relativ stabilste Dimension als neutraler Anker.

Die Rangfolge berücksichtigt zuerst die persönliche Aussagebreite, danach den
Dimensionsscore, anschliessend das bestehende Fachgewicht und zuletzt die stabile
Katalogreihenfolge:

1. **Stufe 3 – streng bestätigtes Mehrquellenprofil:** eine aussergewöhnlich breite,
   widerspruchsfreie Stärke;
2. **Stufe 2 – erreichtes Ziel oder konsistentes Mehrfachmuster:** beispielsweise
   WHO-Bewegungsziel, regelmässiges Krafttraining, stabiler Schlaf, Resilienz oder
   ein konsistentes Ernährungsmuster;
3. **Stufe 1 – einzelne aktive Ressource:** beispielsweise Pflanzenvielfalt,
   soziale Verbundenheit oder Vorsorge;
4. **Stufe 0 – einzelner Schutz-/Kontextfaktor:** beispielsweise nie geraucht oder
   selten Alkohol.

Ein Mehrfachmuster in einer Dimension unter 80 wird für die Rangfolge auf Stufe 1
zurückgenommen. Dadurch kann ein positiver Teilaspekt aus einem insgesamt gemischten
Bereich andere, breiter belegte Stärken nicht verdrängen. «Rauchfrei» bleibt ein
valider Füllkandidat, erhält aber keinen pauschalen Vorrang vor persönlich
beobachteten Fähigkeiten und erreichten Zielen.

Die neue Topstärke **«Sehr starke körperliche Fitness»** erfordert gleichzeitig:

- Fitnessscore mindestens 90;
- vorhandene Aktivitätsangaben und erreichtes WHO-Bewegungsziel;
- mindestens einen fachlich auswertbaren Kurztest im obersten Band für
  *Muskulatur* und einen für *Balance*;
- alle zusätzlich ausgefüllten, fachlich auswertbaren Kurztests ebenfalls im
  obersten Band;
- keinen gleichzeitig ausgelösten Fitness- oder Stabilitäts-/Sturz-Handlungsbedarf.

Nur Kurztests mit `supported` oder `harmonized_orientation` und Normwert `+2`
zählen. Zwei Krafttests ersetzen keinen Balancetest; ein gemischtes Testprofil
erzeugt auch bei hohem Gesamtscore keine pauschale Topaussage. Nicht passende Alters-,
Geschlechts- oder Protokollreferenzen bleiben ausgeschlossen. Da pro Dimension nur
eine Stärke erscheint, fasst die Topstärke das WHO-Bewegungsziel sichtbar in ihrem
Detailtext mit zusammen. Die Aussage bleibt eine Orientierung innerhalb dieses
Checks und ist keine klinische Leistungsdiagnostik oder individuelle
Mortalitätsprognose.

## 14. Wissenschaftliche Einordnung

Die Evidenz unterstützt die Richtung des Modells, validiert aber nicht automatisch jeden konkreten Produktkoeffizienten.

### Bewegung und Fitness

- Die WHO behandelt moderate und intensive Aktivität als alternative beziehungsweise kombinierbare Wege zum Wochenziel. Das begründet das gemeinsame Aktivitätskomposit, nicht eine doppelte Bestrafung der jeweils anderen Intensität. [WHO Guidelines on physical activity and sedentary behaviour](https://www.who.int/publications/i/item/9789240015128)
- Kardiorespiratorische Fitness ist in grossen Übersichten stark mit Morbidität und Mortalität assoziiert. [Übersicht zu kardiorespiratorischer Fitness](https://pubmed.ncbi.nlm.nih.gov/38599681/)
- Höhere Muskelkraft ist in grossen Meta-Analysen mit geringerer Gesamtmortalität assoziiert. [Meta-Analyse zu Muskelkraft](https://pubmed.ncbi.nlm.nih.gov/29425700/)
- Peter Attias Betonung von Ausdauerleistung und Kraft ist mit dieser Richtung vereinbar, stellt aber keine Validierung der konkreten Fragen, Testprotokolle oder Gewichte dar. [Attias Darstellung der Trainingsschwerpunkte](https://peterattiamd.com/how-much-time-should-you-spend-exercising/)

Das Modell berücksichtigt Kondition und Muskulatur bereits mit zusammen 80 % der Fitnessdimension. Zusätzliche «Attia-Gewichte» würden eine wissenschaftlich nicht belegte Genauigkeit suggerieren.

### Körperzusammensetzung und Herz-Kreislauf

- Zentrale Fettverteilung liefert über den BMI hinaus relevante Information. Das
  begründet die geschlechtsübergreifende WHtR-Priorität bei BMI < 35, ohne daraus
  einen klinischen Risikorechner zu machen. [NICE NG246](https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity) · [Meta-Analyse aus 72 prospektiven Kohorten](https://pubmed.ncbi.nlm.nih.gov/32967840/)
- Aktuelles Rauchen ist ein besonders starker und veränderbarer Risikofaktor. Das begründet den Gegencheck und die hohe Empfehlungspriorität. [Prospektive Evidenz zu Rauchen und Mortalität](https://www.nejm.org/doi/full/10.1056/NEJMsa1211128)
- Klinische kardiovaskuläre Modelle kombinieren konkrete Messwerte wie Blutdruck und Lipide mit Alter, Geschlecht, Rauchen und Region. Einfache Ja/Nein-Antworten werden deshalb nicht als scheinpräziser klinischer Risikoscore ausgegeben. [SCORE2-Modell](https://pmc.ncbi.nlm.nih.gov/articles/PMC8248998/)

### Ernährung und Schlaf

- Für Ernährung ist die Qualität des gesamten Ernährungsmusters relevanter als eine nicht validierte Übergewichtung eines einzelnen Proxys. Die fünf Kernfragen bleiben deshalb einfach und gleichgewichtet. [Systematischer Review zu Ernährungsmustern](https://pubmed.ncbi.nlm.nih.gov/35258870/)
- Beobachtungsdaten zeigen nichtlineare Zusammenhänge zwischen Schlafdauer und Gesundheit. Mehr als neun Stunden sind ohne weiteren Kontext jedoch nicht automatisch kausal ungünstig; deshalb bleibt diese Antwort neutral und die Alltagswirkung wird separat berücksichtigt. [Dosis-Wirkungs-Meta-Analyse](https://pubmed.ncbi.nlm.nih.gov/28889101/)

### Grenzen der Übertragbarkeit

Assoziationen oder Hazard Ratios aus wissenschaftlichen Studien können nicht direkt in Fragegewichte übersetzt werden:

- objektiv gemessene Fitness ist nicht identisch mit selbst berichteten Bewegungsminuten;
- Muskelkraftmessungen sind nicht dasselbe wie die Häufigkeit des Krafttrainings;
- Populationen, Messmethoden und Endpunkte unterscheiden sich;
- die Referenzwerte einzelner Kurztests sind Orientierungswerte, keine Diagnosegrenzen.

## 15. Bewusste Modellentscheidungen

Folgende Entscheidungen halten das System gemäss 80/20-Prinzip verständlich und robust:

- fünf Dimensionen weiterhin gleichgewichtet;
- keine höhere Gesamtgewichtung von Fitness trotz starker Evidenz für Fitness und Kraft;
- keine individuellen Zusatzkoeffizienten für einzelne Ernährungsfragen;
- medizinische Angaben als Signale statt normale Minuspunkte;
- optionale Kurztests präzisieren bestehende Fitnessblöcke, erhöhen aber deren Gesamtgewicht nicht;
- numerischer Gesamtscore bleibt ein einfacher Mittelwert;
- Schutzregeln werden nur bei klaren Widerspruchs- oder Sicherheitsfällen eingesetzt.

## 16. Qualitätssicherung und Änderungen am Modell

Fachliche Änderungen am Scoring benötigen mindestens:

1. dokumentierte Begründung und medizinische Eigentümerschaft;
2. Änderung in den kanonischen Dateien, nicht in generierten Dateien;
3. Regressionstests für Grenzwerte, Gegenchecks und typische Profile;
4. Prüfung der Auswirkungen auf Risikosignale und Top-3-Empfehlungen;
5. Aktualisierung dieser Dokumentation und von [`QUELLEN.md`](QUELLEN.md).

Wichtige Invarianten der Tests sind:

- eine ungünstigere Antwort darf einen Score nicht erhöhen;
- ein erfülltes Aktivitätsziel darf nicht wegen der nicht gewählten Intensitätsform abgewertet werden;
- ein hohes Mentalsignal darf nicht mit dem Mentalstatus «Stark» koexistieren;
- Körperzusammensetzung muss in Score, Signal und Kardio-Muster gleich interpretiert werden;
- Deckel dürfen einen tieferen Wert nie anheben;
- ausgelassene optionale Tests dürfen nicht als schlechte Leistung zählen;
- ungestützte Testreferenzen dürfen weder Score noch automatische Empfehlung beeinflussen;
- Top-3-Empfehlungen müssen für definierte archetypische Profile stabil bleiben.

Relevante Testbefehle:

```bash
node tests/integration.test.js
node tests/robustness.test.js
node tests/ui-lifecycle.test.js
node tests/i18n-static.test.js
node tests/i18n-runtime.test.js
```

Bei sichtbaren Ergebnistexten ist zusätzlich der dokumentierte Content-Workflow in [`TEXTPFLEGE.md`](TEXTPFLEGE.md) zu verwenden. Generierte Runtime-Bundles und Exporte dürfen nicht manuell gepflegt werden.

## Anhang A: Fragen und Normwerte

Dieser Anhang bildet den aktuellen Vertrag aus [`questions.js`](../js/questions.js) und `NORMS` in [`scoring.js`](../js/scoring.js) ab. Die Prozentwerte beziehen sich auf einen vollständig beantworteten Fragebogen vor Gegenchecks und Rundung. Bei bedingten Fitnessgewichten ist die jeweils zutreffende Variante angegeben.

### A.1 Einflussfaktoren – scorewirksame Einfachauswahl

| Frage | Antwortstufen → Normwert | Gewicht Dimension / Gesamt |
|---|---|---:|
| **Stabilität im Alltag** (`stabilitaet`)<br>Wie sicher fühlen Sie sich bei alltäglichen Bewegungen? | Sehr sicher → +2; Sicher → +1; Weder noch → 0; Unsicher → −1; Sehr unsicher → −2 | 16,67 % / 3,33 % |
| **Sitz- und Liegezeit** (`sitzzeit`)<br>Wie viele Stunden verbringen Sie an einem typischen Tag im Sitzen oder Liegen? | Weniger als 4 Stunden → +2; 4–6 Stunden → +1; 7–8 Stunden → 0; 9–10 Stunden → −1; Mehr als 10 Stunden → −2 | 16,67 % / 3,33 % |
| **Rauchen** (`rauchen`)<br>Rauchen Sie oder haben Sie in der Vergangenheit geraucht? | Nein, nie → +2; Nicht mehr → +1; Keine Angaben → 0; Ja, manchmal → −2; Ja, regelmässig → −2 | 16,67 % / 3,33 % |
| **Alkohol** (`alkohol`)<br>Wie häufig haben Sie im letzten Monat alkoholische Getränke konsumiert? | Nie oder selten → +2; 2–4 x pro Monat → 0; Keine Angaben → 0; 2–3 x pro Woche → −1; 4 x oder öfter pro Woche → −2 | 16,67 % / 3,33 % |
| **Social Media** (`socialmedia`)<br>Verbringen Sie mehr Zeit mit Social Media als Ihnen lieb ist? | Nein → +2; Selten → +1; Manchmal → 0; Oft → −1; Sehr oft → −2 | 16,67 % / 3,33 % |

Der sechste gleichgewichtete Bestandteil ist die **abgeleitete Körperzusammensetzung** mit 16,67 % der Dimension beziehungsweise 3,33 % des Gesamtscores. Sie ist keine Einfachauswahl; Normwerte und Datenpriorität stehen in [Abschnitt 5.2](#52-einheitliche-körperzusammensetzung). Rauchen −2 oder Körperzusammensetzung −2 deckeln die Dimension auf höchstens 50.

### A.2 Körperliche Fitness – scorewirksame Einfachauswahl

| Frage | Antwortstufen → Normwert | Gewicht Fitness / Gesamt |
|---|---|---:|
| **Moderate Ausdaueraktivität** (`ausdauer_moderat`)<br>Wie viele Stunden moderate Ausdaueraktivität machen Sie pro Woche? | Weniger als 30 min → −2; 30 min – 1 h 15 min → −1; 1 h 15 min – 2 h 30 min → 0; 2 h 30 min – 5 h → +1; 5 h oder mehr → +2 | gemeinsamer Aktivitätsblock A, siehe Hinweis |
| **Intensive Ausdaueraktivität** (`ausdauer_intensiv`)<br>Wie viele Stunden intensive Ausdaueraktivität machen Sie pro Woche? | Keine → −2; Weniger als 30 min → −1; 30 min – 1 h 15 min → 0; 1 h 15 min – 2 h 30 min → +1; 2 h 30 min oder mehr → +2 | gemeinsamer Aktivitätsblock A, siehe Hinweis |
| **Treppenbelastung** (`treppen`)<br>Kommen Sie ausser Atem, wenn Sie zwei Stockwerke Treppen steigen? | Überhaupt nicht → +2; Kaum → +1; Etwas → 0; Deutlich → −1; Sehr stark → −2 | 13,33 % / 2,67 % |
| **Krafttraining** (`krafttraining`)<br>An wie vielen Tagen pro Woche machen Sie Krafttraining? | 0 Tage → −2; 1 Tag → 0; 2 Tage → +1; 3 Tage oder mehr → +2 | ohne Muskeltest 20 % / 4 %; mit Test(s) 10 % / 2 % |
| **Einkaufstaschen tragen** (`einkaufstaschen`)<br>Wie schwer fällt es Ihnen, zwei volle Einkaufstaschen zu tragen? | Überhaupt nicht schwer → +2; Wenig schwer → +1; Mässig schwer → 0; Sehr schwer → −1; Unmöglich → −2 | ohne Muskeltest 20 % / 4 %; mit Test(s) 10 % / 2 % |
| **Vom Boden aufstehen** (`beweglichkeit`)<br>Wie schwer fällt es Ihnen, ohne Hilfe vom Boden aufzustehen? | Überhaupt nicht schwer → +2; Wenig schwer → +1; Mässig schwer → 0; Sehr schwer → −1; Unmöglich → −2 | ohne Einbeinstand 20 % / 4 %; mit Einbeinstand 10 % / 2 % |

Moderate und intensive Aktivität werden nicht addiert und besitzen keine zwei unabhängigen Gewichte. Es gilt `A = max(Norm moderat, Norm intensiv)`. Dieser gemeinsame A-Block zählt 26,67 % des Fitnessscores beziehungsweise 5,33 % des Gesamtscores. Zusammen mit der Treppenbelastung entsteht `Kondition = (2 × A + Treppen) / 3`.

### A.3 Ernährung – scorewirksame Einfachauswahl

| Frage | Antwortstufen → Normwert | Gewicht Dimension / Gesamt |
|---|---|---:|
| **Proteinverteilung** (`protein`)<br>Wie häufig gelingt es Ihnen, über den Tag verteilt zu mindestens drei Mahlzeiten oder Snacks eine klare Proteinquelle einzuplanen? | Selten → −2; Manchmal → −1; Etwa die Hälfte der Zeit → 0; Meistens → +1; Fast immer → +2 | 20 % / 4 % |
| **Pflanzenvielfalt** (`pflanzenvielfalt`)<br>Wie viele verschiedene pflanzliche Lebensmittel haben Sie in der letzten Woche gegessen? | Weniger als 10 → −2; 10–17 → −1; 18–25 → 0; 26–34 → +1; 35 oder mehr → +2 | 20 % / 4 % |
| **Stark verarbeitete Lebensmittel** (`verarbeitet`)<br>Wie häufig greifen Sie in einer typischen Woche zu stark verarbeiteten Lebensmitteln? | Nie → +2; Seltener als 1x pro Woche → +1; 1–2x pro Woche → 0; Fast täglich → −1; Mehrmals täglich → −2 | 20 % / 4 % |
| **Omega-3-Quellen** (`omega3`)<br>Wie oft pro Woche essen Sie fettreichen Fisch oder nehmen Omega-3 als Nahrungsergänzung ein? | Nie → −2; Seltener als 1x pro Woche → −1; 1x pro Woche → 0; 2x pro Woche → +1; Mehr als 2x pro Woche → +2 | 20 % / 4 % |
| **Zuckerhaltige Getränke und Fruchtsäfte** (`zuckergetraenke`)<br>Wie häufig trinken Sie zuckerhaltige Getränke oder reine Fruchtsäfte? | Nie → +2; Seltener als 1x pro Woche → +1; 1–3x pro Woche → 0; 4–6x pro Woche → −1; Täglich oder mehrmals täglich → −2 | 20 % / 4 % |

### A.4 Schlaf – scorewirksame Einfachauswahl

| Frage | Antwortstufen → Normwert | Gewicht Dimension / Gesamt |
|---|---|---:|
| **Schlafqualität** (`schlafqualitaet`)<br>Wie gut oder schlecht haben Sie im letzten Monat insgesamt geschlafen? | Sehr gut → +2; Gut → +1; Durchschnittlich → 0; Schlecht → −1; Sehr schlecht → −2 | 33,33 % / 6,67 % |
| **Schlafdauer** (`schlafdauer`)<br>Wie viele Stunden haben Sie im letzten Monat durchschnittlich pro Nacht geschlafen? | Weniger als 5 h → −2; 5–6 h → −1; 6–7 h → 0; 7–9 h → +2; Mehr als 9 h → 0 | 33,33 % / 6,67 % |
| **Schlafrhythmus** (`schlafrhythmus`)<br>Stehen Sie jeden Tag ungefähr zur gleichen Zeit auf und gehen zur gleichen Zeit ins Bett? | Sehr regelmässig (±30 min) → +2; Regelmässig (±45 min) → +1; Etwas unregelmässig (±1 h) → 0; Unregelmässig (±1,5 h) → −1; Sehr unregelmässig (mehr als 2 h) → −2 | 33,33 % / 6,67 % |

### A.5 Mentale Gesundheit – scorewirksame Einfachauswahl

Für alle acht Aussagen gilt dieselbe vollständige Zustimmungsskala: **Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2**.

| Frage | Antwortstufen → Normwert | Gewicht Dimension / Gesamt |
|---|---|---:|
| **Belastbarkeit** (`belastbarkeit`)<br>Ich bewahre auch in schwierigen Situationen den Überblick und Ruhe. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Selbstwirksamkeit** (`selbstwirksamkeit`)<br>Ich fühle mich meinem Alltag gewachsen. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Sinnhaftigkeit** (`sinnhaftigkeit`)<br>Ich erlebe mein Leben als sinnvoll und erfüllend. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Bewältigungsstrategien** (`coping`)<br>Ich finde auch in belastenden Situationen Wege, die mir helfen, klarzukommen. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Verbundenheit** (`verbundenheit`)<br>Ich fühle mich von den Menschen in meinem Umfeld akzeptiert und eingebunden. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Selbstfürsorge** (`selbstfuersorge`)<br>Ich finde auch in hektischen Zeiten Momente der Ruhe und Erholung. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Zukunft** (`zukunft`)<br>Ich schaue zuversichtlich in meine Zukunft. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |
| **Positive Emotionen** (`positive_emotionen`)<br>Ich erlebe in meinem Alltag regelmässig Momente der Freude oder Dankbarkeit. | Stimme völlig zu → +2; Stimme eher zu → +1; Weder noch → 0; Stimme eher nicht zu → −1; Stimme gar nicht zu → −2 | 12,5 % / 2,5 % |

Belastbarkeit, Selbstwirksamkeit und Coping wirken bei −2 zusätzlich auf den gemeinsamen Mental-Gegencheck. Sinnhaftigkeit und positive Emotionen wirken nur gemeinsam bei zweimal −2 auf diesen Deckel. Details stehen in [Abschnitt 9.2](#92-gemeinsamer-sicherheitsvertrag).

### A.6 Scorefreie Einfachauswahl und Gegenchecks

| Frage | Antwortstufen / interne Einordnung | Rolle ausserhalb des regulären Mittelwerts |
|---|---|---|
| **Familiäre Erkrankungen** (`familie_hk`)<br>Sind bei Ihren Eltern, Geschwistern oder eigenen Kindern Herz-Kreislauf-Erkrankungen, Typ-2-Diabetes, Krebs oder eine bekannte erblich bedingte Erkrankung aufgetreten? | Ja / Nein, soweit mir bekannt / Ich kenne die Familiengeschichte nur teilweise / Weiss ich nicht; kein Normwert | «Ja» erzeugt das medizinische Signal `familie_hk` mittlerer Schwere sowie `ei_familie`/`lv_familie`. «Teilweise» und «Weiss ich nicht» erzeugen scorefrei `ei_familienwissen`/`lv_familienwissen`, aber kein Risikosignal. Keine Antwort zählt als Punkt im Kardio-Muster. |
| **Wissen über passende Vorsorge** (`familienwissen`)<br>Wissen Sie, welche Vorsorgeuntersuchungen aufgrund Ihres Alters, Ihrer persönlichen Werte und Ihrer Familiengeschichte für Sie sinnvoll sind? | Ja / Teilweise / Nein; kein Normwert | «Teilweise» oder «Nein» erzeugt scorefrei `ei_vorsorgewissen`/`lv_vorsorgewissen`, aber kein Risikosignal. Die stabile ID bleibt aus Kompatibilitätsgründen erhalten; die Frage ist kein Scorebestandteil. |
| **Professionelle Risikoeinschätzung** (`vorsorge`)<br>Hat eine Ärztin, ein Arzt oder eine andere medizinische Fachperson Ihr persönliches Gesundheitsrisiko bereits beurteilt und mit Ihnen passende Vorsorgeuntersuchungen besprochen? | Ja, gemäss Fachperson aktuell / Ja, aber länger zurück oder Aktualität unsicher / Nein / Weiss ich nicht; kein Normwert | `aktuell` gilt als erledigt. `nein` erzeugt das medizinische Signal `vorsorge` mittlerer, `aelter_unsicher` und `weiss_nicht` eines tiefer Schwere; alle drei offenen Werte aktivieren `ei_vorsorge`/`lv_vorsorge`. |
| **Bluthochdruck** (`bluthochdruck`)<br>Wurde bei Ihnen ärztlich Bluthochdruck festgestellt oder nehmen Sie Blutdruckmedikamente? | Nein / Ja / Weiss ich nicht; kein Normwert | «Ja» erzeugt ein hohes medizinisches Signal und +2 im Kardio-Muster; «Weiss ich nicht» ein mittleres Signal und +0,5 im Kardio-Muster. |
| **Sättigung** (`saettigung`)<br>Wie häufig fühlen Sie sich nach Ihren Hauptmahlzeiten für etwa vier Stunden satt? | Nie → −2; Selten → −1; Manchmal → 0; Oft → +1; Fast immer → +2 | Kein Scoregewicht und kein Deckel. Nie/Selten/Manchmal können eine Empfehlung auslösen. |
| **Schlafbedingte Alltagsbeeinträchtigung** (`schlaf_auswirkung`)<br>Wie stark hat Ihr Schlaf im letzten Monat Ihren Alltag beeinträchtigt? | Gar nicht → +2; Minimal → +1; Spürbar → 0; Deutlich → −1; Massiv → −2 | Kein gleichgewichteter Scorebestandteil. Spürbar deckelt Schlaf auf 75; deutlich/massiv auf 50. Massiv erzeugt zusätzlich ein medizinisches Signal mittlerer Schwere. |

Für bestehende lokale Stände und Ergebnislinks gilt eine defensive Migration ohne
inhaltliche Vermutungen. Da sich die Bedeutung der drei stabilen Frage-IDs
`familie_hk`, `familienwissen` und `vorsorge` geändert hat, werden deren frühere
Antworten entfernt und im Abschnitt «Einflussfaktoren» neu abgefragt. Alle anderen
weiterhin gültigen Antworten bleiben erhalten. Aktuelle lokale Stände verwenden
Storage-Schema 3, aktuelle Ergebnislinks Hash-Schema 2; unbekannte Versionen werden
abgelehnt. Details stehen in [`EMPFEHLUNGSLOGIK.md`](EMPFEHLUNGSLOGIK.md#45-bestehende-lokale-stände-und-ergebnislinks).

### A.7 Persönliche Angaben und optionale numerische Kurztests

| Eingabe | Erlaubter Bereich | Score-/Signalrolle |
|---|---:|---|
| **Alter** (`alter`) | 16–119 Jahre | Kein eigener Score; bestimmt die zulässige Testreferenz und kann Empfehlungsprioritäten beeinflussen. |
| **Biologisches Geschlecht** (`geschlecht`) | männlich / weiblich / intersex | Kein eigener Score; bestimmt geeignete Fitness-Testreferenzen, nicht die WHtR-Grenzen. |
| **Grösse** (`groesse`) | 100–299 cm | Kein eigener Score; Bestandteil von BMI und bei Taillenangabe des WHtR. |
| **Gewicht** (`gewicht`) | 30–399 kg | Kein eigener Score; bestimmt BMI-Klasse, Untergewichtssignal und – bei fehlender Taille oder Erwachsenen ab BMI 35 – den BMI-Fallback. |
| **Bauchumfang** (`bauchumfang`, optional) | 40–250 cm | Liefert mit der Körpergrösse das bevorzugte WHtR-Körperprofil. Bei Erwachsenen ab BMI 35 bleibt stattdessen trotz Taille der BMI scorewirksam; ohne Bauchumfang greift der BMI ebenfalls als Fallback. Gewicht: 16,67 % der Einflussfaktoren beziehungsweise 3,33 % gesamt. |
| **Einbeinstand** (`einbeinstand`, optional) | 0–1'000 Sekunden | Nur mit unterstützter Referenz scorewirksam: 10 % Fitness / 2 % gesamt; ersetzt die Hälfte des Balanceblocks. |
| **Liegestütze** (`liegestuetze`, optional) | 0–150 Wiederholungen | Bei allein scorebarem Muskeltest 20 % Fitness / 4 % gesamt; zusammen mit Wandsitz 10 % / 2 %. |
| **Wandsitz** (`wandsitz`, optional) | 0–1'000 Sekunden | Bei allein scorebarem Muskeltest 20 % Fitness / 4 % gesamt; zusammen mit Liegestütz 10 % / 2 %. |

Für Kurztests sind Rohwertgrenze, Scoredeckel und Referenzschwelle unterschiedliche Verträge: Werte bis zur Eingabeobergrenze werden unverändert angezeigt; die Einstufung erfolgt anhand der alters- und gegebenenfalls geschlechtsspezifischen Schwellen in [`scoring.js`](../js/scoring.js). Ein ausgelassener oder nicht referenzierbarer Test erhält kein negatives Ersatzgewicht.
