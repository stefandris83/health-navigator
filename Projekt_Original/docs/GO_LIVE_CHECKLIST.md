# Go-live-Checkliste

Stand: Juli 2026. Diese Liste enthält nur Entscheide und Freigaben, die nicht
durch den Quellcode vorweggenommen werden können. Technisch bereits abgesicherte
Punkte stehen im Code-Review und werden hier nicht dupliziert.

## Hosting und Einbettung

- [ ] Ziel-Host, HTTPS-URL und allfälligen Unterpfad verbindlich festlegen; relative
  Asset-Pfade auf dieser Ziel-URL testen.
- [ ] Entscheiden, ob der Navigator als eigenständige Seite oder isoliert eingebettet
  wird. Bei Einbettung `frame-ancestors` auf die konkret freigegebenen Helsana-Hosts
  begrenzen.
- [ ] Einen isolierten, vertrauenswürdigen Origin ohne unkontrollierte Drittanbieter-
  Skripte, Tag-Manager oder Analytics bestätigen. `localStorage` und globale
  JavaScript-Objekte sind innerhalb desselben Origins für andere Skripte sichtbar.
- [ ] Server-Header freigeben und testen: CSP, `X-Content-Type-Options: nosniff`,
  Referrer-Policy, Permissions-Policy, HSTS sowie eine angemessene Cache-Policy für
  Seiten mit lokal verarbeiteten Gesundheitsangaben.
- [ ] Das lokal eingebundene `assets/helsana-logo.svg` durch Brand/Recht als korrektes,
  für diesen Einsatzzweck freigegebenes Markenasset bestätigen.
- [ ] `de-CH`, `en-CH`, `fr-CH` und `it-CH` auf der Ziel-URL inklusive
  Sprachwechsel, interner Navigation, Cache-Invalidierung und der vier
  Installationsmanifeste testen.

## Datenschutz und Recht

- [ ] Datenschutzerklärung, Impressum, rechtliche Hinweise, Nutzungsbedingungen,
  Cookie-Einstellungen und sämtliche übrigen Platzhalter-Links mit freigegebenen
  HTTPS-Zielen ersetzen.
- [ ] Die sichtbaren Aussagen zu Anonymität, lokaler Verarbeitung, KI-/Coach-
  Vorschau, Einwilligung und kurzlebigen Links durch Datenschutz/Legal freigeben.
  Insbesondere muss das Wording zum eingeloggten Kundenkontext passen.
- [ ] Persistenzdauer (`storageTtlDays`, heute 90 Tage) und Verhalten auf gemeinsam
  genutzten Geräten freigeben. Die Löschung nach Ablauf erfolgt beim nächsten
  Zugriff auf die Anwendung, nicht durch einen Hintergrunddienst.
- [ ] Entscheiden, ob bestehende Ergebnislinks weiter importiert werden dürfen
  (`resultLinkImportEnabled`). Im Standalone-Mock ist die Erstellung einschliesslich
  lokaler, gerätegebundener `file://`-Links aktiviert; `live` und `anonymous` bleiben
  ohne ausdrückliches Host-Override deaktiviert.
- [ ] Falls die Erstellung produktiv aktiviert wird: kanonische HTTPS-Basis
  (`resultLinkBaseUrl`), Legal-Hinweis und langfristige Ablösung durch eine
  serverseitige, kurzlebige Tokenlösung freigeben. Der aktuelle Payload ist codiert,
  nicht verschlüsselt.
- [ ] Bestätigen, dass weder Analytics noch Fehlertelemetrie Gesundheitsantworten,
  Scores, Produktinformationen oder Anzeigenamen erfassen.

## Kundenkontext und IT-Integration

- [ ] Produktion explizit mit `integrationMode: 'live'` oder `'anonymous'` starten;
  Mock-Modus und Demo-URL-Profile dürfen nicht produktiv aktiv bleiben.
- [ ] `live` nur wählen, wenn Kundenkontext benötigt wird; `anonymous` ist eine
  harte Grenze und ignoriert auch Bootstrap-, Adapter- und `setContext()`-Daten.
- [ ] Backend-for-Frontend beziehungsweise Host-Adapter bereitstellen. Login,
  Session, Token und echte Produktcodes bleiben ausserhalb des Navigators.
- [ ] Echte Produktcodes serverseitig auf die vier freigegebenen neutralen Kategorien
  abbilden; keine Policen-, Leistungs-, Schaden- oder Diagnosedaten liefern.
- [ ] Vertragsversion 1, Produktlimit, Timeout, Abort-Signal, Login, Logout,
  Re-Login und Fehler-Fallback mit der Zielplattform verifizieren.
- [ ] Echte Helsana-Angebotslinks hinterlegen und fachlich/rechtlich prüfen.
- [ ] Coverage-Zuordnungen und alle `service.coverage.*`-Texte durch Produkt,
  Marketing und Legal freigeben. Erst danach `coverageHintsEnabled: true` im
  Live-Modus setzen. Ein Hinweis ist keine Deckungs- oder Kostenzusage.

## Medizin, Content und Brand

- [ ] Die KI-gestützten Erstübersetzungen für EN, FR und IT muttersprachlich
  prüfen und alle jeweils zugeordneten medizinischen sowie rechtlichen Texte
  freigeben. Bis dahin bleibt jeder Zielsprachtext auf `needs-review`.
- [ ] Für verbleibende externe Helsana-Navigationen ohne bestätigten Sprachpfad
  (aktuell das myHelsana-Portal) entscheiden, ob der dokumentierte deutsche
  Zielseiten-Fallback bestehen darf oder durch einen freigegebenen
  sprachspezifischen Link ersetzt wird. Private, Unternehmen, Helsana-Gruppe und
  Blog besitzen bereits bestätigte DE-/EN-/FR-/IT-Ziele.
- [ ] Den offenen Vier-Sprachen-Review-Bericht (`review-report --all`) abarbeiten;
  technische Validität bedeutet nicht fachliche Freigabe. Den gemeinsamen Status
  `approved` erst setzen,
  wenn alle beim Text genannten Reviewer zugestimmt haben; personenbezogene
  Freigabeevidenz ausserhalb der CSV revisionsfähig führen.
- [ ] Medizinische Schwellen, Normtabellen, Risikosignale, Notfalltexte und sämtliche
  personalisierten Empfehlungen freigeben.
- [x] Mindestalter 16 technisch durchgängig umgesetzt: Jüngere Werte werden vom
  zentralen Antwortschema verworfen. Bei 16- und 17-Jährigen bleiben optionale
  Fitness-Kurztests als Rohwerte sichtbar, aber ohne Referenzstufe, Score-Einfluss
  oder automatische Empfehlung; die Standard-Liegestütz-Einordnung beginnt bei
  Frauen ab 18 und bei Männern ab 20.
- [x] Referenzmodell technisch vereinheitlichen: Bei Taille und Grösse wird für alle
  Geschlechter WHtR verwendet (0,40/0,50/0,60); alte absolute Zentimetergrenzen
  sind aus Score, Signal und Ergebnistext entfernt. Bei Erwachsenen mit BMI ≥ 35
  gilt trotz Taillenangabe der BMI; ohne Taillenangabe ist der BMI ebenfalls der
  Fallback.
- [ ] Medizinische und Product-Freigabe des WHtR-Vertrags einholen: besonders
  Bewertung unter 0,40, 16-/17-Jährige, Grenzen 0,50 und 0,60, BMI-35-Ausnahme,
  Schwangerschaft sowie Kontexte mit Essstörungen oder veränderter Körpergrösse.
- [x] Score-, Signal- und Kardio-Vertrag der Körperzusammensetzung vereinheitlichen:
  Ein zentrales Körperprofil priorisiert geschlechtsübergreifend WHtR und verwendet
  den BMI in zwei getrennten Fällen: bei Erwachsenen ab BMI 35 sowie bei fehlender
  Taillenangabe. Die medizinische Freigabe der Schwellen bleibt davon getrennt offen.
- [x] Liegestütz-Protokoll vereinheitlichen: Frauen und Männer führen denselben
  Standard-Liegestütz von den Zehen aus; die frühere weibliche Knie-Referenz ist
  vollständig aus Scoring und Nutzerführung entfernt.
- [ ] Die kleine direkte Adams-Orientierung 18–24, die praktische
  Topend-Frauenorientierung 25–65 und die modellierten Frauen- und Männerbänder
  bis 94 durch Medizin und Product freigeben. Die Adams-Skala ist noch nicht
  extern validiert, Topend nennt die Originalquelle unbekannt und die älteren
  Bänder übertragen einen Arm-Curl-Altersgradienten statt direkter Liegestütz-Normen.
- [x] Die früheren praxisbasierten Wandsitz-Benchmarks ersetzen: Implementiert ist
  eine aus publizierten Perzentilen abgeleitete, geglättete vierstufige
  Trainingsorientierung für den strikt ausgeführten beidbeinigen 90°-Wandsitz.
  Sie wird weder als klinische Norm noch als Diagnosegrenze bezeichnet.
- [ ] Den produktiven Einsatz der Wandsitz-Orientierung für ältere Personen durch
  die zuständige medizinische Governance ausdrücklich akzeptieren: Das Band 60–69
  ist nur eingeschränkt durch gepoolte 60+-Daten gestützt; ab 70 sind die Grenzen
  extrapoliert. Kleine Veränderungen und Grenzfälle sind wegen Protokolleinfluss
  und Messrauschen zurückhaltend zu interpretieren.
- [ ] Für das heuristische kardiovaskuläre Mustermodell (`cvRiskPattern`) fachliche
  Eigentümerschaft, Versionierung und medizinische Freigabe festlegen; es ist kein
  validierter Risikorechner.
- [x] Die breite Familienfrage vom Kardio-Mustermodell trennen: Sie umfasst auch
  Diabetes und sonstige erbliche Erkrankungen und zählt deshalb nicht mehr als
  kardiovaskulärer Musterfaktor. Eigenständiges medizinisches Signal und
  Familienempfehlung bleiben erhalten.
- [x] Scorefreie Vorsorgehinweise lückenlos in «Grösste Handlungsfelder» routen:
  `familie_hk = ja` nutzt die spezifische Familienkarte, `vorsorge = nein` die
  allgemeine Vorsorgekarte; treffen beide zu, erscheint keine Doppelung. Der Score
  bleibt in allen Fällen unverändert.
- [x] Medizinisch hohen Bluthochdruck in Mischprofilen vor Verdrängung schützen:
  Bei einem echten Kardio-Mehrfaktorenmuster kann der Kardio-Check neben Rauchstopp
  als zweites Haupthandlungsfeld derselben Dimension sichtbar bleiben.
- [x] Untergewicht und auffälliges Körperprofil ohne Scheingenauigkeit abbilden:
  Beide erhalten eine fachlich vorsichtige Summary; aus BMI oder Taillenumfang
  allein wird bewusst kein standardisierter 4-Wochen- oder Therapieplan erzeugt.
  Ein eigener Klärungszustand verhindert dabei einen widersprüchlichen Leertext.
- [ ] Prioritäten und DE-/EN-/FR-/IT-Texte der neuen Vorsorge- und Summary-Hebel
  durch Product, Marketing und Medizin freigeben. Besonders prüfen: konditionale
  Nennung von Lp(a) nur bei tatsächlich früher Herz-Kreislauf-Familiengeschichte,
  ApoB nur als vom individuellen Risikoprofil abhängige Zusatzfrage und neutrales
  Wording zu Untergewicht/Körperprofil sowie die drei neuen Klärungszustand-Texte.
- [x] Gesamtstatus gegen das Überdecken einer sehr schwachen Dimension schützen:
  Der numerische Wert bleibt der gleichgewichtete Mittelwert; liegt mindestens
  eine Dimension unter 40, ist der sichtbare Status höchstens «Solide Basis».
- [x] Moderate und intensive Aktivität im Fitnessscore als alternative Wege zum
  Bewegungsziel behandeln: Der bessere Normwert bildet das gemeinsame
  Aktivitätskomposit; die Treppenbelastung bleibt der alltagsnahe Gegenpart.
- [x] Technischen Feedbackpfad für 1–3 ausgefüllte Fitness-Kurztests umsetzen:
  Rohwert, einheitliche vierstufige Statusbegriffe, passende Kraft-/Balance-
  Empfehlung und persönlicher Woche-4-Retest sind vorhanden. Einbeinstand- und
  Wandsitzwerte unter 18, Liegestützwerte unter der geschlechtsspezifischen
  Untergrenze, Liegestütz-/Wandsitzwerte ab 95 sowie unpassende
  geschlechtsspezifische Referenzen bleiben ohne Kategorie, Statusfarbe,
  Score-Einfluss und automatische Empfehlung. Mit 94 sind alle drei Tests für
  weiblich und männlich technisch abgedeckt.
- [x] Breit bestätigte Spitzenfitness in der Stärkenkarte sichtbar priorisieren:
  Fitnessscore ab 90, erreichtes WHO-Bewegungsziel sowie auswertbare Top-Kurztests
  für Muskulatur und Balance sind gemeinsam erforderlich. Ein offener
  Fitness-Handlungsbedarf, zwei Tests desselben Teilbereichs oder eine unpassende
  Referenz verhindern die zusammengefasste Topaussage. Einfache Schutzfaktoren wie
  «Rauchfrei» bleiben als Füllkandidaten erhalten.
- [ ] Schwelle, Aussagebreiten-Rangfolge und DE-/EN-/FR-/IT-Texte der neuen
  Fitness-Topstärke durch Product, Marketing und Medizin freigeben. Insbesondere
  bestätigen, dass «oberster Orientierungsbereich» keine Leistungsdiagnostik,
  VO₂max-Aussage oder individuelle Gesundheits-/Longevity-Prognose bezeichnet.
- [x] Wandsitz im Fitness-Score medizinisch der Muskulatur zuordnen: Er misst lokale
  Bein-Kraftausdauer und bildet gemeinsam mit dem Liegestütz-Test die Testhälfte
  des Muskulatur-Sub-Scores; er wird nicht mehr der Kondition zugerechnet.
- [ ] Wandsitz-Sicherheitsvertrag anhand der aktuellen Evidenz zur akuten
  Blutdruckreaktion freigeben; bei bekanntem Bluthochdruck wird derzeit kein
  automatischer maximaler Retest empfohlen.
- [x] Proteinempfehlungen fachlich präzisieren: Die Frage ist als Häufigkeits- und
  Verteilungsindikator gekennzeichnet; die Krafttrainingsvariante nennt 1,4–1,6
  g/kg/Tag als Orientierung, 2,0 g/kg/Tag nur als konditionalen Spielraum und
  berücksichtigt Minderjährige sowie medizinische Kontexte defensiv.
- [ ] Verbleibendes Ernährungsmodell fachlich kalibrieren: Pflanzenvielfalt,
  Fisch versus Supplement und die verwendeten Häufigkeitsschwellen benötigen eine
  explizite Begründung. Die Sättigungsfrage ist scorefrei und löst nur noch eine
  Empfehlung aus. Soll Protein
  künftig quantitativ bewertet werden, braucht es eine separate Mengenerfassung
  und einen medizinischen Sicherheitsvertrag; die heutige Frage leistet das nicht.
- [ ] Alkoholerfassung um Menge und episodischen hohen Konsum ergänzen oder klar als
  unvollständige Häufigkeitsorientierung kennzeichnen.
- [ ] Mentale Dimension entweder ausdrücklich als nicht-klinisches Ressourcenprofil
  positionieren oder ein validiertes Instrument samt Lizenz-, Datenschutz- und
  Eskalationsprüfung auswählen.
- [ ] Die nun getrennten Aussagen zu ApoB und Lp(a) anhand ESC/EAS 2025 medizinisch
  und rechtlich freigeben; insbesondere darf daraus kein pauschaler Leistungs- oder
  Testanspruch entstehen.
- [ ] Den Ersatz der auffälligen Swissheart-Seite durch die geprüfte offizielle
  Werte-Seite medizinisch/redaktionell bestätigen und künftigen Linkrot-Prozess
  festlegen.
- [x] Gedämpfte Hilfstexte sowie kleine Status- und Fortschrittslabels erreichen
  technisch mindestens WCAG-AA-Kontrast 4,5:1; Statushintergründe, Layout und
  Abstände bleiben unverändert.

## Abnahme und Betrieb

- [ ] Ziel-Browsermatrix inklusive Safari/iOS, Chrome/Android, Edge, Zoom 200/400 %,
  Tastatur und mindestens einem Screenreader vollständig abnehmen.
- [ ] Desktop- und Mobile-Ansichten sowie Start, Fragebogen, Ergebnis, Modal,
  Radar, Atemübung, Chat-Vorschau, Wiederaufnahme und Reset visuell freigeben.
- [ ] Verantwortlichkeiten für Content-Import, Reviewstatus, Quellenprüfung,
  Security-Updates, Störungsbehandlung und Rücknahme eines fehlerhaften Releases
  benennen.
