/*
 * scoring.js
 * ---------------------------------------------------------------------------
 * Berechnet aus den Antworten:
 *   - abgeleitete Kennzahlen (BMI, Taille-Grösse-Verhältnis)
 *   - einen Score pro bewerteter Dimension (0–100)
 *   - einen Gesamtscore
 *   - relevante Risikosignale (Lebensstil vs. medizinische Abklärung)
 *
 * Modell (gemäss Score-Dokument «Score Berechnungen» zum finalen Fragenset
 * «Fragebogen HN»; bewusste, begründete Abweichungen sind direkt im Code
 * kommentiert und in docs/QUELLEN.md dokumentiert):
 *   Jede bewertete Antwort wird auf eine interne Skala von -2 bis +2 normiert
 *   (+2 = sehr gut … 0 = neutral … -2 = kritisch). Pro Dimension wird der
 *   Mittelwert der vorhandenen Antworten gebildet, ergänzt um «Gegenchecks»,
 *   die eine gute Bewertung deckeln, wenn eine kritische Kernangabe vorliegt.
 *   Anschliessend wird linear auf 0–100 abgebildet:  score = (norm + 2) / 4 * 100
 *   (-2 → 0, 0 → 50, +2 → 100). Der Gesamtscore ist der Mittelwert der fünf
 *   bewerteten Dimensionen.
 *
 * Das Modell ist bewusst transparent und einfach gehalten. Es ist KEINE
 * Diagnose, sondern eine grobe Standortbestimmung zur Orientierung.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

/* Zustimmungsskala (Bereich «Mentales Wohlbefinden»). */
const AGREE_NORM = { voll: 2, eher: 1, teils: 0, eher_nicht: -1, gar_nicht: -2 };

/* Normwerte je Antwortoption auf der Skala -2 … +2. */
const NORMS = {
  /* --- S-1 Einflussfaktoren --- */
  stabilitaet: { sehr_sicher: 2, sicher: 1, weder: 0, unsicher: -1, sehr_unsicher: -2 },
  // Sitzzeit: bewusste Abweichung vom Score-Dokument (dort 7–8 h = −1, 9–10 h = −2).
  // Monotone, dosisabhängige Skala gemäss Evidenz (Ekelund et al. 2016/2019: deutlich
  // erhöhtes Risiko v. a. ab ~9,5 h/Tag; 7–8 h ≈ Bevölkerungsdurchschnitt → «genügend»).
  // Details siehe docs/QUELLEN.md.
  sitzzeit: { u4: 2, s4_6: 1, s7_8: 0, s9_10: -1, ue10: -2 },
  familienwissen: { sehr_gut: 2, gut: 1, teilweise: 0, wenig: -1, gar_nicht: -2 },
  rauchen: { nie: 2, frueher: 1, keine_angabe: 0, ja_gelegentlich: -2, ja_regelmaessig: -2 },
  alkohol: { nie_selten: 2, m1_4: 0, w2_3: -1, w4plus: -2, keine_angabe: 0 },
  socialmedia: { nein: 2, selten: 1, manchmal: 0, oft: -1, sehr_oft: -2 },

  /* --- S-2 Körperliche Fitness (Fragebogen-Anteil) --- */
  ausdauer_moderat: { u30: -2, m30_75: -1, m75_150: 0, m150_300: 1, ue300: 2 },
  ausdauer_intensiv: { keine: -2, u30: -1, m30_75: 0, m75_150: 1, ue150: 2 },
  // Krafttraining: bewusste Abweichung vom Fragenset (dort 1 Tag = +1).
  // 1 Tag/Woche liegt unter der WHO-Empfehlung (≥ 2 Tage) → neutral (0) statt +1;
  // ausserdem wäre 1 Tag = 2 Tage (+1/+1) nicht plausibel. Siehe docs/QUELLEN.md.
  krafttraining: { tage0: -2, tage1: 0, tage2: 1, tage3plus: 2 },
  beweglichkeit: { gar_nicht: 2, wenig: 1, maessig: 0, ziemlich: -1, nicht: -2 },
  treppen: { gar_nicht: 2, kaum: 1, etwas: 0, deutlich: -1, sehr_stark: -2 },
  einkaufstaschen: { gar_nicht: 2, wenig: 1, maessig: 0, ziemlich: -1, nicht: -2 },

  /* --- S-3 Ernährung --- */
  // Die Proteinfrage bewertet ausschliesslich die Regelmässigkeit verteilter
  // Proteinquellen. Sie schätzt weder die Tagesmenge noch eine Versorgung in g/kg.
  protein: { selten: -2, manchmal: -1, haelfte: 0, meistens: 1, fast_immer: 2 },
  pflanzenvielfalt: { u10: -2, v10_17: -1, v18_25: 0, v26_34: 1, ue35: 2 },
  saettigung: { nie: -2, selten: -1, manchmal: 0, oft: 1, fast_immer: 2 },
  verarbeitet: { nie: 2, u1woche: 1, w1_2: 0, fast_taeglich: -1, mehrmals_taeglich: -2 },
  omega3: { nie: -2, u1woche: -1, w1: 0, w2: 1, ue2: 2 },
  zuckergetraenke: { nie: 2, u1woche: 1, w1_3: 0, w4_6: -1, taeglich: -2 },

  /* --- S-4 Schlaf --- */
  schlafqualitaet: { sehr_gut: 2, gut: 1, durchschnittlich: 0, schlecht: -1, sehr_schlecht: -2 },
  // >9 h sind nicht generell ungünstig (z. B. junge Erwachsene, Erholung von
  // Schlafdefizit oder Erkrankung). Ohne Kontext deshalb neutral statt negativ.
  schlafdauer: { u5: -2, s5_6: -1, s6_7: 0, s7_9: 2, ue9: 0 },
  schlafrhythmus: { sehr_regelmaessig: 2, regelmaessig: 1, etwas_unregelmaessig: 0, unregelmaessig: -1, sehr_unregelmaessig: -2 },
  schlaf_auswirkung: { gar_nicht: 2, kaum: 1, spuerbar: 0, deutlich: -1, massiv: -2 },

  /* --- S-5 Mentales Wohlbefinden --- */
  belastbarkeit: AGREE_NORM,
  selbstwirksamkeit: AGREE_NORM,
  sinnhaftigkeit: AGREE_NORM,
  coping: AGREE_NORM,
  verbundenheit: AGREE_NORM,
  selbstfuersorge: AGREE_NORM,
  zukunft: AGREE_NORM,
  positive_emotionen: AGREE_NORM,
};

const STATUS_BANDS = [
  { min: 80, key: 'stark', label: window.ResultCopy.get('service.status_band.stark.label'), color: '#2e9e6b' },
  { min: 60, key: 'solide', label: window.ResultCopy.get('service.status_band.solide.label'), color: '#5aa9e6' },
  { min: 40, key: 'ausbau', label: window.ResultCopy.get('service.status_band.ausbau.label'), color: '#e8a33d' },
  { min: 0, key: 'aufmerksam', label: window.ResultCopy.get('service.status_band.aufmerksam.label'), color: '#dd6b55' },
];
STATUS_BANDS.forEach(Object.freeze);
Object.freeze(STATUS_BANDS);

function statusForScore(score) {
  return STATUS_BANDS.find((b) => score >= b.min) || STATUS_BANDS[STATUS_BANDS.length - 1];
}

/* ---------- kleine Helfer ---------- */

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/* Normwert (-2…+2) einer Einfachauswahl-Frage. */
function norm(qid, value) {
  const map = NORMS[qid];
  if (!map || value == null) return null;
  const v = map[value];
  return v == null ? null : v;
}

/* Einheitliche Einordnung der beiden Ausdauerfragen.
 * Das WHO-Ziel kann über moderate ODER intensive Aktivität erreicht werden.
 * Eine exakte Kombination beider Intensitäten ist mit den breiten Antwort-
 * intervallen nicht belastbar berechenbar und bleibt fachlich zu entscheiden.
 * `needsEntry` bezeichnet nur die Kombination aus sehr wenig moderater und
 * keiner bzw. sehr wenig intensiver Aktivität. Die Scoreformel nutzt separat
 * den besseren der beiden kalibrierten Normwerte als gemeinsames
 * Aktivitätskomposit; dieser Helper hält Zielstatus, Empfehlungen und Stärken
 * kohärent. */
function activityStatus(a) {
  const answers = a || {};
  const moderate = answers.ausdauer_moderat;
  const intensive = answers.ausdauer_intensiv;
  const hasModerate = norm('ausdauer_moderat', moderate) != null;
  const hasIntensive = norm('ausdauer_intensiv', intensive) != null;
  const goalMet = moderate === 'm150_300' || moderate === 'ue300'
    || intensive === 'm75_150' || intensive === 'ue150';
  const needsEntry = hasModerate && hasIntensive && !goalMet
    && moderate === 'u30' && (intensive === 'keine' || intensive === 'u30');
  return {
    hasData: hasModerate && hasIntensive,
    goalMet,
    needsEntry,
  };
}

/* Mittelwert vorhandener Normwerte (null wird ignoriert). */
function avgNorms(list) {
  const vals = list.filter((v) => v != null && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/* Norm (-2…+2) → 0–100. */
function norm100(n) {
  return Math.max(0, Math.min(100, Math.round(((n + 2) / 4) * 100)));
}

/* Einordnung eines Messwerts in ein absteigendes Schwellen-Array [ +2, +1, 0, -1 ]. */
function bandNorm(v, t) {
  if (v == null) return null;
  if (v >= t[0]) return 2;
  if (v >= t[1]) return 1;
  if (v >= t[2]) return 0;
  if (v >= t[3]) return -1;
  return -2;
}

/* ---------- abgeleitete Kennzahlen ---------- */

function computeMetrics(a) {
  const m = { bmi: null, bmiClass: null, waist: null, whtr: null, waistStatus: null };

  const h = Number(a.groesse);
  const w = Number(a.gewicht);
  if (h > 0 && w > 0) {
    const bmi = w / Math.pow(h / 100, 2);
    m.bmi = Math.round(bmi * 10) / 10;
    if (bmi < 18.5) m.bmiClass = 'untergewicht';
    else if (bmi < 25) m.bmiClass = 'normal';
    else if (bmi < 30) m.bmiClass = 'uebergewicht';
    else if (bmi < 35) m.bmiClass = 'adipositas1';
    else m.bmiClass = 'adipositas2';
  }

  const waist = Number(a.bauchumfang);
  if (waist > 0 && h > 0) {
    m.waist = waist;
    // Ungerundeter Wert für Grenzentscheidungen. Eine Rundung vor dem Vergleich
    // würde Werte knapp unter 0,50 beziehungsweise 0,60 falsch hochstufen.
    m.whtr = waist / h; // Taille-Grösse-Verhältnis
    // Statusband: für Frau/Mann geschlechtsspezifische WHO-Umfangsschwellen,
    // für «intersex/andere» das geschlechtsneutrale Taille-Grösse-Verhältnis.
    if (a.geschlecht === 'maennlich') m.waistStatus = waist < 94 ? 'normal' : waist < 102 ? 'erhoeht' : 'hoch';
    else if (a.geschlecht === 'weiblich') m.waistStatus = waist < 80 ? 'normal' : waist < 88 ? 'erhoeht' : 'hoch';
    else m.waistStatus = m.whtr < 0.5 ? 'normal' : m.whtr < 0.6 ? 'erhoeht' : 'hoch';
  }
  m.bodyRisk = bodyRiskStatus(m, a);
  return m;
}

/* Körperzusammensetzung als Norm: bevorzugt Taille-Grösse-Verhältnis, sonst BMI. */
function bmiNorm(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 0;   // Untergewicht: nicht ideal, aber nicht kritisch
  if (bmi < 25) return 2;     // Normalbereich
  if (bmi < 30) return 0;     // Übergewicht
  return -2;                  // Adipositas
}
function whtrNorm(r) {
  if (r == null) return null;
  if (r < 0.34) return 0;
  if (r <= 0.45) return 2;
  if (r <= 0.51) return 0;
  if (r < 0.6) return -1;
  return -2;
}
/* Geschlechtsspezifische Taillenumfang-Norm (WHO-Schwellen), cm. */
function waistNormBySex(waist, geschlecht) {
  if (waist == null) return null;
  if (geschlecht === 'maennlich') {
    if (waist < 94) return 2;   // unauffällig
    if (waist < 102) return 0;  // erhöht
    return -2;                  // deutlich erhöht
  }
  if (geschlecht === 'weiblich') {
    if (waist < 80) return 2;
    if (waist < 88) return 0;
    return -2;
  }
  return null; // intersex/andere → keine Sex-Referenztabelle
}
/* Körperzusammensetzung als Norm:
 *   Frau/Mann  → geschlechtsspezifischer Taillenumfang (WHO), sonst BMI
 *   intersex/andere → geschlechtsneutrales Taille-Grösse-Verhältnis, sonst BMI
 */
function bodyRiskStatus(m, a) {
  const metrics = m || {};
  const bySex = waistNormBySex(metrics.waist, a && a.geschlecht);
  if (bySex != null) {
    return {
      source: 'waist',
      norm: bySex,
      severity: metrics.waistStatus === 'hoch'
        ? 'mittel'
        : (metrics.waistStatus === 'erhoeht' ? 'tief' : null),
    };
  }
  if (metrics.whtr != null) {
    const whtr = whtrNorm(metrics.whtr);
    return {
      source: 'whtr',
      norm: whtr,
      severity: metrics.waistStatus === 'hoch'
        ? 'mittel'
        : (metrics.waistStatus === 'erhoeht' ? 'tief' : null),
    };
  }
  const bmi = bmiNorm(metrics.bmi);
  return {
    source: 'bmi',
    norm: bmi,
    severity: bmi === -2 ? 'mittel' : null,
  };
}

function bodyNorm(m, a) {
  return (m && m.bodyRisk ? m.bodyRisk : bodyRiskStatus(m, a)).norm;
}

/* ---------- Fitness-Kurztests → Norm (-2…+2) ----------
 * Alters- und – wo fachlich passend – geschlechtsspezifische Vergleichstabellen
 * (Herleitung und Grenzen in docs/QUELLEN.md). Die interne Tabellenwahl bleibt
 * binär, damit die Datenstruktur kompakt ist. Der Referenzstatus verhindert aber,
 * dass für intersexuelle Personen geschlechtsspezifische Liegestütz- oder
 * Wandsitzwerte sichtbar eingestuft, gescort oder empfohlen werden.
 *
 * Standardformat je Altersband: [ +2, +1, 0, -1 ] (darunter -2).
 */
function sexKey(a) {
  return a.geschlecht === 'maennlich' ? 'm' : 'w';
}

/* Wählt aus { bands: [[maxAlter, schwellen], …] } das passende Altersband. */
function pickBand(bands, age) {
  for (let i = 0; i < bands.length; i++) {
    if (age < bands[i][0]) return bands[i][1];
  }
  return bands[bands.length - 1][1];
}

/* Einbeinstand (Augen offen, bester Versuch), Sekunden.
 * Referenz: Springer et al. 2007 (J Geriatr Phys Ther) – Normwerte sind
 * altersabhängig; relevante GESCHLECHTSUNTERSCHIEDE bestehen laut Studienlage
 * nicht («performance is … not related to gender»). Die Tabellen sind dennoch
 * pro Geschlecht hinterlegt (aktuell identisch), damit künftige differenzierte
 * Referenzwerte ohne Strukturänderung eingepflegt werden können.
 * Zusatzevidenz: Araujo et al. 2022 (BJSM) – 10-Sekunden-Kriterium ab 50+. */
const BALANCE_BANDS = {
  m: [
    [40, [45, 30, 20, 10]],
    [50, [40, 27, 18, 9]],
    [60, [37, 24, 15, 8]],
    [70, [30, 20, 12, 6]],
    [80, [20, 14, 8, 4]],
    [Infinity, [10, 6, 4, 2]],
  ],
  w: [
    [40, [45, 30, 20, 10]],
    [50, [40, 27, 18, 9]],
    [60, [37, 24, 15, 8]],
    [70, [30, 20, 12, 6]],
    [80, [20, 14, 8, 4]],
    [Infinity, [10, 6, 4, 2]],
  ],
};
/* Standard-Liegestütze (Zehen als Drehpunkt, maximale korrekte Wiederholungen).
 * Männer 20–69: CSEP-PATH/Payne et al.; 70–94 anhand der altersbezogenen
 * Arm-Curl-Mediane von Rikli & Jones modelliert. Frauen 18–24: Adams et al.;
 * 25–65: praktische Topend-Orientierung für Standard-Liegestütze; 66–94 mit
 * demselben konservativen Alterungsprinzip modelliert. Die App-Skala bündelt
 * bei Adams «sehr gut» und «gut» als solide Basis; bei Topend bündelt sie
 * «gut» und «überdurchschnittlich» als solide Basis sowie «schlecht» und
 * «sehr schlecht» im untersten Bereich.
 * Direkte, praktische und modellierte Referenzqualität werden separat markiert;
 * ab 95 bleibt der Wert eine persönliche Ausgangsmessung. Details: QUELLEN.md. */
const PUSHUP_BANDS = {
  m: [
    [30, [36, 29, 22, 17]],
    [40, [30, 22, 17, 12]],
    [50, [25, 17, 13, 10]],
    [60, [21, 13, 10, 7]],
    [70, [18, 11, 8, 5]],
    [80, [16, 10, 7, 4]],
    [90, [15, 9, 6, 4]],
    [Infinity, [12, 7, 5, 3]],
  ],
  w: [
    [25, [18, 8, 5, 0]],
    [30, [33, 14, 9, 5]],
    [40, [29, 13, 7, 3]],
    [50, [21, 10, 5, 2]],
    [60, [17, 9, 4, 2]],
    [66, [13, 6, 3, 2]],
    [70, [12, 6, 3, 2]],
    [80, [11, 5, 3, 2]],
    [90, [10, 5, 3, 2]],
    [Infinity, [9, 4, 3, 2]],
  ],
};
/* Wandsitz (beidbeinig, 90°-Winkel), Sekunden.
 * Harmonisierte vierstufige Orientierungswerte auf Basis publizierter
 * Perzentildaten (McIntosh et al. 1998; Koley & Bandyopadhyay 2024). Werte ab
 * 60 Jahren sind nur eingeschränkt belegt, ab 70 extrapoliert. Deshalb werden
 * die Stufen als Trainingsorientierung, nie als Diagnosegrenzen bezeichnet.
 * Format: [Stark ab, Solide Basis ab, Ausbaufähig ab]; darunter folgt
 * «Erhöhte Aufmerksamkeit». Details und Testprotokoll: docs/QUELLEN.md. */
const WALLSIT_BANDS = {
  m: [
    [30, [135, 95, 75]],
    [40, [120, 85, 65]],
    [50, [100, 70, 50]],
    [60, [85, 60, 40]],
    [70, [65, 45, 30]],
    [80, [50, 35, 20]],
    [90, [35, 25, 12]],
    [Infinity, [25, 15, 5]],
  ],
  w: [
    [30, [110, 80, 60]],
    [40, [100, 72, 55]],
    [50, [67, 50, 33]],
    [60, [61, 45, 30]],
    [70, [45, 30, 20]],
    [80, [35, 22, 12]],
    [90, [25, 15, 8]],
    [Infinity, [15, 8, 3]],
  ],
};
const FITNESS_TEST_RATING_KEYS = Object.freeze({
  2: 'very_strong',
  1: 'strong',
  0: 'reference',
  '-1': 'below_reference',
  '-2': 'markedly_below_reference',
});

/* Liefert die Schwelle des nächsthöheren Vergleichsbereichs. Der Wert
 * ist eine Trainingsorientierung, kein medizinischer Grenzwert
 * und kein versprochener 4-Wochen-Zielwert. */
function nextBandThreshold(thresholds, normValue) {
  const indexByNorm = { '-2': 3, '-1': 2, 0: 1, 1: 0 };
  const index = indexByNorm[normValue];
  return index == null ? null : thresholds[index];
}

/* Vier publizistisch verständliche Stufen für den Wandsitz. Die interne
 * Score-Abbildung +2/+1/0/-1 landet exakt in denselben vier Statusbändern wie
 * die sichtbare 0–100-Standortbestimmung; -2 bleibt für diesen Test ungenutzt. */
function fourLevelBandNorm(value, thresholds) {
  if (value >= thresholds[0]) return 2;
  if (value >= thresholds[1]) return 1;
  if (value >= thresholds[2]) return 0;
  return -1;
}

function nextFourLevelThreshold(thresholds, normValue) {
  const indexByNorm = { '-1': 2, 0: 1, 1: 0 };
  const index = indexByNorm[normValue];
  return index == null ? null : thresholds[index];
}

function fitnessTestReferenceStatus(id, age, geschlecht) {
  if (!Number.isFinite(age)) return 'age_outside_reference';
  if (id === 'einbeinstand') {
    return age >= 18 && age <= 99 ? 'supported' : 'age_outside_reference';
  }
  if (id === 'liegestuetze') {
    if (geschlecht === 'maennlich') {
      if (age < 20 || age > 94) return 'age_outside_reference';
      return age <= 69 ? 'supported' : 'modeled_orientation';
    }
    if (geschlecht === 'weiblich') {
      if (age < 18 || age > 94) return 'age_outside_reference';
      return age <= 65 ? 'harmonized_orientation' : 'modeled_orientation';
    }
    return age >= 18 && age <= 94 ? 'reference_unavailable' : 'age_outside_reference';
  }
  if (age < 18 || age > 94) return 'age_outside_reference';
  // Die freigegebene Tabelle ist biologisch geschlechtsspezifisch. Für intersex
  // liegt keine passende eigene Vergleichsgruppe vor; der Rohwert bleibt dort
  // sichtbar, wird aber weder eingefärbt noch für Empfehlungen verwendet.
  return geschlecht === 'maennlich' || geschlecht === 'weiblich'
    ? 'harmonized_orientation'
    : 'reference_unavailable';
}

/* Ein einziger Ergebnisvertrag fuer Scoring, Ergebnisdarstellung und
 * Empfehlungen. Nur tatsaechlich ausgefuellte optionale Tests erscheinen;
 * der numerische Wert 0 ist dabei ein gueltiges Ergebnis. */
function evaluateFitnessTests(a) {
  const age = numOrNull(a.alter);
  // Ohne ein valides Alter darf kein optionaler Kurztest versehentlich über
  // den bisherigen 40-Jahre-Fallback gescort oder als Empfehlung verwendet
  // werden. Die interne Bandwahl dient in diesem Fall nur dazu, den Rohwert im
  // einheitlichen Ergebnisvertrag zu halten; der Referenzstatus sperrt Score,
  // Statusfarbe und Empfehlung.
  const bandAge = Number.isFinite(age) ? age : 40;
  const sex = sexKey(a);
  const configs = [
    {
      id: 'einbeinstand', unitKey: 'seconds', component: 'balance',
      scoreComponent: 'balance', bands: BALANCE_BANDS,
    },
    {
      id: 'liegestuetze', unitKey: 'repetitions', component: 'strength',
      scoreComponent: 'musculature', bands: PUSHUP_BANDS,
    },
    {
      id: 'wandsitz', unitKey: 'seconds', component: 'strength_endurance',
      scoreComponent: 'musculature', bands: WALLSIT_BANDS, fourLevel: true,
    },
  ];

  return configs.reduce((out, config) => {
    const value = numOrNull(a[config.id]);
    if (value == null) return out;
    const thresholds = pickBand(config.bands[sex], bandAge).slice();
    const normValue = config.fourLevel
      ? fourLevelBandNorm(value, thresholds)
      : bandNorm(value, thresholds);
    const score = norm100(normValue);
    const referenceStatus = fitnessTestReferenceStatus(config.id, age, a.geschlecht);
    out.push({
      id: config.id,
      value,
      unitKey: config.unitKey,
      component: config.component,
      scoreComponent: config.scoreComponent,
      norm: normValue,
      score,
      ratingKey: FITNESS_TEST_RATING_KEYS[normValue],
      statusKey: statusForScore(score).key,
      thresholds,
      nextThreshold: config.fourLevel
        ? nextFourLevelThreshold(thresholds, normValue)
        : nextBandThreshold(thresholds, normValue),
      referenceStatus,
      scorable: referenceStatus === 'supported'
        || referenceStatus === 'harmonized_orientation'
        || referenceStatus === 'modeled_orientation',
    });
    return out;
  }, []);
}

/* ---------- Dimensions-Scores (Norm -2…+2) ---------- */

// S-1 Einflussfaktoren
function scoreEinfluss(a, m) {
  const body = bodyNorm(m, a);
  const rauchN = norm('rauchen', a.rauchen);
  let n = avgNorms([
    norm('stabilitaet', a.stabilitaet),
    norm('sitzzeit', a.sitzzeit),
    norm('familienwissen', a.familienwissen),
    rauchN,
    norm('alkohol', a.alkohol),
    norm('socialmedia', a.socialmedia),
    body,
  ]);
  if (n == null) return null;
  // Gegencheck: kritisches Rauchen oder kritische Körperzusammensetzung deckelt auf neutral.
  if ((rauchN === -2 || body === -2) && n > 0) n = 0;
  return n;
}

// S-2 Körperliche Fitness (Fragebogen + optionale Tests, Modell 2/5–2/5–1/5)
function scoreFitness(a, fitnessTests) {
  const tests = fitnessTests || evaluateFitnessTests(a);

  // Moderate und intensive Aktivitaet sind zwei gleichwertige Wege zum
  // Bewegungsziel, keine voneinander unabhaengigen Gesundheitsfaktoren. Der
  // bessere der beiden kalibrierten Werte bildet deshalb einen gemeinsamen
  // Aktivitaetswert. Sein bisheriges Gesamtgewicht von 2/3 des Konditionsblocks
  // bleibt erhalten; die alltagsnahe Treppenleistung bildet das restliche 1/3.
  const activityValues = [
    norm('ausdauer_moderat', a.ausdauer_moderat),
    norm('ausdauer_intensiv', a.ausdauer_intensiv),
  ].filter((value) => value != null && !Number.isNaN(value));
  const activity = activityValues.length ? Math.max(...activityValues) : null;
  const conditioningParts = [];
  if (activity != null) conditioningParts.push({ v: activity, w: 2 });
  const stairs = norm('treppen', a.treppen);
  if (stairs != null) conditioningParts.push({ v: stairs, w: 1 });
  const conditioningWeight = conditioningParts.reduce((sum, part) => sum + part.w, 0);
  const kondition = conditioningWeight
    ? conditioningParts.reduce((sum, part) => sum + part.v * part.w, 0) / conditioningWeight
    : null;

  let muskulatur = avgNorms([
    norm('krafttraining', a.krafttraining),
    norm('einkaufstaschen', a.einkaufstaschen),
  ]);
  // Liegestuetz und Wandsitz messen unterschiedliche Muskelgruppen, gehoeren
  // aber beide zum Teilbereich Muskulatur. Sind beide vorhanden, teilen sie
  // sich gleichgewichtet die Testhaelfte dieses Teilbereichs. Dadurch waechst
  // das Gewicht der Muskulatur nicht allein durch einen zweiten freiwilligen
  // Test; ein Wandsitz kann insbesondere keine schwache Kondition ausgleichen.
  const strengthTests = avgNorms(tests
    .filter((test) => test.scorable && test.scoreComponent === 'musculature')
    .map((test) => test.norm));
  if (muskulatur != null && strengthTests != null) muskulatur = (muskulatur + strengthTests) / 2;
  else if (muskulatur == null) muskulatur = strengthTests;

  let balance = norm('beweglichkeit', a.beweglichkeit);
  const balanceTests = avgNorms(tests
    .filter((test) => test.scorable && test.scoreComponent === 'balance')
    .map((test) => test.norm));
  if (balance != null && balanceTests != null) balance = (balance + balanceTests) / 2;
  else if (balance == null) balance = balanceTests;

  const parts = [];
  if (kondition != null) parts.push({ v: kondition, w: 2 });
  if (muskulatur != null) parts.push({ v: muskulatur, w: 2 });
  if (balance != null) parts.push({ v: balance, w: 1 });
  if (!parts.length) return null;
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  return parts.reduce((s, p) => s + p.v * p.w, 0) / wsum;
}

// S-3 Ernährung
function scoreErnaehrung(a) {
  return avgNorms([
    norm('protein', a.protein),
    norm('pflanzenvielfalt', a.pflanzenvielfalt),
    norm('verarbeitet', a.verarbeitet),
    norm('omega3', a.omega3),
    norm('zuckergetraenke', a.zuckergetraenke),
  ]);
}

// S-4 Schlaf
function scoreSchlaf(a) {
  let n = avgNorms([
    norm('schlafqualitaet', a.schlafqualitaet),
    norm('schlafdauer', a.schlafdauer),
    norm('schlafrhythmus', a.schlafrhythmus),
  ]);
  if (n == null) return null;
  const aus = norm('schlaf_auswirkung', a.schlaf_auswirkung);
  // Alltagsbeeintraechtigung wirkt abgestuft: «spuerbar» verhindert eine
  // unpassende starke Einordnung, deutlich/massiv deckeln weiter auf neutral.
  if (aus === 0 && n > 1) n = 1;
  else if (aus != null && aus < 0 && n > 0) n = 0;
  return n;
}

// S-5 Mentales Wohlbefinden
const MENTAL_IDS = ['belastbarkeit', 'selbstwirksamkeit', 'sinnhaftigkeit', 'coping', 'verbundenheit', 'selbstfuersorge', 'zukunft', 'positive_emotionen'];
function severeMental(a) {
  const belast = norm('belastbarkeit', a.belastbarkeit);
  const coping = norm('coping', a.coping);
  const selbstw = norm('selbstwirksamkeit', a.selbstwirksamkeit);
  const sinn = norm('sinnhaftigkeit', a.sinnhaftigkeit);
  const pos = norm('positive_emotionen', a.positive_emotionen);
  return belast === -2 || coping === -2 || selbstw === -2 || (sinn === -2 && pos === -2);
}
function scoreMental(a) {
  let n = avgNorms(MENTAL_IDS.map((id) => norm(id, a[id])));
  if (n == null) return null;
  if (severeMental(a) && n > 0) n = 0;
  return n;
}

function dimNorm(dimId, a, m, fitnessTests) {
  switch (dimId) {
    case 'einfluss': return scoreEinfluss(a, m);
    case 'fitness': return scoreFitness(a, fitnessTests);
    case 'ernaehrung': return scoreErnaehrung(a);
    case 'schlaf': return scoreSchlaf(a);
    case 'mental': return scoreMental(a);
    default: return null;
  }
}

/* ---------- Risikosignale ----------
 * type: 'medizinisch'  -> ärztlich einordnen lassen
 *       'lebensstil'    -> hier können Sie selbst viel bewirken
 *       'dringend'      -> zeitnah medizinisch abklären
 * severity: 'hoch' | 'mittel' | 'tief'
 *
 * Nicht beeinflussbare bzw. medizinische Angaben (familiäres Risiko,
 * Bluthochdruck) fliessen NICHT als Punkteabzug in die Einflussfaktoren ein,
 * sondern erscheinen bewusst hier als Hinweis/Signal.
 */
function detectRiskSignals(a, m, fitnessTests) {
  const sig = [];
  const add = (id, type, severity) => sig.push({
    id,
    type,
    severity,
    label: window.ResultCopy.get('recommendation.risk_signal.' + id + '.label'),
  });

  // --- Mentale Belastung ---
  const belast = norm('belastbarkeit', a.belastbarkeit);
  const coping = norm('coping', a.coping);
  const selbstw = norm('selbstwirksamkeit', a.selbstwirksamkeit);
  const sinn = norm('sinnhaftigkeit', a.sinnhaftigkeit);
  const pos = norm('positive_emotionen', a.positive_emotionen);
  const verb = norm('verbundenheit', a.verbundenheit);
  if (severeMental(a)) {
    add('hohe_belastung', 'medizinisch', 'hoch');
  } else if (belast <= -1 || coping <= -1 || selbstw <= -1 || (pos != null && pos <= -1)) {
    add('belastung', 'lebensstil', 'mittel');
  }
  if (verb != null && verb <= -1) {
    add('einsamkeit', 'lebensstil', 'mittel');
  }

  // --- Medizinisch einzuordnen ---
  if (a.bluthochdruck === 'ja') {
    add('bluthochdruck', 'medizinisch', 'hoch');
  } else if (a.bluthochdruck === 'weiss_nicht') {
    add('blutdruck_unbekannt', 'medizinisch', 'mittel');
  }
  if (a.familie_hk === 'ja') {
    add('familie_hk', 'medizinisch', 'mittel');
  }
  if (a.vorsorge === 'nein') {
    add('vorsorge', 'medizinisch', 'mittel');
  }
  if (m.bmiClass === 'untergewicht') {
    add('untergewicht', 'medizinisch', 'mittel');
  }

  // --- Lebensstil ---
  if (a.rauchen === 'ja_regelmaessig' || a.rauchen === 'ja_gelegentlich') {
    add('rauchen', 'lebensstil', 'hoch');
  }
  if (a.alkohol === 'w4plus') {
    add('alkohol', 'lebensstil', 'mittel');
  }
  const bodyRisk = m.bodyRisk || bodyRiskStatus(m, a);
  if (bodyRisk.severity) {
    add('koerperzusammensetzung', 'lebensstil', bodyRisk.severity);
  }
  const activity = activityStatus(a);
  const kraftN = norm('krafttraining', a.krafttraining);
  if (activity.needsEntry && kraftN != null && kraftN <= 0) {
    add('bewegungsmangel', 'lebensstil', 'hoch');
  } else if (kraftN === -2) {
    add('keine_kraft', 'lebensstil', 'mittel');
  }
  if (a.sitzzeit === 'ue10' || a.sitzzeit === 's9_10') {
    add('sitzen', 'lebensstil', 'mittel');
  }
  if (a.stabilitaet === 'unsicher' || a.stabilitaet === 'sehr_unsicher') {
    add('stabilitaet', 'lebensstil', 'mittel');
  }
  const legstandTest = (fitnessTests || []).find((test) => test.id === 'einbeinstand');
  // Ein intern berechneter Vergleichswert ist nur dann fachlich verwertbar,
  // wenn für Alter und Referenzgruppe ein freigegebener Scorevertrag besteht.
  // Insbesondere dürfen 16- und 17-Jährige durch ihren sichtbaren Rohwert
  // keine automatische Balance-Empfehlung erhalten.
  const legstand = legstandTest && legstandTest.scorable ? legstandTest.norm : null;
  if (a.beweglichkeit === 'nicht' || a.beweglichkeit === 'ziemlich' || legstand === -2) {
    add('balance', 'lebensstil', 'mittel');
  }
  if (a.schlaf_auswirkung === 'massiv') {
    add('schlaf', 'medizinisch', 'mittel');
  } else if (a.schlafqualitaet === 'schlecht' || a.schlafqualitaet === 'sehr_schlecht'
      || a.schlafdauer === 'u5') {
    add('schlaf', 'lebensstil', 'mittel');
  }
  if (a.socialmedia === 'sehr_oft' || a.socialmedia === 'oft') {
    add('socialmedia', 'lebensstil', 'mittel');
  }
  if (a.zuckergetraenke === 'taeglich' || a.verarbeitet === 'mehrmals_taeglich') {
    add('ernaehrung', 'lebensstil', 'mittel');
  }

  return sig;
}

/* ---------- Gesamtauswertung ---------- */

function computeResults(answers) {
  const schema = typeof window !== 'undefined' && window.HealthAnswerSchema;
  let cleanAnswers = {};
  try {
    cleanAnswers = schema && typeof schema.sanitizeAnswers === 'function'
      ? schema.sanitizeAnswers(answers)
      : {};
  } catch (error) {
    cleanAnswers = {};
  }

  const metrics = computeMetrics(cleanAnswers);
  const fitnessTests = evaluateFitnessTests(cleanAnswers);
  const scores = {};
  const norms = {};
  const order = (typeof window !== 'undefined' && window.DIMENSION_ORDER) || ['einfluss', 'fitness', 'ernaehrung', 'schlaf', 'mental'];
  order.forEach((id) => {
    const n = dimNorm(id, cleanAnswers, metrics, fitnessTests);
    norms[id] = n;
    scores[id] = n == null ? 50 : norm100(n);
  });

  // Gesamtscore: gleichgewichteter Mittelwert der bewerteten Dimensionen.
  const vals = order.map((id) => scores[id]);
  const overall = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 50;

  const signals = detectRiskSignals(cleanAnswers, metrics, fitnessTests);

  const hasCriticalDimension = vals.some((score) => score < 40);
  const status = statusForScore(hasCriticalDimension && overall >= 80 ? 79 : overall);

  return { metrics, scores, norms, overall, status, signals, fitnessTests };
}

if (typeof window !== 'undefined') {
  // questionNorm(qid, value) → -2…+2 oder null: erlaubt der UI, konkrete
  // Defizit-Themen (z. B. für die Ergebnis-Zusammenfassung) zu benennen.
  window.Scoring = Object.freeze({
    computeResults,
    statusForScore,
    STATUS_BANDS,
    questionNorm: norm,
    activityStatus,
    bodyRiskStatus,
  });
}
})();
