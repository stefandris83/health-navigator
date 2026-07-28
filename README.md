# Health Navigator – Gesundheitscheck

Der Health Navigator ist eine statische, mehrsprachige Webanwendung für ein
strukturiertes Gesundheitsassessment. Sechs Fragebogenabschnitte führen zu fünf
Gesundheitsdimensionen, persönlichen Stärken, priorisierten Handlungsfeldern,
konkreten Empfehlungen und 4-Wochen-Plänen.

> Der Gesundheitscheck dient der präventiven Orientierung. Er ist keine medizinische
> Diagnose und ersetzt keine ärztliche oder andere professionelle Beratung.

## Live-Version

**[Health Navigator auf GitHub Pages öffnen](https://stefandris83.github.io/health-navigator/)**

## Wichtigste Funktionen

- Gesundheitsprofil aus Einflussfaktoren, Fitness, Ernährung, Schlaf und mentaler
  Gesundheit
- persönliche Stärken, priorisierte nächste Schritte und dimensionsbezogene Hinweise
- optionales Taille-Grösse-Verhältnis mit BMI-Fallback und entscheidungsnaher
  Einbindung in Körperprofil- und Vorsorgeempfehlungen
- optionale Fitness-Kurztests für Balance und Muskulatur mit alters- und
  geschlechtsspezifischen Orientierungswerten
- vollständige Benutzeroberfläche in Deutsch, Englisch, Französisch und Italienisch
- zentraler, CSV-gestützter Prozess für Textpflege, Übersetzung und Review
- lokale Speicherung im Browser; die Standalone-Version sendet keine Antworten an
  einen Server
- direkte Nutzung über `file://` und Veröffentlichung auf einem statischen Webserver
- responsive und tastaturbedienbare Oberfläche für Desktop und Mobile

## Anwendung starten

Die Anwendung benötigt keinen Build und keine Laufzeit-Abhängigkeiten.

1. [`Projekt_Original/index.html`](Projekt_Original/index.html) direkt im Browser
   öffnen; oder
2. optional einen lokalen Webserver starten:

```bash
cd Projekt_Original
python3 -m http.server 8000
```

Danach `http://localhost:8000` aufrufen.

Node.js wird nur für Tests und den Content-Workflow benötigt.

## Dokumentation

| Thema | Dokument |
| --- | --- |
| Vollständiges Assessment-, Scoring- und Empfehlungsmodell | [SCORING_MODELL.md](Projekt_Original/docs/SCORING_MODELL.md) |
| Textpflege, Übersetzungen und CSV-Workflow | [TEXTPFLEGE.md](Projekt_Original/docs/TEXTPFLEGE.md) |
| Technische und fachliche Integration | [INTEGRATION.md](Projekt_Original/docs/INTEGRATION.md) |
| Wissenschaftliche Quellen und Aussagegrenzen | [QUELLEN.md](Projekt_Original/docs/QUELLEN.md) |
| Offene Prüf- und Freigabepunkte | [GO_LIVE_CHECKLIST.md](Projekt_Original/docs/GO_LIVE_CHECKLIST.md) |
| Architektur und technische Reviewbefunde | [CODE_REVIEW.md](Projekt_Original/docs/CODE_REVIEW.md) |
| Vollständige Projektübergabe | [HANDOFF.md](Projekt_Original/HANDOFF.md) |
| Technische Detailbeschreibung | [Projekt-README](Projekt_Original/README.md) |

## Projektstruktur

```text
.github/workflows/             GitHub-Pages-Veröffentlichung
Projekt_Original/
├── index.html                 Anwendung
├── quellen.html               Öffentliche Quellenübersicht
├── assets/                    Logos, Icons und Testillustrationen
├── css/                       Styling und responsive Darstellung
├── js/                        Fragen, Scoring, Empfehlungen und UI
├── content/result-texts/      Kanonische Texte und Übersetzungen
├── exports/                   Generierte Review- und CSV-Artefakte
├── scripts/                   Content-Validierung und Generierung
├── tests/                     Dependency-freie Regressionstests
└── docs/                      Fachliche und technische Dokumentation
```

## Textpflege und Mehrsprachigkeit

Die deutschen JSON-Dateien unter `Projekt_Original/content/result-texts/` bilden die
kanonische Struktur. EN, FR und IT werden als vollständige Sprach-Overlays gepflegt.
Der Content-Workflow prüft unter anderem fehlende Texte, ungültige Platzhalter,
Metadaten und Abweichungen zwischen Quelldateien und generierten Artefakten.

Die wichtigsten Befehle werden in `Projekt_Original` ausgeführt:

```bash
node scripts/result-content.js validate
node scripts/result-content.js export --all
node scripts/result-content.js import exports/result-texte-review.csv --dry-run
node scripts/result-content.js check
```

Details und der sichere Importprozess stehen in
[`TEXTPFLEGE.md`](Projekt_Original/docs/TEXTPFLEGE.md).

## Tests

```bash
cd Projekt_Original
node scripts/result-content.js validate
node scripts/result-content.js check
node tests/content-workflow.test.js
node tests/integration.test.js
node tests/robustness.test.js
node tests/ui-lifecycle.test.js
node tests/i18n-static.test.js
node tests/i18n-runtime.test.js
```

Die Tests benötigen nur Node.js und keine Paketinstallation. Der GitHub-Pages-Workflow
führt dieselben Prüfungen vor jeder Veröffentlichung der Anwendung aus.

## Technischer Rahmen

Die Anwendung besteht aus HTML, CSS und Vanilla JavaScript. Klassische Skripte und
relative Pfade erhalten die direkte `file://`-Nutzung. Fragen, Antwortwerte, Scores,
Signale und Priorisierungen bleiben sprachunabhängig; die Locale steuert nur sichtbare
Texte und Metadaten.
