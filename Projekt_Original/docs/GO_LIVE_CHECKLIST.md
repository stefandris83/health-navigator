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

- [ ] Den offenen Review-Bericht (`review-report`) abarbeiten; technische Validität
  bedeutet nicht fachliche Freigabe. Den gemeinsamen Status `approved` erst setzen,
  wenn alle beim Text genannten Reviewer zugestimmt haben; personenbezogene
  Freigabeevidenz ausserhalb der CSV revisionsfähig führen.
- [ ] Medizinische Schwellen, Normtabellen, Risikosignale, Notfalltexte und sämtliche
  personalisierten Empfehlungen freigeben.
- [ ] Zielalter entscheiden: Der Fragebogen akzeptiert ab 12 Jahren, während Texte
  und mehrere Referenz-/Normtabellen für Erwachsene formuliert sind und die
  Liegestütznormen erst ab 20 beginnen.
- [ ] Referenzmodell der Körperzusammensetzung freigeben: absolute
  Taillenumfangsschwellen für Erwachsene versus einheitliches Taille-Grösse-Verhältnis,
  insbesondere für 12- bis 17-Jährige sowie nahe den Grenzen 0,50 und 0,60.
- [ ] Score-/Signalvertrag der Körperzusammensetzung entscheiden: Bei vorhandenem
  Taillenumfang priorisiert der Score derzeit diesen Wert vor dem BMI, während das
  Risikosignal auch durch einen BMI im Adipositasbereich ausgelöst werden kann.
- [ ] Liegestütz-Protokoll vereinheitlichen: Die weibliche CSEP-Referenz nutzt die
  Knie-Variante, die aktuelle Anleitung beschreibt den Standard-Liegestütz.
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
- [ ] Die Familienfrage fachlich vom Kardio-Mustermodell abgleichen: Sie umfasst
  auch Diabetes und sonstige erbliche Erkrankungen, wird dort aber heute als
  kardiovaskuläre Familiengeschichte gewichtet.
- [ ] Entscheiden, wie der Gesamtstatus mit einer sehr schwachen Einzeldimension
  umgeht. Der gleichgewichtete Mittelwert kann aktuell trotz eines Dimensionsscores
  von 0 insgesamt 80 beziehungsweise «Stark» ergeben.
- [x] Technischen Feedbackpfad für 1–3 ausgefüllte Fitness-Kurztests umsetzen:
  Rohwert, einheitliche vierstufige Statusbegriffe, passende Kraft-/Balance-
  Empfehlung und persönlicher Woche-4-Retest sind vorhanden. Unpassende
  Liegestützreferenzen sowie Wandsitzwerte unter 18 oder bei «intersex/andere»
  bleiben ohne Kategorie, Statusfarbe, Score-Einfluss und automatische Empfehlung.
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
  Fisch versus Supplement, Sättigungsdeckelung und die doppelte Gewichtung stark
  verarbeiteter Lebensmittel benötigen eine explizite Begründung. Soll Protein
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
- [ ] Kontrastbefunde bei gedämpften Texten und Statusfarben mit Brand/A11y
  entscheiden. Im Review wurde keine sichtbare Markenfarbänderung vorgenommen.

## Abnahme und Betrieb

- [ ] Ziel-Browsermatrix inklusive Safari/iOS, Chrome/Android, Edge, Zoom 200/400 %,
  Tastatur und mindestens einem Screenreader vollständig abnehmen.
- [ ] Desktop- und Mobile-Ansichten sowie Start, Fragebogen, Ergebnis, Modal,
  Radar, Atemübung, Chat-Vorschau, Wiederaufnahme und Reset visuell freigeben.
- [ ] Verantwortlichkeiten für Content-Import, Reviewstatus, Quellenprüfung,
  Security-Updates, Störungsbehandlung und Rücknahme eines fehlerhaften Releases
  benennen.
