# Textpflege in vier Sprachen

Dieses Dokument beschreibt den sicheren Austausch aller zentral gepflegten
App-Texte in Deutsch, Englisch, Französisch und Italienisch mit Marketing,
Medizin und Recht. Der Workflow benötigt für die
Pflegebefehle nur Node.js und keine zusätzlichen npm-Pakete; die Empfehlungslogik
verändert er nicht.

## Grundprinzip

Die Verantwortlichkeiten sind getrennt:

- `content/result-texts/*.json` ist die **kanonische deutsche Struktur- und Textquelle** (`de-CH`).
- `content/result-texts/locales/{en-CH,fr-CH,it-CH}/*.json` enthält schlanke
  Übersetzungs-Overlays. Struktur, IDs, Reviewer und Kontexte werden nicht dupliziert.
- Bedingungen, Scores und Prioritäten bleiben in den JavaScript-Regeln.
- `js/result-copy.generated.js` ist ein automatisch erzeugtes Runtime-Bundle.
- `manifest.<locale>.webmanifest` und der deutsche Kompatibilitätsalias
  `manifest.webmanifest` werden aus den zentralen Installations-Texten erzeugt.
  Alle Manifeste verwenden dieselbe neutrale Startadresse; die zuletzt in der
  App gewählte und separat gespeicherte Sprache entscheidet beim Öffnen.
- `exports/result-texte-uebersicht.md` bleibt die deutsche gruppierte
  **Lesefassung**. Zusätzlich gibt es `result-texte-uebersicht-<locale>.md`.
- Eine CSV ist nur das **Austauschformat** mit Marketing, nie die Source of Truth.
- Vor jedem echten Import mit Änderungen entsteht unter `exports/import-backups/`
  eine neue, zeitgestempelte Sicherung des vorherigen Katalog- und Artefaktstands.
- `js/result-copy.js` stellt der Anwendung `get(id)` und `format(id, values)` zur
  Verfügung.

Das Runtime-Bundle wird eingecheckt. Dadurch kann die App weiterhin ohne
Build-Schritt direkt über `index.html` gestartet werden.

## Übersetzungs-Overlays und Vollständigkeit

Jede Übersetzungsdatei besitzt denselben Domain- und ID-Bestand wie Deutsch,
enthält pro Eintrag aber nur:

- `id` und den übersetzten `text`,
- sprachspezifische `requiredTerms`, `reviewStatus` und optional `reviewComment`,
- `translationState` (`missing` oder `translated`),
- `sourceContractHash` als Bindung an den deutschen Ausgangsvertrag. Dieser
  umfasst neben Text, Platzhaltern und Review-Metadaten ausdrücklich auch
  `section` und `context`.

Fehlende oder zusätzliche IDs/Domains, abweichende Platzhalter oder HTML-Tags,
unbekannte Sprachen und gemischte CSV-Sprachen werden hart abgelehnt. Es gibt
absichtlich keinen Rückfall einzelner Texte auf Deutsch. Nur ein vollständiger,
aktueller Locale-Katalog gelangt durch `validate`, `build` und `check`. Erkennt
die Runtime trotz dieser Release-Sperre ein fehlendes oder unvollständiges
Sprachbundle, wechselt der gesamte Seitenaufruf geschlossen auf das vollständige
deutsche Notfallbundle. Die gespeicherte Sprachpräferenz wird dabei nicht
überschrieben. Auch die statische Seitenkopie wird erst nach einer vollständigen
Vorprüfung geschrieben; dadurch können niemals bereits übersetzte und deutsche
HTML-Bestandteile gemischt werden. Fehlt selbst das deutsche Bundle, bleibt das
bereits im HTML vorhandene deutsche Bootstrap-Grundgerüst sichtbar.

Besitzt der deutsche Ausgangseintrag `requiredTerms`, muss auch jede fertige
Übersetzung sprachspezifische Schutzbegriffe festlegen. Dabei werden nicht
blind die deutschen Wörter kopiert, sondern die tatsächlich sichtbaren
Entsprechungen der Zielsprache geschützt. Nicht übersetzbare Werte wie
Notrufnummern, Telefonnummern, Einheiten und Platzhalter bleiben unverändert.
Eine als `translated` markierte Fassung darf diese Schutzliste nicht leer
lassen; der Import prüft anschliessend, dass jeder geschützte Wert im neuen Text
erhalten bleibt.

Die mit dieser Version bereitgestellten EN-, FR- und IT-Texte sind
**KI-gestützte Erstübersetzungen**. Sie bleiben vollständig auf
`needs-review`, bis eine muttersprachliche Prüfung und – abhängig von den
zugeordneten Reviewern – die medizinische beziehungsweise rechtliche Freigabe
erfolgt ist. Dieser allgemeine Hinweis steht einmal in jeder übersetzten
Markdown-Übersicht. Das editierbare Feld `Review-Kommentar` bleibt dagegen leer,
damit es ausschliesslich für echte Rückmeldungen der Prüfstellen zur Verfügung
steht.

Neue IDs werden sicher als unvollständige Skelette ergänzt:

```bash
node scripts/result-content.js sync-locales
# oder nur eine Sprache
node scripts/result-content.js sync-locales --locale it-CH
```

Der Befehl überschreibt keine bestehende Übersetzung. Neue Einträge enthalten
vorübergehend den deutschen Text, `translationState: missing` und
`reviewStatus: needs-review`; dadurch schlagen die Release-Prüfungen bewusst
fehl, bis der Text wirklich übersetzt und als `translated` gekennzeichnet ist.
Wenn sich der deutsche Text oder sein fachlicher Vertrag ändert, wird der
`sourceContractHash` veraltet und die Übersetzung automatisch wieder
prüfpflichtig. Ein geänderter Text darf nie automatisch als freigegeben gelten.
Beim einmaligen Wechsel auf den um `section` und `context` erweiterten Vertrag
migriert `sync-locales` ausschliesslich Hashes, die exakt dem bisherigen
Altvertrag entsprechen. Bereits fachlich veraltete Hashes bleiben unangetastet
und damit weiterhin prüfpflichtig.

## Umfang des Marketing-Exports

Der Export enthält sämtliche zentral gepflegten, sichtbaren Texte von
Startseite, Fragebogen, Ergebnissen, globaler Navigation und Quellenseite –
einschliesslich antwortabhängiger Varianten und kleiner Textfragmente:

- Ergebnis-Hero, Status, Stärken und Handlungsfelder,
- Empfehlungskarten und sämtliche 4-Wochen-Planvarianten,
- Rohwerte, Einordnungen, Evidenzgrenzen und Retest-Vorlagen der freiwilligen
  Fitness-Kurztests,
- Risikosignale, dimensionsbezogene Handlungsschritte und medizinische Klärungshinweise,
- Chat-/Coach-Texte, Angebots- und Versicherungs-Hinweise,
- Modals, Aktionen, barrierefreie Beschriftungen sowie Name und Beschreibung
  der installierbaren Web-App.

Bewusst nicht enthalten sind URLs und Entscheidungslogik. Ausgenommen ist der
minimale statische Render-/Bootstrap-Fehlertext: Er muss gerade dann funktionieren,
wenn das generierte Textbundle fehlt oder beschädigt ist. Diese Trennung hält den
Textauszug vollständig pflegbar, ohne sicherheits- oder fachkritische Logik in eine
Tabellendatei zu verlagern. Demo-Namen und neutrale Demo-Produktlabels sind als
sichtbare Testtexte enthalten. Angebots- und Quellen-URLs bleiben als strukturierte Konfiguration im
Code, damit sie nicht versehentlich als Freitext geändert werden.

Bewusste Ausnahme sind die Einträge `service.dimension.*`: Bereichstitel,
Kurzlabels und Einleitungen werden teilweise im Fragebogen **und** auf der
Ergebnisseite verwendet. Ihr Kontext ist deshalb mit `shared_quiz_and_results`
gekennzeichnet. Änderungen daran beeinflussen beide Ansichten und benötigen die
im Eintrag genannten Reviews; `service.dimension.grund.*` erscheint nur im
Fragebogen, bleibt aber aus Gründen der gemeinsamen Dimensionskonfiguration im
Katalog sichtbar.

Eigenständige Signalhinweise und medizinische Klärungshinweise werden auf der
Ergebnisseite direkt in der jeweils passenden Dimension ausgespielt. Sie verwenden
wie die Empfehlungskarten die Felder persönliche Relevanz, konkreter nächster Schritt
und erwarteter Nutzen. Ist dasselbe Thema bereits durch eine sichtbare Empfehlung
oder den priorisierten Aktionsplan abgedeckt, wird kein zusätzlicher Signalunterkasten
gerendert. Die frühere separate Einordnungssektion ist deshalb kein eigener
Textkontext mehr. Beim Review sind die Ausspielungskontexte der verbleibenden
Signaltexte entsprechend als Dimensionsdetails zu verstehen.

Die Kurztest-Texte liegen unter `ui.fitness_tests.*` und
`recommendation.fitness_test.*`. Marketing bearbeitet dort Überschriften,
Einordnungen, Relevanz-, Sicherheits- und Retesttexte. Alters-/Geschlechtsbänder,
Schwellen, Score-Gewichte und die Frage, ob eine Referenz fachlich anwendbar ist,
sind dagegen medizinische Modelllogik in `js/scoring.js` und werden nicht in
Textvarianten dupliziert. Dadurch enthält der Export jede tatsächlich verschiedene
Formulierung genau einmal statt eine Zeile pro Zahlenkombination.

## Schnellablauf

Alle Befehle werden im Projektordner `Projekt_Original` ausgeführt.

```bash
# 1. Alle vier Sprachen und alle generierten Artefakte prüfen
node scripts/result-content.js validate
node scripts/result-content.js check

# 2. Alle Lesefassungen und editierbaren Auszüge erzeugen
node scripts/result-content.js overview --all
node scripts/result-content.js export --all

# 3. Zurückerhaltene Datei prüfen, ohne etwas zu ändern
node scripts/result-content.js import exports/result-texte-review.csv --dry-run

# 4. Nach Prüfung übernehmen
node scripts/result-content.js import exports/result-texte-review.csv

# 5. Freigabestand und alle generierten Artefakte abschliessend prüfen
node scripts/result-content.js review-report --all
node scripts/result-content.js validate
node scripts/result-content.js check
node tests/content-workflow.test.js
node tests/integration.test.js
node tests/robustness.test.js
node tests/ui-lifecycle.test.js
node tests/i18n-static.test.js
node tests/i18n-runtime.test.js
```

`build` und `check` sind absichtlich gemeinsame Vier-Sprachen-Gates und
akzeptieren keine Sprachoption. So kann nie versehentlich ein einsprachiges
Bundle an die Stelle des gemeinsamen Runtime-Bundles geschrieben werden. Für
die Arbeit an einer einzelnen Sprache dient `validate --locale en-CH` (analog
`fr-CH`, `it-CH`, `de-CH`). `export` und `overview` bleiben ohne Option
rückwärtskompatibel bei Deutsch; für alle Sprachen wird `--all` verwendet.

Ein erfolgreicher Import aktualisiert die betroffenen JSON-Dateien und erzeugt
`js/result-copy.generated.js`, die Standard-CSV, die Markdown-Übersicht und das
sprachspezifische Web-App-Manifest automatisch neu. Damit bleiben alle
eingecheckten Artefakte auf derselben Quellversion. Schlägt ein Schreibvorgang
innerhalb dieses Mehrdateiensatzes fehl,
stellt das Werkzeug die bereits ersetzten Ziele automatisch auf ihren vorherigen
Stand zurück; die vollständige Importsicherung bleibt zusätzlich erhalten.

## Welche Datei wofür gedacht ist

Die Markdown-Übersicht gruppiert alle Texte nach **Gesundheitsbereich und Thema**.
Ein anklickbarer Arbeitsindex, Status- und Reviewer-Zahlen sowie die natürliche Reihenfolge
zusammengehöriger Texte (Überschrift, Begründung, nächster Schritt, Nutzen und
4-Wochen-Plan) erleichtern die vollständige Prüfung. Technische IDs stehen nur noch
als Metadaten beim jeweiligen Text. Die Datei wird deterministisch aus dem Katalog
erzeugt, ist eine reine Lesefassung und darf nicht zurückimportiert werden.

Für konkrete Änderungen erhalten Marketing, Medizin und Recht zusätzlich die CSV.
Sie verwendet dieselbe Gruppierung und Sortierung, stellt die redaktionellen Spalten
an den Anfang und verschiebt technische IDs und Hashes ans Ende. Nur die CSV enthält
die geschützte Austauschstruktur für den Rückimport. Nach einem Import werden
Markdown-Übersicht, Standard-CSV und App-Manifest automatisch erneut erzeugt,
damit Lesefassung, CSV, JSON, Runtime-Bundle und Installationsmetadaten denselben
Katalogstand ausweisen.

## Was im Review bearbeitet werden darf

Die CSV ist UTF-8 mit BOM, semikolongetrennt und RFC-4180-konform. Sie kann in
Excel, Numbers oder Google Sheets geöffnet werden. Der neue Inhalt wird in
**`Neuer Text`** eingetragen. Ein leeres Feld bedeutet: bisherigen Text
unverändert lassen.

Zusätzlich dürfen `Freigabestatus` und `Review-Kommentar` gepflegt werden. Der
`Prüfhinweis` ist dagegen ein unveränderlicher fachlicher oder technischer
Ausgangshinweis. Diese Trennung verhindert, dass eine Review-Rückmeldung die
Begründung für eine notwendige Prüfung überschreibt. Alle übrigen Spalten sind
geschützte Metadaten und dürfen nicht inhaltlich verändert, gelöscht oder neu
angelegt werden. Eine Sortierung der ganzen Zeilen ist zulässig; die technische
ID bleibt dabei mit ihrer Zeile verbunden.

Der `Review-Kommentar` ist eine sachliche Rückmeldung zum Text, kein
personenbezogener Freigabe-Audit-Trail. Dort gehören weder Kunden- oder
Gesundheitsdaten noch Namen einzelner Reviewer hinein.

### Empfohlener Review-Ablauf

1. Nach `Freigabe durch` auf die eigene Stelle filtern, z. B. `Medizin`.
2. Zuerst `Prüfung erforderlich`, danach `Nicht geprüft` bearbeiten.
3. Änderungen ausschliesslich in `Neuer Text` und Hinweise in
   `Review-Kommentar` eintragen; den bisherigen Text nicht überschreiben.
4. Filter dürfen verwendet werden, aber **keine gefilterten, ausgeblendeten oder
   unveränderten Zeilen löschen**. Für den sicheren Import muss die vollständige
   Datei mit allen exportierten Textzeilen zurückgegeben werden.
5. `Freigegeben` erst setzen, wenn alle unter `Freigabe durch` genannten Stellen
   dem aktuellen beziehungsweise neuen Text zugestimmt haben.
6. Die zurückerhaltene Gesamtdatei zuerst per Dry Run prüfen und erst danach
   importieren.

| Spalte | Bedeutung |
| --- | --- |
| `Gesundheitsbereich` | Redaktioneller Hauptbereich, z. B. Körperliche Fitness oder Einflussfaktoren |
| `Thema` | Inhaltliche Review-Gruppe, z. B. Krafttraining & Muskulatur oder Herz-Kreislauf & Vorsorge |
| `Seitenelement` | Element der Ergebnisseite, z. B. Empfehlungskarte, Dimensionsdetail oder 4-Wochen-Plan |
| `Textfunktion` | Verständliche Funktion des Textes, z. B. Überschrift, Begründung, nächster Schritt oder Nutzen |
| `Kontext / Variante` | Genaue Ausspielung bzw. antwortabhängige Variante |
| `Deutscher Ausgangstext` | Nur in Übersetzungsdateien: unveränderliche Referenz für fachliche Kontrolle |
| `Aktueller Text` | Text des exportierten Katalogstands |
| `Neuer Text` | Einzige Spalte für den Ersatztext; leer = unverändert |
| `Review-Kommentar` | Optionale gemeinsame Rückmeldung aus Marketing, Medizin oder Recht |
| `Freigabe durch` | Stellen, deren Zustimmung erforderlich ist |
| `Freigabestatus` | `Nicht geprüft`, `Prüfung erforderlich` oder `Freigegeben`; bei medizinisch/rechtlich relevantem neuem Text automatisch wieder prüfpflichtig |
| `Prüfhinweis` | Schreibgeschützter fachlicher oder technischer Ausgangshinweis |
| `Platzhalter` | Dynamische Werte wie `{{name}}`, die exakt erhalten bleiben müssen |
| `Geschützte Begriffe` | Zwingend unverändert zu übernehmende Begriffe oder Nummern |
| `ID (technisch)` | Dauerhaft stabile, globale Content-ID |
| `Domain (technisch)` | Technische Quelldomain im Katalog |
| `Sprache (technisch)` | Nur in Übersetzungsdateien: unveränderlicher Sprachcode |
| `Austauschformat (technisch)` | Deutsches Format `2`; Übersetzungsformat `3` |
| `Quellversion (technisch)` | Hash des vollständigen Katalogstands beim Export |
| `Zeilen-Hash (technisch)` | Hash der konkreten Ausgangszeile für Konfliktschutz |

Die Gesundheitsbereiche, Themen und verständlichen Textfunktionen werden zentral
im Exportskript aus den stabilen Content-IDs abgeleitet. Sie sind reine
Review-Metadaten und verändern weder Scoring noch Empfehlungslogik oder sichtbare
Ausspielung der App. Bei einer neuen Themenfamilie wird die Zuordnung im zentralen
`reviewFacetFor()` ergänzt und mit einem Beispiel im Content-Workflow-Test gesichert.

Bereits vor Einführung des Austauschformats 2 versandte CSV-Dateien im alten
12-Spalten-Format können weiterhin importiert werden. Dabei bleibt ein bestehender
alter `Marketing-Kommentar`, der identisch mit dem Prüfhinweis ist, unverändert;
nur eine tatsächlich neue Rückmeldung wird als `Review-Kommentar` übernommen.
Für neue Review-Runden soll immer ein frischer Export im Format 2 (Deutsch)
oder Format 3 (Übersetzungen) verwendet werden. Ein Format-3-Import wird anhand
der unveränderlichen Sprache automatisch in das richtige Overlay geschrieben;
Legacy-Formate 1 und 2 dürfen ausschliesslich nach `de-CH` importiert werden.

Ein Freigabestatus allein darf ein mit `sync-locales` erzeugtes, noch deutsches
Übersetzungs-Skelett niemals als übersetzt markieren. Der Import weist diesen
Fall ausdrücklich zurück. Soll ein Text in der Zielsprache absichtlich exakt
gleich bleiben (beispielsweise ein Markenname), wird derselbe Text bewusst in
`Neuer Text` kopiert; erst diese explizite Bestätigung setzt
`translationState: translated`. Damit bleibt das Vollständigkeits-Gate streng,
ohne sprachunabhängige Begriffe künstlich verändern zu müssen.

Wichtig beim Speichern in Excel:

- Das Format muss CSV UTF-8 bleiben.
- Alle Spalten müssen erhalten bleiben.
- IDs dürfen nicht durch fortlaufende Nummern ersetzt werden.
- Mehrzeilige Texte sind erlaubt; Excel quotiert sie beim CSV-Export.
- Beginnt ein Text mit `=`, `+`, `-` oder `@`, muss in der Tabellenzelle davor
  ein Apostroph gesetzt werden. Der Import entfernt diesen Schutz wieder. So
  kann kein Text als Tabellenformel ausgeführt werden.

## Platzhalter und Formatierung

Dynamische Werte stehen als Platzhalter im Text, beispielsweise:

```text
Bei Ihnen kommen mehrere Faktoren zusammen: {{riskFactors}}.
```

Die Schreibweise und die Menge der Platzhalter müssen exakt erhalten bleiben.
Der Import lehnt fehlende, zusätzliche oder umbenannte Platzhalter ab. Werte
werden von `ResultCopy.format()` bei der Laufzeit HTML-escaped eingesetzt.

**Klartext-Invariante für verschachtelte Copy:** Katalogtexte, die ihrerseits als
Variable in einen anderen `ResultCopy.format()`-Text eingesetzt werden, müssen
reiner Text bleiben und dürfen auch kein `<b>` oder `<i>` enthalten. Das betrifft
insbesondere `ui.hero.topic.*`, `ui.hero.topic_suffix.*`,
`ui.hero.dimension.*`, `ui.action_plan.heading.one|two|three` und
`ui.hero.action_plan_verb.*`. Gleiches gilt für die als Variablen eingesetzten
Fitness-Einheiten `ui.fitness_tests.unit.*` und Empfehlungstitel. Eine Hervorhebung gehört in den äusseren Zieltext;
Markup in einer solchen Variablen würde aus Sicherheitsgründen sichtbar escaped.
Die technische Erlaubnis von `<b>`/`<i>` ist deshalb keine Einladung, Markup in
jedem Eintrag zu verwenden: `label`, `source_label`, `title`, Signaltexte und die
genannten verschachtelten Familien sind als Klartext vertraglich getestet. Im
Zweifel bestehendes Markup nicht neu einführen, sondern den Ausspielungskontext
mit der Entwicklung klären.

Für kontrollierte Formatierung sind ausschliesslich diese attributlosen Tags erlaubt:

```html
<b>fett</b>
<i>kursiv</i>
<br>
<ul><li>Listenpunkt</li></ul>
```

Attribute, Links, andere Tags und fehlerhaft verschachteltes HTML werden
abgelehnt. URLs und Angebots-/Quellenreferenzen gehören nicht in den Text,
sondern in die dafür vorgesehene Fachlogik.

Bei Übersetzungen müssen Platzhalter und die Abfolge der erlaubten HTML-Tags
exakt dem deutschen Ausgangstext entsprechen. `requiredTerms` ist dagegen
bewusst sprachspezifisch und wird nicht aus Deutsch geerbt.

`requiredTerms` im JSON schützt sicherheits- oder fachkritische Bestandteile,
zum Beispiel Notfallnummern. Jeder geschützte Begriff muss im neuen Text
unverändert vorkommen.

## Quellversion und Konflikte

Jeder Export trägt zwei Schutzebenen:

1. `Quellversion (technisch)` erkennt, ob sich der Gesamtkatalog seit dem Export geändert
   hat.
2. `Zeilen-Hash (technisch)` erkennt, ob sich genau der bearbeitete Eintrag geändert
   hat.

Bei einer veralteten Quellversion stoppt der Import standardmässig. Am sichersten
ist dann ein neuer Export. Wenn das Review-Team bereits umfangreich gearbeitet hat,
kann die Datei bewusst zeilenweise geprüft werden:

```bash
node scripts/result-content.js import exports/result-texte-review.csv --dry-run --allow-stale
```

`--allow-stale` umgeht **nicht** den Zeilenschutz: Wurde eine bearbeitete
Ausgangszeile inzwischen im Code geändert, bleibt der Import mit einem Konflikt
stehen. Unbearbeitete, inzwischen geänderte Zeilen verhindern den Import nicht.
Es gibt absichtlich keine Option, einen solchen Konflikt blind zu überschreiben.

## Dry Run und Importbericht

Vor jeder Übernahme ist ein Dry Run Pflicht:

```bash
node scripts/result-content.js import <datei.csv> --dry-run
```

Er zeigt:

- wie viele Texte und Review-Kommentare geändert würden,
- die IDs aller betroffenen Texte,
- ob eine fachliche Freigabe zurückgesetzt würde,
- ob die Datei auf einem veralteten Export basiert.

Ein Dry Run schreibt weder JSON-Dateien noch eines der generierten Artefakte.
Ein Import ohne Änderungen ist ebenfalls ein echter No-op.

## Automatische Importsicherung

Unmittelbar vor einem echten Import mit Text-, Review-Kommentar- oder Statusänderungen
erstellt das Werkzeug einen neuen Ordner unter:

```text
exports/import-backups/<locale>/<ISO-Zeitstempel>/
```

Die Sicherung enthält die bisherigen deutschen JSON-Dateien oder das betroffene
Locale-Overlay, das bisherige Runtime-Bundle, die zugehörige CSV,
Markdown-Übersicht, das zugehörige Web-App-Manifest und `manifest.json`.
Das Manifest dokumentiert Quell- und Zielversion, betroffene IDs, automatisch
zurückgesetzte Freigaben und SHA-256-Hashes der gesicherten Dateien. Frühere
Sicherungen werden nie überschrieben. Ein Dry Run und ein No-op-Import erzeugen
keine Sicherung.

Für ein manuelles Rollback werden die Dateien aus `content/result-texts/`, `js/`,
`exports/` und gegebenenfalls das Web-App-Manifest im Projektstamm aus dem
gewünschten Sicherungsordner an ihre gleichnamigen
Projektpfade zurückkopiert. Anschliessend immer `validate` und `check` ausführen.

## Fachliche Freigaben

Für `reviewers` sind ausschliesslich `Marketing`, `Medizin` und `Recht`
zulässig. Diese kontrollierte Wertemenge verhindert, dass ein Tippfehler den
automatischen Freigabe-Reset umgeht. Der `reviewStatus` verwendet genau diese
Werte:

- leer: noch kein Status gesetzt,
- `needs-review`: ausdrücklich zu prüfen,
- `approved`: für den aktuellen Textstand freigegeben.

`reviewStatus` ist bewusst ein gemeinsamer Gesamtstatus und kein Status pro Person
oder Fachbereich. `approved` darf deshalb erst gesetzt werden, wenn **alle** unter
`reviewers` genannten Stellen den aktuellen Text freigegeben haben. Wer wann
freigegeben hat, muss im vereinbarten externen Freigabeprozess revisionsfähig
dokumentiert werden; CSV und CLI sind kein personenbezogener Audit-Trail. Die
Reviewer-Zeilen im Report zählen entsprechend Texte mit diesem gemeinsamen
Gesamtstatus, nicht einzelne Zustimmungen.

Ein leerer Status und `needs-review` gelten im Go-live-Report beide als offen.
CSV und Markdown zeigen die internen Werte verständlich als `Nicht geprüft`,
`Prüfung erforderlich` und `Freigegeben` an.

Steht in `reviewers` bzw. `Freigabe durch` `Medizin` oder `Recht`, setzt jede
Textänderung `reviewStatus` automatisch auf `needs-review`. Ein alter
Freigabestatus darf nicht stillschweigend auf einer neuen medizinischen oder
rechtlichen Formulierung bestehen bleiben.

Der Status kann nach dem fachlichen Review über die CSV oder direkt in der
kanonischen JSON-Datei aktualisiert werden. Kommt gleichzeitig ein neuer Text
mit medizinischem oder rechtlichem Reviewbedarf zurück, hat der
Sicherheitsmechanismus Vorrang und setzt den Status unabhängig vom CSV-Wert auf
`needs-review`.

Der aktuelle Freigabestand aller vier Sprachen lässt sich ohne Schreibzugriff
kompakt ausgeben:

```bash
node scripts/result-content.js review-report --all
```

Für die offenen technischen IDs einer einzelnen Sprache dient beispielsweise
`node scripts/result-content.js review-report --locale fr-CH`.

Für eine Release-Pipeline steht zusätzlich ein gemeinsamer Gate-Modus bereit:

```bash
node scripts/result-content.js review-report --all --fail-on-open
```

Dieser Befehl beendet sich mit Exit-Code 1, solange in einer der vier Sprachen
mindestens ein Text nicht `approved` ist. Er verändert keine Dateien. Ohne
`--all` bleibt `review-report` aus Rückwärtskompatibilitätsgründen bei `de-CH`;
mit `--locale` kann gezielt eine Sprache geprüft werden.

## Kanonisches JSON-Schema

Jede Datei unter `content/result-texts/` bildet eine Domain:

```json
{
  "schemaVersion": 1,
  "locale": "de-CH",
  "domain": "recommendations",
  "entries": [
    {
      "id": "recommendation.catalog.ei_rauchstopp.title",
      "section": "Empfehlungskarten",
      "context": "Rauchstopp-Empfehlung, Titel",
      "kind": "title",
      "reviewers": "Marketing",
      "text": "Rauchstopp als stärksten Hebel nutzen",
      "reviewStatus": "approved",
      "comment": "Fachlichen Nutzen durch Medizin prüfen.",
      "reviewComment": "Im gemeinsamen Review sprachlich freigegeben."
    }
  ]
}
```

Pflichtfelder pro Eintrag:

- `id`: global eindeutig und dauerhaft stabil
- `section`: Bereich der App
- `context`: verständliche Beschreibung der Ausspielung/Variante
- `kind`: Textart
- `reviewers`: kommaseparierte Zeichenkette oder Array
- `text`: kanonischer Text

Optionale Felder:

- `requiredTerms`: zwingend zu erhaltende Zeichenketten
- `reviewStatus`: Freigabestatus
- `comment`: schreibgeschützter fachlicher/technischer Prüfhinweis
- `reviewComment`: editierbare gemeinsame Rückmeldung aus dem Review

Zum Schutz vor versehentlich unbrauchbaren Importen gelten grosszügige
Obergrenzen: ID 160, Bereich 160, Ausspielung 1000, Textart 80, Text 8000,
Pflichtbegriff 500, Review-Status 40 sowie Prüfhinweis und Review-Kommentar je
4000 Zeichen. Tabulatoren und
Zeilenumbrüche bleiben in redaktionellen Texten erlaubt; andere ASCII-Steuerzeichen
sowie unsichtbare Bidi-Steuerzeichen werden abgelehnt.

IDs werden nie aus dem Text abgeleitet und nach einer Umformulierung nicht
umbenannt. Neue IDs müssen über alle Domain-Dateien hinweg eindeutig sein.
Das schlanke Overlay-Schema ist im Abschnitt «Übersetzungs-Overlays und
Vollständigkeit» beschrieben; strukturelle Felder dürfen dort nicht dupliziert
werden.

## Befehlsreferenz

### `validate`

Prüft ohne Option sämtliche JSON-Dateien aller vier Sprachen auf:

- exakte Schema-Version und Locale,
- fehlende oder unbekannte Felder,
- doppelte Domains und globale IDs,
- Pflichtfelder, kontrollierte Reviewer und Review-Status,
- Feldlängen sowie unzulässige Steuer- und Bidi-Zeichen,
- Platzhalter,
- erlaubtes und korrekt verschachteltes HTML,
- `requiredTerms`.

Bei Übersetzungen werden zusätzlich exakte Domain-/ID-Parität,
`translationState`, `sourceContractHash` sowie Platzhalter- und HTML-Parität
gegen Deutsch geprüft.

### `build`

Validiert den Katalog und erzeugt deterministisch
`js/result-copy.generated.js`, die vier sprachspezifischen Web-App-Manifeste und
den deutschen Kompatibilitätsalias `manifest.webmanifest`.

```bash
node scripts/result-content.js build
```

Die generierte Datei darf nie manuell editiert werden.

### `check`

Erzeugt das Multi-Locale-Runtime-Bundle, alle vier CSV-Dateien, alle
Markdown-Übersichten und alle Web-App-Manifeste im Speicher und vergleicht sie
bytegenau mit den eingecheckten Dateien. Der Befehl schlägt
fehl, sobald nach einer JSON-Änderung eines der generierten Artefakte veraltet ist.

### `export`

```bash
node scripts/result-content.js export [ausgabe.csv]
node scripts/result-content.js export --locale fr-CH [ausgabe.csv]
node scripts/result-content.js export --all
```

Ohne Pfad wird nach `exports/result-texte-de-CH.csv` exportiert.

### `overview`

```bash
node scripts/result-content.js overview [ausgabe.md]
node scripts/result-content.js overview --locale it-CH [ausgabe.md]
node scripts/result-content.js overview --all
```

Ohne Pfad wird nach `exports/result-texte-uebersicht.md` exportiert. Die Ausgabe
ist eine gruppierte, nicht importierbare Lesefassung. Textänderungen kommen immer
über die CSV zurück.

### `review-report`

```bash
node scripts/result-content.js review-report [--locale de-CH|en-CH|fr-CH|it-CH|--all] [--fail-on-open]
```

Zeigt die Anzahl freigegebener und offener Texte pro Status und Reviewer. Mit
`--all` enthält der kompakte Bericht jede Sprache und eine Gesamtsumme.
`--all --fail-on-open` macht den Report zu einem gemeinsamen Release-Gate für
alle vier Sprachen, ohne den Katalog oder generierte Dateien zu verändern.

### `import`

```bash
node scripts/result-content.js import <datei.csv> [--dry-run] [--allow-stale]
```

Der Import erkennt Format-3-Dateien anhand der unveränderlichen Locale-Spalte,
verlangt exakt dieselbe Menge eindeutiger IDs wie der Zielkatalog und lehnt
fehlende, unbekannte, doppelte oder sprachlich gemischte Zeilen ab.

## Tests

```bash
node tests/content-workflow.test.js
```

Die Tests decken unter anderem ab:

- CSV-Roundtrip mit Semikolon, Quotes und Zeilenumbrüchen,
- UTF-8-BOM und Formula-Injection-Schutz,
- No-op-Reimport,
- Dry Run ohne Schreibzugriff,
- Platzhalter-, HTML- und Pflichtbegriffsvalidierung,
- vollständige Locale-Overlays, Quellvertrags-Drift und fehlende Übersetzungen,
- unveränderliche CSV-Sprache sowie deutsche Referenzspalte,
- deterministisches Vier-Sprachen-Bundle ohne ID-Fallback,
- veraltete Exporte und zeilenweise Base-Hash-Konflikte,
- deterministische und vollständige Markdown-Review-Übersicht,
- Freigabereport nach Status und Reviewer,
- gemeinsamer Vier-Sprachen-Freigabereport und Release-Gate,
- Klartext-Invariante für verschachtelte Hero-Copy und fail-fast Runtime-Copy,
- Aktualität von Runtime-Bundle, Standard-CSV und Markdown-Übersicht,
- Aktualität und Katalogbindung der sprachspezifischen App-Manifeste,
- Sicherung aller zum importierten Locale gehörenden generierten Artefakte,
- automatischer Gesamt-Rollback bei einem simulierten Schreibfehler.

`node tests/integration.test.js` prüft zusätzlich, dass Auswahl, Priorisierung,
Varianten, dimensionsbezogene Signalhinweise und 4-Wochen-Pläne über stabile IDs
funktionieren. Die Tests hängen nicht an frei änderbaren Formulierungen; fachlich
zwingende Werte werden über `requiredTerms` geschützt.

`node tests/robustness.test.js` prüft ausserdem die versionierte/ablaufende lokale
Speicherung, Ergebnis-Link-Validierung, Kundenkontext-Timeouts, Schutz vor
veralteten Adapterantworten sowie zentrale A11y-, Datenschutz- und
Doppelklick-Portabilitätsverträge. `node tests/ui-lifecycle.test.js` prüft die
sichtbare Fehlergrenze, optionale Zahlenfelder, URL-/Platzhalterausgabe,
Kontext-Refresh und Cleanup-Verträge.

`node tests/i18n-static.test.js` prüft den Locale-, Navigations-, Manifest- und
statischen Seitenvertrag. `node tests/i18n-runtime.test.js` stellt sicher, dass
Frage-IDs, Antwortwerte, Scores, Risikosignale und Empfehlungen in allen vier
Sprachen technisch identisch bleiben.

## Fehlerbehebung

**„Generiertes Artefakt ist veraltet“**  
Den in der Fehlermeldung genannten Befehl ausführen: `build` für das Runtime-Bundle,
`export` für die Standard-CSV oder `overview` für die Review-Übersicht. Sind mehrere
Artefakte unklar, alle drei Befehle aus dem Schnellablauf ausführen und danach erneut
`check` starten.

**„CSV basiert auf einer veralteten Quellversion“**  
Bevorzugt neu exportieren. Nur nach bewusster Prüfung `--allow-stale` zusammen
mit `--dry-run` verwenden.

**„Zeilenkonflikt“**  
Der betroffene Text wurde seit dem Marketing-Export auch im Code geändert.
Aktuelle und Marketing-Fassung manuell zusammenführen und auf Basis eines neuen
Exports erneut importieren.

**„Schreibgeschützte CSV-Spalten wurden verändert“**  
Die ursprünglichen Metadatenspalten wiederherstellen oder einen neuen Export
verwenden. Nur `Neuer Text`, `Freigabestatus` und optional
`Review-Kommentar` bearbeiten.

**„Geschütztes Element fehlt“ oder „Platzhalter müssen unverändert bleiben“**  
Die in `Platzhalter` und `Geschützte Begriffe` gezeigten Werte exakt in den neuen
Text übernehmen.
