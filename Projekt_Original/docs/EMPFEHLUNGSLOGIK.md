# Empfehlungslogik des Gesundheitschecks

**Stand:** Juli 2026
**Zweck:** Verständliche und technisch genaue Übersicht darüber, wie aus Antworten
sichtbare Hinweise, Handlungsfelder, Empfehlungen, 4-Wochen-Pläne und Stärken
entstehen.

Dieses Dokument beschreibt die **Auswahllogik der Texte**. Die Berechnung der
Dimensions- und Gesamtwerte ist ausführlich in
[`SCORING_MODELL.md`](SCORING_MODELL.md) dokumentiert; fachliche Grundlagen und
Aussagegrenzen stehen in [`QUELLEN.md`](QUELLEN.md).

## 1. Kurzfassung

Score und Empfehlungen sind zwei getrennte, aber miteinander verbundene Pfade:

```text
Antworten
  │
  ├─> Normwerte und Messwertprofile ─> Dimensionsscores ─> Gesamtscore
  │
  └─> Signale und Antwortmuster
        │
        ├─> Haupthandlungshebel ─> priorisierter Aktionsplan (maximal 3)
        ├─> weitere Empfehlungen in den Dimensionskarten
        └─> noch nicht abgedeckte medizinische oder fachliche Hinweise

Positive Antwortmuster ────────────────────────────────> Stärken (maximal 3)
```

Eine Antwort kann deshalb:

- den Score und eine Empfehlung beeinflussen;
- nur eine Empfehlung oder einen medizinischen Klärungshinweis auslösen;
- nur bei der Priorisierung eines Mehrfaktorenmusters mitwirken; oder
- eine persönliche Stärke bestätigen.

Insbesondere sind die drei Fragen zu Familiengeschichte, medizinischer
Risikoeinschätzung und Wissen über passende Vorsorge **scorefrei**. Fehlendes Wissen
ist kein schlechter Gesundheitszustand. Es führt stattdessen zu einem konkreten,
fairen nächsten Schritt.

## 2. Verbindliche Quellen im Projekt

| Aufgabe | Verbindliche Datei |
|---|---|
| Fragen, Antwortwerte und Vollständigkeit | [`questions.js`](../js/questions.js) |
| Normen, Messwertprofile, Scores und Signale | [`scoring.js`](../js/scoring.js) |
| Auslöser, Prioritäten, Deduplizierung, Stärken und Pläne | [`recommendations.js`](../js/recommendations.js) |
| Darstellung der Ergebnisse | [`app.js`](../js/app.js) |
| Sichtbare deutsche Texte | [`content/result-texts/`](../content/result-texts/) |
| EN-/FR-/IT-Texte | [`content/result-texts/locales/`](../content/result-texts/locales/) |
| Generiertes Runtime-Textbundle | [`result-copy.generated.js`](../js/result-copy.generated.js) |
| Regressionstests | [`tests/`](../tests/) |

Bei einem Widerspruch ist der getestete Code massgebend. Dokumentation, kanonische
Texte, generierte Dateien und Tests müssen bei fachlichen Änderungen gemeinsam
aktualisiert werden.

## 3. Die Verarbeitungskette im Detail

### 3.1 Antworten und abgeleitete Profile

Die App bereinigt zuerst alle Antworten gegen das erlaubte Schema. Aus den gültigen
Antworten entstehen:

- Normwerte von grundsätzlich −2 bis +2 für scorewirksame Fragen;
- BMI und – bei optionaler Taillenangabe – das Taille-Grösse-Verhältnis;
- ein einheitliches Körperprofil für Score, Signal und Kardio-Muster;
- ein Aktivitätsstatus einschliesslich WHO-Bewegungsziel;
- alters- und gegebenenfalls geschlechtsspezifische Einordnungen der optionalen
  Fitness-Kurztests;
- fünf Dimensionsscores und ein Gesamtscore.

### 3.2 Signale

`scoring.js` leitet zusätzlich strukturierte Signale ab. Ein Signal besteht aus
einer stabilen ID, einem Typ und einer Schwere. Die Typen unterscheiden vor allem:

- **medizinisch:** professionelle Abklärung oder Einordnung kann sinnvoll sein;
- **Lebensstil:** ein grundsätzlich selbst beeinflussbarer Ansatz ist erkennbar;
- **dringend/hohe Belastung:** Sicherheitslogik hat Vorrang vor der normalen
  Priorisierung.

Signale sind keine Diagnosen. Sie werden nicht pauschal als Minuspunkte in den
Gesamtscore übersetzt.

### 3.3 Empfehlungskatalog

Jede Katalogempfehlung besitzt:

- eine stabile ID und Dimension;
- eine klar definierte Auslösebedingung;
- `impact`, `urgency` und `ease`;
- optional ein Thema (`topic`) für die Deduplizierung;
- optional eine Liste ausdrücklich abgedeckter Empfehlungen (`covers`);
- gegebenenfalls ein Helsana-Angebot oder ein Sicherheitskennzeichen.

Für normale Katalogeinträge gilt:

\[
Priorität=2{,}2\cdot Impact+2{,}6\cdot Dringlichkeit+1{,}2\cdot Umsetzbarkeit
\]

Kritische Sicherheitsempfehlungen erhalten unabhängig davon technischen Vorrang.

### 3.4 Haupthandlungshebel

Der Lever-Katalog fasst einzelne Antworten, Signale und Antwortmuster zu
verständlichen Hauptthemen zusammen. Er beantwortet nicht nur «Welche Dimension ist
am tiefsten?», sondern «Welcher konkrete nächste Schritt ist für dieses Profil am
relevantesten?».

Beispiele:

- Mehrere kardiometabolische Faktoren können gemeinsam den kardiovaskulären
  Vorsorge-Check auslösen.
- Eine bekannte Familiengeschichte kann unabhängig von einem hohen Score ein
  Vorsorgethema eröffnen.
- Eine massive Schlafbeeinträchtigung wird als Abklärung und nicht bloss als
  allgemeiner Schlaftipp priorisiert.
- Ein auffälliges Körperprofil bleibt ohne genügend Informationen ein
  Klärungshinweis und erzeugt keinen pauschalen Gewichtsplan.

### 3.5 Priorisierung und Themendeduplizierung

Der Aktionsplan und die Kurzliste «Grösste Handlungsfelder» verwenden dieselben
Hebel und Prioritäten:

1. kritische Sicherheitsempfehlungen;
2. zutreffende Haupthandlungshebel in globaler Prioritätsreihenfolge;
3. Auffüllen aus dem allgemeinen Empfehlungskatalog;
4. Entfernung gleicher oder ausdrücklich abgedeckter Themen;
5. Begrenzung auf höchstens drei Einträge.

Grundsätzlich wird Vielfalt über die fünf Dimensionen angestrebt. Ein zweiter
Eintrag derselben Dimension ist nur bei hoher Priorität beziehungsweise als
eigenständiger scorefreier oder reiner Klärungshinweis zulässig. Mehr als zwei
Einträge derselben Dimension werden nicht gewählt.

`topic` verhindert parallele Karten zum gleichen Thema. `covers` ist enger: Es
kennzeichnet eine konkrete Empfehlung, deren Inhalt in einer umfassenderen Karte
bereits enthalten ist. So kann beispielsweise die Familienkarte einen gleichzeitig
offenen allgemeinen Vorsorgehinweis bündeln, ohne andere unabhängige
Gesundheitsthemen auszublenden.

### 3.6 Top 3, Dimensionskarten und nicht priorisierte Signale

Die priorisierten Empfehlungen erscheinen als «Ihre nächsten drei Schritte» mit
persönlicher Begründung, nächstem Schritt, erwartetem Nutzen und einem optionalen
4-Wochen-Plan.

In jeder Dimensionskarte werden danach:

1. die dort liegenden Top-3-Karten gespiegelt;
2. weitere zutreffende Katalogempfehlungen ergänzt;
3. noch nicht durch eine sichtbare Empfehlung abgedeckte Signale als eigenständige
   Hinweise dargestellt.

Ein Signal verschwindet also nicht still. Es wird nur dann nicht nochmals separat
angezeigt, wenn eine stabil zugeordnete Empfehlung dasselbe Thema bereits
ausreichend erklärt.

### 3.7 Stärken

Stärken werden unabhängig vom Aktionsplan ausgewählt. Die Rangfolge berücksichtigt:

1. Aussagebreite des positiven Musters;
2. Dimensionsscore;
3. fachliches Gewicht;
4. stabile Katalogreihenfolge.

Es erscheinen höchstens drei Stärken und grundsätzlich höchstens eine pro
Dimension. Eine einzelne positive Antwort erhält keinen Vorrang vor einer breit
bestätigten Stärke; in einer Dimension unter 45 wird keine widersprüchliche Stärke
ausgegeben.

## 4. Die drei scorefreien Vorsorgefragen

Die Fragen messen drei unterschiedliche Sachverhalte und bleiben deshalb getrennt:

1. **Tatsächliche Familiengeschichte:** Ist eine relevante Erkrankung bekannt?
2. **Professionelle Risikoeinschätzung:** Wurde das persönliche Risiko medizinisch
   beurteilt und ist diese Einschätzung noch aktuell?
3. **Orientierungswissen:** Weiss die Person, welche Vorsorge für sie grundsätzlich
   sinnvoll ist?

Keine dieser Fragen fliesst in den 0–100-Score ein.

### 4.1 Familiäre Erkrankungen (`familie_hk`)

> Sind bei Ihren Eltern, Geschwistern oder eigenen Kindern Herz-Kreislauf-
> Erkrankungen, Typ-2-Diabetes, Krebs oder eine bekannte erblich bedingte
> Erkrankung aufgetreten?

| Antwortwert | Bedeutung | Technische Wirkung |
|---|---|---|
| `ja` | Mindestens eine relevante Erkrankung ist in der nahen Familie bekannt. | Medizinisches Signal und priorisierbare Familien-/Vorsorgeempfehlung. |
| `nein` | Soweit bekannt liegt keine der genannten Erkrankungen vor. | Kein negatives Signal; keine automatische Familienempfehlung. |
| `teilweise` | Die Familiengeschichte ist nur teilweise bekannt. | Scorefrei `ei_familienwissen`/`lv_familienwissen`; kein Risikosignal. |
| `weiss_nicht` | Es liegt keine belastbare Kenntnis der Familiengeschichte vor. | Scorefrei `ei_familienwissen`/`lv_familienwissen` mit etwas höherer Priorität; kein Risikosignal. |

Der Fragebogen enthält bewusst **keine zusätzliche Folgefrage** nach Details. Damit
bleibt er kurz. Stattdessen gibt die Empfehlung dem Kunden einen konkreten Auftrag:

> Klären Sie, welche Erkrankung bei welchem Familienmitglied und ungefähr in
> welchem Alter diagnostiziert wurde, und nehmen Sie diese Angaben zu einem
> Vorsorgegespräch mit.

Diese drei Angaben sind der eigentliche Mehrwert für eine spätere professionelle
Einordnung. Die App bewertet eine breite Ja-Antwort nicht selbst als konkrete
kardiovaskuläre Familienanamnese und stellt keine genetische Diagnose.

### 4.2 Medizinische Risikoeinschätzung (`vorsorge`)

> Hat eine Ärztin, ein Arzt oder eine andere medizinische Fachperson Ihr
> persönliches Gesundheitsrisiko bereits beurteilt und mit Ihnen passende
> Vorsorgeuntersuchungen besprochen?

| Antwortwert | Bedeutung | Technische Wirkung |
|---|---|---|
| `aktuell` | Eine medizinische Risikoeinschätzung liegt vor und wird als aktuell verstanden. | Kein offener Vorsorgehinweis; kann zusammen mit vorhandenem Orientierungswissen eine Stärke bestätigen. |
| `aelter_unsicher` | Eine Beurteilung fand statt, liegt aber länger zurück oder ihre Aktualität ist unklar. | Signal `vorsorge` mit Schwere `tief` sowie `ei_vorsorge`/`lv_vorsorge`. |
| `nein` | Bisher fand keine entsprechende professionelle Risikoeinschätzung statt. | Signal `vorsorge` mit Schwere `mittel` sowie `ei_vorsorge`/`lv_vorsorge`; höchste Priorität der drei offenen Werte. |
| `weiss_nicht` | Die Person kann nicht sicher sagen, ob eine solche Beurteilung erfolgt ist. | Signal `vorsorge` mit Schwere `tief` sowie `ei_vorsorge`/`lv_vorsorge`. |

Die Frage trennt bewusst eine professionelle Einschätzung vom blossen Lesen oder
Informieren. Ob und in welchem Intervall Untersuchungen sinnvoll sind, hängt unter
anderem von Alter, persönlichen Messwerten, Beschwerden und Familiengeschichte ab.

### 4.3 Wissen über passende Vorsorge (`familienwissen`)

> Wissen Sie, welche Vorsorgeuntersuchungen aufgrund Ihres Alters, Ihrer
> persönlichen Werte und Ihrer Familiengeschichte für Sie sinnvoll sind?

Die bestehende stabile technische ID bleibt aus Kompatibilitätsgründen erhalten;
inhaltlich erfasst die Frage künftig das Wissen über persönlich passende Vorsorge
und nicht mehr die Qualität der Familienkenntnis.

| Antwortwert | Bedeutung | Technische Wirkung |
|---|---|---|
| `ja` | Die Person weiss, welche Vorsorgeuntersuchungen für sie grundsätzlich sinnvoll sind. | Kein offener Informationshinweis; kein Scorebonus. |
| `teilweise` | Das Wissen ist unvollständig. | Scorefrei `ei_vorsorgewissen`/`lv_vorsorgewissen`; kein Risikosignal. |
| `nein` | Es fehlt eine klare Orientierung. | Scorefrei `ei_vorsorgewissen`/`lv_vorsorgewissen` mit höherer Priorität; kein Risikosignal. |

Der Antwortwert beschreibt Informationsbedarf, nicht Gesundheit. Deshalb gibt es
weder einen Plus- noch einen Minuspunkt.

### 4.4 Zusammenspiel und Bündelung

| Antwortmuster | Sichtbare Hauptwirkung |
|---|---|
| Familiengeschichte `ja` | Spezifische Familien-/Vorsorgekarte; sie fordert Erkrankung, betroffene Person und Diagnosealter zur Klärung auf. |
| Familiengeschichte `teilweise` oder `weiss_nicht` | Familieninformationen gezielt einholen; keine Risikobehauptung und kein Scoremalus. |
| Risikoeinschätzung `nein` | Professionelle Vorsorge beziehungsweise persönliche Risikoeinschätzung besprechen. |
| Risikoeinschätzung `aelter_unsicher` oder `weiss_nicht` | Aktualität beziehungsweise bisherigen Umfang klären. |
| Vorsorgewissen `teilweise` oder `nein` | Information und Gesprächsvorbereitung anbieten. |
| Familiengeschichte `ja` plus nicht aktuelle/fehlende Risikoeinschätzung oder fehlendes Vorsorgewissen | Die spezifische Familienkarte erhält Vorrang und deckt `ei_vorsorge` und `ei_vorsorgewissen` ab. |
| Mehrere offene Vorsorgefragen | Keine drei nahezu identischen Karten; das gemeinsame Thema `vorsorge` wird dedupliziert. |

Die Lever-Prioritäten bilden die Handlungsnähe ab: Bei `familie_hk = ja` liegt
`lv_familie` je nach Vorsorgestatus zwischen 5,8 (`aktuell`) und 6,8 (`nein`).
`lv_vorsorge` liegt zwischen 4,5 (`aelter_unsicher`) und 5,5 (`nein`). Unbekannte
Familiengeschichte wird mit 4,2 vor teilweise bekannter Familiengeschichte mit 3,8
eingeordnet; fehlendes Vorsorgewissen mit 3,5 vor teilweisem Wissen mit 3,0. Diese
Zahlen priorisieren Texte innerhalb der App und sind keine medizinischen
Risikokoeffizienten.

### 4.5 Bestehende lokale Stände und Ergebnislinks

Die Frage-IDs bleiben stabil, ihre Bedeutung hat sich jedoch verändert. Frühere
Antworten werden deshalb **nicht geraten oder semantisch umgedeutet**:

- Local-Storage-Schema 3 und Ergebnislink-Schema 2 enthalten die aktuellen Werte.
- Bei älteren lokalen Ständen (Schema 2 oder unversioniert) bleiben alle anderen
  gültigen Antworten erhalten; `familie_hk`, `familienwissen` und `vorsorge` werden
  entfernt. Die App öffnet anschliessend den Abschnitt «Einflussfaktoren», damit
  diese drei Fragen neu beantwortet werden können.
- Bei älteren Ergebnislinks (Schema 1) werden ebenfalls nur diese drei Antworten
  verworfen; alle anderen weiterhin gültigen Angaben bleiben nutzbar.
- Unbekannte Schema-Versionen werden abgelehnt.

So wird weder aus einem früheren «Ja» fälschlich eine aktuelle medizinische
Risikoeinschätzung noch aus früherem Familienwissen ein Wissen über persönlich
passende Vorsorge abgeleitet.

## 5. Kardiovaskuläres Muster und Vorsorgeempfehlungen

Das kardiovaskuläre Antwortmuster ist eine **heuristische Priorisierungsregel**, kein
klinischer Risikorechner. Es bündelt mehrere in der App erhobene Faktoren:

| Faktor | Mustergewicht |
|---|---:|
| Bekannter Bluthochdruck | +2 |
| Blutdruck unbekannt | +0,5 |
| Aktuelles Rauchen | +2 |
| Körperprofil, Signalstärke `mittel` | +1,5 |
| Körperprofil, Signalstärke `tief` | +0,5 |
| 9 Stunden oder mehr Sitzen | +1 |
| Sehr niedrige Aktivität | +1 |
| Ernährungsscore unter 45 | +1 |
| Höchste Alkoholfrequenz | +1 |

Ab 3 kann der kardiovaskuläre Vorsorge-Check als zentraler Hebel erscheinen. Eine
offene professionelle Risikoeinschätzung erhöht die Handlungspriorität und bestimmt
die Formulierung des nächsten Schritts, ist aber kein zusätzlicher klinischer
Risikokoeffizient.

Die breite Familienfrage zählt nicht als Zahl in dieses Muster, weil sie auch
Diabetes, Krebs und andere erblich bedingte Erkrankungen umfasst. Sie bleibt als
eigenständiges medizinisches Vorsorgethema sichtbar. Nur eine später fachlich
differenzierte Frage zu vorzeitigen Herz-Kreislauf-Erkrankungen könnte als eigener
Kardiofaktor validiert werden.

Wenn der Kardio-Check das Körperprofil bereits mit persönlichem WHtR- oder BMI-Wert
erklärt, wird keine zweite Körperprofilkarte erzeugt. Bekannter Bluthochdruck und der
allgemeine Vorsorgebedarf können ebenfalls durch die umfassendere Karte abgedeckt
werden. Ein unabhängiger Rauchstopp-Hebel darf wegen seiner hohen Priorität daneben
sichtbar bleiben.

## 6. Zentrale Empfehlungsgruppen nach Dimension

Die folgende Übersicht nennt die produktrelevanten Triggergruppen. Die exakten
Antwortbedingungen und Prioritätszahlen bleiben in `recommendations.js` verbindlich.

### 6.1 Einflussfaktoren

| Thema | Typische Auslöser | Ergebnisrichtung |
|---|---|---|
| Kardiovaskulärer Vorsorge-Check | Mehrfaktorenmuster ab Schwelle 3 | Professionelle Gesamteinordnung priorisieren. |
| Blutdruck | Bekannt oder unbekannt | Behandlung/Verlauf beziehungsweise Messung klären. |
| Familiengeschichte | `familie_hk` ja, teilweise oder unbekannt | Familienangaben konkretisieren und fachlich besprechen. |
| Risikoeinschätzung | Nicht erfolgt, veraltet oder unklar | Persönliches Risiko professionell beurteilen beziehungsweise Aktualität prüfen. |
| Vorsorgewissen | Nur teilweise oder nicht vorhanden | Orientierung und Gesprächsvorbereitung anbieten. |
| Rauchen | Gelegentlich oder regelmässig | Rauchstopp mit hoher Priorität. |
| Alkohol | Erhöhte Häufigkeitsstufen | Konsum reflektieren und reduzieren. |
| Sitzen | 9 Stunden oder mehr | Sitzzeit unterbrechen und Alltagsbewegung erhöhen. |
| Stabilität | Unsicher oder sehr unsicher | Gleichgewicht/Sturzprävention, altersabhängig höher priorisiert. |
| Social Media | Oft oder sehr oft | Bewusste Nutzung; bei Schlafmuster mit Abendroutine bündeln. |
| Körperprofil | WHtR-/BMI-Signal | Messwert fachlich einordnen; als Kontext, nicht als pauschalen Therapieplan behandeln. |
| Untergewicht | BMI unter 18,5 | Ursachen beziehungsweise Verlauf professionell klären; kein Standardplan. |

### 6.2 Körperliche Fitness

| Thema | Typische Auslöser | Ergebnisrichtung |
|---|---|---|
| Bewegungseinstieg/Ausdauer | WHO-Ziel nicht erreicht, sehr geringe Aktivität | Niedrigschwelliger Einstieg oder Ausdaueraufbau. |
| Kraft | Wenig Krafttraining, erschwertes Tragen oder tiefer auswertbarer Krafttest | Regelmässiges Krafttraining; bei Testbezug sicherer Retest. |
| Balance/Funktion | Erschwertes Aufstehen oder tiefer auswertbarer Einbeinstand | Balance und funktionelle Kraft trainieren. |
| Alltagskondition | Deutliche oder sehr starke Atemnot beim Treppensteigen | Belastbarkeit schrittweise aufbauen; Sicherheitshinweise bleiben vorrangig. |

### 6.3 Ernährung

| Thema | Typische Auslöser | Ergebnisrichtung |
|---|---|---|
| Zuckergetränke | Vier- bis sechsmal wöchentlich oder täglich | Häufigkeit reduzieren; bei Körperprofil mit kurzem Zusatzkontext. |
| Stark Verarbeitetes | Fast täglich oder mehrmals täglich | Anteil schrittweise reduzieren. |
| Protein | Selten oder manchmal über den Tag verteilt | Regelmässige Proteinquellen einplanen; Alter beeinflusst Priorität/Text. |
| Pflanzenvielfalt | Unter 18 verschiedene pflanzliche Lebensmittel | Vielfalt schrittweise erhöhen. |
| Omega-3 | Nie | Geeignete Quellen prüfen. |
| Sättigung | Nie, selten oder manchmal | Mahlzeitenstruktur als Kontext verbessern; scorefrei. |

### 6.4 Schlaf

| Thema | Typische Auslöser | Ergebnisrichtung |
|---|---|---|
| Medizinische Schlafabklärung | Massive Alltagsbeeinträchtigung | Abklärung vor allgemeinen Optimierungstipps. |
| Schlafdauer | Weniger als 7 Stunden | Dauer schrittweise stabilisieren. |
| Schlafrhythmus | Unregelmässig oder sehr unregelmässig | Regelmässigere Zeiten etablieren. |
| Bildschirm am Abend | Hohe Social-Media-Nutzung plus ungünstiger Schlafrhythmus/-qualität | Ein gemeinsamer Abendroutinen-Hebel statt zweier Karten. |
| Schlafqualität | Schlechte Qualität oder relevante Alltagswirkung | Ursachen beobachten und passende nächste Schritte wählen. |

### 6.5 Mentales Wohlbefinden

| Thema | Typische Auslöser | Ergebnisrichtung |
|---|---|---|
| Unterstützung | Schwere mentale Konstellation | Kritische Unterstützung mit Vorrang. |
| Stresskompetenz | Tiefe Belastbarkeit, Selbstwirksamkeit oder Bewältigung | Konkrete Unterstützung und Bewältigungsstrategien. |
| Selbstfürsorge | Wenig Ruhe und Erholung | Kleine Erholungsfenster etablieren. |
| Verbundenheit | Geringe soziale Einbindung | Kontakt und Unterstützung stärken. |
| Sinn/Zukunft | Tiefe Sinnhaftigkeit oder Zuversicht | Reflektierende und professionelle Ressourcen anbieten. |

## 7. Textquellen und Sprachinvarianz

Die Entscheidungslogik enthält keine sichtbaren deutschen Sätze. Sie arbeitet mit
stabilen IDs wie `ei_familie`, `lv_kardio` oder `recommendation.signal.vorsorge.*`.
Die sichtbaren Texte liegen im Content-Katalog:

- Deutsch bildet die kanonische Struktur;
- EN, FR und IT enthalten vollständige Overlays derselben IDs;
- Platzhalter wie persönliche Messwerte werden für alle Sprachen mit demselben
  Variablenvertrag eingesetzt;
- `result-content.js validate` prüft fehlende IDs, Metadaten und Platzhalter;
- `result-content.js check` prüft, ob Bundle, CSV, Markdown und Manifeste dem
  kanonischen Stand entsprechen;
- die i18n-Regressionstests sichern, dass Fragen, Antwortwerte, Scores, Signale,
  Empfehlungen und Prioritäten in allen Sprachen identisch bleiben.

Eine Übersetzung darf daher nur Wortlaut und sprachspezifische Formatierung ändern,
nicht Auslöser oder Gewicht. Inhaltliche Änderungen werden in den deutschen
kanonischen JSON-Dateien und allen drei Sprach-Overlays gemeinsam gepflegt; das
Runtime-Bundle und die Exporte werden anschliessend generiert.

## 8. Änderungs- und Freigaberegeln

Änderungen an Auslösern oder Empfehlungstexten benötigen mindestens:

1. fachliche Begründung und benannte Eigentümerschaft;
2. Abgleich von Frage, Signal, Lever, Empfehlung und 4-Wochen-Plan;
3. Prüfung typischer Einzel- und Kombinationsprofile;
4. Regressionstests für Priorisierung und Deduplizierung;
5. identische funktionale Verträge in DE, EN, FR und IT;
6. Aktualisierung von `SCORING_MODELL.md`, `QUELLEN.md`, dieser Übersicht und – bei
   offenen Freigaben – `GO_LIVE_CHECKLIST.md`;
7. medizinische, Product-, Marketing- und sprachliche Freigabe vor Go-live.

Die App bleibt eine präventive Orientierung. Weder ein Signal noch eine Empfehlung
beweist eine Erkrankung, legt eine individuelle Untersuchungsfrequenz fest oder
ersetzt eine professionelle Beurteilung.
