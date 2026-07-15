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

const copy = window.ResultCopy;

const DK = { value: 'unbekannt', label: copy.get('questionnaire.common.dont_know') };

// Zustimmungsskala für die Aussagen im Bereich «Mentales Wohlbefinden».
// Fragenset: Stimme völlig zu (+2) … Stimme gar nicht zu (−2), Mitte «Weder noch».
const AGREE = [
  { value: 'voll', label: copy.get('questionnaire.common.agreement.fully') },
  { value: 'eher', label: copy.get('questionnaire.common.agreement.mostly') },
  { value: 'teils', label: copy.get('questionnaire.common.agreement.neutral') },
  { value: 'eher_nicht', label: copy.get('questionnaire.common.agreement.mostly_not') },
  { value: 'gar_nicht', label: copy.get('questionnaire.common.agreement.not_at_all') },
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
        text: copy.get('questionnaire.question.alter.text'), // F-0.1
        type: 'number',
        unit: copy.get('questionnaire.question.alter.unit'),
        min: 12,
        max: 119,
        placeholder: copy.get('questionnaire.question.alter.placeholder'),
      },
      {
        id: 'geschlecht',
        text: copy.get('questionnaire.question.geschlecht.text'), // F-0.2
        type: 'single',
        options: [
          { value: 'maennlich', label: copy.get('questionnaire.question.geschlecht.option.maennlich')},
          { value: 'weiblich', label: copy.get('questionnaire.question.geschlecht.option.weiblich')},
          { value: 'intersex', label: copy.get('questionnaire.question.geschlecht.option.intersex')},
        ],
      },
      {
        id: 'groesse',
        text: copy.get('questionnaire.question.groesse.text'), // F-0.3
        type: 'number',
        unit: copy.get('questionnaire.question.groesse.unit'),
        min: 100,
        max: 299,
        placeholder: copy.get('questionnaire.question.groesse.placeholder'),
      },
      {
        id: 'gewicht',
        text: copy.get('questionnaire.question.gewicht.text'), // F-0.4
        type: 'number',
        unit: copy.get('questionnaire.question.gewicht.unit'),
        min: 30,
        max: 399,
        placeholder: copy.get('questionnaire.question.gewicht.placeholder'),
      },
      {
        // Nicht im finalen Fragenset enthalten – bleibt unverändert (optional).
        id: 'bauchumfang',
        text: copy.get('questionnaire.question.bauchumfang.text'),
        help:
          copy.get('questionnaire.question.bauchumfang.help'),
        type: 'number',
        unit: copy.get('questionnaire.question.bauchumfang.unit'),
        min: 40,
        max: 250,
        placeholder: copy.get('questionnaire.question.bauchumfang.placeholder'),
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
          copy.get('questionnaire.question.stabilitaet.text'),
        helpTitle: copy.get('questionnaire.question.stabilitaet.help_title'),
        help:
          copy.get('questionnaire.question.stabilitaet.help'),
        type: 'single',
        options: [
          { value: 'sehr_sicher', label: copy.get('questionnaire.question.stabilitaet.option.sehr_sicher')},
          { value: 'sicher', label: copy.get('questionnaire.question.stabilitaet.option.sicher')},
          { value: 'weder', label: copy.get('questionnaire.question.stabilitaet.option.weder')},
          { value: 'unsicher', label: copy.get('questionnaire.question.stabilitaet.option.unsicher')},
          { value: 'sehr_unsicher', label: copy.get('questionnaire.question.stabilitaet.option.sehr_unsicher')},
        ],
      },
      {
        id: 'sitzzeit', // F-1.2
        text:
          copy.get('questionnaire.question.sitzzeit.text'),
        helpTitle: copy.get('questionnaire.question.sitzzeit.help_title'),
        help:
          copy.get('questionnaire.question.sitzzeit.help'),
        type: 'single',
        options: [
          { value: 'u4', label: copy.get('questionnaire.question.sitzzeit.option.u4')},
          { value: 's4_6', label: copy.get('questionnaire.question.sitzzeit.option.s4_6')},
          { value: 's7_8', label: copy.get('questionnaire.question.sitzzeit.option.s7_8')},
          { value: 's9_10', label: copy.get('questionnaire.question.sitzzeit.option.s9_10')},
          { value: 'ue10', label: copy.get('questionnaire.question.sitzzeit.option.ue10')},
        ],
      },
      {
        id: 'familienwissen', // F-1.3 «Familiäre Krankheitsgeschichte»
        text: copy.get('questionnaire.question.familienwissen.text'),
        helpTitle: copy.get('questionnaire.question.familienwissen.help_title'),
        help:
          copy.get('questionnaire.question.familienwissen.help'),
        type: 'single',
        options: [
          { value: 'sehr_gut', label: copy.get('questionnaire.question.familienwissen.option.sehr_gut')},
          { value: 'gut', label: copy.get('questionnaire.question.familienwissen.option.gut')},
          { value: 'teilweise', label: copy.get('questionnaire.question.familienwissen.option.teilweise')},
          { value: 'wenig', label: copy.get('questionnaire.question.familienwissen.option.wenig')},
          { value: 'gar_nicht', label: copy.get('questionnaire.question.familienwissen.option.gar_nicht')},
        ],
      },
      {
        id: 'vorsorge', // F-1.4 «Regelmässige Vorsorgeuntersuchung» – ohne Score-Einfluss (Ø)
        text:
          copy.get('questionnaire.question.vorsorge.text'),
        helpTitle: copy.get('questionnaire.question.vorsorge.help_title'),
        help:
          copy.get('questionnaire.question.vorsorge.help'),
        type: 'single',
        options: [
          { value: 'ja', label: copy.get('questionnaire.question.vorsorge.option.ja')},
          { value: 'nein', label: copy.get('questionnaire.question.vorsorge.option.nein')},
        ],
      },
      {
        id: 'rauchen', // F-1.5
        text: copy.get('questionnaire.question.rauchen.text'),
        helpTitle: copy.get('questionnaire.question.rauchen.help_title'),
        help:
          copy.get('questionnaire.question.rauchen.help'),
        type: 'single',
        options: [
          { value: 'ja_regelmaessig', label: copy.get('questionnaire.question.rauchen.option.ja_regelmaessig')},
          { value: 'ja_gelegentlich', label: copy.get('questionnaire.question.rauchen.option.ja_gelegentlich')},
          { value: 'nie', label: copy.get('questionnaire.question.rauchen.option.nie')},
          { value: 'frueher', label: copy.get('questionnaire.question.rauchen.option.frueher')},
          { value: 'keine_angabe', label: copy.get('questionnaire.question.rauchen.option.keine_angabe')},
        ],
      },
      {
        id: 'alkohol', // F-1.6
        text: copy.get('questionnaire.question.alkohol.text'),
        helpTitle: copy.get('questionnaire.question.alkohol.help_title'),
        help:
          copy.get('questionnaire.question.alkohol.help'),
        type: 'single',
        options: [
          { value: 'nie_selten', label: copy.get('questionnaire.question.alkohol.option.nie_selten')},
          { value: 'm1_4', label: copy.get('questionnaire.question.alkohol.option.m1_4')},
          { value: 'w2_3', label: copy.get('questionnaire.question.alkohol.option.w2_3')},
          { value: 'w4plus', label: copy.get('questionnaire.question.alkohol.option.w4plus')},
          { value: 'keine_angabe', label: copy.get('questionnaire.question.alkohol.option.keine_angabe')},
        ],
      },
      {
        id: 'socialmedia', // F-1.7
        text: copy.get('questionnaire.question.socialmedia.text'),
        helpTitle: copy.get('questionnaire.question.socialmedia.help_title'),
        help:
          copy.get('questionnaire.question.socialmedia.help'),
        type: 'single',
        options: [
          { value: 'nein', label: copy.get('questionnaire.question.socialmedia.option.nein')},
          { value: 'selten', label: copy.get('questionnaire.question.socialmedia.option.selten')},
          { value: 'manchmal', label: copy.get('questionnaire.question.socialmedia.option.manchmal')},
          { value: 'oft', label: copy.get('questionnaire.question.socialmedia.option.oft')},
          { value: 'sehr_oft', label: copy.get('questionnaire.question.socialmedia.option.sehr_oft')},
        ],
      },
      {
        // Nicht im finalen Fragenset enthalten – bleibt unverändert.
        // Fliesst NICHT in den Score ein, nur als Risikosignal/Hinweis.
        id: 'familie_hk',
        text: copy.get('questionnaire.question.familie_hk.text'),
        help:
          copy.get('questionnaire.question.familie_hk.help'),
        type: 'single',
        options: [
          { value: 'nein', label: copy.get('questionnaire.question.familie_hk.option.nein')},
          { value: 'ja', label: copy.get('questionnaire.question.familie_hk.option.ja')},
          { value: 'weiss_nicht', label: copy.get('questionnaire.question.familie_hk.option.weiss_nicht')},
        ],
      },
      {
        // Nicht im finalen Fragenset enthalten – bleibt unverändert.
        // Fliesst NICHT in den Score ein, nur als Risikosignal/Hinweis.
        id: 'bluthochdruck',
        text: copy.get('questionnaire.question.bluthochdruck.text'),
        help:
          copy.get('questionnaire.question.bluthochdruck.help'),
        type: 'single',
        options: [
          { value: 'nein', label: copy.get('questionnaire.question.bluthochdruck.option.nein')},
          { value: 'ja', label: copy.get('questionnaire.question.bluthochdruck.option.ja')},
          { value: 'weiss_nicht', label: copy.get('questionnaire.question.bluthochdruck.option.weiss_nicht')},
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
        text: copy.get('questionnaire.question.ausdauer_moderat.text'),
        helpTitle: copy.get('questionnaire.question.ausdauer_moderat.help_title'),
        help:
          copy.get('questionnaire.question.ausdauer_moderat.help'),
        type: 'single',
        options: [
          { value: 'u30', label: copy.get('questionnaire.question.ausdauer_moderat.option.u30')},
          { value: 'm30_75', label: copy.get('questionnaire.question.ausdauer_moderat.option.m30_75')},
          { value: 'm75_150', label: copy.get('questionnaire.question.ausdauer_moderat.option.m75_150')},
          { value: 'm150_300', label: copy.get('questionnaire.question.ausdauer_moderat.option.m150_300')},
          { value: 'ue300', label: copy.get('questionnaire.question.ausdauer_moderat.option.ue300')},
        ],
      },
      {
        id: 'ausdauer_intensiv', // F-2.2
        text: copy.get('questionnaire.question.ausdauer_intensiv.text'),
        helpTitle: copy.get('questionnaire.question.ausdauer_intensiv.help_title'),
        help:
          copy.get('questionnaire.question.ausdauer_intensiv.help'),
        type: 'single',
        options: [
          { value: 'keine', label: copy.get('questionnaire.question.ausdauer_intensiv.option.keine')},
          { value: 'u30', label: copy.get('questionnaire.question.ausdauer_intensiv.option.u30')},
          { value: 'm30_75', label: copy.get('questionnaire.question.ausdauer_intensiv.option.m30_75')},
          { value: 'm75_150', label: copy.get('questionnaire.question.ausdauer_intensiv.option.m75_150')},
          { value: 'ue150', label: copy.get('questionnaire.question.ausdauer_intensiv.option.ue150')},
        ],
      },
      {
        id: 'krafttraining', // F-2.3
        text: copy.get('questionnaire.question.krafttraining.text'),
        helpTitle: copy.get('questionnaire.question.krafttraining.help_title'),
        help:
          copy.get('questionnaire.question.krafttraining.help'),
        type: 'single',
        options: [
          { value: 'tage0', label: copy.get('questionnaire.question.krafttraining.option.tage0')},
          { value: 'tage1', label: copy.get('questionnaire.question.krafttraining.option.tage1')},
          { value: 'tage2', label: copy.get('questionnaire.question.krafttraining.option.tage2')},
          { value: 'tage3plus', label: copy.get('questionnaire.question.krafttraining.option.tage3plus')},
        ],
      },
      {
        id: 'beweglichkeit', // F-2.4
        text: copy.get('questionnaire.question.beweglichkeit.text'),
        type: 'single',
        options: [
          { value: 'gar_nicht', label: copy.get('questionnaire.question.beweglichkeit.option.gar_nicht')},
          { value: 'wenig', label: copy.get('questionnaire.question.beweglichkeit.option.wenig')},
          { value: 'maessig', label: copy.get('questionnaire.question.beweglichkeit.option.maessig')},
          { value: 'ziemlich', label: copy.get('questionnaire.question.beweglichkeit.option.ziemlich')},
          { value: 'nicht', label: copy.get('questionnaire.question.beweglichkeit.option.nicht')},
        ],
      },
      {
        id: 'treppen', // F-2.5
        text: copy.get('questionnaire.question.treppen.text'),
        type: 'single',
        options: [
          { value: 'gar_nicht', label: copy.get('questionnaire.question.treppen.option.gar_nicht')},
          { value: 'kaum', label: copy.get('questionnaire.question.treppen.option.kaum')},
          { value: 'etwas', label: copy.get('questionnaire.question.treppen.option.etwas')},
          { value: 'deutlich', label: copy.get('questionnaire.question.treppen.option.deutlich')},
          { value: 'sehr_stark', label: copy.get('questionnaire.question.treppen.option.sehr_stark')},
        ],
      },
      {
        id: 'einkaufstaschen', // F-2.6
        text: copy.get('questionnaire.question.einkaufstaschen.text'),
        type: 'single',
        options: [
          { value: 'gar_nicht', label: copy.get('questionnaire.question.einkaufstaschen.option.gar_nicht')},
          { value: 'wenig', label: copy.get('questionnaire.question.einkaufstaschen.option.wenig')},
          { value: 'maessig', label: copy.get('questionnaire.question.einkaufstaschen.option.maessig')},
          { value: 'ziemlich', label: copy.get('questionnaire.question.einkaufstaschen.option.ziemlich')},
          { value: 'nicht', label: copy.get('questionnaire.question.einkaufstaschen.option.nicht')},
        ],
      },
      {
        id: 'einbeinstand', // F-2.7 (optional)
        text: copy.get('questionnaire.question.einbeinstand.text'),
        note: copy.get('questionnaire.common.fitness_test_safety_note'),
        helpTitle: copy.get('questionnaire.question.einbeinstand.help_title'),
        help:
          copy.get('questionnaire.question.einbeinstand.help'),
        type: 'number',
        unit: copy.get('questionnaire.question.einbeinstand.unit'),
        min: 0,
        max: 1000,
        placeholder: copy.get('questionnaire.question.einbeinstand.placeholder'),
        optional: true,
      },
      {
        id: 'liegestuetze', // F-2.8 (optional)
        text: copy.get('questionnaire.question.liegestuetze.text'),
        note: copy.get('questionnaire.common.fitness_test_safety_note'),
        helpTitle: copy.get('questionnaire.question.liegestuetze.help_title'),
        help:
          copy.get('questionnaire.question.liegestuetze.help'),
        type: 'number',
        unit: copy.get('questionnaire.question.liegestuetze.unit'),
        min: 0,
        max: 150,
        placeholder: copy.get('questionnaire.question.liegestuetze.placeholder'),
        optional: true,
      },
      {
        id: 'wandsitz', // F-2.9 (optional)
        text:
          copy.get('questionnaire.question.wandsitz.text'),
        note: copy.get('questionnaire.common.fitness_test_safety_note'),
        helpTitle: copy.get('questionnaire.question.wandsitz.help_title'),
        help:
          copy.get('questionnaire.question.wandsitz.help'),
        type: 'number',
        unit: copy.get('questionnaire.question.wandsitz.unit'),
        min: 0,
        max: 1000,
        placeholder: copy.get('questionnaire.question.wandsitz.placeholder'),
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
          copy.get('questionnaire.question.protein.text'),
        helpTitle: copy.get('questionnaire.question.protein.help_title'),
        help:
          copy.get('questionnaire.question.protein.help'),
        type: 'single',
        options: [
          { value: 'selten', label: copy.get('questionnaire.question.protein.option.selten')},
          { value: 'manchmal', label: copy.get('questionnaire.question.protein.option.manchmal')},
          { value: 'haelfte', label: copy.get('questionnaire.question.protein.option.haelfte')},
          { value: 'meistens', label: copy.get('questionnaire.question.protein.option.meistens')},
          { value: 'fast_immer', label: copy.get('questionnaire.question.protein.option.fast_immer')},
        ],
      },
      {
        id: 'pflanzenvielfalt', // F-3.2
        text: copy.get('questionnaire.question.pflanzenvielfalt.text'),
        helpTitle: copy.get('questionnaire.question.pflanzenvielfalt.help_title'),
        help:
          copy.get('questionnaire.question.pflanzenvielfalt.help'),
        type: 'single',
        options: [
          { value: 'u10', label: copy.get('questionnaire.question.pflanzenvielfalt.option.u10')},
          { value: 'v10_17', label: copy.get('questionnaire.question.pflanzenvielfalt.option.v10_17')},
          { value: 'v18_25', label: copy.get('questionnaire.question.pflanzenvielfalt.option.v18_25')},
          { value: 'v26_34', label: copy.get('questionnaire.question.pflanzenvielfalt.option.v26_34')},
          { value: 'ue35', label: copy.get('questionnaire.question.pflanzenvielfalt.option.ue35')},
        ],
      },
      {
        id: 'saettigung', // F-3.3 – Gegencheck, kein Blauer Kasten im Fragenset
        text:
          copy.get('questionnaire.question.saettigung.text'),
        type: 'single',
        options: [
          { value: 'nie', label: copy.get('questionnaire.question.saettigung.option.nie')},
          { value: 'selten', label: copy.get('questionnaire.question.saettigung.option.selten')},
          { value: 'manchmal', label: copy.get('questionnaire.question.saettigung.option.manchmal')},
          { value: 'oft', label: copy.get('questionnaire.question.saettigung.option.oft')},
          { value: 'fast_immer', label: copy.get('questionnaire.question.saettigung.option.fast_immer')},
        ],
      },
      {
        id: 'verarbeitet', // F-3.4
        text: copy.get('questionnaire.question.verarbeitet.text'),
        helpTitle: copy.get('questionnaire.question.verarbeitet.help_title'),
        help:
          copy.get('questionnaire.question.verarbeitet.help'),
        type: 'single',
        options: [
          { value: 'nie', label: copy.get('questionnaire.question.verarbeitet.option.nie')},
          { value: 'u1woche', label: copy.get('questionnaire.question.verarbeitet.option.u1woche')},
          { value: 'w1_2', label: copy.get('questionnaire.question.verarbeitet.option.w1_2')},
          { value: 'fast_taeglich', label: copy.get('questionnaire.question.verarbeitet.option.fast_taeglich')},
          { value: 'mehrmals_taeglich', label: copy.get('questionnaire.question.verarbeitet.option.mehrmals_taeglich')},
        ],
      },
      {
        id: 'omega3', // F-3.5
        text:
          copy.get('questionnaire.question.omega3.text'),
        helpTitle: copy.get('questionnaire.question.omega3.help_title'),
        help:
          copy.get('questionnaire.question.omega3.help'),
        type: 'single',
        options: [
          { value: 'nie', label: copy.get('questionnaire.question.omega3.option.nie')},
          { value: 'u1woche', label: copy.get('questionnaire.question.omega3.option.u1woche')},
          { value: 'w1', label: copy.get('questionnaire.question.omega3.option.w1')},
          { value: 'w2', label: copy.get('questionnaire.question.omega3.option.w2')},
          { value: 'ue2', label: copy.get('questionnaire.question.omega3.option.ue2')},
        ],
      },
      {
        id: 'zuckergetraenke', // F-3.6 – kein Blauer Kasten im Fragenset
        text: copy.get('questionnaire.question.zuckergetraenke.text'),
        type: 'single',
        options: [
          { value: 'nie', label: copy.get('questionnaire.question.zuckergetraenke.option.nie')},
          { value: 'u1woche', label: copy.get('questionnaire.question.zuckergetraenke.option.u1woche')},
          { value: 'w1_3', label: copy.get('questionnaire.question.zuckergetraenke.option.w1_3')},
          { value: 'w4_6', label: copy.get('questionnaire.question.zuckergetraenke.option.w4_6')},
          { value: 'taeglich', label: copy.get('questionnaire.question.zuckergetraenke.option.taeglich')},
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
        text: copy.get('questionnaire.question.schlafqualitaet.text'),
        type: 'single',
        options: [
          { value: 'sehr_gut', label: copy.get('questionnaire.question.schlafqualitaet.option.sehr_gut')},
          { value: 'gut', label: copy.get('questionnaire.question.schlafqualitaet.option.gut')},
          { value: 'durchschnittlich', label: copy.get('questionnaire.question.schlafqualitaet.option.durchschnittlich')},
          { value: 'schlecht', label: copy.get('questionnaire.question.schlafqualitaet.option.schlecht')},
          { value: 'sehr_schlecht', label: copy.get('questionnaire.question.schlafqualitaet.option.sehr_schlecht')},
        ],
      },
      {
        id: 'schlafdauer', // F-4.2
        text:
          copy.get('questionnaire.question.schlafdauer.text'),
        type: 'single',
        options: [
          { value: 'u5', label: copy.get('questionnaire.question.schlafdauer.option.u5')},
          { value: 's5_6', label: copy.get('questionnaire.question.schlafdauer.option.s5_6')},
          { value: 's6_7', label: copy.get('questionnaire.question.schlafdauer.option.s6_7')},
          { value: 's7_9', label: copy.get('questionnaire.question.schlafdauer.option.s7_9')},
          { value: 'ue9', label: copy.get('questionnaire.question.schlafdauer.option.ue9')},
        ],
      },
      {
        id: 'schlafrhythmus', // F-4.3
        text:
          copy.get('questionnaire.question.schlafrhythmus.text'),
        type: 'single',
        options: [
          { value: 'sehr_regelmaessig', label: copy.get('questionnaire.question.schlafrhythmus.option.sehr_regelmaessig')},
          { value: 'regelmaessig', label: copy.get('questionnaire.question.schlafrhythmus.option.regelmaessig')},
          { value: 'etwas_unregelmaessig', label: copy.get('questionnaire.question.schlafrhythmus.option.etwas_unregelmaessig')},
          { value: 'unregelmaessig', label: copy.get('questionnaire.question.schlafrhythmus.option.unregelmaessig')},
          { value: 'sehr_unregelmaessig', label: copy.get('questionnaire.question.schlafrhythmus.option.sehr_unregelmaessig')},
        ],
      },
      {
        id: 'schlaf_auswirkung', // F-4.4 – Gegencheck
        text:
          copy.get('questionnaire.question.schlaf_auswirkung.text'),
        type: 'single',
        options: [
          { value: 'gar_nicht', label: copy.get('questionnaire.question.schlaf_auswirkung.option.gar_nicht')},
          { value: 'kaum', label: copy.get('questionnaire.question.schlaf_auswirkung.option.kaum')},
          { value: 'spuerbar', label: copy.get('questionnaire.question.schlaf_auswirkung.option.spuerbar')},
          { value: 'deutlich', label: copy.get('questionnaire.question.schlaf_auswirkung.option.deutlich')},
          { value: 'massiv', label: copy.get('questionnaire.question.schlaf_auswirkung.option.massiv')},
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
        text: copy.get('questionnaire.question.belastbarkeit.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'selbstwirksamkeit', // F-5.2 Selbstwirksamkeit
        text: copy.get('questionnaire.question.selbstwirksamkeit.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'sinnhaftigkeit', // F-5.3 Sinnhaftigkeit
        text: copy.get('questionnaire.question.sinnhaftigkeit.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'coping', // F-5.4 Coping-Kompetenz
        text: copy.get('questionnaire.question.coping.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'verbundenheit', // F-5.5 Soziale Verbundenheit
        text: copy.get('questionnaire.question.verbundenheit.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'selbstfuersorge', // F-5.6 Selbstfürsorge
        text: copy.get('questionnaire.question.selbstfuersorge.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'zukunft', // F-5.7 Zukunftsorientierung
        text: copy.get('questionnaire.question.zukunft.text'),
        type: 'single',
        options: AGREE,
      },
      {
        id: 'positive_emotionen', // F-5.8 Positive Emotionen
        text: copy.get('questionnaire.question.positive_emotionen.text'),
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
