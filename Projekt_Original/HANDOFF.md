# Projektübergabe: Helsana Gesundheitscheck

**Stand:** 28. Juli 2026
**Zweck:** Vollständige Übergabe des aktuellen Arbeitsstands für die weitere Projektarbeit.
**Wichtig:** Diese Datei beschreibt den Ist-Stand. Bei Widersprüchen sind der getestete Code, die kanonischen Content-Dateien und die Regressionstests massgebend.

## 1. Kurzfassung für die Weiterarbeit

Der Gesundheitscheck ist eine statische, build-freie Helsana-Webanwendung aus HTML,
CSS und Vanilla JavaScript. Er unterstützt DE, EN, FR und IT, läuft grundsätzlich
direkt über `file://`, kann statisch über GitHub Pages publiziert werden und speichert
Antworten ausschliesslich lokal im Browser. Aus sechs Fragebogenabschnitten entstehen
fünf gleichgewichtete Dimensionsscores, ein Gesamtwert, separate Risikosignale,
konkret priorisierte persönliche Stärken, personalisierte Empfehlungen, drei
priorisierte nächste Schritte, 4-Wochen-Pläne und eine lokale regelbasierte
Coach-Vorschau.

Der aktuelle Branch enthält einen grossen zusammenhängenden Änderungssatz. Er umfasst
insbesondere das überarbeitete Scoring- und Empfehlungssystem,
den vollständigen Vier-Sprachen- und Content-Workflow, Accessibility-Härtungen,
Dokumentation sowie acht neu generierte Messillustrationen. Diese Änderungen dürfen
nicht durch Reset, Checkout oder eine vermeintliche «Bereinigung» verloren gehen.

Aktueller Teststand:

- Content-Validierung: erfolgreich, vier Sprachen mit je 1'213 Texten;
- Artefakt-Check: erfolgreich;
- 185 von 185 Einzeltests erfolgreich;
- alle Tests zu Scoring, Empfehlungen, I18n, Content, Security,
  Accessibility, Illustrationen und Lifecycle sind grün.

## 2. Arbeitsordner, Git und Veröffentlichung

### Pfade

- Workspace: `/Users/stefandris/Desktop/Health-Navigator-Codex`
- App: `/Users/stefandris/Desktop/Health-Navigator-Codex/Projekt_Original`
- Git-Repository: Workspace-Wurzel
- Remote: `https://github.com/stefandris83/health-navigator.git`
- Aktueller Branch: `codex/whtr-primary-scoring`
- Tracking-Branch nach Veröffentlichung: `origin/codex/whtr-primary-scoring`
- Ausgangs-HEAD vor diesem Änderungssatz: `871da45 Merge pull request #14 from stefandris83/codex/red-gradient-checkmark-icon`
- Öffentliche GitHub-Pages-Adresse: `https://stefandris83.github.io/health-navigator/`

Der Workflow `.github/workflows/deploy-pages.yml` läuft bei Änderungen unter
`Projekt_Original/**` auf `main`, führt alle Content- und Testprüfungen aus und
veröffentlicht nur die Runtime-Dateien (`index.html`, `quellen.html`, Manifeste,
`assets`, `css`, `js`). Dokumentation, Tests, Content-Quelldateien und Marketing-
Exporte werden nicht als Website ausgeliefert.

### Umfang des Änderungssatzes

Der aktuelle Änderungssatz ersetzt die früheren geschlechtsspezifischen absoluten
Taillenschwellen durch das geschlechtsneutrale Taille-Grösse-Verhältnis, vereinheitlicht
Score, Signal, Empfehlung und Ergebnistext, integriert das Körperprofil ohne separate
blaue Metrikbox entscheidungsnah in die Empfehlungen und behandelt einen möglichen
Muskelmassen-Kontext des BMI defensiv. Aktualisiert sind alle vier Sprachen,
Regressionstests, Quellen, Marketing-Exporte sowie die Scoring-Dokumentation. Bereits
veröffentlichte Illustrationen, Fitnessreferenzen und das App-Icon bleiben erhalten.

### Repository-Hygiene

`.DS_Store`-Betriebssystemartefakte werden an der Repository-Wurzel und im
App-Ordner ignoriert. Der Repository-Hygienetest ist damit grün. Es gibt keinen Ordner
`Projekt_Optimiert`, kein neu erstelltes ZIP und kein `node_modules` im Projekt.

## 3. Unverhandelbare technische Rahmenbedingungen

Bei jeder Fortsetzung gelten diese Entscheidungen:

1. Änderungen erfolgen direkt in `Projekt_Original`; keinen parallelen Projektordner
   und kein ZIP erzeugen.
2. HTML, CSS und Vanilla JavaScript beibehalten; kein Framework, kein TypeScript und
   keine unnötige Dependency einführen.
3. Für die Nutzung darf kein Build, kein lokaler Server, kein npm und kein Internet
   nötig sein. `Projekt_Original/index.html` soll direkt über `file://` funktionieren.
4. Deshalb klassische Skripte und relative Pfade beibehalten; keine lokalen ES-Module
   oder `fetch()`-Abhängigkeiten auf JSON einführen.
5. Die vorhandene Script-Reihenfolge in `index.html` ist Vertragsbestandteil und wird
   getestet.
6. Generierte Dateien niemals manuell bearbeiten. Texte zuerst in den kanonischen JSON-
   Quellen ändern und anschliessend den Generator verwenden.
7. Die CSV ist ein Review- und Austauschformat, nicht die Source of Truth.
8. Stabile Frage-IDs, Antwortwerte, Content-IDs, Storage-Schemata und öffentliche
   Integrationsschnittstellen nicht ohne Migration und Tests verändern.
9. Kundenkontext, Gesundheitsantworten und Versicherungsinformationen getrennt halten.
10. Keine Gesundheitsdaten, Scores, Produktinformationen oder Anzeigenamen loggen.
11. Migrationslogik, Fallbacks, Race-/Timeout-Schutz, Accessibility-Attribute und
    öffentliche APIs nur mit eindeutigem Nutzungsnachweis entfernen.
12. Ein Browser-, `file://`- oder visueller Test darf nur behauptet werden, wenn er
    tatsächlich durchgeführt wurde.

## 4. Architektur und zentrale Dateien

| Bereich | Datei(en) | Verantwortung |
|---|---|---|
| Einstieg | `index.html`, `quellen.html` | Statische App- und Quellenseite |
| Styling | `css/styles.css` | Helsana-Look, Responsive UI, A11y-Zustände |
| Fragen | `js/questions.js` | Bereiche, Fragen, Antwortwerte, Pflichtfelder, Zahlenlimits, Illustrationsmetadaten |
| Scoring | `js/scoring.js` | Normen, Formeln, Körperprofil, Kurztestreferenzen, Scores und Risikosignale |
| Empfehlungen | `js/recommendations.js` | Stärkenrangfolge, Empfehlungsregeln, Deduplizierung, Top 3, Pläne, Detailhinweise und Test-Retests |
| UI/Lifecycle | `js/app.js` | Rendering, Navigation, Modals, Chat, Atemübung, Ergebnisansicht, Cleanup |
| Texte Runtime | `js/result-copy.js` | Sichere `get`-/`format`-API, Locale-Gesamtfallback |
| Generiertes Textbundle | `js/result-copy.generated.js` | Eingechecktes, automatisch generiertes Vier-Sprachen-Bundle |
| Locale | `js/locale.js`, `js/page-i18n.js` | Sprachwahl, Speicherung, URL, Manifest, statische Seitenübersetzung |
| Persistenz | `js/persistence.js` | Versionierter Local-Storage- und Ergebnislinkvertrag |
| Integration | `js/config.js`, `js/integration.js` | Sichere Konfiguration und flüchtiger CustomerContext |
| Helsana-Angebote | `js/helsana.js` | Angebotsschlüssel und HTTPS-Ziele |
| URL-Sicherheit | `js/url-safety.js` | Gemeinsame HTTPS-Allowlist |
| Coach/Radar | `js/coach.js`, `js/radar.js` | Lokale Coach-Vorschau und SVG-Radar |
| Textquellen | `content/result-texts/` | Kanonische deutsche Texte und Übersetzungs-Overlays |
| Generator | `scripts/result-content.js` | Validate, Build, Export, Overview, Import, Backups und Konfliktschutz |
| Tests | `tests/*.test.js` | Fach-, Content-, I18n-, Security-, Lifecycle- und Portabilitätsverträge |
| Dokumentation | `docs/*.md` | Scoring, Integration, Textpflege, Quellen, Review, Go-live |

## 5. Ziele und Produktentscheidungen

### Grundziel

Der Check soll eine verständliche, motivierende Standortbestimmung bieten, aber keine
medizinische Diagnose oder einen validierten klinischen Risiko-/Mortalitäts-/Longevity-
Score vortäuschen. Numerischer Score und medizinisch beziehungsweise fachlich wichtige
Empfehlungen sind deshalb bewusst zwei getrennte Systeme.

### Ergebnisdarstellung

- Fünf Dimensionen: Einflussfaktoren, Körperliche Fitness, Ernährung, Schlaf und
  Mentale Gesundheit.
- Die drei priorisierten Schritte werden oben im Aktionsplan und zusätzlich in der
  fachlich passenden Dimension gespiegelt.
- Dort werden identische Überschriften und dasselbe Empfehlungsobjekt verwendet;
  dadurch entstehen keine divergierenden Textkopien.
- In den Dimensionsdetails wird auf die detaillierten 4-Wochen-Pläne im Aktionsplan
  verwiesen, statt sie vollständig zu duplizieren.
- Nicht priorisierte Quick Wins und Hinweise erscheinen in der passenden Dimension.
- Die frühere separate Sektion «Selbst beeinflussen vs. ärztlich abklären» wurde
  vollständig entfernt, weil sie inhaltlich doppelte.
- Signalhinweise verwenden einheitlich: persönliche Relevanz, konkreter nächster
  Schritt und erwarteter Nutzen.
- Von einer priorisierten Empfehlung bereits abgedeckte Signale erzeugen keine zweite
  Doppelbox.
- Der kardiovaskuläre Vorsorge-Check bündelt Blutdruck/Vorsorge, unterdrückt aber nicht
  pauschal eigenständige nicht-kardiovaskuläre Familienhinweise.
- Scorefreie Angaben zu familiären Erkrankungen und fehlender Risikoeinschätzung
  besitzen eigene Haupthandlungshebel. Treffen beide zu, bündelt die spezifischere
  Familienkarte den generischen Vorsorgehinweis, ohne den Score zu verändern.
- Untergewicht und ein auffälliges Körperprofil werden in «Grösste Handlungsfelder»
  sichtbar, erzeugen aus Einzelmessungen aber bewusst keinen pauschalen Therapieplan.
  Ein eigener Klärungszustand erklärt den fehlenden 4-Wochen-Plan widerspruchsfrei.
- BMI, Taillenumfang und WHtR stehen nicht mehr in einer separaten blauen Box im
  Dimensionskopf. Der persönliche Körpermarker erscheint stattdessen im
  Körperprofil-Handlungsfeld oder konkret im ausgelösten kardiovaskulären
  Vorsorge-Check; der bereits abgedeckte Signalhinweis wird dedupliziert.
- Ein ungünstiger Körpermarker kann bei der ersten ohnehin ausgelösten passenden
  Empfehlung in Fitness, Ernährung, Schlaf oder Mentalem einen kurzen Zusatzbezug
  erhalten. Er erzeugt in diesen Dimensionen selbst keine Empfehlung, kein Defizit
  und keinen Scoreabzug.
- Häufiges Krafttraining, erreichtes Bewegungsziel und gute auswertbare Krafttests
  wählen bei einem BMI-Signal nur eine vorsichtige Muskelmassen-Textvariante. Die
  Tests messen keine Körperzusammensetzung; Score, Signal und Abklärungsbedarf bleiben
  deshalb unverändert.
- Eine grüne Erfolgsmeldung erscheint nicht allein aufgrund einer positiven Einzelantwort,
  wenn der Dimensionsscore nur «Ausbaufähig» ist.
- Allgemeine positive Einordnungen und grüne Detailtexte wurden sprachlich entdoppelt.
- Die Stärkenkarte priorisiert breit belegte Fähigkeiten und erreichte Ziele vor
  einzelnen Schutzmerkmalen. «Sehr starke körperliche Fitness» steht nur bei
  Fitnessscore ab 90, erreichtem WHO-Bewegungsziel, auswertbaren Top-Kurztests für
  Muskulatur und Balance, ausschliesslich starken zusätzlich ausgefüllten
  auswertbaren Kurztests sowie ohne offenen Fitness- oder Stabilitäts-/Sturz-
  Handlungsbedarf an erster Stelle.
  Das WHO-Ziel bleibt im zusammengefassten Detailtext ausdrücklich sichtbar.
- «Rauchfrei» wurde nicht entfernt: Es bleibt ein Schutzfaktor und Füllkandidat,
  verdrängt bei einem breit starken Profil aber nicht mehr Fitness, Schlaf,
  mentale oder ernährungsbezogene Mehrfachmuster.

### Wesentliche sichtbare Textentscheidungen

- Produktname in der Oberfläche: **Gesundheitscheck** statt
  «Gesundheitsschutz-Check».
- Dimension: **Mentale Gesundheit** statt «Mentale und emotionale Gesundheit».
- Chat-Titel: «Haben Sie Fragen? Der Helsana Digital Coach ist für Sie da.»
- Solide-Hero: «Vieles ist bereits gut aufgestellt» statt «Vieles trägt bereits».
- Interne Begriffe wie «Navigator-Referenzmodell» wurden aus sichtbaren Texten entfernt.
- Alle redaktionellen Texte müssen über den zentralen Content-Workflow gepflegt werden.

## 6. Implementiertes Scoring-Modell

Die vollständige verbindliche Beschreibung steht in `docs/SCORING_MODELL.md`. Die
massgebende Implementierung liegt in `js/scoring.js`, das Fragenschema in
`js/questions.js`, das Empfehlungssystem in `js/recommendations.js`.

### Grundskala und Gesamtwert

- Interne Normskala grundsätzlich −2, −1, 0, +1, +2.
- Umrechnung: `round(((Norm + 2) / 4) * 100)`.
- Statusbänder: 80–100 Stark, 60–79 Solide Basis, 40–59 Ausbaufähig,
  0–39 Erhöhte Aufmerksamkeit.
- Die fünf Dimensionen zählen numerisch je 20 %.
- Schutzregel: Liegt eine Dimension unter 40, kann der sichtbare Gesamtstatus höchstens
  «Solide Basis» sein; die Gesamtzahl selbst bleibt unverändert.

### Einflussfaktoren

Gleichgewichteter Mittelwert aus sieben Bestandteilen: Stabilität, Sitzzeit,
Familienwissen, Rauchen, Alkohol, Social Media und Körperzusammensetzung.

- Aktuelles Rauchen mit −2 oder ein Körperprofil mit −2 deckelt die Dimension bei 50.
- Körperzusammensetzung nutzt ein einziges zentrales Profil für Score, Signal und
  kardiovaskuläres Muster.
- Bei Taille und Grösse wird geschlechtsübergreifend WHtR verwendet: < 0,50 +2,
  0,50 bis < 0,60 Norm 0 mit tiefem Signal, ab 0,60 −2 mit mittlerem Signal.
- Bei Erwachsenen mit BMI ≥ 35 ist der BMI trotz Taillenangabe die Grundlage; ohne
  Taillenangabe ist er ebenfalls der Fallback. Im ersten Fall wird der Quotient nur
  angezeigt und nicht zusätzlich gescort.
- WHtR < 0,40 wird nicht über das höchste Band hinaus belohnt; bei gleichzeitigem
  Untergewicht bleibt der Körperbaustein neutral und das Untergewichtssignal separat.
- Im heuristischen kardiovaskulären Muster zählt ein Körperprofil mit Signalstärke
  `tief` +0,5 und mit `mittel` +1,5. Erreicht das Gesamtmuster die Schwelle 3,
  nennt der Vorsorge-Check den persönlichen WHtR-/BMI-Wert samt Einordnung.
- Vorsorge, bekannte Familienerkrankungen und Bluthochdruck sind scorefrei, können
  aber wichtige medizinische Signale, Haupthandlungsfelder und Empfehlungen auslösen.

### Körperliche Fitness

Obergewichtung im Fitnessscore:

- Kondition 40 %;
- Muskulatur 40 %;
- Balance/Funktion 20 %.

Implementierte 80/20-Verbesserungen:

- Moderate und intensive Aktivität sind alternative/komplementäre Wege zum Ziel.
  Es wird das bessere Normergebnis als gemeinsames Aktivitätskomposit verwendet;
  Treppenbelastung bleibt der alltagsnahe Gegenpart.
- Wandsitz zählt zur lokalen Bein-Kraftausdauer und damit zur Muskulatur, nicht zur
  Kondition.
- Liegestütz und Wandsitz teilen sich bei Anwendbarkeit die Testhälfte der Muskulatur.
- Einbeinstand teilt sich bei Anwendbarkeit den Balanceblock mit dem Aufstehen vom Boden.
- Ausgelassene optionale Tests werden nicht als null oder schlecht gewertet.
- Rohwerte bleiben sichtbar, selbst wenn der Referenzvertrag nicht anwendbar ist.
- Mindestalter für den Check: 16 Jahre. Jüngere Alterswerte werden verworfen.
- Bei 16- und 17-Jährigen bleiben Testwerte reine Rohwerte ohne Referenzstufe, Score-
  Einfluss oder automatische Empfehlung.
- Einbeinstand ist von 18 bis 99 scorewirksam und deckt Alter 94 direkt ab.
- Beim Liegestütz gilt für alle Geschlechter dasselbe Standardprotokoll von den Zehen.
  Frauen werden von 18 bis 24 anhand der kleinen direkten Adams-Skala, von 25 bis
  65 praktisch und von 66 bis 94 modelliert eingeordnet; Männer von 20 bis 69
  direkt und von 70 bis 94 modelliert.
- Wandsitz ist von 18 bis 94 für weiblich/männlich scorewirksam; die älteren Bänder
  sind Trainingsorientierungen. Für Intersex fehlt eine passende Referenzgruppe.
- Einbeinstand und Wandsitz akzeptieren Eingaben bis 1'000 Sekunden. Der Rohwert wird
  bis 1'000 angezeigt; eine Bewertungsobergrenze darf den sichtbaren Wert nicht kappen.
- Tiefe, fachlich vergleichbare Tests führen zur passenden Kraft- oder Balanceempfehlung.
- Wenn diese Empfehlung in den Top 3 liegt, enthält Woche 4 einen persönlichen Retest
  mit Ausgangswert und sicherem Vergleichshinweis.

### Ernährung

- Gleichgewichteter Mittelwert aus Protein, Pflanzenvielfalt, stark verarbeiteten
  Lebensmitteln, Omega-3 und Zuckergetränken.
- Die Sättigungsfrage ist ein Kontext- und Empfehlungsgegencheck, aber **kein** sechster
  Scorebestandteil und **kein** harter Scoredeckel.
- Die Proteinfrage bleibt ein transparenter Häufigkeits-/Verteilungsindikator und kein
  Nachweis einer bedarfsgerechten Proteinmenge.

### Schlaf

- Gleichgewichteter Mittelwert aus Schlafqualität, Schlafdauer und Schlafrhythmus.
- Alltagsbeeinträchtigung wirkt abgestuft:
  - «spürbar» deckelt bei 75;
  - «deutlich» oder «massiv» deckelt bei 50;
  - «massiv» erzeugt zusätzlich ein medizinisches Signal mittlerer Schwere.

### Mentale Gesundheit

- Acht Aussagen werden gleichgewichtet.
- Ein gemeinsamer Vertrag steuert sowohl das hohe medizinische Signal als auch den
  Scoredeckel bei 50.
- Schwere Konstellation: Belastbarkeit, Coping oder Selbstwirksamkeit = −2; oder
  Sinnhaftigkeit = −2 zusammen mit positiven Emotionen = −2.

### Kardiovaskuläres Antwortmuster

- Das Muster priorisiert bei mehreren Faktoren einen Vorsorge-Check; es ist kein
  validierter Risikorechner.
- Faktoren: Bluthochdruck, unbekannter Blutdruck, Rauchen, deutliches Körperprofil,
  lange Sitzzeit, sehr geringe Aktivität, tiefer Ernährungsscore und höchste
  Alkoholfrequenz.
- Die breite Familienfrage zählt bewusst nicht in dieses Muster, weil sie auch Diabetes
  und andere erbliche Erkrankungen umfasst. Sie bleibt ein eigenständiges Signal.

## 7. Empfehlungssystem

Das Empfehlungssystem ist bewusst vom numerischen Score getrennt.

- Katalog und Bedingungen liegen in `js/recommendations.js`.
- Jede Empfehlung besitzt stabile ID, Dimension, Bedingung, Impact, Dringlichkeit,
  Umsetzbarkeit, Deduplizierungsthema und gegebenenfalls Angebot/Sicherheitsflag.
- Normale Priorität: `2.2 * impact + 2.6 * urgency + 1.2 * ease`.
- Kritische Empfehlungen erhalten starken technischen Vorrang.
- Auswahl der Top 3: kritische Hinweise, Haupthandlungshebel, Katalogauffüllung,
  Themendeduplizierung und grundsätzlich Dimensionsvielfalt.
- Ein zweiter Hebel derselben Dimension ist bei sehr hoher Priorität oder als
  eigenständiger scorefreier/`summaryOnly`-Klärungshinweis zulässig; ein dritter
  ist in Summary und Aktionsplan ausgeschlossen. Dadurch bleibt ein Kardio-Check
  bei Bluthochdruck plus Rauchen sichtbar, ohne andere Dimensionen zu verdrängen.
- `lv_untergewicht` und `lv_koerperprofil` sind dokumentierte `summaryOnly`-Regeln:
  sichtbare Einordnung ja, standardisierter 4-Wochen-Plan aus Einzelwerten nein;
  die Oberfläche zeigt dafür einen eigenen fachlichen Klärungszustand.
- `topThree` ist aus Kompatibilitätsgründen ein getesteter Alias von `actionPlan`.
- Pläne sind zentral in `PLANS`; es gibt keine verstreuten Inline-Pläne im Katalog.
- Persönliche Stärken werden getrennt vom Aktionsplan nach Aussagebreite,
  Dimensionsscore, Fachgewicht und stabiler Katalogreihenfolge sortiert. Es bleibt
  bei höchstens drei Karten und grundsätzlich einer Stärke pro Dimension.
- Die mehrquellenbasierte Fitness-Topstärke verlangt zwei unterschiedliche
  scorebare Testkomponenten und ausschliesslich Topwerte unter allen zusätzlich
  ausgefüllten auswertbaren Kurztests. Nicht passende Alters-, Geschlechts- oder
  Protokollreferenzen sowie offene Fitness- oder Stabilitäts-/Sturzfelder sperren sie.
- Die überarbeiteten Scores benötigten keine separate pauschale Umschreibung aller
  Empfehlungstexte. Angepasst wurden nur Texte/Varianten, deren fachliche Aussage sich
  konkret geändert hatte, etwa Aktivitätskomposit, Wandsitz, Fitness-Retests,
  Körperzusammensetzung, Familien-/Kardioabgrenzung und Protein.

## 8. Wissenschaftlich/fachlich bereits präzisierte Inhalte

- Wandsitz wird als lokale statische Kraftausdauer der Beinmuskulatur beschrieben.
- Die sichtbare Wandsitz-Einordnung nutzt eine geglättete vierstufige
  Trainingsorientierung aus harmonisierten Referenzwerten, nicht den Anspruch einer
  klinischen Diagnosegrenze.
- Fitness-Kurztests zeigen Rohwert, einheitliche Statusbegriffe, Bedeutung,
  gesundheitliche Relevanz und gegebenenfalls die nächste Orientierung. Methoden-
  und Aussagegrenzen bleiben in `docs/QUELLEN.md` und `docs/SCORING_MODELL.md`
  dokumentiert, nicht als zusätzliche blaue Box in der Kurztestkarte.
- Muskelkraft wird als relevanter Indikator für Belastbarkeit, Mobilität und gesundes
  Altern eingeordnet, ohne aus einem Einzeltest ein persönliches Erkrankungsrisiko
  abzuleiten.
- Protein: Im Krafttrainingskontext werden 1,4–1,6 g/kg/Tag als Orientierung genannt;
  2,0 g/kg/Tag nur als konditionaler Spielraum etwa bei hoher Belastung,
  Energiedefizit oder zunehmendem Alter. Minderjährige und medizinische Kontexte
  werden defensiv behandelt.
- Taillenumfang und der daraus berechnete WHtR werden persönlich und normalerweise
  auf zwei Dezimalstellen eingeordnet; nahe einer Grenze bleiben zusätzliche Stellen
  sichtbar. Der Wert erscheint entscheidungsnah im Handlungsfeld oder Vorsorge-Check
  statt als separate blaue Metrikbox oder pauschal grüne Quick-Win-Box.
- Quellen, Grenzen und offene medizinische Entscheide stehen in `docs/QUELLEN.md`
  und `docs/GO_LIVE_CHECKLIST.md`.

## 9. Content- und Marketing-Workflow

### Source of Truth

- Deutsch: `content/result-texts/*.json` mit sieben Domains.
- EN/FR/IT: vollständige schlanke Overlays unter
  `content/result-texts/locales/{en-CH,fr-CH,it-CH}/`.
- Aktuell je Sprache 1'213 IDs.
- Das generierte Runtime-Bundle `js/result-copy.generated.js` wird eingecheckt, damit
  `file://` ohne Build funktioniert.

### Vier-Sprachen-Vertrag

- Exakt `de-CH`, `en-CH`, `fr-CH`, `it-CH`.
- IDs, Fragewerte, Scores, Signale und Empfehlungsauswahl sind sprachinvariant.
- `?lang=` hat Vorrang vor der separat gespeicherten Locale.
- Sprachwechsel bewahrt Fragebogen-/Ergebniszustand und die Route zur Quellenseite.
- Ein unvollständiges Zielbundle erzeugt keine Mischsprache: Der ganze Seitenaufruf
  fällt geschlossen auf das vollständige deutsche Notfallbundle zurück.
- Der Übersetzungsvertragshash bindet Text, Platzhalter, Reviewmetadaten, `section`
  und `context`.
- Die zuletzt gewählte Sprache bleibt auch beim PWA-Start massgeblich; ältere
  sprachgebundene Icons sollen sie nicht überschreiben.
- EN/FR/IT sind KI-gestützte Erstübersetzungen und bleiben `needs-review`, bis
  muttersprachliche, medizinische und rechtliche Freigaben erfolgt sind.

### Marketing-Dateien

- Bevorzugte menschliche Lesefassung:
  `exports/result-texte-uebersicht-<locale>.md`.
- Editierbares Rückspiel-Format:
  `exports/result-texte-<locale>.csv`.
- Marketing/Medizin/Recht schreiben Textänderungen in `Neuer Text` und können
  `Freigabestatus` und `Review-Kommentar` pflegen.
- `Prüfhinweis`, IDs, Hashes und übrige Metadaten sind geschützt.
- Ein leeres Feld `Neuer Text` bedeutet unverändert.
- CSV immer vollständig zurückgeben; keine ausgeblendeten Zeilen löschen.
- Vor Import immer Dry Run; bei echtem Import mit Änderungen entsteht automatisch
  eine Sicherung unter `exports/import-backups/`.
- Ein erfolgreicher Import aktualisiert JSON, Bundle, CSV, Markdown und Manifest
  gemeinsam und rollt Mehrdateienfehler zurück.

### Wichtigste Befehle

```bash
cd /Users/stefandris/Desktop/Health-Navigator-Codex/Projekt_Original
node scripts/result-content.js validate
node scripts/result-content.js check
node scripts/result-content.js overview --all
node scripts/result-content.js export --all
node scripts/result-content.js review-report --all
node scripts/result-content.js import exports/result-texte-review.csv --dry-run
node scripts/result-content.js import exports/result-texte-review.csv
```

`docs/TEXTPFLEGE.md` ist die vollständige Arbeitsanleitung.

## 10. Integration, Datenschutz und Security

- Drei Modi: `mock`, `live`, `anonymous`.
- Produktion muss explizit `live` oder `anonymous` setzen.
- `anonymous` ist eine harte Grenze: Bootstrap, Adapter und direkter Kontext werden
  ignoriert.
- `?kunde=` aktiviert Demo-Kontext ausschliesslich im Mock-Modus.
- CustomerContext wird validiert, begrenzt, eingefroren und niemals persistiert.
- Gesundheitsantworten werden nicht an den CustomerContext-Adapter übergeben.
- Timeout, Abort, verspätete Antworten, Adapterwechsel und Logout-Races sind getestet.
- Local Storage ist versioniert, sanitisiert und läuft standardmässig nach 90 Tagen ab.
- Ergebnislinks sind codiert, nicht verschlüsselt.
- Im Standalone-Mock sind lokale, pfadgebundene `file://`-Links möglich.
- In `live`/`anonymous` ist Erstellung ohne explizites Override deaktiviert und auf
  sichere HTTPS-Basen begrenzt.
- Bestehender gültiger Linkimport kann separat deaktiviert werden.
- Dynamische URLs durchlaufen eine gemeinsame HTTPS-Allowlist; `javascript:`, `data:`,
  Zugangsdaten und unsichere Protokolle werden blockiert.
- Dynamische Texte werden escaped; die Content-API bleibt fail-fast.
- Ein schmaler Render-Guard zeigt bei fehlender Text-ID oder beschädigtem Bundle einen
  katalogunabhängigen Reload-Zustand statt einer leeren Seite.
- Das Helsana-Logo liegt lokal als `assets/helsana-logo.svg` vor.
- Echte Helsana-Angebotslinks, Coverage-Zuordnungen und Legal-Wording bleiben Go-live-
  Entscheide.

## 11. Accessibility, Lifecycle und mobile Nutzung

Bereits implementiert und getestet:

- vollständige Pfeiltastensteuerung für eigene Radio-Gruppen nach Roving-Tabindex-
  Muster;
- korrekte `aria-invalid`-/Fehlerzustände und Pflichtfeldnavigation;
- Fokusmanagement bei Vor/Zurück, Bearbeiten und Modals;
- strikte Modal-Hintergrundisolation mit `inert` und `aria-hidden`, Fokusfalle,
  Escape-Schliessung und Zustandswiederherstellung;
- App-Modal statt nativem Browser-`confirm()` bei «Neu beginnen»;
- Cleanup von Atemübung, Chat, Radar, Score-Animation und Timern bei erneutem Rendern;
- Hilfstexte und kleine Badges erreichen technisch mindestens WCAG-AA-Kontrast 4,5:1;
- mobiles Ergebnislayout nutzt die Kartenbreite besser;
- Gesundheitsberatungs-Telefonnummer bleibt auf einer Zeile;
- lokales PWA-Icon mit dem roten Verlauf der Startkachel und weissem Checkmark als
  SVG, Android-PNGs und Apple-Touch-Icon;
- vier sprachspezifische Manifeste plus deutscher Kompatibilitätsalias.

## 12. Messillustrationen

Neu generiert und in den Fragehilfen eingebunden sind je eine männliche und weibliche,
dezente Graustufenillustration für:

- Taillenumfang;
- Einbeinstand;
- Liegestütz;
- Wandsitz.

Technischer Vertrag:

- lokale quadratische 1024×1024-PNGs unter `assets/illustrations/`;
- Auswahl anhand der Geschlechtsangabe;
- Intersex verwendet wie beauftragt die weibliche Illustration;
- ohne Geschlechtsangabe wird standardmässig die weibliche Illustration gezeigt;
- eigenständige Einbindung unter Eingabefeld, Einheit, Fehler- und Optionalhinweis;
- der aufklappbare hellblaue Hilfetext enthält kein Bild mehr;
- dekoratives `alt=""`, `aria-hidden="true"`, da der benachbarte übersetzte Text die
  Technik beschreibt;
- `loading="lazy"`, `decoding="async"`, responsive Darstellung und Graustufenfilter;
- GitHub Pages kopiert den gesamten Assets-Ordner rekursiv.

Die Bilder wurden einzeln visuell geprüft. Eine erste weibliche Wandsitz-Version mit
zu grossem Abstand zur Wand wurde verworfen und neu erzeugt. Die finale Version zeigt
den notwendigen Wandkontakt. Die Einbindung wurde im Fragebogen bei 1'280 px und
390 px Browserbreite interaktiv geprüft; es gab keinen horizontalen Überlauf und keine
Browserfehler.

## 13. Bereits durchgeführte Reviews und Bereinigungen

Das Projekt wurde mehrfach konservativ geprüft. Bereits umgesetzt wurden unter anderem:

- zentrale, wartbare Textquelle und deterministischer Import-/Exportworkflow;
- Render-Fehlergrenze bei Contentfehlern;
- Klartext-Invariante für verschachtelte Formatvariablen samt Test;
- Entfernung nachweislich unbenutzter Icons, CSS-Hilfsklassen, eines React-`key`-
  Überbleibsels und eines reinen Durchreichwrappers;
- Entfernung doppelter/überholter Ergebnisabschnitte und Detailkarten;
- lokale Logo- und PWA-Assets;
- robuste Ergebnislink-, Storage-, Kundenadapter- und URL-Sicherheitslogik;
- vollständige Vier-Sprachen-Parität;
- fachlich kohärentere Score-, Signal- und Empfehlungsschwellen;
- ausführliche Scoring-, Quellen-, Textpflege-, Integration-, Review- und Go-live-
  Dokumentation.

Bewusst beibehalten wurden dokumentierte öffentliche APIs, Storage-Migrationen,
Security-Fallbacks, Timeouts/Race-Schutz, `multi`-/`dontKnow`-Schemasupport,
`topThree`-Alias, Integrations-Mocks, vorbereitete Angebotsschlüssel, Rebranding-Tokens
und defensive Coach-Fallbacks, weil sie getestet oder Teil der Zielarchitektur sind.

## 14. Bewusst verworfene oder nicht umgesetzte Ansätze

- Kein grundlegendes Neugewichten aller Fragen allein aufgrund einzelner Experten-
  Positionen. Es wurden nur klar begründete, einfache 80/20-Korrekturen umgesetzt.
- Kein klinischer Herz-Kreislauf-, Mortalitäts- oder Longevity-Score.
- Keine pauschalen numerischen Abzüge für familiäre Erkrankungen, Vorsorge oder
  Bluthochdruck; Routing erfolgt über Signale und Empfehlungen.
- Keine Knie-Liegestütze im Kurztest: Anleitung, Bewertung und Retest verwenden für
  Frauen und Männer dasselbe Standardprotokoll. Praktische und modellierte
  Vergleichsreihen werden nicht als klinische Norm ausgegeben.
- Keine Referenzbewertung für 16-/17-Jährige oder unpassende Geschlechtsgruppen.
- Kein deutschsprachiger Einzeltext-Fallback innerhalb einer Zielsprache; stattdessen
  vollständiger Locale-Fallback, um Mischsprache zu verhindern.
- Kein Framework, Buildsystem, lokaler JSON-Fetch oder ES-Modulumbau.
- Keine direkte manuelle Bearbeitung generierter Dateien.
- Keine erfundenen Produkt-, Coverage-, Legal- oder internen Helsana-URLs.
- Keine Entfernung selten genutzter Integrations-, Migrations- oder Sicherheitsverträge
  ohne eindeutigen Beleg.
- Kein Umgehen der Browser-Sicherheitsrichtlinie, als der eingebettete Browser lokale
  `file://`-URLs blockierte.

## 15. Aktueller Testnachweis vom 28. Juli 2026

Ausgeführt im Ordner `Projekt_Original`:

| Befehl | Ergebnis |
|---|---|
| `node scripts/result-content.js validate` | erfolgreich; 1'213 Texte je Locale |
| `node scripts/result-content.js check` | erfolgreich; Bundle, CSV, Markdown und Manifeste aktuell |
| `node tests/content-workflow.test.js` | 42/42 |
| `node tests/integration.test.js` | 78/78 |
| `node tests/robustness.test.js` | 24/24 |
| `node tests/ui-lifecycle.test.js` | 19/19 |
| `node tests/i18n-static.test.js` | 18/18 |
| `node tests/i18n-runtime.test.js` | 4/4 |

**Gesamt aktuell: 185/185 Tests erfolgreich.**

Vollständiger Testblock:

```bash
cd /Users/stefandris/Desktop/Health-Navigator-Codex/Projekt_Original
node scripts/result-content.js validate
node scripts/result-content.js check
node tests/content-workflow.test.js
node tests/integration.test.js
node tests/robustness.test.js
node tests/ui-lifecycle.test.js
node tests/i18n-static.test.js
node tests/i18n-runtime.test.js
```

## 16. Browser- und visuelle Prüfungen: was wirklich belegt ist

Frühere Browserprüfungen über einen lokalen statischen HTTP-Server umfassten unter
anderem:

- Altersvalidierung 15/16;
- Pfeiltastensteuerung und Fokus;
- Modal-Isolation, Fokusfalle, Escape und Cleanup;
- Start in zuvor gewählter Sprache sowie DE/EN/FR/IT;
- zentrale Assessment- und Ergebnisflüsse, Radar, Pläne, Atemübung, Chat,
  Kundenprofile, Ergebnislinks, Reset und mobile Breite;
- bei diesen dokumentierten Läufen blieb die Konsole ohne relevante Fehler.

Die neue Stärkenrangfolge wurde zusätzlich mit dem starken Referenzprofil über
einen lokalen statischen HTTP-Server geprüft: Fitness stand auf Desktop sichtbar
an erster Stelle; «Rauchfrei» erschien nicht in den Top 3. Bei 390 × 844 Pixeln
war die Stärkenkarte 350 Pixel breit, ohne horizontalen Überlauf und mit lesbaren
Umbrüchen. Die Browser-Konsole blieb ohne Warnungen oder Fehler.

Der aktuelle Abschlussreview prüfte die Anwendung zusätzlich real über einen lokalen
HTTP-Server: Startseite und Ergebnisprofil in DE/EN/FR/IT, Ergebnis-Sprachwechsel,
öffnende Dimensionsdetails sowie die relevante Summary bei 390 × 844 Pixeln. Score,
Texte und Handlungsfeld blieben sprachübergreifend konsistent; es gab keinen
horizontalen Überlauf und keine Warnung oder Fehlermeldung in der Browser-Konsole.
Der WHtR-Grenzfall 86 cm bei 173 cm Körpergrösse wurde nach der finalen Korrektur
ebenfalls in allen vier Sprachen geprüft: angezeigt wurden konsistent 0.497 bzw.
0,497 und «unter 0.50» bzw. die locale-gerechte Übersetzung. Bei 390 Pixeln Breite
blieb `scrollWidth === clientWidth`; die Browser-Konsole enthielt keine Warnungen
oder Fehler.
Der direkte `file://`-Aufruf blieb durch die Sicherheitsrichtlinie des eingebetteten
Browsers blockiert; dafür ist nur der automatisierte statische Doppelklick-Vertrag
belegt, kein interaktiver Browserlauf.

Nicht vollständig belegt:

- interaktiver kompletter `file://`-Durchlauf in der aktuellen Umgebung;
- pixelgenauer visueller Vorher-/Nachher-Vergleich;
- vollständige Browsermatrix;
- Screenreader-Abnahme;
- Zoom-Abnahme bei 200/400 %;
- vollständige visuelle Prüfung der neu eingebundenen Messillustrationen im realen
  Fragebogen auf Desktop und Mobil.

Der eingebettete Browser blockierte zuletzt `file://` aufgrund seiner eigenen
Sicherheitsrichtlinie. Einzelne Bildassets wurden lokal visuell geprüft; das ist kein
Ersatz für einen vollständigen App-Smoke-Test.

## 17. Offene fachliche, rechtliche und produktive Entscheide

Die vollständige Liste steht in `docs/GO_LIVE_CHECKLIST.md`. Besonders wichtig:

### Medizin

- Medizinische Freigabe aller Schwellen, Normtabellen, Risikosignale, Notfalltexte und
  personalisierten Empfehlungen.
- Product-, Marketing- und Medizin-Freigabe der neuen Stärkenrangfolge, des
  Fitnessscore-Schwellenwerts 90 und der Formulierung «oberster
  Orientierungsbereich» in allen vier Sprachen.
- Product-, Marketing- und Medizin-Freigabe der neuen Familien-, Vorsorge-,
  Untergewichts- und Körperprofil-Hebel in DE/EN/FR/IT sowie ihrer Prioritäten.
  Besonders prüfen: Lp(a) nur konditional bei tatsächlich früher
  Herz-Kreislauf-Familiengeschichte und ApoB nur als individuelle Zusatzfrage.
- Product-, Marketing- und Medizin-Freigabe der entscheidungsnahen Körperprofil-
  Integration: persönliche WHtR-/BMI-Nennung im Kardio-Check, Zusatzbezug nur bei
  ohnehin ausgelösten Empfehlungen, +0,5/+1,5 im heuristischen Muster sowie der
  vorsichtige Muskelmassen-Kontext ohne Score-Rabatt.
- Freigabe des geschlechtsneutralen WHtR-Körpermodells, besonders für Werte unter
  0,40, für 16-/17-Jährige, nahe 0,50/0,60, bei BMI ≥ 35 und für ausgeschlossene
  Kontexte wie Schwangerschaft oder Essstörungen.
- Medizinische/Product-Freigabe der kleinen direkten Adams-Orientierung 18–24, der
  praktischen Topend-Frauenorientierung 25–65 und der modellierten
  Frauen-/Männerbänder bis 94.
- Governance-Freigabe der Wandsitz-Orientierung für ältere Personen; ab 70 sind Teile
  extrapoliert.
- Sicherheitsvertrag für maximalen Wandsitz bei bekanntem Bluthochdruck.
- Fachliche Eigentümerschaft und Versionierung des heuristischen kardiovaskulären
  Musters.
- Kalibrierung des verbleibenden Ernährungsmodells und vollständigere Alkoholerfassung.
- Entscheidung, ob die mentale Dimension ausdrücklich ein nicht-klinisches
  Ressourcenprofil bleibt oder durch ein validiertes Instrument ersetzt wird.
- Freigabe der Aussagen zu ApoB und Lp(a).

### Übersetzung, Content und Brand

- Muttersprachliche Prüfung aller EN-/FR-/IT-Texte.
- Medizinische und rechtliche Freigaben gemäss Review-Metadaten.
- Offenen Vier-Sprachen-Reviewbericht abarbeiten.
- Lokales Helsana-Logo und neu generierte Illustrationen durch Brand/Recht freigeben.
- Inhaltliche App-Texte bei Änderungen ausschliesslich über JSON/CSV-Workflow pflegen.

### Recht, Datenschutz und Integration

- Platzhalterlinks für Impressum, Datenschutz, Nutzungsbedingungen, Cookies und
  Helsana-Angebote durch freigegebene HTTPS-Ziele ersetzen.
- Coverage-Texte und Produktzuordnungen freigeben, bevor Coverage im Live-Modus
  aktiviert wird.
- Persistenzdauer von 90 Tagen und Ergebnislinkstrategie freigeben.
- Sicherstellen, dass produktive Telemetrie keine Gesundheits- oder Kundendaten erfasst.
- Zielmodus `live`/`anonymous`, Host-Adapter, BFF-Vertrag und neutrale Produktkategorien
  verbindlich integrieren.

### Hosting und Abnahme

- Ziel-Host, Unterpfad, CSP und Security-Header festlegen.
- Isolierten Origin ohne unkontrollierte Drittanbieter-Skripte bestätigen.
- Browser-/Gerätematrix, Screenreader, Zoom, Tastatur, Mobile/Desktop und alle vier
  Sprachen final abnehmen.
- Verantwortlichkeiten für Content, Medizin, Recht, Security, Betrieb und Rollback
  benennen.

## 18. Empfohlene Reihenfolge für die Weiterarbeit

1. **Nicht resetten.** Zuerst `git status` und diese Übergabe lesen.
2. Alle acht Prüfungen bei weiteren Änderungen erneut ausführen und den tatsächlichen
   Stand dokumentieren.
3. Den gesamten Diff konservativ prüfen; besonders die Illustrationen und
   `docs/SCORING_MODELL.md` dürfen bei weiteren Git-Operationen nicht fehlen.
4. Einen echten Browser-Smoke-Test der Hauptflüsse auf Desktop
   und Mobil durchführen. Wenn `file://` technisch nicht steuerbar ist, das transparent
   dokumentieren und zusätzlich manuell prüfen lassen.
5. Pull Request/Branchstatus auf GitHub prüfen und erst nach Review nach `main` mergen;
   GitHub Pages publiziert danach automatisch.
6. Medizinische, sprachliche, rechtliche und Brand-Go-live-Punkte getrennt vom
   technischen Merge abarbeiten.

## 19. Wichtige Dokumente zum Weiterlesen

- `README.md` – Architektur, Betrieb, Sprachen, Integration, Content und Tests
- `docs/SCORING_MODELL.md` – vollständiges aktuelles Score-/Signal-/Empfehlungsmodell
- `docs/TEXTPFLEGE.md` – Vier-Sprachen-Workflow für Marketing, Medizin und Recht
- `docs/INTEGRATION.md` – CustomerContext, Modi, Datenschutz und Hostvertrag
- `docs/QUELLEN.md` – wissenschaftliche Grundlagen und Aussagegrenzen
- `docs/CODE_REVIEW.md` – chronologisches Review- und Optimierungsprotokoll
- `docs/GO_LIVE_CHECKLIST.md` – noch offene fachliche, rechtliche und produktive Entscheide

## 20. Abschlussstatus dieser Übergabe

Diese Übergabe dokumentiert den vollständigen zusammenhängenden Änderungssatz mit
Code-, Content-, Asset-, Konfigurations-, Test- und Dokumentationsänderungen. Der
technische Stand ist lokal vollständig geprüft; offene medizinische, sprachliche,
rechtliche und Brand-Freigaben bleiben davon getrennte Go-live-Aufgaben.
