/*
 * questions.js
 * ---------------------------------------------------------------------------
 * Definition aller Bereiche und Fragen des Gesundheitschecks.
 *
 * Fragetexte, Antwortoptionen und Info-Boxen («Blauer Kasten») folgen 1:1 dem
 * finalen, rechtlich geprüften Fragenset «Fragebogen HN» (Fragenset-final).
 * Offensichtliche Tippfehler der Vorlage wurden korrigiert; alle Korrekturen
 * und bewussten Abweichungen sind in docs/QUELLEN.md (Abschnitt
 * «Abgleich mit dem finalen Fragenset») dokumentiert.
 *
 * Fragen, die NICHT im finalen Fragenset enthalten sind, bleiben unverändert
 * bestehen: Taillenumfang (bauchumfang), familiäre Erkrankungen ja/nein
 * (familie_hk) und Bluthochdruck (bluthochdruck).
 *
 * Frage-Schema:
 *   {
 *     id:        eindeutige ID (wird als Antwortschlüssel verwendet)
 *     text:      Fragetext (1:1 aus Spalte «Formulierung der Frage»)
 *     note:      optionale Zusatzzeile unter der Frage (z. B. Sicherheitshinweis)
 *     helpTitle: Titel der aufklappbaren Info-Box (aus «Hinweis (Blauer Kasten)»)
 *     help:      Inhalt der Info-Box (HTML erlaubt); ohne help keine Info-Box
 *     type:      'number' | 'single' | 'multi'
 *     unit:      Einheit bei number
 *     min/max:   Grenzen bei number
 *     optional:  true, wenn die Frage übersprungen werden darf
 *     dontKnow:  true, fügt Option «Weiss ich nicht» hinzu
 *     options:   [{ value, label, exclusive? }]
 *   }
 *
 * Eine Dimension mit `scored: false` (Persönliche Angaben) liefert nur
 * Kontext/Kennzahlen und ist keine eigene Radar-Achse.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

const DK = { value: 'unbekannt', label: 'Weiss ich nicht' };

// Zustimmungsskala für die Aussagen im Bereich «Mentales Wohlbefinden».
// Fragenset: Stimme völlig zu (+2) … Stimme gar nicht zu (−2), Mitte «Weder noch».
const AGREE = [
  { value: 'voll', label: 'Stimme völlig zu' },
  { value: 'eher', label: 'Stimme eher zu' },
  { value: 'teils', label: 'Weder noch' },
  { value: 'eher_nicht', label: 'Stimme eher nicht zu' },
  { value: 'gar_nicht', label: 'Stimme gar nicht zu' },
];

const DIMENSIONS = [
  /* ===================================================================== */
  /* F-0  Persönliche Angaben (nicht bewertet – liefert BMI / WHtR)         */
  /* ===================================================================== */
  {
    id: 'grund',
    title: window.ResultCopy.get('service.dimension.grund.title'),
    short: window.ResultCopy.get('service.dimension.grund.short'),
    icon: 'metabolism',
    scored: false,
    intro: window.ResultCopy.get('service.dimension.grund.intro'),
    questions: [
      {
        id: 'alter',
        text: 'Bitte geben Sie Ihr Alter in Jahren an.', // F-0.1
        type: 'number',
        unit: 'Jahre',
        min: 12,
        max: 119,
        placeholder: 'z. B. 45',
      },
      {
        id: 'geschlecht',
        text: 'Bitte wählen Sie Ihr biologisches Geschlecht aus.', // F-0.2
        type: 'single',
        options: [
          { value: 'maennlich', label: 'Männlich' },
          { value: 'weiblich', label: 'Weiblich' },
          { value: 'intersex', label: 'Intersex' },
        ],
      },
      {
        id: 'groesse',
        text: 'Bitte geben Sie Ihre Grösse in Zentimetern an.', // F-0.3
        type: 'number',
        unit: 'cm',
        min: 100,
        max: 299,
        placeholder: 'z. B. 175',
      },
      {
        id: 'gewicht',
        text: 'Bitte geben Sie Ihr Gewicht in Kilogramm an.', // F-0.4
        type: 'number',
        unit: 'kg',
        min: 30,
        max: 399,
        placeholder: 'z. B. 78',
      },
      {
        // Nicht im finalen Fragenset enthalten – bleibt unverändert (optional).
        id: 'bauchumfang',
        text: 'Kennen Sie Ihren Taillenumfang?',
        help:
          'Messen Sie nach normalem Ausatmen ungefähr auf halber Strecke zwischen der untersten ' +
          'tastbaren Rippe und der Oberkante des Beckenkamms. Bauchfett ist stoffwechselaktiv – das ' +
          'Verhältnis von Taille zu Körpergrösse ist oft aussagekräftiger als das Gewicht ' +
          'allein. Wenn Sie den Wert nicht kennen, lassen Sie das Feld einfach leer.',
        type: 'number',
        unit: 'cm',
        min: 40,
        max: 250,
        placeholder: 'z. B. 92',
        optional: true,
      },
    ],
  },

  /* ===================================================================== */
  /* F-1 / S-1  Einflussfaktoren                                            */
  /* ===================================================================== */
  {
    id: 'einfluss',
    title: window.ResultCopy.get('service.dimension.einfluss.title'),
    short: window.ResultCopy.get('service.dimension.einfluss.short'),
    icon: 'shield',
    intro: window.ResultCopy.get('service.dimension.einfluss.intro'),
    questions: [
      {
        id: 'stabilitaet', // F-1.1 «Stabilität im Alltag» (Sicherheitsgefühl bei Bewegungen)
        text:
          'Wie sicher fühlen Sie sich bei alltäglichen Bewegungen? (z. B. beim Aufstehen vom ' +
          'Boden, beim Gehen auf Waldwegen, beim Heruntersteigen von einem Hocker)',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Wer einmal gestürzt ist, hat ein hohes Risiko für weitere Stürze. Daher zählen Stürze ' +
          'zu den häufigsten Gesundheitsrisiken im Alter. Schon ein Sturz kann die Selbstständigkeit ' +
          'und Lebensqualität aufgrund von Verletzungen stark beeinträchtigen. Die gute Nachricht: ' +
          'Mit gezieltem Training von Gleichgewicht, Kraft und Beweglichkeit sinkt das Risiko erheblich.',
        type: 'single',
        options: [
          { value: 'sehr_sicher', label: 'Sehr sicher' },
          { value: 'sicher', label: 'Sicher' },
          { value: 'weder', label: 'Weder noch' },
          { value: 'unsicher', label: 'Unsicher' },
          { value: 'sehr_unsicher', label: 'Sehr unsicher' },
        ],
      },
      {
        id: 'sitzzeit', // F-1.2
        text:
          'Wie viele Stunden verbringen Sie an einem typischen Tag im Sitzen oder Liegen? ' +
          '(z. B. Arbeit/Ausbildung, Essen, Verkehr, Medien/Freizeit, Entspannung, aber ohne ' +
          'Schlaf/Nickerchen)',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Langes Sitzen oder Liegen (ohne Schlaf) erhöht das Risiko für Herz-Kreislauf-Erkrankungen ' +
          'und Diabetes. Bereits eine kurze stündliche Pause (aufstehen, strecken, ein paar Schritte ' +
          'gehen oder die Treppe nehmen) senkt dieses Risiko deutlich.',
        type: 'single',
        options: [
          { value: 'u4', label: 'Weniger als 4 Stunden' },
          { value: 's4_6', label: '4–6 Stunden' },
          { value: 's7_8', label: '7–8 Stunden' },
          { value: 's9_10', label: '9–10 Stunden' },
          { value: 'ue10', label: 'Mehr als 10 Stunden' },
        ],
      },
      {
        id: 'familienwissen', // F-1.3 «Familiäre Krankheitsgeschichte»
        text: 'Wie gut wissen Sie über mögliche Krebs- oder Herz-Kreislauferkrankungen in Ihrer Familie Bescheid?',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Das Bewusstsein über familiäre Krebs- und Herz-Kreislauferkrankungen macht eine gezielte ' +
          'Vorsorge möglich. Wer seine familiäre Vorbelastung kennt, kann frühzeitig den persönlichen ' +
          'Risikofaktoren entgegensteuern und mit gezielten Vorsorgeuntersuchungen die Früherkennung ' +
          'fördern.',
        type: 'single',
        options: [
          { value: 'sehr_gut', label: 'Sehr gut' },
          { value: 'gut', label: 'Gut' },
          { value: 'teilweise', label: 'Teilweise' },
          { value: 'wenig', label: 'Wenig' },
          { value: 'gar_nicht', label: 'Gar nicht' },
        ],
      },
      {
        id: 'vorsorge', // F-1.4 «Regelmässige Vorsorgeuntersuchung» – ohne Score-Einfluss (Ø)
        text:
          'Haben Sie sich zu Krankheiten wie Krebs, Bluthochdruck und Typ-2-Diabetes informiert ' +
          'und Ihr persönliches Risiko einschätzen lassen?',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Bluthochdruck bleibt oft unbemerkt, ist aber ein zentraler Risikofaktor für ' +
          'Herz-Kreislauf-Erkrankungen. Auch eine Abklärung zum persönlichen Risiko von Krebs- oder ' +
          'ersten Anzeichen von Typ-2-Diabetes kann sich je nach Alter, Lebensstil oder ' +
          'Familiengeschichte lohnen. Durch eine frühe Identifikation und kleine Veränderungen im ' +
          'Alltag lassen sich Risiken und Auswirkungen senken.',
        type: 'single',
        options: [
          { value: 'ja', label: 'Ja' },
          { value: 'nein', label: 'Nein' },
        ],
      },
      {
        id: 'rauchen', // F-1.5
        text: 'Rauchen Sie oder haben Sie in der Vergangenheit geraucht? (z. B. Zigaretten, Vapes, Shisha)',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Ein Rauchstopp lohnt sich immer und in jedem Alter. Bereits nach einem Tag werden ' +
          'Atemwegsreizungen reduziert, in wenigen Monaten verbessert sich Ihr Kreislauf und Ihre ' +
          'Lungenfunktion. Nach etwa einem Jahr ist das Risiko für eine koronare Herzkrankheit ' +
          'ungefähr halb so hoch wie bei weiterem Rauchen. Ausserdem ' +
          'erholt sich Ihr Geruchssinn, das Essen schmeckt besser und Sie fühlen sich leistungsfähiger.',
        type: 'single',
        options: [
          { value: 'ja_regelmaessig', label: 'Ja, regelmässig' },
          { value: 'ja_gelegentlich', label: 'Ja, manchmal' },
          { value: 'nie', label: 'Nein, nie' },
          { value: 'frueher', label: 'Nicht mehr' },
          { value: 'keine_angabe', label: 'Keine Angaben' },
        ],
      },
      {
        id: 'alkohol', // F-1.6
        text: 'Wie häufig haben Sie im letzten Monat alkoholische Getränke konsumiert?',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Die Vorstellung, dass ein Glas Wein pro Tag gesund sei, ist ein Mythos, der auf ' +
          'fehlerhaften Studien beruht. Bereits in geringen Mengen erhöht Alkohol das Risiko für ' +
          'Krebs und Herz-Kreislauf-Erkrankungen. Auch das Suchtpotential von Alkohol, selbst bei ' +
          'geringen Mengen und regelmässigem Konsum, wird stark unterschätzt.',
        type: 'single',
        options: [
          { value: 'nie_selten', label: 'Nie oder selten' },
          { value: 'm1_4', label: '2–4 x pro Monat' },
          { value: 'w2_3', label: '2–3 x pro Woche' },
          { value: 'w4plus', label: '4 x oder öfter pro Woche' },
          { value: 'keine_angabe', label: 'Keine Angaben' },
        ],
      },
      {
        id: 'socialmedia', // F-1.7
        text: 'Verbringen Sie mehr Zeit mit Social Media als Ihnen lieb ist?',
        helpTitle: 'Haben Sie gewusst?',
        help:
          'Social Media kann ein Suchtpotenzial darstellen und sowohl die psychische als auch die ' +
          'allgemeine Gesundheit beeinträchtigen. Dazu zählen Schlafstörungen, Depressionen, ' +
          'Angstzustände und soziale Konflikte.',
        type: 'single',
        options: [
          { value: 'nein', label: 'Nein' },
          { value: 'selten', label: 'Selten' },
          { value: 'manchmal', label: 'Manchmal' },
          { value: 'oft', label: 'Oft' },
          { value: 'sehr_oft', label: 'Sehr oft' },
        ],
      },
      {
        // Nicht im finalen Fragenset enthalten – bleibt unverändert.
        // Fliesst NICHT in den Score ein, nur als Risikosignal/Hinweis.
        id: 'familie_hk',
        text: 'Gibt es in Ihrer nahen Familie (Eltern, Geschwister) Herz-Kreislauf-Erkrankungen, Diabetes oder erblich bedingte Erkrankungen?',
        help:
          'Besonders relevant sind früh aufgetretene Erkrankungen (Männer vor 55, Frauen vor 65 Jahren). ' +
          'Eine familiäre Vorbelastung ist kein Schicksal – sie ist ein Grund, Vorsorge ernst zu nehmen.',
        type: 'single',
        options: [
          { value: 'nein', label: 'Nein' },
          { value: 'ja', label: 'Ja' },
          { value: 'weiss_nicht', label: 'Weiss ich nicht' },
        ],
      },
      {
        // Nicht im finalen Fragenset enthalten – bleibt unverändert.
        // Fliesst NICHT in den Score ein, nur als Risikosignal/Hinweis.
        id: 'bluthochdruck',
        text: 'Wurde bei Ihnen ärztlich Bluthochdruck festgestellt oder nehmen Sie Blutdruckmedikamente?',
        help:
          'Bluthochdruck (ab ca. 140/90 mmHg) verläuft oft unbemerkt, lässt sich aber gut behandeln. ' +
          'Wenn Sie unsicher sind, lohnt sich eine Messung.',
        type: 'single',
        options: [
          { value: 'nein', label: 'Nein' },
          { value: 'ja', label: 'Ja' },
          { value: 'weiss_nicht', label: 'Weiss ich nicht' },
        ],
      },
    ],
  },

  /* ===================================================================== */
  /* F-2 / S-2  Körperliche Fitness                                         */
  /* ===================================================================== */
  {
    id: 'fitness',
    title: window.ResultCopy.get('service.dimension.fitness.title'),
    short: window.ResultCopy.get('service.dimension.fitness.short'),
    icon: 'activity',
    intro: window.ResultCopy.get('service.dimension.fitness.intro'),
    questions: [
      {
        id: 'ausdauer_moderat', // F-2.1
        text: 'Wie viele Stunden moderate Ausdaueraktivität machen Sie pro Woche?',
        helpTitle: 'Was bedeutet moderate Ausdaueraktivität?',
        help:
          'Sie atmen schneller als normal, können sich aber noch unterhalten (z. B. zügiges Gehen, ' +
          'langsames Radfahren, Schwimmen in mässigem Tempo).' +
          '<br><br><b>WHO-Empfehlung:</b> Mindestens 150 Minuten moderate Aktivität pro Woche, ' +
          'wobei jede Aktivitätsdauer zählt.',
        type: 'single',
        options: [
          { value: 'u30', label: 'Weniger als 30 min' },
          { value: 'm30_75', label: '30 min – 1 h 15 min' },
          { value: 'm75_150', label: '1 h 15 min – 2 h 30 min' },
          { value: 'm150_300', label: '2 h 30 min – 5 h' },
          { value: 'ue300', label: '5 h oder mehr' },
        ],
      },
      {
        id: 'ausdauer_intensiv', // F-2.2
        text: 'Wie viele Stunden intensive Ausdaueraktivität machen Sie pro Woche?',
        helpTitle: 'Was bedeutet intensive Ausdaueraktivität?',
        help:
          'Sie geraten ins Schwitzen und können nur noch wenige Worte oder gar nicht mehr sprechen ' +
          '(z. B. Joggen, schnelles Radfahren, intensives Schwimmen).' +
          '<br><br><b>WHO-Empfehlung:</b> Mindestens 75 Minuten intensive Aktivität pro Woche, ' +
          'wobei jede Aktivitätsdauer zählt.',
        type: 'single',
        options: [
          { value: 'keine', label: 'Keine' },
          { value: 'u30', label: 'Weniger als 30 min' },
          { value: 'm30_75', label: '30 min – 1 h 15 min' },
          { value: 'm75_150', label: '1 h 15 min – 2 h 30 min' },
          { value: 'ue150', label: '2 h 30 min oder mehr' },
        ],
      },
      {
        id: 'krafttraining', // F-2.3
        text: 'An wie vielen Tagen pro Woche machen Sie Krafttraining?',
        helpTitle: 'Was ist Krafttraining?',
        help:
          'Muskelkräftigende Übungen mit Gewichten, Geräten oder dem eigenen Körpergewicht ' +
          '(z. B. Liegestütze, Kniebeugen oder Hanteltraining).' +
          '<br><br><b>WHO-Empfehlung:</b> Mindestens zweimal pro Woche für alle wichtigen Muskelgruppen.',
        type: 'single',
        options: [
          { value: 'tage0', label: '0 Tage' },
          { value: 'tage1', label: '1 Tag' },
          { value: 'tage2', label: '2 Tage' },
          { value: 'tage3plus', label: '3 Tage oder mehr' },
        ],
      },
      {
        id: 'beweglichkeit', // F-2.4
        text: 'Wie schwer fällt es Ihnen, ohne Hilfe vom Boden aufzustehen?',
        type: 'single',
        options: [
          { value: 'gar_nicht', label: 'Überhaupt nicht schwer' },
          { value: 'wenig', label: 'Wenig schwer' },
          { value: 'maessig', label: 'Mässig schwer' },
          { value: 'ziemlich', label: 'Sehr schwer' },
          { value: 'nicht', label: 'Unmöglich' },
        ],
      },
      {
        id: 'treppen', // F-2.5
        text: 'Kommen Sie ausser Atem, wenn Sie zwei Stockwerke Treppen steigen?',
        type: 'single',
        options: [
          { value: 'gar_nicht', label: 'Überhaupt nicht' },
          { value: 'kaum', label: 'Kaum' },
          { value: 'etwas', label: 'Etwas' },
          { value: 'deutlich', label: 'Deutlich' },
          { value: 'sehr_stark', label: 'Sehr stark' },
        ],
      },
      {
        id: 'einkaufstaschen', // F-2.6
        text: 'Wie schwer fällt es Ihnen, zwei volle Einkaufstaschen zu tragen?',
        type: 'single',
        options: [
          { value: 'gar_nicht', label: 'Überhaupt nicht schwer' },
          { value: 'wenig', label: 'Wenig schwer' },
          { value: 'maessig', label: 'Mässig schwer' },
          { value: 'ziemlich', label: 'Sehr schwer' },
          { value: 'nicht', label: 'Unmöglich' },
        ],
      },
      {
        id: 'einbeinstand', // F-2.7 (optional)
        text: 'Wie lange können Sie auf einem Bein stehen, ohne sich festzuhalten? (optional)',
        note: 'Bei körperlichen Einschränkungen oder Verletzungsrisiken sollte dieser Test nicht durchgeführt werden.',
        helpTitle: 'So führen Sie den Einbeinstand-Test korrekt aus',
        help:
          '1 – Stellen Sie sich aufrecht hin, Füsse hüftbreit.<br>' +
          '2 – Fixieren Sie Ihre Augen auf einen Punkt.<br>' +
          '3 – Heben Sie ein Bein so an, dass der Fuss den Boden nicht berührt.<br>' +
          '4 – Halten Sie das Gleichgewicht so lange wie möglich.<br><br>' +
          'Stoppen Sie die Zeit, sobald das Bein den Boden berührt.<br><br>' +
          'Wiederholen Sie den Test mit jedem Bein und notieren Sie Ihren besten Wert. Ein grosser ' +
          'Unterschied zwischen den Beinen deutet auf ein Ungleichgewicht hin, das Sie mit gezieltem ' +
          'Training verbessern können.' +
          '<br><br><b>Was der Einbeinstand-Test verrät:</b><br>' +
          'Der Test misst Gleichgewicht und Koordination. Die Fähigkeit, auch mit geschlossenen ' +
          'Augen zu balancieren, zeigt, wie gut Ihr Körper die Sinneswahrnehmungen (z. B. aus ' +
          'Gelenken und Muskeln) nutzt. Regelmässiges Üben hilft, Balance zu stärken und ' +
          'Verletzungen vorzubeugen.',
        type: 'number',
        unit: 'Sekunden',
        min: 0,
        max: 1000,
        placeholder: 'z. B. 30',
        optional: true,
      },
      {
        id: 'liegestuetze', // F-2.8 (optional)
        text: 'Wie viele Liegestütze können Sie ohne Unterbrechung korrekt ausführen? (optional)',
        note: 'Bei körperlichen Einschränkungen oder Verletzungsrisiken sollte dieser Test nicht durchgeführt werden.',
        helpTitle: 'So führen Sie den Liegestütz-Test korrekt aus',
        help:
          '1 – Auf den Bauch legen, Hände unter die Schultern.<br>' +
          '2 – Arme strecken und Körper vom Boden abheben.<br>' +
          '3 – Körper, Hüfte und Beine in einer Linie halten.<br>' +
          '4 – Körper absenken, bis die Brust fast den Boden berührt.<br>' +
          '5 – Wieder hochdrücken in die Ausgangsposition.<br><br>' +
          'Ohne Pause wiederholen, bis es nicht mehr geht.' +
          '<br><br><b>Was der Liegestütz-Test verrät:</b><br>' +
          'Liegestütze messen die Kraft von Brust, Schultern, Armen und Rumpf. Starke ' +
          'Oberkörpermuskeln sind wichtig für Alltagstätigkeiten wie Tragen oder Aufstehen und ' +
          'helfen, Sturzverletzungen zu vermeiden.',
        type: 'number',
        unit: 'Wiederholungen',
        min: 0,
        max: 150,
        placeholder: 'z. B. 15',
        optional: true,
      },
      {
        id: 'wandsitz', // F-2.9 (optional)
        text:
          'Wie lange können Sie maximal in einer sitzenden Haltung (90°-Winkel) mit dem Rücken ' +
          'an der Wand bleiben? (optional)',
        note: 'Bei körperlichen Einschränkungen oder Verletzungsrisiken sollte dieser Test nicht durchgeführt werden.',
        helpTitle: 'So führen Sie den Wandsitz-Test korrekt aus',
        help:
          '1 – Rücken und Becken vollständig an eine gerade Wand legen.<br>' +
          '2 – Füsse parallel und ungefähr hüftbreit aufstellen.<br>' +
          '3 – Nach unten rutschen, bis Hüfte und Knie ungefähr einen 90°-Winkel bilden.<br>' +
          '4 – Beide Beine gleichmässig belasten. Hände und Arme dürfen weder Beine noch Wand abstützen.<br>' +
          '5 – Normal weiteratmen und die Position so lange wie möglich halten.<br><br>' +
          'Machen Sie zuerst einen kurzen Übungsversuch und danach einen gewerteten Versuch. Die Zeit beginnt in der korrekten Position. Beenden Sie den Test, sobald Becken oder Rücken den Wandkontakt verlieren, Sie deutlich hochrutschen oder sich mit den Händen abstützen. Brechen Sie bei Schmerzen, Schwindel oder Atemnot ab.' +
          '<br><br><b>Was der Wandsitz-Test verrät:</b><br>' +
          'Er misst die lokale Kraftausdauer von Beinen und Gesäss. Diese Muskeln sind wichtig ' +
          'für Stabilität, Beweglichkeit und Sicherheit. Wer sie trainiert, bleibt länger aktiv, ' +
          'mobil und selbstständig.',
        type: 'number',
        unit: 'Sekunden',
        min: 0,
        max: 1000,
        placeholder: 'z. B. 45',
        optional: true,
      },
    ],
  },

  /* ===================================================================== */
  /* F-3 / S-3  Ernährung                                                   */
  /* ===================================================================== */
  {
    id: 'ernaehrung',
    title: window.ResultCopy.get('service.dimension.ernaehrung.title'),
    short: window.ResultCopy.get('service.dimension.ernaehrung.short'),
    icon: 'nutrition',
    intro: window.ResultCopy.get('service.dimension.ernaehrung.intro'),
    questions: [
      {
        id: 'protein', // F-3.1
        text:
          'Wie häufig gelingt es Ihnen, über den Tag verteilt zu mindestens drei Mahlzeiten ' +
          'oder Snacks eine klare Proteinquelle einzuplanen (z. B. Hülsenfrüchte, Tofu, ' +
          'Eier, Milchprodukte, Fisch oder Fleisch)?',
        helpTitle: 'Was misst diese Frage – und welche Menge ist sinnvoll?',
        help:
          'Diese Frage erfasst, wie regelmässig Sie Proteinquellen einbauen. Sie berechnet ' +
          '<b>nicht</b>, wie viele Gramm Protein Sie tatsächlich pro Tag und Kilogramm ' +
          'Körpergewicht aufnehmen.<br><br>' +
          '<b>Geeignete Proteinquellen sind zum Beispiel:</b>' +
          '<ul><li>Hülsenfrüchte wie Linsen, Bohnen oder Kichererbsen</li>' +
          '<li>Tofu, Tempeh, Eier, Quark, Joghurt oder Hüttenkäse</li>' +
          '<li>Fisch oder Fleisch</li></ul>' +
          '<b>Orientierung bei regelmässigem Krafttraining:</b><br>' +
          'Für gesunde Erwachsene sind etwa 1,4–1,6 g Protein pro kg Körpergewicht und Tag ' +
          'eine praktische Orientierung. In einer grossen Meta-Analyse flachten die ' +
          'durchschnittlichen zusätzlichen Vorteile für den Aufbau fettfreier Masse ab rund ' +
          '1,6 g/kg/Tag deutlich ab. Das ist keine harte biologische Grenze.<br><br>' +
          'Bis etwa 2,0 g/kg/Tag können bei sehr hoher Trainingsbelastung oder einem gezielten ' +
          'Energiedefizit als individueller Spielraum sinnvoll sein. Für die meisten Menschen ' +
          'ist diese Menge nicht nötig; das Alter allein begründet kein Ziel von 2,0 g/kg/Tag. ' +
          'Krafttraining setzt den Trainingsreiz, Protein liefert die Bausteine. Proteinpulver ' +
          'ist nicht automatisch erforderlich.<br><br>' +
          'Für Personen unter 18 Jahren sowie bei einer Nierenerkrankung oder medizinisch ' +
          'verordneter Ernährung sollte die passende Menge fachlich geklärt werden.',
        type: 'single',
        options: [
          { value: 'selten', label: 'Selten' },
          { value: 'manchmal', label: 'Manchmal' },
          { value: 'haelfte', label: 'Etwa die Hälfte der Zeit' },
          { value: 'meistens', label: 'Meistens' },
          { value: 'fast_immer', label: 'Fast immer' },
        ],
      },
      {
        id: 'pflanzenvielfalt', // F-3.2
        text: 'Wie viele verschiedene pflanzliche Lebensmittel haben Sie in der letzten Woche gegessen?',
        helpTitle: 'Was zählt beispielsweise als pflanzliches Lebensmittel?',
        help:
          '<b>Gemüse &amp; Salate:</b> Spinat, Brokkoli, Karotten, Tomaten, Gurken, Paprika, ' +
          'Zwiebeln, Knoblauch<br>' +
          '<b>Früchte:</b> Äpfel, Bananen, Beeren, Orangen, Trauben, Avocado<br>' +
          '<b>Getreide &amp; Pseudogetreide:</b> Hafer, Quinoa, Hirse, Buchweizen, Gerste, Vollkornreis<br>' +
          '<b>Samen:</b> Chiasamen, Leinsamen, Kürbiskerne, Sonnenblumenkerne, Sesam<br>' +
          '<b>Hülsenfrüchte &amp; Nüsse:</b> Linsen, Kichererbsen, Bohnen, Mandeln, Walnüsse<br>' +
          '<b>Gewürze &amp; Kräuter:</b> Basilikum, Oregano, Kurkuma, Ingwer, Zimt, Pfeffer<br>' +
          '<b>Pilze:</b> Champignons, Shiitake, Austernpilze' +
          '<br><br><b>Warum ist pflanzliche Vielfalt wichtig?</b><br>' +
          'Eine bunte Auswahl an Pflanzen liefert Nährstoffe, Antioxidantien und Ballaststoffe. ' +
          'Jede Pflanze enthält eigene bioaktive Stoffe, die verschiedene Funktionen im Körper ' +
          'unterstützen. Vielfalt stärkt besonders das Darmmikrobiom und fördert so eine gesunde ' +
          'Darmflora.',
        type: 'single',
        options: [
          { value: 'u10', label: 'Weniger als 10' },
          { value: 'v10_17', label: '10–17' },
          { value: 'v18_25', label: '18–25' },
          { value: 'v26_34', label: '26–34' },
          { value: 'ue35', label: '35 oder mehr' },
        ],
      },
      {
        id: 'saettigung', // F-3.3 – Gegencheck, kein Blauer Kasten im Fragenset
        text:
          'Wie häufig fühlen Sie sich nach Ihren Hauptmahlzeiten für etwa vier Stunden satt, ' +
          'ohne Bedürfnis nach einem Snack?',
        type: 'single',
        options: [
          { value: 'nie', label: 'Nie' },
          { value: 'selten', label: 'Selten' },
          { value: 'manchmal', label: 'Manchmal' },
          { value: 'oft', label: 'Oft' },
          { value: 'fast_immer', label: 'Fast immer' },
        ],
      },
      {
        id: 'verarbeitet', // F-3.4
        text: 'Wie häufig greifen Sie in einer typischen Woche zu stark verarbeiteten Lebensmitteln?',
        helpTitle: 'Was gilt als stark verarbeitet?',
        help:
          '<ul><li>Fertiggerichte, Tiefkühlpizza</li>' +
          '<li>Süssigkeiten, Cookies, Chips</li>' +
          '<li>Softdrinks, Energy-Drinks</li>' +
          '<li>Wurst und verarbeitetes Fleisch</li>' +
          '<li>Weissbrot, süsse Backwaren</li></ul>' +
          '<b>Praktische Regel:</b><br>' +
          'Mehr als fünf Zutaten oder schwer aussprechbare Namen = meist stark verarbeitet.' +
          '<br><br><b>Warum sind verarbeitete Lebensmittel problematisch?</b><br>' +
          'Viele stark verarbeitete Produkte enthalten viel Zucker, Salz, ungünstige Fette und ' +
          'Zusatzstoffe, während Ballaststoffe und wichtige Nährstoffe fehlen. Nicht jedes ' +
          'verarbeitete Lebensmittel ist gleich problematisch. Entscheidend ist, den Anteil stark ' +
          'verarbeiteter Produkte zu reduzieren und schrittweise mehr frische, nährstoffreiche ' +
          'Lebensmittel in den Alltag einzubauen.',
        type: 'single',
        options: [
          { value: 'nie', label: 'Nie' },
          { value: 'u1woche', label: 'Seltener als 1x pro Woche' },
          { value: 'w1_2', label: '1–2x pro Woche' },
          { value: 'fast_taeglich', label: 'Fast täglich' },
          { value: 'mehrmals_taeglich', label: 'Mehrmals täglich' },
        ],
      },
      {
        id: 'omega3', // F-3.5
        text:
          'Wie oft pro Woche essen Sie fettreichen Fisch (z. B. Lachs, Makrele, Hering) oder ' +
          'nehmen Omega-3 als Nahrungsergänzung ein?',
        helpTitle: 'Warum ist Omega-3 wichtig?',
        help:
          'Omega-3-Fettsäuren aus maritimen Quellen unterstützen Ihr Gehirn, Ihr Herz und wirken ' +
          'stark entzündungshemmend im ganzen Körper. Da der Körper sie nicht ausreichend selbst ' +
          'bildet, ist ihre regelmässige Zufuhr über Lebensmittel entscheidend. Algenöl ist eine ' +
          'sehr gute vegane Alternative zu Fisch. Ihr Körper kann diese sofort nutzen, im Gegensatz ' +
          'zu Omega-3-Vorstufen aus anderen Pflanzenölen.',
        type: 'single',
        options: [
          { value: 'nie', label: 'Nie' },
          { value: 'u1woche', label: 'Seltener als 1x pro Woche' },
          { value: 'w1', label: '1x pro Woche' },
          { value: 'w2', label: '2x pro Woche' },
          { value: 'ue2', label: 'Mehr als 2x pro Woche' },
        ],
      },
      {
        id: 'zuckergetraenke', // F-3.6 – kein Blauer Kasten im Fragenset
        text: 'Wie häufig trinken Sie zuckerhaltige Getränke oder reine Fruchtsäfte?',
        type: 'single',
        options: [
          { value: 'nie', label: 'Nie' },
          { value: 'u1woche', label: 'Seltener als 1x pro Woche' },
          { value: 'w1_3', label: '1–3x pro Woche' },
          { value: 'w4_6', label: '4–6x pro Woche' },
          { value: 'taeglich', label: 'Täglich oder mehrmals täglich' },
        ],
      },
    ],
  },

  /* ===================================================================== */
  /* F-4 / S-4  Schlaf                                                      */
  /* ===================================================================== */
  {
    id: 'schlaf',
    title: window.ResultCopy.get('service.dimension.schlaf.title'),
    short: window.ResultCopy.get('service.dimension.schlaf.short'),
    icon: 'sleep',
    intro: window.ResultCopy.get('service.dimension.schlaf.intro'),
    questions: [
      {
        id: 'schlafqualitaet', // F-4.1
        text: 'Wie gut oder schlecht haben Sie im letzten Monat insgesamt geschlafen?',
        type: 'single',
        options: [
          { value: 'sehr_gut', label: 'Sehr gut' },
          { value: 'gut', label: 'Gut' },
          { value: 'durchschnittlich', label: 'Durchschnittlich' },
          { value: 'schlecht', label: 'Schlecht' },
          { value: 'sehr_schlecht', label: 'Sehr schlecht' },
        ],
      },
      {
        id: 'schlafdauer', // F-4.2
        text:
          'Wie viele Stunden haben Sie im letzten Monat durchschnittlich pro Nacht geschlafen ' +
          '(ohne Wachphasen)?',
        type: 'single',
        options: [
          { value: 'u5', label: 'Weniger als 5 h' },
          { value: 's5_6', label: '5–6 h' },
          { value: 's6_7', label: '6–7 h' },
          { value: 's7_9', label: '7–9 h' },
          { value: 'ue9', label: 'Mehr als 9 h' },
        ],
      },
      {
        id: 'schlafrhythmus', // F-4.3
        text:
          'Stehen Sie jeden Tag, auch am Wochenende, ungefähr zur gleichen Zeit auf und gehen ' +
          'zur gleichen Zeit ins Bett? (z. B. Sie gehen jeden Tag um 22 Uhr ins Bett und stehen ' +
          'um 6 Uhr auf)',
        type: 'single',
        options: [
          { value: 'sehr_regelmaessig', label: 'Sehr regelmässig (±30 min Abweichung)' },
          { value: 'regelmaessig', label: 'Regelmässig (±45 min Abweichung)' },
          { value: 'etwas_unregelmaessig', label: 'Etwas unregelmässig (±1 h Abweichung)' },
          { value: 'unregelmaessig', label: 'Unregelmässig (±1.5 h Abweichung)' },
          { value: 'sehr_unregelmaessig', label: 'Sehr unregelmässig (mehr als 2 h Abweichung)' },
        ],
      },
      {
        id: 'schlaf_auswirkung', // F-4.4 – Gegencheck
        text:
          'Wie stark hat Ihr Schlaf im letzten Monat Ihren Alltag beeinträchtigt? ' +
          '(z. B. reduzierte Leistungsfähigkeit, Konzentration, Stimmung, Energie, soziale Aktivitäten)',
        type: 'single',
        options: [
          { value: 'gar_nicht', label: 'Gar nicht' },
          { value: 'kaum', label: 'Minimal' },
          { value: 'spuerbar', label: 'Spürbar' },
          { value: 'deutlich', label: 'Deutlich' },
          { value: 'massiv', label: 'Massiv' },
        ],
      },
    ],
  },

  /* ===================================================================== */
  /* F-5 / S-5  Mentales Wohlbefinden                                       */
  /* ===================================================================== */
  {
    id: 'mental',
    title: window.ResultCopy.get('service.dimension.mental.title'),
    short: window.ResultCopy.get('service.dimension.mental.short'),
    icon: 'mind',
    intro: window.ResultCopy.get('service.dimension.mental.intro'),
    questions: [
      {
        id: 'belastbarkeit', // F-5.1 Belastbarkeit
        text: 'Ich bewahre auch in schwierigen Situationen den Überblick und Ruhe.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'selbstwirksamkeit', // F-5.2 Selbstwirksamkeit
        text: 'Ich fühle mich meinem Alltag gewachsen.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'sinnhaftigkeit', // F-5.3 Sinnhaftigkeit
        text: 'Ich erlebe mein Leben als sinnvoll und erfüllend.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'coping', // F-5.4 Coping-Kompetenz
        text: 'Ich finde auch in belastenden Situationen Wege, die mir helfen, klarzukommen.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'verbundenheit', // F-5.5 Soziale Verbundenheit
        text: 'Ich fühle mich von den Menschen in meinem Umfeld akzeptiert und eingebunden.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'selbstfuersorge', // F-5.6 Selbstfürsorge
        text: 'Ich finde auch in hektischen Zeiten Momente der Ruhe und Erholung.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'zukunft', // F-5.7 Zukunftsorientierung
        text: 'Ich schaue zuversichtlich in meine Zukunft.',
        type: 'single',
        options: AGREE,
      },
      {
        id: 'positive_emotionen', // F-5.8 Positive Emotionen
        text: 'Ich erlebe in meinem Alltag regelmässig Momente der Freude oder Dankbarkeit.',
        type: 'single',
        options: AGREE,
      },
    ],
  },
];

// Alle bewerteten Dimensionen (ohne Grundinformation) – Basis für Radar & Score.
const SCORED_DIMENSIONS = DIMENSIONS.filter((d) => d.scored !== false);

// Reihenfolge der bewerteten Dimensionen für Radar/Auswertung.
const DIMENSION_ORDER = SCORED_DIMENSIONS.map((d) => d.id);

/* -------------------------------------------------------------------------
 * Zentraler Datenvertrag für Antworten.
 *
 * Persistierte/geteilte Antworten sind nicht vertrauenswürdig: alte Links,
 * manuell verändertes localStorage oder spätere Schemaänderungen dürfen keine
 * unbekannten Werte in Scoring und Empfehlungen einschleusen. Deshalb werden
 * alle Eingaben ausschliesslich gegen den Fragenkatalog normalisiert.
 * ---------------------------------------------------------------------- */
const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);

function allowedValues(q) {
  const options = (q.options || []).slice();
  if (q.dontKnow) options.push(DK);
  return options.map((o) => o.value);
}

function sanitizeAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};

  ALL_QUESTIONS.forEach((q) => {
    if (!Object.prototype.hasOwnProperty.call(raw, q.id)) return;
    const value = raw[q.id];

    if (q.type === 'number') {
      if (value === '' || value == null) return;
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      if (n < (q.min ?? -Infinity) || n > (q.max ?? Infinity)) return;
      clean[q.id] = n;
      return;
    }

    const allowed = allowedValues(q);
    if (q.type === 'multi') {
      if (!Array.isArray(value)) return;
      let selected = [...new Set(value.filter((v) => allowed.includes(v)))];
      const exclusive = (q.options || []).filter((o) => o.exclusive).map((o) => o.value);
      const exclusiveHit = selected.find((v) => exclusive.includes(v));
      if (exclusiveHit != null) selected = [exclusiveHit];
      if (selected.length) clean[q.id] = selected;
      return;
    }

    if (q.type === 'single' && allowed.includes(value)) clean[q.id] = value;
  });

  return clean;
}

function isQuestionComplete(q, answers) {
  const hasRaw = !!answers && Object.prototype.hasOwnProperty.call(answers, q.id);
  const raw = hasRaw ? answers[q.id] : undefined;
  const empty = !hasRaw || raw === '' || raw == null ||
    (q.type === 'multi' && Array.isArray(raw) && raw.length === 0);
  // Optional bedeutet: Das Feld darf leer bleiben. Wird ein Wert eingegeben,
  // muss er aber valide sein; sonst würde er beim Sanitizing still verworfen.
  if (q.optional && empty) return true;
  const clean = sanitizeAnswers(answers);
  if (!Object.prototype.hasOwnProperty.call(clean, q.id)) return false;
  return q.type !== 'multi' || clean[q.id].length > 0;
}

function isDimensionComplete(dim, answers) {
  return !!dim && dim.questions.every((q) => isQuestionComplete(q, answers));
}

function areAnswersComplete(answers) {
  return DIMENSIONS.every((dim) => isDimensionComplete(dim, answers));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

deepFreeze(DK);
deepFreeze(DIMENSIONS);
deepFreeze(SCORED_DIMENSIONS);
deepFreeze(DIMENSION_ORDER);

if (typeof window !== 'undefined') {
  window.DIMENSIONS = DIMENSIONS;
  window.SCORED_DIMENSIONS = SCORED_DIMENSIONS;
  window.DIMENSION_ORDER = DIMENSION_ORDER;
  window.DONT_KNOW = DK;
  window.HealthAnswerSchema = Object.freeze({
    sanitizeAnswers,
    isDimensionComplete,
    areAnswersComplete,
  });
}
})();
