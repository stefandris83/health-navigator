# Gesundheitscheck

Der Health Navigator ist eine statische Helsana-Webanwendung für ein strukturiertes
Gesundheitsassessment. Sechs Fragebogenabschnitte führen zu fünf bewerteten
Gesundheitsdimensionen, einem persönlichen Profil, konkreten persönlichen Stärken,
priorisierten nächsten Schritten, 4-Wochen-Plänen, weiteren dimensionsbezogenen
Handlungsschritten und medizinischen Klärungshinweisen sowie einer lokalen
regelbasierten Coach-Vorschau.

> Der Check ist keine medizinische Diagnose und ersetzt keine ärztliche oder andere
> professionelle medizinische Beratung.

## Direkt starten oder statisch publizieren

Es gibt keinen Build und keine Laufzeit-Abhängigkeiten. Die Anwendung ist für den
direkten Start von `index.html` per Doppelklick (`file://`) sowie für die unveränderte
Publikation auf einem statischen HTTPS-Webserver ausgelegt. Relative Assets,
klassische Skripte und das Fehlen lokaler Fetch-/Modulabhängigkeiten werden
automatisiert geprüft; ein vollständiger manueller `file://`-Smoke-Test bleibt Teil
der Browserabnahme. Terminal, Node.js, npm und lokaler Server sind für die Nutzung
nicht vorgesehen.

Node.js wird nur für die optionalen Tests und den Content-Workflow verwendet. Die
Kernanwendung lädt keine Daten vom Server. Auch das Helsana-Logo wird als lokales
SVG aus `assets/helsana-logo.svg` geladen; der zentrale Ablauf ist daher nicht von
einer externen Logo-Quelle abhängig. Nur externe Fach- und Angebotslinks benötigen
eine Internetverbindung.

## Sprachen

Die Anwendung unterstützt die vier Schweizer Sprachvarianten `de-CH`, `en-CH`,
`fr-CH` und `it-CH`. Die Sprachschalter DE, EN, FR und IT laden dieselbe statische
App mit dem erlaubten Parameter `?lang=<locale>` neu. Die Sprachwahl wird unter
`health-navigator.locale.v1` getrennt von Antworten und Plandaten gespeichert;
sie enthält keine Gesundheitsinformation. Ein Wechsel auf der Ergebnisseite
kehrt nach dem Reload wieder zur Ergebnisansicht zurück. Auch die Navigation zur
Quellenseite und zurück bewahrt die gewählte Sprache.

Die Locale bestimmt ausschliesslich sichtbare Texte, Metadaten und das
Installationsmanifest. Frage-IDs, Antwortwerte, Scores, Risikosignale und
Empfehlungsprioritäten sind in allen Sprachen identisch und werden durch einen
eigenen Regressionstest abgesichert. Ergebnislinks übernehmen nur den validierten
`lang`-Parameter; andere Query-Parameter werden nicht in einen Ergebnislink kopiert.

## Datenschutz und lokaler Zustand

Antworten und abgehakte Planschritte werden ausschliesslich im Browser gespeichert.
Der Standard-TTL beträgt 90 Tage; abgelaufene Daten werden beim nächsten Zugriff
entfernt (kein Hintergrunddienst). Beschädigte, unbekannte und zukünftige Schemata
werden verworfen. Der Kundenkontext wird niemals persistiert.

Ergebnislinks enthalten Antworten codiert, aber nicht verschlüsselt. Ihre Erstellung
ist im Standalone-Mock aktiviert; dort kann auch unter `file://` ein lokaler,
geräte- und pfadgebundener Link erzeugt werden. In `live` und `anonymous` bleibt die
Erstellung ohne ausdrückliches Host-Override deaktiviert und benötigt eine sichere
HTTPS-Seitenadresse oder eine konfigurierte kanonische HTTPS-Basis. Der Import
bestehender gültiger Links bleibt aus Kompatibilitätsgründen aktiv, überschreibt aber
nicht automatisch einen lokalen Stand. Ungültige Health-Navigator-Hashes werden
entfernt.

## Projektstruktur

```text
index.html / quellen.html        Statische Einstiegs- und Quellenseite
manifest*.webmanifest            Deutscher Kompatibilitäts- und vier Sprach-Manifeste
assets/helsana-logo.svg          Lokal eingebundenes Helsana-Markenasset
assets/app-icon.*                Rotes Verlaufs-Icon mit Checkmark (SVG und Mobil-PNGs)
css/styles.css                   Bestehendes Helsana-Look-and-Feel
js/config.js                     Validierte Laufzeitkonfiguration
js/questions.js                  Fragen und Antwortschema
js/persistence.js                Versionierter Storage- und Linkvertrag
js/scoring.js                    Score-, Kennzahl- und Risikosignal-Logik
js/recommendations.js            Stärken-, Empfehlungs- und Priorisierungsregeln
js/helsana.js                    Angebotsschlüssel und HTTPS-Ziele
js/integration.js                Minimaler, nicht persistierter CustomerContext
js/coach.js / js/radar.js        Regelbasierte Vorschau und SVG-Radar
js/result-copy.js                Sichere Runtime-Copy-API
js/result-copy.generated.js      Generiertes, eingechecktes Runtime-Bundle
js/locale.js / js/page-i18n.js   Locale-Vertrag und statische Seitenübersetzung
js/url-safety.js                 Gemeinsame HTTPS-Allowlist
js/app.js                        UI, Navigation und Lebenszyklus
content/result-texts/*.json      Kanonische deutsche App-Texte und Struktur
content/result-texts/locales/    Schlanke EN-/FR-/IT-Übersetzungs-Overlays
scripts/result-content.js        Validierung, Exporte und sicherer Reimport
exports/                         Generierte Review-Artefakte
tests/                           Dependency-freie Node-Regressionssuiten
docs/                            Integration, Scoring, Textpflege, Quellen und Reviews
```

Die klassischen Skripte und relativen Pfade sind Absicht: Sie erhalten die direkte
`file://`-Nutzung. Die Ladereihenfolge in `index.html` ist vertraglich getestet.

## Laufzeitkonfiguration

Eine Host-Seite setzt vor `js/config.js` den dedizierten Namespace. Ein vorhandenes
generisches `window.APP_CONFIG` wird aus Kompatibilitätsgründen nur als Legacy-Input
gelesen und niemals überschrieben.

```html
<script>
  window.HealthNavigatorConfig = {
    resultLinkEnabled: false,
    resultLinkImportEnabled: true,
    resultLinkBaseUrl: 'https://example.invalid/health-navigator/',
    storageTtlDays: 90,
    adapterTimeoutMs: 4000,
    integrationMode: 'live',
    demoProfilesEnabled: false,
    coverageHintsEnabled: false
  };
</script>
<script src="js/config.js"></script>
```

Für eine strikte CSP gehört diese Konfiguration in eine freigegebene externe Datei
oder in ein Script mit Nonce. Ungültige Werte fallen auf sichere Defaults zurück;
die wirksame `window.HealthNavigatorConfig` ist eingefroren.

| Einstellung | Standard | Wirkung |
| --- | --- | --- |
| `resultLinkEnabled` | `true` im Mock, sonst `false` | Blendet die Erstellung codierter Ergebnislinks ein. Im lokalen Standalone-Mock sind auch gerätegebundene `file://`-Links möglich. |
| `resultLinkImportEnabled` | `true` | Erlaubt den validierten Import vorhandener `#r=`-Links. |
| `resultLinkBaseUrl` | `null` | Optionale absolute HTTPS-Basis ohne Query/Hash für portable Links. |
| `storageTtlDays` | `90` | Gültigkeit lokaler Antworten und Plan-Häkchen (1–3650 Tage). |
| `adapterTimeoutMs` | `4000` | Adapter-Timeout (100–60'000 ms), danach anonymer Fallback. |
| `integrationMode` | `mock` | `mock`, `live` oder `anonymous`; `anonymous` blockiert Bootstrap, Adapter und direkten Kundenkontext. |
| `demoProfilesEnabled` | `true` im Mock | Erlaubt `?kunde=…` ausschliesslich im Mock-Modus. |
| `coverageHintsEnabled` | `true` im Mock, sonst `false` | Schaltet rechtlich zu prüfende Produkthinweise frei. |

Auf der Ergebnisseite erscheinen nicht priorisierte Hinweise direkt bei der fachlich
passenden Dimension. Eigenständige Hinweise folgen derselben Struktur wie die
Empfehlungskarten: persönliche Relevanz, konkreter nächster Schritt und erwarteter
Nutzen. Bereits durch eine Empfehlung abgedeckte Signale erzeugen keine zusätzliche
Doppelbox. Themen aus dem Aktionsplan werden aus demselben Empfehlungsobjekt
gespiegelt und als priorisierter Schritt markiert; die frühere separate Sektion
«Selbst beeinflussen vs. ärztlich abklären» besteht nicht mehr.

Scorefreie medizinische Angaben bleiben vom 0–100-Score getrennt, verschwinden aber
nicht aus der Zusammenfassung: bekannte familiäre Erkrankungen und eine noch nicht
erfolgte persönliche Risikoeinschätzung können eigene Haupthandlungsfelder und
Vorsorgekarten auslösen. Die breite Familienfrage wird dabei nicht pauschal als
Herz-Kreislauf-Anamnese gewertet. Untergewicht und ein auffälliges Körperprofil
erhalten eine vorsichtige Summary-Einordnung; ohne Angaben zu Verlauf, Beschwerden
und Ursache entsteht daraus bewusst kein automatischer Therapieplan. Ein eigener
Klärungszustand erklärt dies, statt gleichzeitig zu behaupten, es gebe kein
Handlungsfeld.

Die Stärkenkarte bevorzugt breit abgestützte persönliche Fähigkeiten und erreichte
Ziele vor einzelnen Schutzmerkmalen. Eine sehr hohe Fitness wird nur dann als
herausragende Topstärke zusammengefasst, wenn Fitnessscore, WHO-Bewegungsziel und
fachlich auswertbare Top-Kurztests für Muskulatur und Balance übereinstimmen und
alle zusätzlich ausgefüllten auswertbaren Kurztests ebenfalls im Topband liegen
sowie kein Fitness- oder Stabilitäts-/Sturz-Handlungsbedarf offen ist. Ohne diesen
Mehrquellenvertrag bleibt die
präzisere Einzelstärke wie «WHO-Bewegungsziel erreicht» sichtbar. Diese Rangfolge
ändert weder Scores noch den Aktionsplan.

Ausgefüllte Einbeinstand-, Liegestütz- und Wandsitz-Tests erscheinen immer direkt
in der Dimension «Körperliche Fitness». Rohwert, fachlich zulässige Einordnung,
persönliche Bedeutung und gesundheitliche Relevanz werden übersichtlich
ausgewiesen; Methoden- und Aussagegrenzen bleiben in `docs/QUELLEN.md` und
`docs/SCORING_MODELL.md` dokumentiert. Ein
Wert mit «Erhöhter Aufmerksamkeit» verweist auf dieselbe Kraft- oder
Balance-Empfehlung; liegt diese im Aktionsplan, ergänzt Woche 4 eine persönliche
Verlaufskontrolle mit dem ursprünglichen Testwert. Im Fitness-Score zählen
Liegestütz und Wandsitz gemeinsam zur Muskulatur und teilen sich deren Testhälfte;
der Wandsitz wird nicht als Kondition gewertet.

## Öffentliche Vorschau mit GitHub Pages

Nach der einmaligen Aktivierung von GitHub Pages veröffentlicht der Workflow
`.github/workflows/deploy-pages.yml` die Anwendung unter
`https://stefandris83.github.io/health-navigator/`. Jede Änderung an
`Projekt_Original` auf `main` löst eine neue Veröffentlichung aus; sie kann auch
manuell über den Tab «Actions» gestartet werden. Vor dem Erzeugen des
Upload-Artefakts führt der Workflow die Content-Prüfungen und alle vorhandenen
Tests aus; bei einem Fehler wird nicht veröffentlicht.

Veröffentlicht werden nur die Dateien, die der Check zur Laufzeit benötigt:
`index.html`, `quellen.html`, alle `manifest*.webmanifest`, `assets/`, `css/` und `js/`. Tests,
Dokumentation, Marketing-Exporte und Content-Arbeitsdateien sind nicht Teil der
öffentlichen Website. Die Anwendung speichert Antworten weiterhin nur lokal im
Browser.

## Auf dem Smartphone installieren

Über die HTTPS-Vorschau kann der Check als Verknüpfung auf dem Startbildschirm
abgelegt werden. In Chrome auf Android wählen Sie im Browsermenü «App installieren»
oder «Zum Startbildschirm hinzufügen». In Safari auf iPhone oder iPad wählen Sie
«Teilen» und danach «Zum Home-Bildschirm». Das lokale App-Symbol verwendet den
Helsana-roten Verlauf der Startkachel und ein weisses Checkmark; seine SVG-Quelle
liegt in `assets/app-icon.svg`. Die daraus erzeugten PNG-Varianten
`assets/app-icon-192.png`, `assets/app-icon-512.png` und
`assets/apple-touch-icon.png` sind für Android beziehungsweise iOS vorgesehen.

Die Anwendung bleibt eine statische Web-App: Für die Installation und spätere
Nutzung ist eine HTTPS-Adresse erforderlich. Ein Doppelklick auf die lokale
`index.html` funktioniert weiterhin, kann aber nicht als mobile App installiert
werden.

## Helsana-Integration

Gesundheitslogik und Versicherungslogik sind getrennt. `js/integration.js` verarbeitet
nur Loginstatus, optionalen Anzeigenamen und neutrale Produktkategorien. Echte
Authentifizierung, Sessions, Produktcodes und das Mapping gehören in die Helsana-
Plattform beziehungsweise ein Backend-for-Frontend.

Im Standalone-Mock sind folgende Testprofile verfügbar und werden nicht gespeichert:

```text
index.html?kunde=grund
index.html?kunde=zusatz-praevention
index.html?kunde=zusatz-komplett
```

Die Gesundheitsantworten werden unabhängig davon weiterhin lokal gespeichert. Live-
Bootstrap, Adaptervertrag, Abort-/Timeout-Verhalten, Login/Logout und Coverage-Regeln
stehen in [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Angebote und Fachquellen

Angebotsziele werden zentral in `js/helsana.js`, Fachquellen in `SOURCE_CONFIG` in
`js/recommendations.js` gepflegt. Externe Ziele müssen absolute HTTPS-URLs ohne
Zugangsdaten sein. `href: '#'` bleibt ein sichtbarer, nicht interaktiver Platzhalter.
Labels und übrige sichtbare Ergebnis-Copy liegen im Content-Katalog.

## App-Texte in vier Sprachen prüfen und zurückspielen

`content/result-texts/*.json` ist die kanonische deutsche Struktur- und Textquelle;
EN, FR und IT liegen als vollständige schlanke Overlays unter `locales/`. Das
gemeinsame Runtime-Bundle, die vier CSV-Dateien, Markdown-Übersichten und
sprachspezifischen Web-App-Manifeste werden deterministisch erzeugt und nie
manuell bearbeitet. Damit sind auch Installationsname und -beschreibung im
Marketing-Workflow enthalten. Die Manifeste starten sprachneutral; die zuletzt in
der App gewählte Sprache bleibt deshalb auch bei einem früher installierten
Homescreen-Icon massgeblich. Ein unvollständiges Sprachbundle führt geschlossen auf
das vollständige deutsche Notfallbundle zurück und erzeugt keine Mischsprache.

CSV und Markdown verwenden dieselbe redaktionelle Gruppierung nach Gesundheitsbereich
und Thema. Die CSV stellt aktuelle und neue Texte an den Anfang, zeigt verständliche
Textfunktionen und Freigabestatus und verschiebt technische IDs und Hashes ans Ende.
Fachliche `Prüfhinweise` sind schreibgeschützt; Rückmeldungen aus Marketing, Medizin
und Recht werden separat als `Review-Kommentar` zurückgespielt.

```bash
node scripts/result-content.js validate
node scripts/result-content.js review-report --all
node scripts/result-content.js overview --all
node scripts/result-content.js export --all
node scripts/result-content.js import exports/result-texte-review.csv --dry-run
node scripts/result-content.js import exports/result-texte-review.csv
node scripts/result-content.js check
```

Ein echter Import prüft IDs, Metadaten, Platzhalter, geschützte Begriffe, Quellhashes
und Konflikte, legt bei Text-, Kommentar- oder Statusänderungen ein Backup an und
aktualisiert JSON, Bundle, CSV, Übersicht sowie App-Manifest gemeinsam. Details:
[docs/TEXTPFLEGE.md](docs/TEXTPFLEGE.md).

## Tests

```bash
node scripts/result-content.js validate
node scripts/result-content.js check
node tests/content-workflow.test.js
node tests/integration.test.js
node tests/robustness.test.js
node tests/ui-lifecycle.test.js
node tests/i18n-static.test.js
node tests/i18n-runtime.test.js
```

Die Tests benötigen nur Node.js und keine Installation. Fachliche und rechtliche
Freigaben ersetzen sie nicht. Offene Entscheidungen sind zentral in
[docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) zusammengeführt;
das vollständige, implementierte Bewertungs- und Empfehlungsmodell steht in
[docs/SCORING_MODELL.md](docs/SCORING_MODELL.md). Die wissenschaftlichen Grundlagen
und Aussagegrenzen sind in [docs/QUELLEN.md](docs/QUELLEN.md) dokumentiert;
Reviewbefunde und getestete Architektur stehen in
[docs/CODE_REVIEW.md](docs/CODE_REVIEW.md).
