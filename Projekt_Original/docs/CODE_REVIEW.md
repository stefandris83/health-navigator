# Code-Review und Optimierungsprotokoll

Stand: Juli 2026 · Umfang: vollständiger Ordner `Projekt_Original`

> **Leserhinweis zum aktuellen Stand:** Dieses Dokument ist chronologisch aufgebaut.
> Der jüngste vollständig verifizierte Projektstand steht in Abschnitt 26: 1'223
> lokalisierte Texte je Sprache und 189/189 erfolgreiche Tests. Kleinere Zahlen in
> früheren Abschnitten dokumentieren damalige Zwischenstände und sind keine aktuellen
> Bestandsangaben.

## 1. Gesamtbeurteilung

Die Ausgangsbasis war für einen dependency-freien Prototyp bereits ungewöhnlich
solide: klare Fachmodule, ein sicherer zentraler Textkatalog, versionierte Persistenz,
eine vom Scoring getrennte CustomerContext-Schicht und 56 grüne Regressionstests.
Die passende Zielarchitektur bleibt deshalb HTML, CSS und klassisches Vanilla
JavaScript ohne Build. Ein Framework, Backend, eigenes Login oder allgemeines CMS
würde hier mehr Betriebs- und Übergabekomplexität als Nutzen schaffen.

Die wichtigsten realen Risiken lagen nicht in der medizinischen Score-Engine, sondern
an Systemgrenzen: ein destruktiver Modal-Rückgabewert, Notfallrouting im Coach,
Mock-/Live-Trennung, asynchrone Adapterrennen, dynamische URLs, Ergebnislink-Privacy,
UI-Timer/Lifecycle sowie eine Lücke zwischen Content-Import und eingecheckten
Review-Artefakten. Diese Punkte wurden lokal und regressionstestbar behoben. An
medizinischen Gewichten, Schwellen, Normtabellen und Empfehlungsprioritäten wurden
keine beabsichtigten Änderungen vorgenommen. Für einen vollständigen visuellen oder
Quellvergleich fehlten jedoch Git-Baseline und Vorher-Screenshots.

## 2. Technische Bestandsaufnahme vor Änderungen

### Dateien und Struktur

- Zwei statische Seiten: `index.html`, `quellen.html`; ein gemeinsames Stylesheet.
- Zwölf klassische Runtime-Skripte für Konfiguration, Fragen, Persistenz, Scoring,
  Empfehlungen, Angebote, Integration, Coach, Radar, Copy und App-Steuerung. Im
  finalen Stand ergänzt `js/url-safety.js` die zentrale URL-Prüfung als dreizehntes
  Skript.
- Vier kanonische JSON-Kataloge mit 732 global eindeutigen Texten:
  `recommendations` 432, `ui` 196, `services` 77, `coach` 27.
- Eingechecktes Runtime-Bundle sowie CSV- und Markdown-Reviewexport.
- Ein dependency-freies Node-CLI und drei dependency-freie Testsuiten.
- Dokumentation für Quellen, Integration und Textpflege.
- Technische Altlasten: `.DS_Store` und ein personenbezogener lokaler Editorpfad
  in `.vscode/launch.json`.
- Kein Git-Repository im Arbeitsordner; Änderungen wurden deshalb über Datei- und
  Artefaktprüfungen statt über einen Git-Diff auditiert.

### Verifizierte Baseline

```text
node scripts/result-content.js validate       732 Texte, valide
node scripts/result-content.js check          Bundle aktuell
node tests/content-workflow.test.js            15/15
node tests/integration.test.js                 31/31
node tests/robustness.test.js                  10/10
Gesamt                                          56/56
```

Baseline-Quellversion:
`v1:fb4a668043d9e28d100503b6ee0f486fdb650cc0da1e1f927c0c4c78d1249aef`.
CSV, Markdown und Runtime-Bundle waren zu diesem Zeitpunkt deterministisch aktuell.

### Öffentliche Schnittstellen und Datenverträge

| Vertrag | Ausgangslage und stabiler Schlüsselraum |
| --- | --- |
| Fragen | 41 stabile Frage-IDs in sechs Dimensionen; `grund` nicht bewertet, danach `einfluss`, `fitness`, `ernaehrung`, `schlaf`, `mental`. Antwortwerte werden gegen den Katalog sanitisiert. |
| Scoring | Fünf Dimensionsscores, Gesamtscore, Statusband, Kennzahlen und Risikosignale. Status- und Signal-IDs sind Fachverträge für Empfehlungen und Copy. |
| Empfehlungen | Stabile Empfehlungs-/Plan-IDs, Themen, Dimension, Priorität und maximal drei produktive Aktionsschritte; Gesundheitskontext kennt keine Versicherungen. |
| Angebote | 17 Schlüssel in `HELSANA_OFFERS`; redaktionelle Labels im Content-Katalog, technische Ziele in `helsana.js`. |
| CustomerContext | Vertrag v1: Loginstatus, optionaler Anzeigename, technische Produkt-ID, neutrale Kategorie, Label und Quelle. Öffentliche API über `HelsanaIntegration`. |
| Persistenz | `helsana_gcheck_v1` und `helsana_gcheck_plan_v1`; Storage-Schema 2, Hash-Schema 1, TTL 90 Tage, Hashlimit 32 KiB. |
| URL | Optional `?kunde=…` nur im Mock-Modus; Ergebnisimport über `#r=…`; keine sonstigen Health-Daten in Query oder Events. |
| Content | Stabile globale Content-ID, Domain, Bereich, Textart, Text, Platzhalter, erlaubtes HTML, geschützte Begriffe, Reviewer, Reviewstatus und Kommentar. |
| Laufzeitkonfiguration | Neu dediziert als `HealthNavigatorConfig`; sichere Defaults für Links, TTL, Adapter, Modus, Demo und Coverage. |

Die vollständigen Antwortoptionen und Fachregeln bleiben absichtlich in
`js/questions.js`, `js/scoring.js` und `js/recommendations.js`; eine duplizierte
Dokumentkopie würde bei Änderungen schnell veralten.

### Script-Reihenfolge

`config` → generierte Copy → Copy-API → URL-Sicherheit → Fragen → Persistenz →
Angebote → Integration → Scoring → Empfehlungen → Coach → Radar → App. Fehlende
zentrale Abhängigkeiten erzeugen verständliche Initialisierungsfehler; Reihenfolge und
relative Dateiziele werden statisch getestet.

## 3. Priorisierte Findings und Umsetzung

### P0 – kritischer Funktions-/Sicherheitsfehler

| Finding | Wirkung vorher | Umsetzung |
| --- | --- | --- |
| Home-Modal unterschied Abbruch und expliziten Neustart nicht | Escape oder Klick auf den Hintergrund konnte gespeicherte Antworten und Planstatus löschen | Eindeutige Rückgaben `dismiss`, `cancel`, `confirm`; nur die explizite Neustarttaste ruft `reset()` auf. |
| Coach routete «Atemnot» zur Atem-/Stressantwort | Ein potenzieller Notfallbegriff erhielt keine Notfallantwort | Notfallprüfung vor Stressroute; Atemnot, Herzinfarkt und weitere eindeutige Krisenbegriffe getestet. Normale «Atemübung» bleibt im Stresspfad. |

### P1 – vor produktiver Integration relevant

| Bereich | Finding | Umgesetzte Lösung |
| --- | --- | --- |
| Konfiguration | Generisches `window.APP_CONFIG` konnte Hostkonfiguration überschreiben | Dedizierter, eingefrorener Namespace `HealthNavigatorConfig`; Legacy-Objekt wird nur gelesen. |
| Integration | `mode: mock` hatte keine echte Sicherheitsgrenze; Demo-Query konnte Livepfade beeinflussen | Validierte Modi `mock`, `live`, `anonymous`; Demo-Query nur im Mock; Live ohne Adapter anonym; Anonymous-Modus als harte Kontextgrenze; One-shot-Bootstrap vor Auto-Init. |
| Async/Races | Adapterwechsel entwertete laufenden Request nicht; Timeout abortierte Netzwerk nicht; `ready` blieb alt | Sequenzentwertung plus `AbortController`, Timeout-/Abort-Cleanup, dynamischer `ready`-Getter, getestete Mehrfachinitialisierung/Login/Logout. |
| CustomerContext | Getter/Proxy/überlange Listen und Steuerzeichen konnten Fehler oder unkontrollierte Daten erzeugen | Gesamt-Normalisierung fail-closed, strikte Versionstypen, 100 rohe/20 gültige Produkte, Unicode-/Bidi-Bereinigung, Begrenzung, Deduplizierung, Deep-Freeze. |
| Coverage | Offene Legal-Texte waren live nicht explizit gesperrt | `coverageHintsEnabled`; Live/anonym standardmässig aus, Mock separat an; Recht-Reviewer und `needs-review` bei sensiblen IDs. |
| URLs/XSS | Angebots- und Quellenziele wurden nicht gemeinsam protokollvalidiert | Zentrale absolute HTTPS-Allowlist ohne Credentials; Attribute escaped; ungültige Ziele werden nicht als Link gerendert. |
| Ergebnislink | Basis übernahm Query-Secrets beziehungsweise konnte lokale und produktive Kontexte nicht sauber unterscheiden | Konfigurierte kanonische HTTPS-Basis oder queryfreie HTTPS-Seitenbasis; ausschliesslich der Standalone-Mock darf einen gerätegebundenen `file://`-Link erzeugen, `live`/`anonymous` verlangen eine explizite Freischaltung und HTTPS; ungültige Health-Hashes werden entfernt. |
| Navigation | Nichtleere ungültige optionale Zahl konnte still verworfen werden | Optional bedeutet nur «leer erlaubt»; eingegebene Werte müssen valide sein. Feldgebundene Fehlermeldung und ARIA-Zustand. |
| UI-Lifecycle | Kontext-Event vollrenderte Ergebnisse und zerstörte offene Details, Chat/Fokus/Übung; Timer/RAF konnten weiterlaufen | In-place-Refresh nur für Chip/Coverage; zentraler Cleanup für Chat-Timeouts, Score-RAF, Radar und Atemübung bei Render/Navigation. |
| Textworkflow | Import aktualisierte JSON/Bundle, aber nicht Standard-CSV/Markdown; `check` sah Stale-Artefakte nicht; ein später Schreibfehler konnte einen gemischten Mehrdateienstand hinterlassen | Import/Backup und `check` auf alle generierten Artefakte erweitert; deterministische Regeneration, Stale-Tests und automatischer Rollback des gesamten bereits geschriebenen Satzes. |
| Governance | Beliebige Reviewer/Statuswerte; 731 leere Status im Überblick unsichtbar | Kontrollierte Reviewer/Statuswerte, sichtbares «nicht gesetzt», `review-report`, Legal-Metadaten für Datenschutz/Consent/Coverage. |
| Repository | Persönlicher Editorpfad und `.DS_Store` | Portable `${workspaceFolder}`-Konfiguration, `.gitignore`, Hygiene-Test, Artefakt entfernt. |

### P2 – Härtung und Wartbarkeit

- Fragen und Scoring laufen in IIFEs; zentrale Exporte sind eingefroren. Dadurch sinkt
  das Risiko klassischer Top-Level-Kollisionen bei direkter Einbettung, ohne ES-Module
  oder CORS-Risiko unter `file://`.
- `Scoring.computeResults()` sanitisiert auch direkte API-Aufrufe fail-closed; die UI
  bleibt nicht die einzige Vertrauensgrenze.
- Platzhalter sind keine `<a href="#">`-Elemente und benötigen keine Inline-
  Eventhandler mehr. Externe Links verwenden `noopener noreferrer`; Referrer-Meta ist
  gesetzt.
- Chatlog, Kopierstatus, Zahlenfehler und Atemstatus haben gezieltere Live-Regionen;
  Fokus und Reduced-Motion-Pfade wurden lokal verbessert.
- CustomerContext-Refresh vermeidet ein unnötiges Vollrendering der grossen
  Ergebnisseite.
- Eine äussere App-Bootstrap- und innere Render-Grenze lassen
  `ResultCopy.get/format()` weiterhin hart fehlschlagen, zeigen Nutzenden bei einem
  Laufzeit-/Deploymentfehler aber einen statischen Reload-Zustand statt einer leeren
  App. Der Runtime-Test simuliert dafür eine bereits beim Top-Level-Copy-Lookup
  fehlende ID. Die Konsole erhält nur einen technischen Fehlercode beziehungsweise
  eine kontrollierte `ResultCopy`-Vertragsmeldung – nie Antworten, Scores oder Stack.
- Verschachtelt eingesetzte Hero-Copy besitzt einen dokumentierten und getesteten
  Klartextvertrag, damit redaktionelles Markup nicht doppelt escaped sichtbar wird.
- Die auffällige Swissheart-Zielseite wurde aus der Runtime entfernt und durch die
  offizielle Werte-Übersicht ersetzt; HEPA wird korrekt HEPA Schweiz/BASPO zugeordnet.
- `quellen.html`, Runtime-Quellen und interne Dokumentation verwenden denselben Stand
  Juli 2026.
- Dimensionsdetails trennen neutrale, solide und starke Fallbacks nun in Farbe und
  Text: Unter 60 bleibt die Rückmeldung neutral, 60–79 ist blau und zurückhaltend,
  erst ab 80 erscheint eine grüne Erfolgsbox. Die Grenzen sind für alle fünf
  Dimensionen als Regressionstest abgedeckt.
- Die einmal berechneten Top-Schritte werden in ihrer globalen Reihenfolge zusätzlich
  in die passende Dimension projiziert und dort sichtbar als Aktionsplanschritt
  markiert. Titel, Begründung, Startschritt und Nutzen stammen aus demselben Objekt wie
  oben; 4-Wochen-Pläne werden in den Details nicht dupliziert.
- Nicht priorisierte Hinweise und medizinische Klärungshinweise erscheinen direkt
  in der fachlich passenden Dimension. `Recommendations.dimensionInsights()` ordnet
  und dedupliziert sie gegen stabile Aktionsplan-IDs; eigenständige Hinweise nutzen
  dieselbe Drei-Zeilen-Struktur wie Empfehlungskarten. Die frühere separate Sektion
  «Selbst beeinflussen vs. ärztlich abklären» wurde entfernt.
- Das Helsana-Logo wird lokal aus `assets/helsana-logo.svg` geladen. Der zentrale
  Offline-/`file://`-Ablauf besitzt damit keine externe Logo-Abhängigkeit mehr.

### P3 – bewusst dokumentiert, nicht eigenmächtig umgesetzt

- Kein umfassender `window.HealthNavigator.init/destroy`-Facade-Umbau. Die aktuelle
  Seite besitzt einen klaren Page-Lifetime-Lebenszyklus; eine echte wiederholte
  Mount/Unmount-Anforderung muss zuerst mit der Zielplattform definiert werden.
- Keine komplette Zerlegung von `app.js`. Sie ist gross, aber die verbleibenden
  Operationen teilen State, Render- und Eventdelegation eng. Eine Dateiaufteilung ohne
  Module würde vor allem Ladereihenfolge und Globals vermehren.
- Keine Migration auf ES-Module, TypeScript, Framework, Bundler oder Testframework.
- In diesem Review noch keine sichtbaren Änderungen an Brandfarben trotz einzelner
  Kontrastbefunde; die spätere ausdrückliche Freigabe und Umsetzung ist in Abschnitt
  18 dokumentiert.
- Kein Backend, Login, Tokenhandling, `postMessage`-Kanal, Analytics oder echtes LLM.

## 4. Security- und Datenschutzreview

### Dynamische Ausgabeinventur

| Quelle | Vertrauensniveau | Ausgabeweg und Schutz |
| --- | --- | --- |
| Content-Katalog | redaktionell, kontrolliert | Schema, erlaubte Tags, Platzhaltervertrag, `requiredTerms`; ResultCopy escaped Variablen und nur erlaubtes Markup. |
| Fragen/Regeln/Icons | statischer Code | Bekannte Templates; Antworten werden nicht als HTML ausgegeben. |
| Anzeigename/Produktlabel | extern | Whitelist, Typ-/Längen-/Unicodebereinigung; Anzeigename über sichere Copy-Formatierung, Labels nicht für Healthlogik. |
| Angebots-/Quellen-URL | intern/redaktionell | gemeinsame absolute HTTPS-Allowlist, Credentials-Verbot, Attribut-Escaping, `noopener noreferrer`. |
| Chat-Eingabe | Nutzer | maximale Länge; DOM-Ausgabe per `textContent`; nicht in Bot-HTML interpoliert. |
| Storage/Hash | Nutzer/manipulierbar | Schema, Grösse, TTL, Antwort-Sanitizer; ungültige Werte fail-closed. |
| Kundenkontext-Event | extern | Event enthält nur technische Quelle, keine Namen, Produkte, Scores oder Antworten. |

Inline-Styles bleiben für dynamische Statusfarben und bestehendes Design bestehen;
eine Ziel-CSP benötigt deshalb vorerst eine freigegebene Style-Strategie. Inline-
Eventhandler wurden entfernt. Empfohlene HTTP-Header und Origin-Grenzen stehen in
`docs/INTEGRATION.md`; nicht durch Code entscheidbare Freigaben in
`docs/GO_LIVE_CHECKLIST.md`.

Verbleibende Datenschutzgrenzen: `localStorage` ist originweit lesbar; Ablauf ist
lazy; Ergebnislinks sind nur codiert; das Anonymitäts-Wording passt nicht ohne Legal-
Prüfung zu einer eingeloggten Ansicht. Die Linkerstellung ist nur im Standalone-Mock
standardmässig aktiv; `live` und `anonymous` bleiben ohne ausdrückliches Override aus.
Coverage bleibt live standardmässig deaktiviert.

## 5. Content- und Fachreview

- Alle 783 personalisierten Ergebnis-/Service-/Coach-Texte liegen in vier
  kanonischen JSON-Dateien. Es wurde keine neue redaktionelle Ergebnis-Copy in die
  Logik verschoben.
- Die allgemeinen Einordnungen `stark` und `solide` benennen nur den Status. Für
  60–79 und 80–100 bestehen getrennte dimensionsspezifische Kataloge unter
  `recommendation.solid.*` und `recommendation.positive.*`. So erhält ein solider
  Schlafscore keine Erfolgsbehauptung, und die wichtige starke Schlaf-Aussage
  «eine wertvolle Basis für alles andere» erscheint nicht doppelt.
- Eigenständige Handlungs- und medizinische Klärungshinweise sind Teil der jeweiligen
  Dimensionsdetails. Hinweise zu bereits durch eine Empfehlung abgedeckten Themen
  werden nicht als zusätzlicher Unterkasten ausgespielt; die Top-Aktion selbst wird
  dort mit identischer Copy gespiegelt.
- Die kardiovaskuläre Top-Aktion deckt die Detailkarten zu familiärem Risiko,
  fehlender Vorsorge, bekanntem Bluthochdruck und unzureichendem Familienwissen über
  stabile `covers`-IDs ab. Die Blutdruckmessung bei unbekanntem Status bleibt als
  eigenständiger ergänzender Schritt erhalten; familienbezogene Angaben wurden in
  die Top-Copy integriert.
- CSV-Schutz gegen Formeln, exakte ID-Menge, unveränderbare Metadaten, Quellhashes,
  Konfliktprüfung, Dry Run, Backups, erlaubtes Markup, Platzhalter und geschützte
  Begriffe bleiben erhalten.
- Technische Validität und fachliche Freigabe sind bewusst getrennt. `review-report`
  macht offene Status sichtbar, erzwingt aber nicht ohne Organisationsentscheid eine
  pauschale Freigabe aller Texte. Aktuell: 600 ohne Status, 183 `needs-review`,
  0 `approved`; Marketing 783, Medizin 492 und Recht 17 zugeordnete offene Texte.
- `service.dimension.*` wird teils im Fragebogen und teils im Ergebnis genutzt. Diese
  Shared-Nutzung ist im Textpflegeleitfaden ausdrücklich markiert.
- Medizinische Aussagen zu ApoB/Lp(a), Rauchstopp, Schlaf, Belastungsatemnot,
  Krafttraining, intensiver Alltagsbewegung und Zuckergetränken wurden anhand
  aktueller Primär-/Leitlinienquellen präzisiert. Alle betroffenen Texte stehen
  ausdrücklich auf `needs-review`; Schwellen, Normwerte und Heuristiken bleiben bis
  zur Helsana-Freigabe offene Produktentscheidungen.

## 6. Bewusst beibehaltene gute Lösungen

- Deterministischer JSON→Bundle/CSV/Markdown-Workflow mit stabilem ID-Vertrag.
- Versionierte Persistenz, Migration, TTL, Schema- und Hashlimits.
- Trennung von Scoring/Empfehlungen und Versicherungs-/Angebotshinweisen.
- Eine einzige produktive Empfehlungspriorisierung mit neutralem, nicht als Erfolg
  missverständlichem Leerzustand.
- Lokale regelbasierte Coach-Vorschau ohne Datenübertragung.
- Dependency-freies SVG-Radar mit explizitem Resize-Cleanup.
- Eventdelegation für die dynamische App statt Listener pro Renderbaum.
- Statische, ohne Build nutzbare Skripte und relative Pfade.

## 7. Finale Qualitätssicherung

```text
node scripts/result-content.js validate                         783 Texte, valide
node scripts/result-content.js check                            Bundle/CSV/MD aktuell
node scripts/result-content.js overview ...                    deterministisch erzeugt
node scripts/result-content.js export ...                      deterministisch erzeugt
node scripts/result-content.js import ... --dry-run            0 Änderungen, keine Writes
node scripts/result-content.js review-report                   0/783 approved, 783 offen
Finale Quellversion                                            v1:251caa1299327d60c6e55e4acf616ac809b22060a8a8a06225995fea49b0398a
node tests/content-workflow.test.js                             24/24
node tests/integration.test.js                                  51/51
node tests/robustness.test.js                                   21/21
node tests/ui-lifecycle.test.js                                 10/10
Gesamt                                                         106/106
```

Gegenüber der Baseline 56/56 kamen 50 gezielte Regressionstests hinzu. Alle Runtime-,
Test- und Workflow-JavaScript-Dateien bestanden zusätzlich `node --check`.

Die zwischenzeitlich von macOS angelegten Dateien `Projekt_Original/.DS_Store` und
`Projekt_Original/content/.DS_Store` wurden nach ausdrücklicher Freigabe entfernt.
Sie sind kein offener Hygiene-Punkt mehr.

Die Browser-Steuerung konnte die bereits geöffnete lokale Seite erkennen, lehnte aber
den Zugriff auf `file://` aufgrund ihrer URL-Sicherheitsrichtlinie ab. Deshalb wurden
kein echter Klick-Smoke-Test, keine Konsole und keine Vorher-/Nachher-Screenshots als
erfolgreich behauptet. Stattdessen prüfen die Tests alle relativen Assets, die exakte
klassische Script-Reihenfolge, fehlende Inline-Handler sowie die zentralen Zustands-
und Interaktionsverträge statisch.

Die vollständige manuelle Browsermatrix, visuelle Regression, Zoom- und Screenreader-
Abnahme bleibt deshalb ein Go-live-Punkt.

## 8. Offene Entscheide

Die verbleibenden Brand-, Legal-, Medizin-, Hosting-, Security- und IT-Entscheide
sind in `docs/GO_LIVE_CHECKLIST.md` zentral zusammengeführt; fachliche Evidenz und
Begründungen bleiben ergänzend in `docs/QUELLEN.md` dokumentiert.

## 9. Unabhängiger Abschlussreview und belegte Bereinigung

Der finale Stand wurde nochmals vom tatsächlichen Dateibaum aus geprüft. Grundlage
waren projektweite Referenzsuchen in HTML, CSS, JavaScript, Tests und Dokumentation,
ein bidirektionaler Content-ID-Abgleich, die dokumentierten öffentlichen Verträge und
die vollständigen Regressionstests. Mangels Git-Repository und Vorher-Screenshots war
kein pixelgenauer oder vollständiger Diff gegen den ursprünglichen Stand möglich.

### Gefundene und behobene Vertragsfehler

| Problem | Korrektur | Nachweis und Verifikation |
| --- | --- | --- |
| `integrationMode: 'anonymous'` übernahm Bootstrap-Kontext/-Adapter und erlaubte später `setContext()` | Anonymous-Modus ignoriert Bootstrap-Inhalte, lehnt Adapter ab und bleibt auch bei direktem Setzen anonym | Widerspruch zur dokumentierten Bedeutung «ohne Kundenkontext»; neuer Runtime-Test deckt Bootstrap, Query, Adapter, `setContext()` und `init()` ab. |
| Die implizite Ergebnislink-Basis validierte die aktuelle HTTPS-Seite nicht über dieselbe Credentials-Allowlist wie konfigurierte Ziele | Aktuelle Seiten-URL läuft durch `HealthUrlSafety.safeHttps()`; Query und Hash werden danach entfernt. Der lokale Sonderfall ist eng auf `file://` im Standalone-Mock begrenzt | URL-Tests blockieren HTTP, `javascript:`, `data:` und HTTPS mit Zugangsdaten; `file://` ist nur im Mock erlaubt, UI-Vertrag und Laufzeitkonfiguration prüfen diese Grenze. |
| `Coach`, `Radar` und `Recommendations` waren im Gegensatz zu den übrigen Runtime-APIs mutabel | API-Objekte sowie exponierter Empfehlungskatalog und Quellenobjekte eingefroren | Keine dokumentierte Host-Customizing-Schnittstelle; Immutability-Regressionstests ergänzt. |

### Nachweislich entfernte Altlasten

| Entfernte beziehungsweise konsolidierte Bestandteile | Grund und Beleg | Betroffene Dateien | Verifikation |
| --- | --- | --- | --- |
| `answeredCount()`, `isAnswered()`, zwei Encode-/Decode-Durchreichfunktionen, `renderFailure()`, ungenutzter RAF-Rückgabewert, unerreichbarer `copied`-Initialparameter | Jeweils keine Consumer beziehungsweise genau ein reiner Durchreichaufruf; Status wird erst nach der Kopieraktion gesetzt | `js/app.js` | Projektweite Referenzsuche, Link-/Lifecycle- und Volltests |
| Doppelte optionale Zahlenvalidierung in `dimValid()` | Vollständig durch `HealthAnswerSchema.isDimensionComplete()` ersetzt; dasselbe Schema steuert Navigation und Sanitisierung | `js/app.js`, bestehender Schema-Test | Leere optionale und ungültige eingegebene Zahlen explizit getestet |
| Ungenutzte SVGs `heart`/`print`, sechs nie gelesene Dimensionsfarben, wirkungslose DOM-Hooks `key`, `data-offer-key`, `data-chat-chips` und Atemklasse `active` | Kein Lesezugriff, Selektor, Datenvertrag oder dokumentierter Consumer | `js/app.js`, `js/questions.js` | Referenzsuche und alle Runtime-Tests |
| `ResultCopy.fields()`/`attach()` und öffentlicher `escapeHtml`-Export | Ohne Consumer; Regel/Copy-Zusammenführung ist vollständig in `recommendations.js`; dokumentierte API besteht aus `get/format` plus Versionsmetadaten | `js/result-copy.js` | Exakte minimale API und Fail-fast-Verhalten getestet |
| `isPlaceholderOffer`-Global und `HealthUrlSafety.isPlaceholder()` | Renderer verwendet ausschliesslich die zentrale `safeHttps()`-Prüfung; beide Wrapper hatten sonst keine Consumer | `js/helsana.js`, `js/url-safety.js`, Tests | URL-Allowlist und Platzhalter-Rendering getestet |
| Doppelte `safeWhen`/`safeCheck`-Guards und unerreichbare Typverzweigung nach der Normalisierung aller Pläne zu Funktionen | Identische Fail-closed-Semantik beziehungsweise objektiv immer funktionaler `PLANS`-Eintrag | `js/recommendations.js` | 35 Empfehlungs-/Scoring-Regressionstests |
| Tote CSS-Regeln `.brand-name`, `.brand-dot`, `.center`, `.mt-0`; doppelte `.q-help-toggle`-Regel; vollständig ersetzter Signal-Pseudopunktpfad; wirkungslose `is-inplan`-Regel | Kein Runtime-Match; die weiter bestehende Überblicksliste verwendet `insight-list` mit expliziten `insight-dot`-Elementen, die neuen Dimensionshinweise eigene `dimension-guidance`-Klassen | `css/styles.css`, `js/app.js` | Vollständiger Selektor-/Klassenabgleich; keine DOM-Struktur oder sichtbare aktive Regel entfernt |
| Acht UI-Content-IDs der entfernten Einordnungssektion sowie deren exklusive Classification-/Insight-CSS-Regeln | Nach der Verlagerung der damals als «Quick Wins» bezeichneten Hinweise und der medizinischen Klärungshinweise in die Dimensionsdetails existierte kein Runtime-Verweis mehr; Überblicks- und Dimensions-CSS blieben erhalten | `content/result-texts/ui.json`, `css/styles.css`, generierte Content-Artefakte | Reziproker Content-ID-Test, Selektorabgleich und Dimensions-/Priorisierungsregressionen |
| Unbenutzte Klassenattribute `questions`, `plan-link`, `footer-brand`, `brand-logo-box`, `footer-claim`, `footer-disclaimer` sowie durch `.dim-card` vollständig überschriebener `card`-Token | Keine CSS-/JS-/Test-/Dokureferenz; vorhandene Elemente und A11y-Attribute blieben bestehen | `js/app.js`, `quellen.html` | Referenzsuche und statischer Asset-/HTML-Vertrag |
| Veraltete Kommentare zu Angebots-Labels/Platzhaltern, Integrations-«Austausch» und nicht implementiertem Options-`hint` | Kommentare widersprachen dem Content-Katalog, der Adapterregistrierung oder dem realen Schema | `js/helsana.js`, `js/integration.js`, `js/questions.js` | Doku-/Code-Abgleich |

Es wurde keine Projektdatei vollständig gelöscht. Aus dem Content-Katalog wurden
ausschliesslich die acht nachweislich toten UI-Einträge der entfernten
Einordnungssektion entfernt.
Der kanonische Katalog umfasst nach dem neuen Hero-Leerzustand, der ergänzten
Schlafplan-Variante, fünf getrennten soliden Dimensionstexten sowie
dimensionsbezogenen Signal- und Taillenumfangstexten sowie der persönlichen
Körperzusammensetzungs-Einordnung 783 Einträge;
Runtime-Bundle, CSV und Markdown werden weiterhin ausschliesslich aus den vier
JSON-Dateien erzeugt und nach der Bereinigung gemeinsam regeneriert.

### Reziproker Content- und Artefaktvertrag

Der Content-Test prüft nun neben «Runtime-Verweis besitzt Katalog-ID» auch die
Gegenrichtung «Katalog-ID besitzt einen direkten oder dynamischen Runtime-Vertrag».
Alle 783 IDs sind abgedeckt; fünf Quellen und alle Coverage-Zuordnungen werden benutzt.
Wortgleiche Texte wurden nicht allein wegen gleicher Formulierung zusammengelegt,
weil ihre IDs getrennte Ausspielungs-, Review- oder Übersetzungskontexte besitzen.

### Bewusst nicht entfernt

- Die aktuell nicht ausgespielten Angebote `plus`, `wissen_kardio`,
  `wissen_rauchstopp` und `wissen_bewegung` bleiben Teil des 17-Schlüssel-Katalogs
  und der künftigen Helsana-Integration.
- Die reservierten Status-Tokens und die derzeit ungenutzten Palette-Tokens
  `--brand-800`, `--accent`, `--accent-ink`, `--s-solide` und `--s-ausbau` bleiben
  bis zu einem Brandentscheid.
- Mehrfachauswahl, exklusive Antworten und `dontKnow` bleiben als dokumentierter
  Fragenschema-Vertrag, obwohl das aktuelle 41-Fragen-Set keine Multi-Frage enthält.
- Versionierte Storage-Migrationen, Legacy-Konfiguration, Timeout-/Abort-/Race-Schutz,
  Fehlergrenzen, Persistenz-Fallbacks und Importbackups bleiben erhalten.
- Medizinische Risikosignal-Labels und undokumentierte Diagnosefelder wie `norms`
  wurden nicht entfernt: Aktuell existiert kein UI-Consumer, aber eine externe Nutzung
  des Scoring-Rückgabeobjekts ist ohne formelle API-Entscheidung nicht sicher ausgeschlossen.
- `Recommendations.signalInsights()` bleibt trotz der neuen produktiven
  `dimensionInsights()`-Darstellung als Kompatibilitätsvertrag bestehen. Die globale
  API-Grenze ist nicht formal als intern klassifiziert; eine Entfernung wäre daher
  ohne Consumer-Entscheid nicht ausreichend belegt.
- Gleiches gilt für ungenutzte Rückgabefelder von `activityStatus()`, `buildContext()`
  und `keyLevers()` sowie exportierte Schema-/Quellenmetadaten: Die internen Globals
  sind noch nicht formal als private oder öffentliche API klassifiziert. Diese Grenze
  muss vor einer weiteren API-Verkleinerung verbindlich festgelegt werden.
- Der zusätzliche `plan-link`-Wrapper bleibt trotz entferntem Klassennamen bestehen;
  eine Umstrukturierung der bestehenden Span/Block-Verschachtelung benötigt einen
  echten DOM-/Visualvergleich.

### Dateihygiene und Grenzen der Vergleichsprüfung

`Projekt_Original` enthält keine ZIPs, `node_modules`, Caches, `__MACOSX`, Symlinks,
Backups, `.DS_Store` oder temporären Arbeitskopien. Die beiden zwischenzeitlich
entstandenen `.DS_Store`-Dateien wurden nach ausdrücklicher Freigabe entfernt. Die
einzige fachlich vorgesehene Backup-Struktur entsteht erst bei einem echten
Content-Import.

Stabile IDs, der aktualisierte deterministische Content-Hash und die Regressionstests liefern keine
Hinweise auf unbeabsichtigte Änderungen an den geprüften Scoring-, Empfehlungs-,
Copy- oder Storage-Verträgen. Ohne Git-Diff ist ein vollständiger Quellvergleich und
ohne geeignete Baseline ein visueller Vorher-/Nachher-Nachweis nicht möglich; beides
wird deshalb nicht behauptet.

## 10. Scoring-, Empfehlungs- und Evidenzreview Juli 2026

Der gesamte Pfad Antworten → Normwerte → Dimensions-/Gesamtscore → Status → Signale →
Handlungsfelder → Aktionsplan → Dimensionsdetails wurde erneut unabhängig geprüft.
Aktuelle WHO-, AASM-, ESC/EAS- und Primärquellen bildeten den fachlichen Massstab;
Peter Attias veröffentlichte Schwerpunkte wurden nur als zusätzliche Perspektive,
nicht als Leitlinie oder Freigabeinstanz verwendet.

### Direkt behobene Kohärenzfehler

- Alle fünf Dimensionsdetails verwenden denselben Feedbackvertrag: unter 60 neutral,
  60–79 blau/solide mit eigenen zurückhaltenden Texten, ab 80 grün/stark mit
  separaten positiven Texten. Offene dimensionsbezogene Signale blockieren positive
  Fallbacks.
- Ein leerer Aktionsplan wird nicht mehr automatisch als «Starke Ausgangslage»
  interpretiert. Hero, Aktionsplan und Coach-Handoff besitzen einen neutralen
  Leerzustand; ein Hero-Verweis behauptet keine drei nicht vorhandenen Schritte.
- Alle 25 Kombinationen der beiden Ausdauerantworten nutzen nun denselben zentralen
  Zielvertrag. Erreichtes moderates oder intensives WHO-Ziel kann nicht gleichzeitig
  eine Ausdauer-Ausbaukarte erzeugen; unterhalb des Ziels bleibt kein Zwischenprofil
  ohne passenden Einstieg oder Ausbauhinweis.
- Sättigung «manchmal», Schlafbeeinträchtigung «spürbar», 6–7 Stunden Schlaf und
  negative Selbstwirksamkeit erhalten einen sichtbaren, zur Scorelogik passenden
  Feedbackpfad. Mehr als neun Stunden Schlaf wird ohne weiteren Kontext neutral
  statt pauschal negativ bewertet.
- Das Kardio-Muster bezeichnet einen tiefen zusammengesetzten Fitnessscore nicht mehr
  automatisch als «wenig Bewegung», sondern nutzt das konkrete Aktivitätssignal.
- Belastungsatemnot wird vor einer Trainingssteigerung mit einer medizinischen
  Sicherheitsgrenze versehen.
- Nach Ergänzung signalabhängiger Text-IDs wurden Runtime-Bundle, CSV und Markdown
  gemeinsam neu erzeugt. Der zuvor sichtbare Render-Fallback beim Aufruf der
  Ergebnisseite war durch den Versionsversatz verursacht; `check`, Content-Vertrag
  und ein Taillenumfang-Regressionsprofil sichern die vollständige ID-Menge ab.

### Direkt korrigierte Fachtexte

- Veraltete 10-Minuten-Mindestdauer aus beiden WHO-Aktivitätshinweisen entfernt.
- WHO-konformes Messprotokoll für den Taillenumfang statt «Nabelhöhe» ergänzt.
- ApoB als veränderlichen Marker von der meist einmaligen Lp(a)-Bestimmung getrennt;
  unbelegte Häufigkeitsangabe zur ApoB/LDL-Diskordanz entfernt.
- Rauchstopp-Zahlen auf «Risiko für koronare Herzkrankheit im Vergleich zu weiterem
  Rauchen» präzisiert.
- Rechenfehler/Absolutheit bei Koffein und Alkohol im Schlaftext korrigiert.
- Kausale Überdehnung der beobachtenden VILPA-Evidenz sowie Aussagen vom «einzigen
  Organ», vom stets schnellsten Ernährungshebel und vom vollständigen Umgehen der
  Sättigung entfernt.

Alle geänderten medizinischen Texte stehen auf `needs-review`. Bewusst nicht autonom
neu kalibriert wurden Gesamtstatus, harte Gegenchecks, Erwachsenen-/Jugendmodell,
Fitness-Normtabellen, Protein-/Pflanzen-/Omega-3-Gewichte, Alkoholscreening,
psychometrisches Instrument sowie die unvalidierten Kardio-Gewichte. Diese Punkte
sind in `docs/QUELLEN.md` und `docs/GO_LIVE_CHECKLIST.md` als explizite Helsana-
Entscheide dokumentiert.

## 11. Fitness-Kurztests: sichtbarer Ergebnis- und Retest-Vertrag

Die drei freiwilligen Fitness-Kurztests wurden als eigener, wartbarer Ergebnisweg
ergänzt. `js/scoring.js` berechnet Rohwert, Norm, nächste Modellschwelle und
Referenzstatus einmalig in `results.fitnessTests`; `js/recommendations.js` übernimmt
nur Textaufbereitung, fachliche Empfehlungszuordnung und Retest. `js/app.js` rendert
den Block ausschliesslich in der Dimension «Körperliche Fitness».

Direkt behoben:

- 1, 2 oder 3 ausgefüllte Tests erscheinen immer, fehlende Tests erzeugen keinen
  Leerzustand; der gültige Messwert 0 bleibt erhalten.
- Ein fachlich vergleichbarer tiefer Einbeinstand verweist auf
  `fi_beweglichkeit`, ein tiefer, scorebarer Standard-Liegestütz auf `fi_kraft`.
  Zwei tiefe Krafttests erzeugen nur eine Kraftkarte.
- Frauen und Männer verwenden dasselbe Standard-Liegestützprotokoll. Direkte,
  praktische und modellierte Referenzstatus bleiben technisch unterscheidbar;
  nicht passende Geschlechtsgruppen und Alterswerte ausserhalb der freigegebenen
  Bereiche erzeugen keine automatische Normstufe oder Empfehlung.
- Der Wandsitz wird sichtbar korrekt als lokale Bein-Kraftausdauer, nicht als
  Herz-Kreislauf-Test beschrieben. Die spätere harmonisierte vierstufige
  Trainingsorientierung ersetzt den damaligen provisorischen Hinweis; sie bleibt
  ausdrücklich eine Orientierung und wird nicht als klinische Norm, Diagnose oder
  persönlicher Risikotest ausgegeben.
- Steht die passende Empfehlung im Aktionsplan, ergänzt Woche 4 eine persönliche
  Verlaufskontrolle mit Ausgangswert. Bei bekanntem Bluthochdruck ersetzt ein
  medizinischer Klärungshinweis den automatischen maximalen Wandsitz-Retest.
- `fi_kraft` besitzt nun eine Planvariante für Personen, die bereits mindestens
  zweimal pro Woche trainieren; damit behauptet eine testbedingte Empfehlung nicht
  fälschlich, aktuell finde kein Krafttraining statt.
- Drei durch den zentralen Kurztestvertrag vollständig ersetzte interne
  Normierungs-Wrapper (`balanceTestNorm`, `pushupNorm`, `wallsitNorm`) wurden als
  nachweislich unreferenzierter Dead Code entfernt. Ein versehentliches führendes
  Anführungszeichen vor dem Einbeinstand-Kommentar, das `scoring.js` syntaktisch
  ungültig machte, wurde entfernt und durch `node --check` abgesichert.

Alle 42 neuen und 8 in diesem Zusammenhang angepassten sichtbaren Texte liegen in
den kanonischen JSON-Katalogen und auf `needs-review`. Runtime-Bundle,
Markdown-Übersicht und CSV wurden gemeinsam auf zunächst 780 Texte regeneriert; die
nachfolgende Körperzusammensetzungs-Überarbeitung erhöhte den bereinigten Stand auf
783 Texte. Die Integrationstests und ein UI-Vertrag prüfen Vorhandensein, Schwellen, ungeeignete
Referenzen, Deduplizierung, Aktionsplanverweis, Baseline-Retest und
Bluthochdruck-Sicherheit.

Die zunächst bewusst offengelassene Wandsitz-Zuordnung wurde nach der medizinischen
Helsana-Freigabe umgesetzt: Der Wandsitz zählt als lokale Bein-Kraftausdauer zur
Muskulatur und nicht mehr zur Kondition. Liegestütz und Wandsitz bilden gemeinsam
die Testhälfte des Muskulatur-Sub-Scores. Bei vollständig beantwortetem Fragebogen
hat ein einzelner Krafttest damit weiterhin höchstens 20 % Gewicht im Fitness-Score;
sind beide ausgefüllt, teilen sie diesen Anteil gleichgewichtet mit je 10 %. Der
Einbeinstand bleibt bei höchstens 10 %. Ein zweiter freiwilliger Krafttest vergrössert
damit nicht das Gesamtgewicht der Muskulatur, und ein guter Wandsitz kann eine
schwache Kondition nicht mehr ausgleichen.

Passend dazu führt erschwertes Tragen von Einkaufstaschen jetzt zur Kraft- statt zur
Konditionsempfehlung. Die früheren praxisbasierten Wandsitz-Altersbänder wurden
später durch die in Abschnitt 15 und `docs/QUELLEN.md` dokumentierte harmonisierte
Trainingsorientierung ersetzt; auch der vorsichtige Bluthochdruck-Vertrag für
maximale Retests bleibt bestehen. Peter Attias Schwerpunkt auf Kraft und Funktion
wurde nur als redaktionelle Perspektive genutzt, nicht als Validierung der
Testprotokolle oder Schwellen.

Eine reale visuelle `file://`-Prüfung der neuen Karten war über die verfügbare
Browser-Steuerung technisch blockiert und wird nicht behauptet. Syntax, DOM-/CSS-
Verträge, `file://`-Portabilitätsstruktur und sämtliche automatisierten Tests wurden
lokal geprüft; die visuelle Desktop-/Mobile-Abnahme bleibt Teil der Go-live-Liste.

## 12. Persönliche Körperzusammensetzungs-Einordnung und Boxenkonsistenz

Der app-weite Vergleich aller Ergebnis- und Infoboxen zeigte einen gemeinsamen
Darstellungsfehler: Ein vorhandener Handlungstext setzte bisher automatisch die
grüne Klasse `is-quick-win`. Damit konnten 13 offene Lebensstilsignale wie Rauchen,
Bewegungsmangel oder ein erhöhter Taillenumfang wie ein positives Resultat wirken.

Direkt behoben:

- Grün bleibt ausschliesslich echten positiven Rückmeldungen und starken
  Fitness-Testresultaten vorbehalten. Eigenständige offene Hinweise erhalten eine
  weisse Karte ohne statusabhängige Seitenlinie. Die farbige Seitenlinie bleibt
  ausschliesslich den klar eingeordneten Fitness-Kurztests vorbehalten.
- Die beiden tatsächlich eigenständigen Hinweise `koerperzusammensetzung` und
  `untergewicht` verwenden nun vollständig die Standardfelder «Warum das für Sie
  relevant ist», «Konkreter nächster Schritt» und «Erwarteter Nutzen».
- Signale, die bereits durch eine vollständige Empfehlung abgedeckt werden, erzeugen
  keinen zusätzlichen, teilweise doppelten Unterkasten mehr.
- Bei vorhandenem Taillenumfang nennt die Einordnung Messwert und Referenzstatus.
  Das mittlere Referenzband erzeugt nun einen Hinweis niedriger Priorität; das
  höchste Band bleibt ein mittlerer Hinweis.
- BMI-getriebene Varianten unterscheiden korrekt zwischen fehlendem, normalem und
  erhöhtem Taillenumfang. Der neutrale Titel «Körperzusammensetzung und Stoffwechsel»
  behauptet nicht mehr, der Auslöser sei immer der Bauchumfang.
- Das Taille-Grösse-Verhältnis wird vor Grenzentscheidungen nicht mehr auf zwei
  Dezimalstellen gerundet. Werte knapp unter 0,50 oder 0,60 werden dadurch nicht
  vorzeitig hochgestuft.
- Die kleine Metrikzeile wurde als sichtbare neutrale persönliche Einordnung
  gestaltet. Damit bleibt auch ein eingegebener Taillenumfang im Normalbereich
  klar erkennbar, ohne eine unnötige Handlungskarte zu erzeugen.

Bereinigt wurden die beiden nicht mehr referenzierten UI-IDs
`ui.signal.label.quick_win` und `ui.signal.label.clarify` sowie die dazugehörigen
grünen CSS-Regeln. Die reziproke Content-Prüfung belegt, dass kein Runtime-Vertrag
verloren ging. Drei neue personalisierte BMI-/Taillenumfangsvarianten und zwei
Nutzenfelder erhöhen den kanonischen Bestand netto von 780 auf 783 Texte.

Neue Grenz- und Kohärenztests decken Frauen bei 79/80/87/88 cm, Männer bei
93/94/101/102 cm, das geschlechtsneutrale Verhältnis an 0,50 und 0,60 sowie die
Kombinationen BMI im Adipositasbereich mit fehlendem oder normalem Taillenumfang ab.
Der finale Stand umfasst 106/106 erfolgreiche Tests.

Bewusst nicht autonom neu kalibriert wurde der Scorevertrag: Bei vorhandenem
Taillenumfang priorisiert `bodyNorm()` diesen Wert vor dem BMI, während das Signal
auch durch einen BMI im Adipositasbereich ausgelöst werden kann. Ebenfalls offen ist
die medizinische Referenzwahl für 16- und 17-Jährige. Beide Entscheide sind in der
Go-live-Checkliste festgehalten.

## 13. Evidenzbasierte Proteinempfehlungen

Die Meta-Analyse von Morton et al. wurde gegen Frage, Score, Empfehlungen,
Stärken, 4-Wochen-Plan, Coach und Quellenauftritt geprüft. Der geschätzte
Knickpunkt von 1,62 g/kg/Tag beschreibt den durchschnittlichen zusätzlichen
Zuwachs fettfreier Masse bei gesunden Erwachsenen mit Krafttraining. Er ist keine
harte biologische Grenze, keine allgemeine Mindestzufuhr und kein validierter
Schwellenwert für den Ernährungs-Score. Die eingeschlossenen Studien untersuchten
zudem keinen gezielten Energiemangel.

Direkt behoben:

- Die Proteinfrage nennt keine pauschalen 35–40 g je Mahlzeit mehr. Diese Vorgabe
  hätte je nach Körpergewicht stark unterschiedliche g/kg-Tageswerte bedeutet;
  mehrere bisherige Lebensmittelbeispiele erreichten die behauptete Menge zudem
  nicht zuverlässig. Die Frage bezeichnet sich jetzt ausdrücklich als
  Häufigkeits- und Verteilungsindikator.
- Die Normierung `selten` bis `fast_immer` bleibt unverändert. Ein Test belegt,
  dass dasselbe Antwortmuster bei 50 und 100 kg denselben Ernährungsscore und
  denselben Empfehlungstrigger erzeugt. Eine scheinpräzise Mengenbewertung wurde
  bewusst nicht eingeführt, weil tatsächliche Tagesmenge, Trainingslast,
  Energiebilanz und relevante medizinische Kontexte nicht erhoben werden.
- Die frühere Stärke «Gute Proteinversorgung» wurde in eine belegbare positive
  Routine umformuliert. Auch Empfehlung, Handlungsfeld und Hero-Thema behaupten
  keine gemessene Gesamtversorgung mehr.
- Erwachsene mit mindestens zwei angegebenen Krafttrainingstagen erhalten im
  Proteinplan eine eigene evidenzgebundene Variante: 1,4–1,6 g/kg/Tag als
  praktische Orientierung, Abflachung der durchschnittlichen Zusatzvorteile ab
  rund 1,6 g/kg/Tag und bis etwa 2,0 g/kg/Tag nur als möglicher individueller
  Spielraum bei sehr hoher Trainingsbelastung oder gezieltem Energiedefizit.
  Alter allein löst kein 2,0-g/kg-Ziel aus.
- Minderjährige sowie Erwachsene ohne mindestens zwei Krafttrainingstage sehen
  weiterhin die allgemeine, nicht numerische Planvariante. Nierenerkrankung und
  medizinisch verordnete Ernährung werden als fachliche Klärungsgrenzen genannt.
- Die quantitative Variante verweist strukturiert auf PubMed 28698222. Der
  Demo-Coach erkennt Protein-/Eiweissfragen nun vor der allgemeinen Fitnessroute
  und gibt dieselben Aussage- und Sicherheitsgrenzen wieder.
- Die pauschalen Aussagen, Protein stabilisiere den Blutzucker beziehungsweise
  schütze ab etwa 60 automatisch vor Muskelabbau, wurden entfernt. Ebenso wurde
  klargestellt, dass Proteinpulver nicht automatisch erforderlich und mehr
  Protein nicht automatisch besser ist.

Die drei numerischen Schlüsselbegriffe sind im Content-Workflow über
`requiredTerms` geschützt. Die kanonischen Kataloge, das Runtime-Bundle, die
Markdown-Übersicht und der CSV-Marketingexport wurden gemeinsam auf 786 Texte und
Quellversion `v1:93a0b69d80ebf086fbab55d0ae0edf6e5f84a15a5b2e0cb6524da5d00f7221b3`
regeneriert. Eine zweite Generierung war für alle drei Artefakte byte-identisch.

Vier neue Integrationstests sichern Fragevertrag, Gewichtsunabhängigkeit des
Scores, Alters-/Trainingsgrenze der quantitativen Variante, Quellenverknüpfung,
Stärkenbezeichnung und Coach-Routing. Der dynamische Content-ID-Test kennt die
neue Planvariante. Final erfolgreich: Content-Workflow 24/24, Integration 55/55,
Robustheit 21/21 und UI-Lifecycle 10/10, insgesamt 110/110 Tests; zusätzlich waren
alle JavaScript-Dateien syntaktisch valide.

Eine reale visuelle `file://`-Prüfung war durch die Sicherheitsrichtlinie der
verfügbaren Browser-Steuerung blockiert und wird nicht behauptet. Der bestehende
automatisierte Portabilitätstest für lokale Assets und klassische Script-Reihenfolge
bestand; die sichtbare Desktop-/Mobile-Abnahme der neuen Proteintexte bleibt damit
ein manueller Prüfschritt.

## 14. Redaktioneller Review-Export für Marketing, Medizin und Recht

CSV, Markdown-Übersicht, Importvertrag und Dokumentation wurden unabhängig als
Arbeitsmittel für nichttechnische Reviews geprüft. Der Bestand umfasste 786 Texte,
12 bisherige CSV-Spalten und eine 9'019-zeilige Markdown-Lesefassung. Technisch war
der Workflow sicher, redaktionell standen jedoch lange Hashes vor den Texten,
fachliche Themen waren nicht filterbar, interne englische Werte waren sichtbar und
CSV sowie Markdown verwendeten unterschiedliche Ordnungen.

Ein relevanter Datenvertragsfehler wurde behoben: 195 fachliche oder technische
Prüfhinweise lagen im bisherigen Feld `comment`, wurden im Export aber als
editierbarer `Marketing-Kommentar` bezeichnet. Damit hätte eine Rückmeldung die
Begründung für die Prüfung überschreiben können. `comment` erscheint nun
schreibgeschützt als `Prüfhinweis`; das neue optionale Katalogfeld
`reviewComment` wird separat als editierbarer `Review-Kommentar` importiert.

Direkt umgesetzt:

- CSV und Markdown werden aus demselben redaktionellen Datensatz erzeugt und
  identisch nach neun Gesundheitsbereichen, 44 Themen, Textfamilie und natürlicher
  Textreihenfolge sortiert.
- Die CSV beginnt mit Gesundheitsbereich, Thema, Seitenelement, verständlicher
  Textfunktion, Kontext sowie aktuellem und neuem Text. Technische ID, Domain,
  Austauschformat, Quellversion und Zeilen-Hash stehen am Ende.
- Platzhalter und zwingend geschützte Begriffe werden getrennt ausgewiesen.
- Die internen Statuswerte werden im Export vollständig und verständlich als
  `Nicht geprüft`, `Prüfung erforderlich` und `Freigegeben` gezeigt. Die Übersicht
  erklärt, dass `Freigegeben` die Zustimmung aller zugeordneten Stellen voraussetzt.
- Die Markdown-Lesefassung enthält Gebrauchshinweise, Status- und Reviewer-Zahlen,
  einen anklickbaren Arbeitsindex, menschlich lesbare Überschriften und eine sichere
  formatierte Textvorschau statt technischer Rohblöcke.
- Technische Familien- und Variantenschlüssel werden aus `Kontext / Variante`
  entfernt; englische oder implementierungsnahe Seitenelemente erscheinen als
  verständliche redaktionelle Bezeichnungen. Die technische ID bleibt separat für
  Entwicklung und Rückimport erhalten.
- Das neue Austauschformat 2 wird explizit versioniert. Bereits versandte Dateien
  des alten 12-Spalten-Formats bleiben importierbar; ein unveränderter alter
  `Marketing-Kommentar` wird dabei nicht fälschlich als neue Rückmeldung gespeichert.
- Der Import prüft weiterhin Vollständigkeit, unveränderte Metadaten, Zeilenhashes,
  Quellversion, Platzhalter, Pflichtbegriffe, erlaubtes HTML, Formelinhalte,
  Freigaberesets, Backups und transaktionales Rollback.
- Bei einer aktuellen Quellversion muss auch jede unberührte Zeile ihren aktuellen
  Zeilen-Hash tragen. Eine gleichzeitig manipulierte Metadaten- und Hashzelle kann
  nicht mehr fälschlich als erfolgreicher No-op passieren. Das bewusst lockere
  Verhalten bleibt nur für unberührte Zeilen eines explizit mit `--allow-stale`
  geprüften Altstands bestehen.
- Medizinische Coach-Notfalltexte werden vor dem allgemeinen Coach-Fallback unter
  «Medizin & Sicherheit» eingeordnet; thematische Coach-Antworten zu Ernährung,
  Fitness und Schlaf liegen bei ihrem jeweiligen Gesundheitsbereich.

Neue Regressionstests sichern die fachliche Zuordnung von Krafttraining, Kardio und
Protein, die natürliche Reihenfolge einer vollständigen Empfehlung, das human-first
Spaltenschema, flexible Spaltenreihenfolge, Legacy-Import, die Trennung von
Prüfhinweis und Review-Kommentar sowie den Schutz von Kopfzeile, IDs, Metadaten und
Freigabewerten. Die Reviewer-Dokumentation beschreibt zusätzlich den rollenbasierten
Filterablauf und warnt ausdrücklich davor, gefilterte oder ausgeblendete Zeilen zu
löschen. Nach zwei neu entdeckten Finder-Artefakten wurden ausschliesslich
`Projekt_Original/.DS_Store` und `Projekt_Original/content/.DS_Store` entfernt; der
Hygienetest belegt ihre Überflüssigkeit.

Bewusst nicht ergänzt wurden ein XLSX- oder HTML-Zweitworkflow, getrennte
Freigabestatus pro Rolle, frei erfundene Evidenzklassen und ein Teilimport. Diese
Erweiterungen würden zusätzliche Abhängigkeiten oder fachliche Governance-Entscheide
einführen. Die CSV bleibt daher der eine dependency-freie, vollständig geschützte
Rückimportvertrag; die Markdown-Datei bleibt die vollständige Lesefassung.

Final erfolgreich: Content-Workflow 27/27, Integration 55/55, Robustheit 21/21 und
UI-Lifecycle 10/10, insgesamt 113/113 Tests. `validate`, `check`, der No-op-Dry-Run
der realen Standard-CSV und die Syntaxprüfung aller JavaScript-Dateien waren
ebenfalls erfolgreich. Eine Browser- oder `file://`-Prüfung war für diese reine
Export-/Dokumentationsänderung nicht erforderlich und wurde nicht durchgeführt.

## 15. Einheitliche Kurztest-Einordnung und harmonisierte Wandsitz-Orientierung

Die Darstellung und fachliche Einordnung der Fitness-Kurztests wurde erneut gegen
den Scorevertrag, die sichtbaren Texte und die verfügbare Wandsitz-Evidenz geprüft.
Die frühere Mischung aus fünf technischen Referenzbezeichnungen, einer zusätzlichen
blauen Plakette und einem provisorischen Wandsitz-Hinweis war für Nutzende unnötig
kompliziert und widersprach der vierstufigen Standortbestimmung.

Direkt umgesetzt:

- Auswertbare Fitness-Kurztests verwenden sichtbar nur noch die vier bekannten
  Begriffe **Stark**, **Solide Basis**, **Ausbaufähig** und **Erhöhte
  Aufmerksamkeit**. Das konkrete Testergebnis in Sekunden beziehungsweise
  Wiederholungen steht direkt daneben; die zusätzliche blaue Referenzplakette wurde
  entfernt. Ein eigener numerischer 0–100-Testscore wird nicht angezeigt.
- Die farbige linke Seitenlinie bleibt als Ordnungselement der Kurztestkarten
  erhalten und folgt diesen vier Statusfarben. Gewöhnliche Hinweise innerhalb
  der fünf Dimensionen erhalten dagegen keine Schweregradlinie mehr. Die bereits
  bestehende magenta Hervorhebung eines Top-3-Aktionsschritts bleibt als eigener
  Navigationshinweis erhalten.
- Nutzersichtbare Erläuterungen beschreiben Ergebnis, Bedeutung und Relevanz in
  Alltagssprache. Interne Projektbegriffe wie «Navigator-Referenzmodell» oder
  «Navigator-Orientierungsmodell» wurden aus diesem Ergebnisweg entfernt.
- Der Wandsitz wird weiterhin ausschliesslich als Test der lokalen isometrischen
  Kraftausdauer der Bein- und Hüftmuskulatur behandelt. Er fliesst in die
  Muskulatur, nicht in die Kondition ein.
- Die alten praxisbasierten Vier-Gruppen-Benchmarks wurden durch acht
  Altersbänder für weiblich und männlich ersetzt. Die drei Grenzen jeder Zeile
  bilden *Stark*, *Solide Basis* und *Ausbaufähig* ab; darunter folgt *Erhöhte
  Aufmerksamkeit*. Die vollständige Tabelle und das verbindliche Testprotokoll
  stehen in `docs/QUELLEN.md`.
- Unter 18 Jahren und bei «intersex/andere» wird der Wandsitz mangels passender
  Vergleichsgruppe ausschliesslich als Rohwert gezeigt. Er erhält dann keine
  Kategorie, Statusfarbe, Scorewirkung oder automatisch ausgelöste Empfehlung.
  Dieselbe Fail-closed-Regel gilt bei anderen Kurztests, wenn Alter oder sichtbares
  Protokoll nicht zur hinterlegten Vergleichstabelle passen.
- Eine nächste Wandsitz-Kategoriegrenze darf im persönlichen Woche-4-Retest als
  Trainingsorientierung genannt werden, nie als medizinischer Zielwert oder
  versprochener Trainingserfolg. Der bestehende Schutz bei bekanntem Bluthochdruck
  bleibt erhalten.

### Evidenz- und Aussagegrenze

Die harmonisierte Wandsitz-Tabelle stützt sich auf publizierte Perzentildaten von
[McIntosh et al. 1998](https://www.researchgate.net/profile/Greg-Mcintosh/publication/233783627_Trunk_and_lower_extremity_muscle_endurance_Normative_data/links/55e75ee208ae3e1218420b71/Trunk-and-lower-extremity-muscle-endurance-Normative-data.pdf)
und die ergänzenden Daten für Frauen von 40 bis 59 Jahren von
[Koley & Bandyopadhyay 2024](https://doi.org/10.33438/ijdshs.1341842). Sie ist
bewusst geglättet und gerundet. Die publizierte Gruppe 60+ erlaubt nur eine
eingeschränkte Ableitung für 60–69; **ab 70 Jahren sind die Grenzen extrapoliert**.

[Janik et al. 2021](https://doi.org/10.1186/s40798-021-00338-2) zeigen den Einfluss
von Körpermassen, Proportionen und Testposition auf die Haltezeit.
[Lin et al. 2021](https://doi.org/10.2196/28040) berichten trotz guter
Testwiederholbarkeit ein relevantes Messrauschen; kleine Änderungen und Ergebnisse
nahe einer Grenze dürfen daher nicht überinterpretiert werden. Die Anwendung nennt
die vier Stufen folgerichtig **harmonisierte Trainingsorientierung**, nicht
klinische Norm, Diagnose oder Aussage zum individuellen Erkrankungsrisiko.

Die automatisierte Verifikation dieser Änderung umfasst die acht weiblichen und
männlichen Altersbänder an beiden Altersgrenzen sowie an allen drei
Leistungsschwellen, die ausgeschlossenen Kontexte, die vier Statusbegriffe, den
fehlenden Zusatz-Badge sowie die getrennten Seitenlinienverträge.

Final erfolgreich: Content-Workflow 28/28, Integration 56/56, Robustheit 21/21 und
UI-Lifecycle 11/11, insgesamt **116/116 Tests**. `validate`, `check`, der No-op-Dry-
Run der realen Standard-CSV und die Syntaxprüfung aller geänderten JavaScript-
Dateien waren ebenfalls erfolgreich. Runtime-Bundle, CSV und Markdown-Übersicht
blieben nach erneuter Generierung SHA-256-identisch. Eine echte visuelle Browser-
Abnahme war mit der verfügbaren Browser-Steuerung technisch nicht möglich und wird
nicht behauptet; die betroffenen Rendering- und CSS-Verträge sind statisch getestet.

## 16. Vollständige Vier-Sprachen-Architektur

Die bisher nur optisch vorhandene Sprachwahl wurde zu einer vollständigen
Lokalisierungsarchitektur für `de-CH`, `en-CH`, `fr-CH` und `it-CH` ausgebaut. Jede
Sprache besitzt denselben Bestand von 1'185 sichtbaren Text-IDs in sieben Domains.
Frage-IDs, Antwortwerte, Scoring, Risikosignale, Empfehlungsregeln und Prioritäten
bleiben sprachunabhängig.

Direkt umgesetzt:

- Die deutschen Dateien unter `content/result-texts/*.json` bleiben die kanonische
  Struktur- und Textquelle. EN, FR und IT liegen als schlanke, vollständige Overlays
  unter `content/result-texts/locales/<locale>/` und duplizieren keine Logik.
- Die beiden früheren Quellenseiten-Footer-IDs `sources.footer.tagline` und
  `sources.footer.disclaimer` wurden nach der Vereinheitlichung des Footers entfernt:
  Beide hatten danach keinen Runtime-Verweis mehr; Content-Workflow und statischer
  ID-Test bestätigen, dass keine verwendete Text-ID verloren ging.
- Startseite, Fragebogen, Ergebnisseite, Coach, Navigation, Modals, Quellenseite,
  Metadaten und Installationsmanifest werden aus demselben Textsystem lokalisiert.
  Im Locale-Katalog und in `ResultCopy` gibt es keinen stillen Rückfall einzelner
  fehlender Zielsprachtexte auf Deutsch. Nur bei einem vollständig fehlenden oder
  beschädigten Runtime-Bundle bleibt das deutsche HTML-Grundgerüst als enger
  Bootstrap-Notfallfallback sichtbar, damit keine leere Seite entsteht.
- Die Sprachwahl verwendet ausschliesslich den allowlist-validierten Parameter
  `?lang=` und einen separaten, nicht sensiblen Locale-Storage-Key. Antworten,
  Resultate und Plandaten bleiben beim Wechsel erhalten; Fragebogen- und
  Ergebnisansicht werden nach dem Reload wiederhergestellt.
- Das eingecheckte Runtime-Bundle enthält vier vollständige Sprachpakete und bleibt
  ohne Build, Server, npm oder Internetverbindung lauffähig. Pro Sprache wird ein
  eigenes Web-App-Manifest erzeugt; `manifest.webmanifest` bleibt der deutsche
  Kompatibilitätsalias.
- Private, Unternehmen, Gruppe und Blog verwenden verifizierte Helsana-Zielseiten
  je Sprache. Für myHelsana bleibt mangels bestätigter Sprachpfade bewusst der
  dokumentierte deutsche Fallback als Go-live-Entscheid offen.
- Die englische Krisenhilfe nennt sprachspezifisch Heart2Heart unter
  `0800 143 000` mit der offiziellen Erreichbarkeit 18–23 Uhr; DE, FR und IT
  behalten die landessprachliche Nummer 143. Der Notruf 144 bleibt davon getrennt.
- Locale-gerechte BMI-Ausgaben verwenden in `de-CH`/`en-CH` den Dezimalpunkt und in
  `fr-CH`/`it-CH` das Dezimalkomma. Eine fachlich widersprüchliche Erklärung zum
  Einbeinstand mit geschlossenen Augen wurde in allen Sprachen an den tatsächlich
  beschriebenen Test mit offenen Augen angepasst.

### Sicherer Übersetzungs- und Review-Workflow

Das CSV-Austauschformat 3 enthält bei Zielsprachen zusätzlich den deutschen
Ausgangstext, die Locale und den Übersetzungsvertrag. Der Import lehnt gemischte
Sprachen, fehlende Übersetzungen, strukturelle Abweichungen, entfernte Platzhalter,
HTML-Abweichungen, veraltete deutsche Ausgangsverträge und fehlende geschützte
Begriffe ab. Ein noch fehlender Text kann nicht allein durch eine Statusänderung
als übersetzt markiert werden; eine tatsächlich identische Übersetzung muss in
`Neuer Text` ausdrücklich bestätigt werden.

Notrufnummern, Kontaktangaben, ApoB/Lp(a), Proteinwerte, Einheiten und weitere
medizinisch relevante Aussagen besitzen auch in EN und FR sprachspezifische
`requiredTerms`. Neue `sync-locales`-Skelette bleiben eindeutig `missing` und
belegen das redaktionelle Kommentarfeld nicht mit einem technischen Hinweis vor.

Erzeugt werden vier CSVs, eine deutsche Standardübersicht plus vier
sprachspezifische Markdown-Übersichten, vier Sprachmanifeste, der deutsche
Manifest-Alias und das gemeinsame Runtime-Bundle. `review-report --all` fasst alle
Sprachen zusammen; `--all --fail-on-open` ist das gemeinsame Release-Gate. Aktuell
sind 0/4'740 Texte freigegeben. Das ist beabsichtigt: Die EN-, FR- und IT-Fassungen
sind KI-gestützte Erstübersetzungen und bleiben bis zur muttersprachlichen sowie
gegebenenfalls medizinischen und rechtlichen Prüfung vollständig auf
`needs-review`.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 40/40, Integration 58/58, Robustheit 22/22,
UI-Lifecycle 14/14, I18n-Static 14/14 und I18n-Runtime 4/4, insgesamt **152/152
Tests**. Alle vier Kataloge bestanden `validate`; `check` bestätigte Bundle, CSV,
Markdown und Manifeste. Der No-op-Dry-Run aller vier CSVs schrieb keine Datei. Eine
zweite vollständige Generierung war für sämtliche generierten Artefakte
SHA-256-identisch.

Die Browser-Steuerung blockierte den direkten `file://`-Aufruf aus
Sicherheitsgründen. Ein lokaler HTTP-Port durfte in der Ausführungsumgebung nicht
geöffnet werden. Deshalb wird keine neue interaktive Browser-, Konsolen- oder
visuelle Mobile-Abnahme behauptet. Die direkte Dateinutzung, Script-Reihenfolge,
Locale-Navigation, vier Manifeste, technische Sprachinvarianz und responsive
Verträge sind automatisiert geprüft; ein manueller Smoke-Test jeder Sprache auf
der Ziel-URL bleibt Bestandteil der Go-live-Checkliste.

## 17. Konservativer Abschluss-Review ohne fachliche oder visuelle Änderung

Der Stand wurde erneut vollständig gegen die Vorgabe geprüft, sichtbare Texte,
Übersetzungen, Layout, Fragen, Scores, Signale, Empfehlungen und Angebotslogik
unverändert zu lassen. Vor den Änderungen waren alle **152/152** vorhandenen Tests
erfolgreich.

Direkt umgesetzt wurden ausschliesslich technische Härtungen ohne neue sichtbare
Copy oder fachliche Logik:

- Hinweise zu den freiwilligen Fitness-Kurztests sind nun programmatisch mit dem
  jeweiligen Eingabefeld verbunden. Eine Validierungsfehlermeldung wird über
  `aria-describedby` nur referenziert, solange der Wert tatsächlich ungültig ist.
- Der Fortschrittsbereich verwendet eine gültige Gruppen-Semantik; die aktive
  Fragebogendimension ist die Seitenüberschrift. Die bisherige Darstellung bleibt
  durch identische CSS-Deklarationen erhalten.
- «Ergebnisse bearbeiten» verwendet den bereits bestehenden zentralen
  Navigationspfad und stellt den Fokus nach dem Rendern wieder her.
- Verschachtelte `covers`-Listen des öffentlichen Empfehlungskatalogs werden
  defensiv kopiert und eingefroren. Auswahllogik und Kataloginhalt ändern sich
  dadurch nicht.
- GitHub Pages führt `validate`, `check` und alle sechs Testsuiten vor dem Erzeugen
  des öffentlichen Artefakts aus. Die publizierte Dateiauswahl bleibt unverändert.
- Ein veralteter Kommentar zur Altersgrenze der Liegestütz-Referenz wurde an den
  bereits implementierten und dokumentierten Vertrag angepasst; Laufzeitcode wurde
  dabei nicht verändert.

Die folgenden Befunde wurden in diesem konservativen Review zunächst bewusst nicht
umgesetzt, weil ihre Korrektur sichtbares, fachliches oder anderweitig
nutzungsrelevantes Verhalten verändert hätte. Sie wurden anschliessend ausdrücklich
freigegeben und sind im aktuellen Stand gemäss Abschnitt 18 umgesetzt:

- Ein tiefer Einbeinstand kann bei Personen unter 18 trotz gesperrter Referenz eine
  Balance-Empfehlung auslösen.
- Der sprachgebundene PWA-`start_url` kann eine später gewählte Sprache beim Start
  über ein älter installiertes Homescreen-Icon erneut setzen.
- Der statische Seitenübersetzer kann bei einem teilweise beschädigten Bundle eine
  Mischsprache zeigen.
- Normale graue Hilfstexte und kleine Status-Badges erreichen teilweise nicht den
  angestrebten WCAG-Kontrast.
- Roving-Tabindex/Pfeiltasten für die eigenen Radio-Buttons und eine strengere
  Modal-Isolation würden die Tastaturinteraktion verändern.
- `context` und `section` waren noch nicht Bestandteil des deutschen
  Übersetzungsvertragshashs.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 40/40, Integration 58/58, Robustheit 23/23,
UI-Lifecycle 15/15, I18n-Static 14/14 und I18n-Runtime 4/4, insgesamt **154/154
Tests**. Alle vier Kataloge mit je 1'185 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, CSV, Markdown und Manifeste bytegenau. Syntaxprüfung
aller JavaScript-Dateien und `git diff --check` waren erfolgreich. Ein zusätzlicher
Vergleich von 179 systematisch variierten vollständigen Antwortprofilen ergab vor
und nach dem Review identische Scores, Signale, Empfehlungen, Pläne und Insights.

Vor den Änderungen wurde der zentrale Ablauf über einen lokalen statischen Server
real im Browser geprüft: Start, alle sechs Fragebogenbereiche und Ergebnisansicht
mit Score, Radar, fünf Dimensionen und drei Aktionskarten; die Browser-Konsole blieb
ohne Fehler oder Warnungen. Der direkte `file://`-Aufruf wurde von der
Browser-Sicherheitsrichtlinie blockiert. Nach einer Unterbrechung blockierte dieselbe
Steuerung auch das erneute Laden der lokalen URL. Deshalb werden weder ein realer
interaktiver `file://`-Test noch ein vollständiger visueller Vorher-/Nachher-
Vergleich, eine Browsermatrix, vier manuelle Sprachdurchläufe oder eine reale
Mobile-Abnahme behauptet. Die dafür relevanten Struktur-, Locale-, responsive- und
Portabilitätsverträge sind automatisiert grün.

## 18. Freigegebene Alters-, I18n-, PWA- und Accessibility-Härtung

In einem anschliessenden Auftrag wurden die in Abschnitt 17 zurückgestellten Punkte
ausdrücklich freigegeben und mit Regressionstests umgesetzt:

- Der Check akzeptiert Alter ab 16. Jüngere Werte werden auch aus gespeichertem,
  geteiltem oder manipuliertem Zustand vom zentralen Antwortschema verworfen. Bei
  16- und 17-Jährigen bleiben Fitness-Rohwerte sichtbar, erzeugen wegen fehlender
  passender Referenztabellen aber keine Referenzstufe, Statusfarbe, Score-, Signal-
  oder Empfehlungswirkung. Einbeinstand und Wandsitz werden ab 18, Liegestütze ab
  20 Jahren referenziert. Das Balance-Signal verwendet nur noch auswertbare
  Einbeinstand-Ergebnisse.
- Alle App-Manifeste verwenden den neutralen `start_url` `./`. Die separat
  gespeicherte aktuelle Sprachwahl wird dadurch beim Start über ein früher
  installiertes Homescreen-Icon nicht mehr von dessen damaliger Sprache
  überschrieben.
- `ResultCopy` prüft ein Zielsprachbundle vollständig gegen den deutschen ID- und
  Stringvertrag. Ein unvollständiges Bundle wechselt den gesamten Seitenaufruf auf
  das vollständige deutsche Notfallbundle, ohne die gespeicherte Sprachpräferenz zu
  überschreiben. `page-i18n` prüft alle statischen Kopien vor dem ersten DOM-Write;
  Teilübersetzungen und Mischsprachen werden dadurch verhindert.
- Gedämpfte Hilfstexte verwenden einen Neutralton mit mindestens 4,5:1 Kontrast auf
  Weiss und dem App-Hintergrund. Kleine farbige Status- und Fortschrittslabels nutzen
  eine dunkle Schrift, die auf allen verwendeten Statusfarben mindestens 4,5:1
  erreicht. Layout, Abstände und Statushintergründe bleiben unverändert.
- Eigene Radio-Gruppen verwenden Roving-Tabindex sowie Pfeiltasten, Home und End nach
  dem ARIA-Radio-Pattern. Maus, Tab, Enter und Leertaste bleiben erhalten.
- Beide Modalvarianten isolieren den Hintergrund mit `inert` und `aria-hidden`.
  Ein `focusin`-Guard schützt ältere Umgebungen; Attribute, Listener und vorheriger
  Fokus werden beim Schliessen wiederhergestellt.
- `section` und `context` sind nun Teil des Übersetzungsvertragshashs. `sync-locales`
  migriert ausschliesslich einen exakt passenden Altvertrag; bereits fachlich
  veraltete Hashes bleiben veraltet. 3'555 Hashes in 21 Overlay-Dateien wurden
  migriert. Ein automatischer Vergleich bestätigte, dass weder Übersetzungstexte
  noch Reviewstatus oder sonstige Overlay-Felder verändert wurden.

Die zusammengeführte Testsuite umfasst Content-Workflow 41/41, Integration 60/60,
Robustheit 23/23, UI-Lifecycle 18/18, I18n-Static 18/18 und I18n-Runtime 4/4, damit
insgesamt **164/164 Tests**. Alle vier Kataloge mit je 1'185 Texten sind valide;
Bundle, CSV, Markdown und Manifeste sind aktuell. Eine erneute Overlay-Migration ist
ein No-op. Der Vergleich der drei lokalisierten CSVs und aller vier Runtime-Textmaps
gegen den Ausgangsstand bestätigte identische redaktionelle Inhalte; geändert wurden
nur Vertrags- und Artefakthashes.

Die freigegebenen Laufzeitänderungen wurden zusätzlich real im Browser über einen
lokalen statischen HTTP-Server geprüft: Ein Alter von 15 wird mit `min="16"`,
`aria-invalid="true"` und gesperrter Navigation abgewiesen; 16 wird akzeptiert.
Pfeil-ab verschob Auswahl, Fokus und Roving-Tabindex innerhalb einer Radio-Gruppe
gemeinsam. Beim Navigationsmodal waren alle Hintergrundgeschwister gleichzeitig
`inert` und `aria-hidden`, Tab blieb im Dialog, Escape stellte den Fokus auf den
Auslöser zurück und hinterliess nach der Schliessanimation keine Attribute oder
Backdrop-Elemente. Ein Start ohne Sprachparameter behielt die zuvor gewählte
französische Sprache; DE, EN, FR und IT luden mit passendem Dokument-Locale,
Starttext und Manifest. Während dieser Prüfungen blieb die Browser-Konsole ohne
Warnungen oder Fehler. Ein pixelgenauer visueller Vorher-/Nachher-Vergleich, eine
Browsermatrix, Screenreader-Abnahme und ein interaktiver `file://`-Test wurden nicht
durchgeführt und werden nicht behauptet.

## 19. Mehrquellenbasierte Rangfolge persönlicher Stärken

Die Stärkenkarte war fachlich inkohärent zu einem sehr starken Fitnessprofil:
`st_rauchfrei` besass das höchste statische Gewicht, während Dimensionsscore und
positive Fitness-Kurztests gar nicht in die Rangfolge einflossen. Selbst das
vollständig starke Referenzprofil mit Fitnessscore 100 sowie auswertbaren
Topwerten in Muskulatur und Balance zeigte deshalb «Rauchfrei» vor Fitness.

Der aktuelle Vertrag trennt nun persönliche Aussagebreite vom medizinischen Risiko:

- Stufe 3 ist einem streng widerspruchsfreien Mehrquellenprofil vorbehalten;
- erreichte Ziele und konsistente Mehrfachmuster folgen auf Stufe 2;
- einzelne aktive Ressourcen folgen auf Stufe 1;
- reine Schutz-/Kontextfaktoren wie nie geraucht oder selten Alkohol füllen auf
  Stufe 0 verbleibende Plätze.

Innerhalb einer Stufe entscheiden Dimensionsscore, bestehendes Fachgewicht und die
stabile Katalogreihenfolge. Mehrfachmuster aus einer Dimension unter 80 werden für
die Rangfolge zurückgenommen; der bestehende Kohärenzfilter unter 45 und höchstens
eine Stärke je Dimension bleiben erhalten. Damit bleibt «Rauchfrei» verfügbar,
verdrängt aber keine drei breiter belegten Fähigkeiten oder Ziele mehr.

Die neue Stärke `st_fitness_top` erscheint nur bei Fitnessscore mindestens 90,
erreichtem WHO-Bewegungsziel, einem auswertbaren Top-Kurztest für Muskulatur, einem
auswertbaren Top-Kurztest für Balance, ausschliesslich starken zusätzlich
ausgefüllten auswertbaren Kurztests und ohne ausgelöste Fitness- oder
Stabilitäts-/Sturz-Empfehlung. Zwei Krafttests genügen nicht; ein gemischtes
Testprofil erzeugt auch bei hohem Fitnessscore keine Topaussage.
`reference_unavailable` und `age_outside_reference` können die Aussage nicht
stützen; praktische oder modellierte, aber scorebare Trainingsorientierungen
können sie bei einem starken Ergebnis stützen. Das Detail nennt das
WHO-Ziel ausdrücklich und bezeichnet die Testwerte als Orientierungsbereiche; die
Logik verändert weder Score noch Aktionsplan und behauptet keine VO₂max-Messung,
Leistungsdiagnostik oder individuelle Prognose.

Der frühere Rauchfrei-Superlativ wurde in allen vier Sprachen entfernt. Zwei neue
Content-IDs wurden kanonisch ergänzt, als KI-gestützte Erstübersetzungen auf
`needs-review` belassen und dem Marketing-Export unter «Körperliche Fitness ·
Allgemeine Fitness» zugeordnet. Runtime-Bundle, vier CSVs, fünf
Markdown-Übersichten und Manifeste wurden deterministisch regeneriert.

Die Regressionen decken das starke Referenzprofil, fehlende zweite Testkomponente,
zwei Tests desselben Teilbereichs, offenen Kraft-Handlungsbedarf, Score 89,
verfehltes WHO-Ziel, Minderjährige, intersex/andere Referenzgruppen, den
Rauchfrei-Fallback, Dimensions-Dedup und
deterministische Sprachinvarianz ab.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 41/41, Integration 65/65, Robustheit 24/24,
UI-Lifecycle 19/19, I18n-Static 18/18 und I18n-Runtime 4/4, insgesamt **171/171
Tests**. Alle vier Kataloge mit je 1'187 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, CSV, Markdown und Manifeste als aktuell.

Die deutsche Ergebnisansicht wurde mit dem starken Referenzprofil real über einen
lokalen statischen HTTP-Server geprüft. Auf Desktop erschien «Sehr starke
körperliche Fitness» vor Schlaf und Ernährung; «Rauchfrei» war nicht unter den
Top 3. Bei einem expliziten Mobile-Viewport von 390 × 844 Pixeln war die
Stärkenkarte 350 Pixel breit, erzeugte keinen horizontalen Seitenüberlauf und
brach Label sowie Details lesbar um. Die Browser-Konsole blieb ohne Warnungen oder
Fehler. Nach dem Test wurde der Viewport-Override zurückgesetzt und der lokale
Server beendet.

Nicht behauptet werden ein neuer interaktiver `file://`-Durchlauf, eine vollständige
Browsermatrix, Screenreader-/Zoom-Abnahme oder manuelle visuelle Durchläufe aller
vier Sprachen. Deren technische Sprachinvarianz und responsive Grundverträge sind
automatisiert geprüft; die vollständige Go-live-Abnahme bleibt offen.

## 20. Scoreunabhängige Vorsorge- und Abklärungshinweise

Ein Profil mit `familie_hk = ja` und `vorsorge = nein` behielt zu Recht einen
Einflussfaktoren-Score von 100, zeigte unter «Grösste Handlungsfelder» aber einen
leeren Zustand. Die Ursache war eine Routinglücke: `actionPlan()` konnte über den
Katalog-Fallback `ei_familie` wählen, während `keyLevers()` ausschliesslich Regeln
aus `LEVER_RULES` kannte. Für Familienrisiko und allgemeine fehlende Vorsorge gab
es dort keine Regel. Der ausführliche Aktionsplan und die Kurz-Zusammenfassung
widersprachen sich damit bei identischen Antworten.

Der aktuelle Vertrag behebt die Lücke ohne Scoreänderung:

- `lv_familie` spiegelt die vorhandene Familienkarte `ei_familie`;
- `lv_vorsorge` spiegelt `ei_vorsorge`, wenn keine Familienangabe vorliegt;
- bei beiden Antworten gewinnt wegen desselben Themas die spezifischere
  Familienkarte; `SIGNAL_PRESENTATION` erkennt sie auch als Abdeckung des
  generischen Vorsorgesignals;
- die breite Familienfrage bleibt ausserhalb von `cvRiskPattern()`, weil sie neben
  Herz-Kreislauf-Erkrankungen auch Diabetes und andere erbliche Erkrankungen umfasst;
- bei einem echten Kardio-Mehrfaktorenmuster kann ein zweiter Hebel derselben
  Dimension ab Priorität 8 sichtbar bleiben. Dadurch wird bekannter Bluthochdruck
  bei gleichzeitigem Rauchen nicht aus der Summary verdrängt;
- maximal zwei Hebel derselben Dimension sind in Summary und Aktionsplan erlaubt;
  eigenständige scorefreie oder `summaryOnly`-Hinweise dürfen einen freien zweiten
  Summary-Platz nutzen, ohne eine dritte Einflusskarte zu erzeugen;
- Untergewicht und ein auffälliges Körperprofil erhalten über
  `lv_untergewicht`/`lv_koerperprofil` eine `summaryOnly`-Einordnung. Aus BMI oder
  Taillenumfang allein wird ohne Verlauf, Beschwerden und Ursachen bewusst kein
  standardisierter 4-Wochen- oder Therapieplan erzeugt. Ein eigener fachlicher
  Klärungszustand ersetzt in diesem Fall den widersprüchlichen allgemeinen Leertext;
- scorefreie medizinische Haupthandlungsfelder verwenden einen neutralen Markenpunkt
  statt einer grünen Farbe aus dem unveränderten Dimensionsscore.

Der Familienplan konkretisiert zunächst Erkrankung, betroffene Person und
Erkrankungsalter. Blutdruck, Lipidprofil und die Frage nach einer einmaligen
Lp(a)-Bestimmung werden nur genannt, falls tatsächlich früh Herz-Kreislauf-
Erkrankungen in der Familie aufgetreten sind. ApoB bleibt ausdrücklich eine vom
individuellen Risikoprofil abhängige Zusatzfrage. So wird der gewünschte
kardiovaskuläre Vorsorgehinweis sichtbar, ohne die breite Ja/Nein-Frage in eine
Scheindiagnose umzudeuten.

Acht neue Lever-Texte wurden kanonisch ergänzt, in DE/EN/FR/IT auf
`needs-review` belassen und den fachlichen Review-Facetten «Herz-Kreislauf &
Vorsorge» beziehungsweise «Körperzusammensetzung & Stoffwechsel» zugeordnet. Der
konditionale Familienplan wurde in allen vier Sprachen aktualisiert; `Lp(a)` und
`ApoB` sind als geschützte Begriffe Teil des Übersetzungsvertrags. Runtime-Bundle,
vier CSVs, fünf Markdown-Übersichten und Manifeste wurden deterministisch neu
erzeugt.

Der unabhängige Abschlussreview ergänzte drei lokalisierte UI-Texte für den
Klärungszustand. Vorbelegte `reviewComment`-Felder der neuen Übersetzungen wurden
geleert; fachliche Ausgangshinweise bleiben ausschliesslich im schreibgeschützten
Prüfhinweis. Ein Regressionstest schützt diesen Redaktionsvertrag.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 42/42, Integration 70/70, Robustheit 24/24,
UI-Lifecycle 19/19, I18n-Static 18/18 und I18n-Runtime 4/4, insgesamt **177/177
Tests**. Alle vier Kataloge mit je 1'198 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, CSV, Markdown und Manifeste als aktuell. Die neuen
Regressionen decken unveränderte Scores, Familien-/Vorsorge-Bündelung,
Vorsorge allein, Untergewicht, BMI- und Taillenprofil sowie Bluthochdruck plus
Rauchen ab. Lange lokalisierte Summary-Texte besitzen zusätzlich einen getesteten
`min-width: 0`-/`overflow-wrap`-Vertrag für schmale Ansichten.

Ein realer Browserdurchlauf über den lokalen HTTP-Server prüfte Start-, Ergebnis-
und Quellenseite in DE/EN/FR/IT, Ergebnis-Sprachwechsel, öffnende Dimensionsdetails,
das Familienprofil, den reinen `summaryOnly`-Klärungszustand und das kombinierte
Familien-/Untergewichtsprofil. Desktop und 390 × 844 Pixel blieben ohne horizontalen
Überlauf; die Browser-Konsole meldete keine Warnungen oder Fehler. Der direkte
`file://`-Aufruf wurde von der Sicherheitsrichtlinie des eingebetteten Browsers
blockiert und deshalb nicht interaktiv bestätigt; belegt ist dort nur der grüne
automatisierte Doppelklickvertrag. Medizinische, muttersprachliche und vollständige
visuelle Go-live-Abnahmen bleiben offen.

## 21. Standard-Liegestütz und Altersabdeckung bis 94

Der weibliche Kurztest verwendet keine Knievariante mehr. Anleitung, Illustration,
Scoring, Ergebnistext und Retest beschreiben für Frauen und Männer denselben sauberen
Standard-Liegestütz von den Zehen. Die frühere Protokolldifferenz und der dadurch
ausgelöste Zustand «keine verlässliche Einordnung» wurden entfernt.

Die Referenzqualität bleibt bewusst sichtbar getrennt:

- Frauen 18–24: kleine direkte Adams-Skala; «sehr gut» und «gut» werden zur
  sichtbaren *Soliden Basis* gebündelt, sodass zehn Wiederholungen wie in der
  Studie positiv eingeordnet werden;
- Frauen 25–65: praktische Topend-Orientierung mit ausdrücklich unbekannter
  Originalquelle;
- Frauen 66–94 und Männer 70–94: konservativ anhand des Rikli/Jones-
  Arm-Curl-Altersverlaufs modellierte Trainingsorientierung;
- Männer 20–69: direkte CSEP/Payne-Referenz;
- Einbeinstand 18–99: direkte Altersreferenz; Wandsitz 18–94: harmonisierte,
  in höheren Bändern teilweise extrapolierte Trainingsorientierung.

Der unabhängige Abschlussreview fand und behob zusätzlich falsche Altersformulierungen
oberhalb der Wandsitz- und Einbeinstand-Referenzbereiche, den fehlenden sichtbaren
Transparenzhinweis beim harmonisierten Wandsitz sowie eine uneinheitliche Priorität
von Alters- und Geschlechtsausschluss. Die öffentliche Quellenseite verlinkt nun
Adams, Payne/CSEP, Topend und Rikli/Jones direkt. Standard-, praktische und
modellierte Daten werden nirgends als klinische Norm oder Diagnosegrenze bezeichnet.

Die bereits vorbereitete Bildlogik zeigt Taillenumfang und alle Fitnessillustrationen
auch vor einer Geschlechtsauswahl; standardmässig erscheint die weibliche Darstellung.
Nach Auswahl von «männlich» wird auf die männliche Variante gewechselt.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 42/42, Integration 74/74, Robustheit 24/24,
UI-Lifecycle 19/19, I18n-Static 18/18 und I18n-Runtime 4/4, insgesamt **181/181
Tests**. Alle vier Kataloge mit je 1'205 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, vier CSVs, fünf Markdown-Übersichten und Manifeste als
aktuell. Grenztests sichern 17/18, 19/20, 24/25, 94/95 und 99/100 Jahre,
intersex/andere Angaben, modellierte positive und negative Liegestützwerte sowie
die sichtbaren Referenzhinweise in DE/EN/FR/IT.

Die direkte empirische Evidenz für Standard-Liegestütze reicht nicht lückenlos bis
94. Die transparent modellierten Altersbänder bleiben deshalb vor Produktivfreigabe
eine offene medizinische und Product-Governance-Entscheidung.

## 22. Reduzierte Kurztestkarten ohne blaue Methodenboxen

Die zusätzlichen blauen Methoden- und Referenzhinweise wurden aus den sichtbaren
Ergebniskarten von Einbeinstand, Liegestütz und Wandsitz entfernt. Die Karten zeigen
weiterhin Einordnung, Messwert, Bedeutung, Relevanz, nächste Orientierung und eine
gegebenenfalls passende Empfehlung. Scoring, Referenzstatus, Schwellen und
Empfehlungslogik bleiben unverändert. Evidenzqualität, Modellierungen und fachliche
Grenzen sind weiterhin vollständig in `QUELLEN.md` und `SCORING_MODELL.md`
dokumentiert.

## 23. Plattformübergreifendes App-Icon mit Helsana-Verlauf

Das frühere Navigations- und Gesundheitssymbol wurde durch ein weisses Checkmark auf
dem Helsana-roten Verlauf der Startkachel ersetzt. `assets/app-icon.svg` ist die
kanonische Vektorquelle; daraus wurden die lokalen PNGs für Android mit 192 und 512
Pixeln sowie das Apple-Touch-Icon mit 180 Pixeln neu erzeugt. Der Verlauf verwendet
dieselben Farbstufen `#C01551`, `#9A0941` und `#5E0628` wie die Startkachel. Das
Checkmark bleibt innerhalb der sicheren Maskable-Zone, während der Verlauf die
gesamte Fläche ohne transparente oder schwarze Ränder ausfüllt.

Alle fünf Manifeste und beide HTML-Seiten verwenden weiterhin die bestehenden
relativen Icon-Pfade. Die SVG-Sicherheitsprüfung, PNG-Dimensionsprüfung, lokale
Serverdarstellung und die vollständigen 181 Regressionstests waren erfolgreich.

## 24. Geschlechtsneutrales Taille-Grösse-Verhältnis im Körperprofil

Der Check berechnet keine Taille-Hüfte-Ratio, weil kein Hüftumfang erhoben wird.
Bei vorhandener Taille und Körpergrösse verwendet er stattdessen das
Taille-Grösse-Verhältnis (WHtR) als gemeinsame Grundlage für Score, Signal,
Ergebnistext und das kardiovaskuläre Antwortmuster. Die früheren absoluten
geschlechtsspezifischen Zentimetergrenzen wurden ersetzt; dadurch gilt derselbe
Vertrag in DE, EN, FR und IT sowie für alle Geschlechtsangaben.

Die technische Normierung lautet: unter 0,40 und von 0,40 bis unter 0,50 grundsätzlich
+2, bei gleichzeitigem Untergewicht unter 0,40 jedoch 0; von 0,50 bis unter 0,60
Norm 0 mit tiefem Signal; ab 0,60 Norm −2 mit mittlerem Signal und bestehendem
50er-Deckel der Einflussdimension. Der Körperbaustein bleibt ein Siebtel der
Einflussdimension beziehungsweise 2,86 % des Gesamtscores. WHtR wird nicht zusätzlich
zu einem zweiten Taille- oder BMI-Malus gezählt. Bei Erwachsenen ab BMI 35 bleibt
trotz vorhandener Taille der BMI die Bewertungsgrundlage; fehlt der Taillenumfang,
ist der BMI ebenfalls der Fallback.

Ein unabhängiger Review fand zwei relevante Rundungsrisiken. BMI- und WHtR-Grenzen
verwenden deshalb ausschliesslich ungerundete Rechenwerte. Die sichtbare Ausgabe
zeigt normalerweise eine beziehungsweise zwei Dezimalstellen; nur wenn die Rundung
eine fachliche Grenze überschreiten würde, bleiben zusätzliche Stellen sichtbar.
So erscheint beispielsweise 86/173 als 0.497 und nicht widersprüchlich als
«0.50 (unter 0.50)». Die Dezimalzeichen sind in DE/EN Punkt und in FR/IT Komma.

NICE NG246 und das WHO-Messprotokoll sind auf der öffentlichen Quellenseite
verlinkt; die ergänzenden Meta-Analysen stehen in `QUELLEN.md` beziehungsweise
`SCORING_MODELL.md`. README,
Go-live-Checkliste, Handoff, alle vier Content-Kataloge, Runtime-Bundle, Manifeste,
CSVs und Review-Übersichten entsprechen demselben Stand. Schwangerschaft und weitere
Kontexte, in denen die einfache Messung nicht passend ist, bleiben als fachliche
Freigabepunkte dokumentiert.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 42/42, Integration 75/75, Robustheit 24/24,
UI-Lifecycle 19/19, I18n-Static 18/18 und I18n-Runtime 4/4, insgesamt **182/182
Tests**. Alle vier Kataloge mit je 1'206 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, vier CSVs, fünf Markdown-Übersichten und Manifeste als
aktuell. Grenzregressionen decken 0,40, 0,50, 0,60, Roh-BMI knapp unter 18,5, 25,
30 und 35, 16-/17-Jährige, BMI-Fallback und DE/EN/FR/IT ab.

Ein realer Browserlauf über den lokalen HTTP-Server prüfte den WHtR-Grenzfall
86/173 in allen vier Sprachen bei 390 Pixeln Breite. Wert, Kategorie und
Dezimalzeichen waren konsistent, es gab keinen horizontalen Überlauf und keine
Warnungen oder Fehler in der Browser-Konsole. Der direkte `file://`-Aufruf wurde
von der Sicherheitsrichtlinie des eingebetteten Browsers blockiert; dort belegt
der grüne automatisierte Doppelklickvertrag weiterhin Asset- und Scriptreihenfolge,
nicht jedoch einen interaktiven Browserlauf. Die medizinische und Product-Freigabe
des neuen WHtR-Vertrags bleibt vor einem klinisch verantworteten Go-live offen.

## 25. Entscheidungsnahe Körperprofil-Integration

Die separate blaue Metrikbox mit BMI, Taillenumfang und WHtR wurde aus dem
Dimensionskopf entfernt. Persönliche Körpermarker erscheinen nun im sicheren
`summaryOnly`-Körperprofil-Hinweis oder – sobald ein kardiovaskuläres
Mehrfaktorenmuster die definierte Schwelle erreicht – direkt als konkreter Faktor
in der Begründung des Vorsorge-Checks. Der Kardio-Hebel absorbiert den bereits
erklärten Körperprofil-Hebel auch in «Grösste Handlungsfelder»; dadurch erscheint
derselbe Befund weder im Dimensionsdetail noch in der Kurzliste doppelt.

Fitness, Ernährung, Schlaf und Mentales erhalten einen Körperprofil-Bezug nur an
der ersten ohnehin ausgelösten, fachlich passenden Empfehlung. Der Marker erzeugt
dort weder neue Empfehlungs-IDs noch ein vermeintliches Defizit. Beim BMI-Fallback
wählt häufiges Krafttraining zusammen mit erreichtem Bewegungsziel und guten
auswertbaren Krafttests ausschliesslich eine vorsichtigere Textvariante. Score,
Signal und fachlicher Klärungsbedarf bleiben unverändert, weil die Kurztests keine
Körperzusammensetzung messen.

Ein unabhängiger Abschlussreview fand zusätzlich zwei Randfälle: Die Kurzliste
konnte Kardio- und Körperprofil-Hebel parallel zeigen, und unvollständige optionale
Metrikobjekte konnten durch eine fehlende dynamische Text-ID den Kardio-Check still
unterdrücken. Die Themenabsorption gilt deshalb nun auch in `keyLevers()`; WHtR- und
BMI-Faktoren prüfen ihre benötigten Klassen vor der Formatierung und verwenden bei
unvollständigen Daten den sicheren allgemeinen Körperprofiltext.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 42/42, Integration 78/78, Robustheit 24/24,
UI-Lifecycle 19/19, I18n-Static 18/18 und I18n-Runtime 4/4, insgesamt **185/185
Tests**. Alle vier Kataloge mit je 1'213 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, vier CSVs, fünf Markdown-Übersichten und Manifeste als
aktuell. Ein realer Browserlauf über den lokalen Server prüfte Desktop und 390
Pixel Breite in DE, EN, FR und IT: persönliche WHtR-Faktoren und ergänzende
Körperprofiltexte waren lokalisiert, die blaue Metrikbox fehlte, es gab keinen
horizontalen Überlauf und keine relevanten Konsolenmeldungen.

Die medizinische, Product- und Marketing-Freigabe der heuristischen Gewichte im
kardiovaskulären Mustermodell, der konditionalen Querverweise und der neuen Texte
bleibt vor einem klinisch verantworteten Go-live offen.

## 26. Getrennte Familien-, Risiko- und Vorsorgefragen

Die drei ähnlichen Fragen erfassen nun klar getrennte Sachverhalte: bekannte
Erkrankungen in der nahen Familie, eine aktuelle professionelle Risikoeinschätzung
und das Wissen über persönlich passende Vorsorge. Alle drei bleiben scorefrei.
Damit kann ein sehr guter Gesundheitswert bestehen bleiben, während ein offener
Vorsorgebedarf trotzdem als priorisiertes Handlungsfeld sichtbar wird.

Der Fragebogen enthält bewusst keine zusätzliche Detailfrage zur Familiengeschichte.
Bei einer bekannten, teilweise bekannten oder unbekannten Familiengeschichte fordert
die Empfehlung stattdessen dazu auf, Erkrankung, betroffenes Familienmitglied,
ungefähres Diagnosealter und bei Krebs die Krebsart zu klären. Bei bekannter
Familienerkrankung bündelt eine einzige spezifische Karte gleichzeitig eine fehlende
professionelle Einschätzung und fehlendes Vorsorgewissen. Lp(a) wird nur bei früh
aufgetretenen Herz-Kreislauf-Erkrankungen als mögliche einmalige Bestimmung genannt;
ob ApoB zusätzliche Information liefert, bleibt ausdrücklich vom individuellen
Risikoprofil abhängig.

Die stabilen technischen IDs wurden mit dem aktuellen Antwortvertrag nochmals
verfeinert. Storage-Schema 4 und Ergebnislink-Schema 3 führen die drei Fragen in
der Reihenfolge Familiengeschichte, professionell geklärte Vorsorge und
Vorsorgewissen. Stände mit Schema 3 beziehungsweise Hash 2 übernehmen die frühere
offene Auswahl `aelter_unsicher` eindeutig als `nein`; bei älteren Ständen bleiben
alle anderen gültigen Angaben erhalten, während `familie_hk`, `familienwissen` und
`vorsorge` entfernt und im Abschnitt «Einflussfaktoren» neu abgefragt werden. Die
Dokumentation
`EMPFEHLUNGSLOGIK.md` beschreibt den vollständigen Weg von Antworten über Signale,
Hebel, Prioritäten und Deduplizierung bis zu den sichtbaren Texten.

### Verifikation und Grenzen

Final erfolgreich: Content-Workflow 42/42, Integration 82/82, Robustheit 25/25,
UI-Lifecycle 19/19, I18n-Static 18/18 und I18n-Runtime 4/4, insgesamt **190/190
Tests**. Alle vier Kataloge mit je 1'222 Texten bestanden `validate`; `check`
bestätigte Runtime-Bundle, vier CSVs, fünf Markdown-Übersichten und Manifeste als
aktuell.

Ein vollständiger DE-Browserlauf über den lokalen HTTP-Server bestätigte bei
bekannter Familiengeschichte, fehlender aktueller Einschätzung und fehlendem
Vorsorgewissen genau eine gebündelte Empfehlung bei unverändertem Score. Die drei
Fragen wurden zusätzlich in EN, FR und IT mit erhaltenen Auswahlwerten geprüft;
alle geprüften Tabs blieben ohne Konsolenwarnung oder -fehler. Ein angeforderter
390-Pixel-Viewport wurde vom eingebetteten Browser in dieser Sitzung nicht
übernommen. Für Mobile ist deshalb nur die grüne automatisierte Layoutsuite belegt,
nicht ein neuer visueller 390-Pixel-Durchlauf. Der direkte `file://`-Aufruf bleibt
in dieser Browserumgebung blockiert; der statische Doppelklickvertrag ist grün.
