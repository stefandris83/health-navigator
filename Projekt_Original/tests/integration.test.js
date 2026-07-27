/*
 * tests/integration.test.js
 * ---------------------------------------------------------------------------
 * Abhängigkeitsfreie Tests (nur Node, kein Framework):
 *
 *   node tests/integration.test.js
 *
 * Prüft die Integrationsschicht (js/integration.js) und als Regression die
 * bestehende Kernlogik (Scoring + Empfehlungen). Die Tests laufen bewusst
 * SEQUENZIELL, da die Integrationsschicht – wie in der App – ein Singleton
 * mit gemeinsamem Kontext-Zustand ist. Exit-Code 0 = alles grün.
 * ---------------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Browser-Shim: Die App-Module hängen sich an `window`.
global.window = {};

const ROOT = path.join(__dirname, '..');
function loadModule(rel) {
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

loadModule('js/locale.js');
loadModule('js/config.js');
loadModule('js/url-safety.js');
loadModule('js/result-copy.generated.js');
loadModule('js/result-copy.js');
loadModule('js/questions.js');
loadModule('js/helsana.js');
loadModule('js/integration.js');
loadModule('js/scoring.js');
loadModule('js/recommendations.js');
loadModule('js/coach.js');

const W = global.window;
const Integ = W.HelsanaIntegration;
const CATS = Integ.PRODUCT_CATEGORIES;
const RECOMMENDATION_CONTENT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'content/result-texts/recommendations.json'), 'utf8')
);
const RECOMMENDATION_ENTRIES = new Map(
  RECOMMENDATION_CONTENT.entries.map((entry) => [entry.id, entry])
);

function contentEntry(id) {
  const entry = RECOMMENDATION_ENTRIES.get(id);
  assert.ok(entry, 'Content-ID fehlt: ' + id);
  return entry;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('Coach priorisiert akute Begriffe vor Atemübungs- und Stressantworten', () => {
  const ctx = {
    overall: 50,
    statusLabel: 'Test',
    byId: {},
    weakest: null,
    strongest: null,
    signals: [],
    top: [],
  };
  assert.strictEqual(W.Coach.mockAnswer('Ich habe plötzlich Atemnot', ctx), W.ResultCopy.get('coach.answer.emergency'));
  assert.strictEqual(W.Coach.mockAnswer('Verdacht auf Herzinfarkt', ctx), W.ResultCopy.get('coach.answer.emergency'));
  assert.strictEqual(W.Coach.mockAnswer('Zeig mir die Atemübung', ctx), W.ResultCopy.get('coach.answer.breathing'));
});

test('Coach erkennt akute und thematische Begriffe in allen unterstützten Sprachen', () => {
  const ctx = {
    overall: 50,
    statusLabel: 'Test',
    byId: {},
    weakest: null,
    strongest: null,
    signals: [],
    top: [],
  };
  const previousLocale = W.HealthLocale;
  let current = 'de-CH';
  W.HealthLocale = {
    current,
    getLocale() { return current; },
    normalize(value) { return ['de-CH', 'en-CH', 'fr-CH', 'it-CH'].includes(value) ? value : null; },
  };
  const cases = [
    ['en-CH', 'I have sudden chest pain', 'coach.answer.emergency', null],
    ['fr-CH', "J'ai une difficulté respiratoire", 'coach.answer.emergency', null],
    ['it-CH', 'Ho un dolore al petto improvviso', 'coach.answer.emergency', null],
    ['en-CH', 'Can you show me a breathing exercise?', 'coach.answer.breathing', null],
    ['fr-CH', 'Comment améliorer mon sommeil?', 'coach.answer.sleep', { sleepScore: W.ResultCopy.get('coach.context.score_unknown') }],
    ['it-CH', 'Vorrei migliorare la mia alimentazione', 'coach.answer.nutrition', { nutritionScore: W.ResultCopy.get('coach.context.score_unknown') }],
  ];
  try {
    cases.forEach(([locale, question, expectedId, variables]) => {
      current = locale;
      W.HealthLocale.current = locale;
      const expected = variables
        ? W.ResultCopy.format(expectedId, variables)
        : W.ResultCopy.get(expectedId);
      assert.strictEqual(W.Coach.mockAnswer(question, ctx), expected, locale + ': ' + question);
    });
  } finally {
    W.HealthLocale = previousLocale;
  }
});

/* ---------------- Integrationsschicht ---------------- */

test('Standard ohne Login: anonymer Kontext, keine Hinweise', async () => {
  const ctx = await Integ.init('anonym');
  assert.strictEqual(ctx.isAuthenticated, false);
  assert.strictEqual(Integ.coverageHintFor('ernaehrung'), null);
  assert.strictEqual(Integ.coverageHintFor('bewegung'), null);
});

test('Demo-Profil «grund»: eingeloggt, aber keine Zusatz-Hinweise', async () => {
  const ctx = await Integ.init('grund');
  assert.strictEqual(ctx.isAuthenticated, true);
  assert.strictEqual(Integ.hasCategory(CATS.BASIC), true);
  assert.strictEqual(Integ.hasCategory(CATS.SUPP_PREVENTION), false);
  assert.strictEqual(Integ.coverageHintFor('ernaehrung'), null, 'Nur Grundversicherung → kein Zusatz-Hinweis');
});

test('Demo-Profil «zusatz-praevention»: Hinweis nur für passende Angebote', async () => {
  await Integ.init('zusatz-praevention');
  assert.ok(Integ.coverageHintFor('bewegung'), 'Prävention → Hinweis bei Bewegungsangebot');
  assert.ok(Integ.coverageHintFor('kraft'), 'Prävention → Hinweis bei Kraftangebot');
  assert.strictEqual(Integ.coverageHintFor('vorsorge'), null, 'Vorsorge braucht SUPP_AMBULANT');
  assert.strictEqual(Integ.coverageHintFor('schlaf'), null, 'Angebot ohne Mapping → nie ein Hinweis');
});

test('Demo-Profil «zusatz-komplett»: Hinweise inkl. ambulanter Leistungen', async () => {
  await Integ.init('zusatz-komplett');
  assert.ok(Integ.coverageHintFor('vorsorge'));
  assert.ok(Integ.coverageHintFor('mentaleHilfe'));
  assert.strictEqual(Integ.coverageHintFor('plusEntdecken'), null, 'Bonusprogramm bewusst ohne Hinweis');
});

test('Alle Coverage-Hinweis-Schlüssel existieren in HELSANA_OFFERS', () => {
  const offerKeys = Object.keys(W.HELSANA_OFFERS);
  ['ernaehrung', 'bewegung', 'kraft', 'rauchstopp', 'stress', 'mentaleHilfe', 'vorsorge']
    .forEach((k) => assert.ok(offerKeys.includes(k), `Angebot fehlt: ${k}`));
});

test('Datensparsamkeit: Whitelist verwirft überflüssige/ungültige Felder', () => {
  const dirty = {
    isAuthenticated: true,
    displayName: '  Max Muster  ',
    ahvNumber: '756.0000.0000.00',        // darf NICHT übernommen werden
    policyDetails: { premium: 999 },       // darf NICHT übernommen werden
    products: [
      { id: 'p1', category: CATS.BASIC, label: 'Grund', contractNo: 'X-1' },
      { id: 'p2', category: 'UNBEKANNT', label: 'Weg damit' }, // ungültige Kategorie
      'kaputt',                                                  // ungültiger Eintrag
    ],
  };
  const ctx = Integ.normalizeCustomerContext(dirty);
  assert.strictEqual(ctx.displayName, 'Max Muster');
  assert.strictEqual(ctx.products.length, 1);
  assert.deepStrictEqual(Object.keys(ctx).sort(), ['displayName', 'isAuthenticated', 'products', 'source']);
  assert.deepStrictEqual(Object.keys(ctx.products[0]).sort(), ['category', 'id', 'label']);
  assert.strictEqual('ahvNumber' in ctx, false);
});

test('Adapter austauschbar: setAdapter() + init() liefert Live-Kontext', async () => {
  const LiveDummyAdapter = {
    async getCustomerContext() {
      return {
        isAuthenticated: true,
        displayName: 'IT-Testkunde',
        products: [{ id: 'x', category: CATS.SUPP_AMBULANT, label: 'Ambulant' }],
        source: 'live',
      };
    },
  };
  Integ.setAdapter(LiveDummyAdapter);
  const ctx = await Integ.init();
  assert.strictEqual(ctx.source, 'live');
  assert.ok(Integ.coverageHintFor('vorsorge'), 'Ambulant → Vorsorge-Hinweis');
});

test('Kaputter Adapter → sicherer anonymer Kontext (kein Absturz)', async () => {
  Integ.setAdapter({ async getCustomerContext() { throw new Error('Backend down'); } });
  const ctx = await Integ.init();
  assert.strictEqual(ctx.isAuthenticated, false);
  // Zurück auf ein Mock-Verhalten für allfällige weitere Tests.
  Integ.setAdapter({ async getCustomerContext(id) { return Integ.DEMO_PROFILES[id] || null; } });
  await Integ.init('anonym');
});

/* ---------------- Regression Kernlogik ---------------- */

// Profil mit klaren Defiziten → garantiert Empfehlungen.
const DEFICIT_ANSWERS = {
  alter: 52, geschlecht: 'maennlich', groesse: 178, gewicht: 96,
  stabilitaet: 'unsicher', sitzzeit: 'ue10', familienwissen: 'wenig', vorsorge: 'nein',
  rauchen: 'ja_regelmaessig', alkohol: 'w4plus', socialmedia: 'oft', familie_hk: 'nein', bluthochdruck: 'nein',
  ausdauer_moderat: 'u30', ausdauer_intensiv: 'keine', krafttraining: 'tage0',
  beweglichkeit: 'ziemlich', treppen: 'deutlich', einkaufstaschen: 'maessig',
  protein: 'selten', pflanzenvielfalt: 'u10', saettigung: 'selten',
  verarbeitet: 'mehrmals_taeglich', omega3: 'nie', zuckergetraenke: 'taeglich',
  schlafqualitaet: 'schlecht', schlafdauer: 's5_6', schlafrhythmus: 'unregelmaessig', schlaf_auswirkung: 'deutlich',
  belastbarkeit: 'eher_nicht', selbstwirksamkeit: 'teils', sinnhaftigkeit: 'teils', coping: 'teils',
  verbundenheit: 'teils', selbstfuersorge: 'eher_nicht', zukunft: 'teils', positive_emotionen: 'teils',
};

// Gesundes Profil → Engine darf auch (fast) leer liefern, ohne zu brechen.
const HEALTHY_ANSWERS = {
  alter: 45, geschlecht: 'weiblich', groesse: 170, gewicht: 63,
  stabilitaet: 'sehr_sicher', sitzzeit: 'u4', familienwissen: 'sehr_gut', vorsorge: 'ja',
  rauchen: 'nie', alkohol: 'nie_selten', socialmedia: 'nein', familie_hk: 'nein', bluthochdruck: 'nein',
  ausdauer_moderat: 'ue300', ausdauer_intensiv: 'ue150', krafttraining: 'tage3plus',
  beweglichkeit: 'gar_nicht', treppen: 'gar_nicht', einkaufstaschen: 'gar_nicht',
  einbeinstand: 45, liegestuetze: 30, wandsitz: 90,
  protein: 'fast_immer', pflanzenvielfalt: 'ue35', saettigung: 'fast_immer',
  verarbeitet: 'nie', omega3: 'ue2', zuckergetraenke: 'nie',
  schlafqualitaet: 'sehr_gut', schlafdauer: 's7_9', schlafrhythmus: 'sehr_regelmaessig', schlaf_auswirkung: 'gar_nicht',
  belastbarkeit: 'voll', selbstwirksamkeit: 'voll', sinnhaftigkeit: 'voll', coping: 'voll',
  verbundenheit: 'voll', selbstfuersorge: 'voll', zukunft: 'voll', positive_emotionen: 'voll',
};

test('Regression: Scoring liefert vollständige, plausible Ergebnisse', () => {
  [DEFICIT_ANSWERS, HEALTHY_ANSWERS].forEach((a) => {
    const res = W.Scoring.computeResults(a);
    assert.ok(res.overall >= 0 && res.overall <= 100);
    ['einfluss', 'fitness', 'ernaehrung', 'schlaf', 'mental'].forEach((d) => {
      assert.ok(typeof res.scores[d] === 'number', 'Score fehlt: ' + d);
    });
  });
  const bad = W.Scoring.computeResults(DEFICIT_ANSWERS);
  const good = W.Scoring.computeResults(HEALTHY_ANSWERS);
  assert.ok(good.overall > bad.overall, 'Gesundes Profil muss besser abschneiden');
});

test('Gesamtstatus bezeichnet kein Profil mit kritischer Einzeldimension als stark', () => {
  const criticalMental = { ...HEALTHY_ANSWERS };
  ['belastbarkeit', 'selbstwirksamkeit', 'sinnhaftigkeit', 'coping', 'verbundenheit',
    'selbstfuersorge', 'zukunft', 'positive_emotionen']
    .forEach((id) => { criticalMental[id] = 'gar_nicht'; });
  const critical = W.Scoring.computeResults(criticalMental);
  assert.strictEqual(critical.scores.mental, 0);
  assert.strictEqual(critical.overall, 80, 'Numerischer gleichgewichteter Mittelwert bleibt unverändert');
  assert.strictEqual(critical.status.key, 'solide', 'Kritische Einzeldimension verhindert Gesamtstatus «Stark»');
  assert.strictEqual(W.Scoring.statusForScore(80).key, 'stark', 'Allgemeine Bandfunktion bleibt unverändert');

  const neutralMental = { ...HEALTHY_ANSWERS };
  ['belastbarkeit', 'selbstwirksamkeit', 'sinnhaftigkeit', 'coping', 'verbundenheit',
    'selbstfuersorge', 'zukunft', 'positive_emotionen']
    .forEach((id) => { neutralMental[id] = 'teils'; });
  const neutral = W.Scoring.computeResults(neutralMental);
  assert.strictEqual(neutral.scores.mental, 50);
  assert.strictEqual(neutral.status.key, 'stark', 'Guard greift ausschliesslich unterhalb 40');
});

test('Regression: Empfehlungs-Engine liefert Top-3 bei Defizitprofil', () => {
  const res = W.Scoring.computeResults(DEFICIT_ANSWERS);
  const ctx = W.Recommendations.buildContext(DEFICIT_ANSWERS, res);
  const top = W.Recommendations.topThree(ctx);
  assert.strictEqual(top.length, 3);
  top.forEach((r) => assert.ok(r.title && r.step, 'Empfehlung unvollständig'));
});

test('Scoring exportiert questionNorm für die Ergebnis-Zusammenfassung', () => {
  assert.strictEqual(typeof W.Scoring.questionNorm, 'function');
  assert.strictEqual(W.Scoring.questionNorm('zuckergetraenke', 'taeglich'), -2);
  assert.strictEqual(W.Scoring.questionNorm('zuckergetraenke', 'nie'), 2);
  assert.strictEqual(W.Scoring.questionNorm('zuckergetraenke', undefined), null);
  assert.strictEqual(W.Scoring.questionNorm('gibt_es_nicht', 'x'), null);
});

test('Antwortschema: nur bekannte, gültige Werte; alle nicht optionalen Fragen sind Pflicht', () => {
  const Schema = W.HealthAnswerSchema;
  assert.ok(Schema, 'Zentrales Antwortschema exportiert');
  assert.strictEqual(Schema.areAnswersComplete(HEALTHY_ANSWERS), true, 'Vollständiges Profil wird akzeptiert');

  const dirty = { ...HEALTHY_ANSWERS, alter: 999, rauchen: 'unbekannter_wert', fremdes_feld: '<script>' };
  const clean = Schema.sanitizeAnswers(dirty);
  assert.strictEqual('fremdes_feld' in clean, false, 'Unbekannte IDs werden verworfen');
  assert.strictEqual('alter' in clean, false, 'Zahl ausserhalb des Bereichs wird verworfen');
  assert.strictEqual('rauchen' in clean, false, 'Unbekannte Option wird verworfen');
  assert.strictEqual(Schema.areAnswersComplete(clean), false, 'Ungültige Pflichtwerte verhindern ein Ergebnis');

  const withoutRequired = { ...HEALTHY_ANSWERS };
  delete withoutRequired.schlafqualitaet;
  assert.strictEqual(Schema.areAnswersComplete(withoutRequired), false, 'Fehlende Pflichtantwort verhindert ein Ergebnis');
  const withoutOptional = { ...HEALTHY_ANSWERS };
  delete withoutOptional.einbeinstand;
  delete withoutOptional.liegestuetze;
  delete withoutOptional.wandsitz;
  assert.strictEqual(Schema.areAnswersComplete(withoutOptional), true, 'Optionale Kurztests dürfen fehlen');
});

test('Zielalter: Der Check akzeptiert Personen ab 16 Jahren und verwirft jüngere Alterswerte', () => {
  const Schema = W.HealthAnswerSchema;
  const ageQuestion = W.DIMENSIONS
    .flatMap((dimension) => dimension.questions)
    .find((question) => question.id === 'alter');

  assert.strictEqual(ageQuestion.min, 16, 'HTML- und Schemavertrag verwenden dieselbe Untergrenze');
  assert.strictEqual(Schema.sanitizeAnswers({ alter: 15 }).alter, undefined);
  assert.strictEqual(Schema.sanitizeAnswers({ alter: 16 }).alter, 16);
  assert.strictEqual(Schema.areAnswersComplete({ ...HEALTHY_ANSWERS, alter: 15 }), false);
  assert.strictEqual(Schema.areAnswersComplete({ ...HEALTHY_ANSWERS, alter: 16 }), true);

  const underAgeResults = W.Scoring.computeResults({
    ...HEALTHY_ANSWERS,
    alter: 15,
    beweglichkeit: 'gar_nicht',
    einbeinstand: 0,
  });
  const underAgeLegstand = underAgeResults.fitnessTests.find((testResult) => testResult.id === 'einbeinstand');
  assert.strictEqual(underAgeLegstand.referenceStatus, 'age_outside_reference');
  assert.strictEqual(underAgeLegstand.scorable, false, 'ungültiges Alter darf nicht über einen Fallback scoren');
  assert.ok(!underAgeResults.signals.some((signal) => signal.id === 'balance'));
});

test('Fragen- und Scoring-APIs sind gekapselt, unveränderlich und sanitizen an der Scoring-Grenze', () => {
  assert.strictEqual(Object.isFrozen(W.DIMENSIONS), true);
  assert.strictEqual(Object.isFrozen(W.DIMENSIONS[0]), true);
  assert.strictEqual(Object.isFrozen(W.DIMENSIONS[0].questions), true);
  assert.strictEqual(Object.isFrozen(W.HealthAnswerSchema), true);
  assert.strictEqual(Object.isFrozen(W.Scoring), true);
  assert.strictEqual(Object.isFrozen(W.Scoring.STATUS_BANDS), true);
  assert.strictEqual(Object.isFrozen(W.Scoring.STATUS_BANDS[0]), true);
  assert.strictEqual(Object.isFrozen(W.Recommendations), true);
  assert.strictEqual(Object.isFrozen(W.Recommendations.CATALOG), true);
  assert.strictEqual(Object.isFrozen(W.Recommendations.CATALOG[0]), true);
  W.Recommendations.CATALOG.filter((record) => Array.isArray(record.covers)).forEach((record) => {
    assert.strictEqual(Object.isFrozen(record.covers), true, record.id + ': covers muss unveränderlich sein');
  });
  assert.strictEqual(Object.isFrozen(W.Recommendations.SOURCES), true);
  assert.strictEqual(Object.isFrozen(W.Recommendations.SOURCES.swissheart_werte), true);
  assert.strictEqual(Object.isFrozen(W.Recommendations.POSITIVES), true);
  assert.strictEqual(Object.isFrozen(W.Coach), true);

  const dirty = {
    ...DEFICIT_ANSWERS,
    alter: '52',
    rauchen: '<script>',
    ausdauer_moderat: 'unbekannter_wert',
    fremdes_feld: 'nicht übernehmen',
  };
  const clean = W.HealthAnswerSchema.sanitizeAnswers(dirty);
  assert.deepStrictEqual(
    W.Scoring.computeResults(dirty),
    W.Scoring.computeResults(clean),
    'computeResults muss exakt den zentral sanitizten Eingabestand auswerten'
  );
});

test('Scoring ist für alle bewerteten Einfachauswahlen monoton', () => {
  W.DIMENSIONS.filter((dimension) => dimension.scored !== false).forEach((dimension) => {
    dimension.questions.filter((question) => Array.isArray(question.options)).forEach((question) => {
      const ranked = question.options
        .map((option) => ({
          value: option.value,
          norm: W.Scoring.questionNorm(question.id, option.value),
        }))
        .filter((entry) => entry.norm != null)
        .sort((left, right) => right.norm - left.norm);
      if (!ranked.length) return;

      let previousDimension = Infinity;
      let previousOverall = Infinity;
      ranked.forEach((entry) => {
        const results = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, [question.id]: entry.value });
        assert.ok(results.scores[dimension.id] <= previousDimension,
          `${question.id}/${entry.value}: schlechtere Norm darf Dimension nicht verbessern`);
        assert.ok(results.overall <= previousOverall,
          `${question.id}/${entry.value}: schlechtere Norm darf Gesamtwert nicht verbessern`);
        previousDimension = results.scores[dimension.id];
        previousOverall = results.overall;
      });
    });
  });
});

test('Ausdauer: Alle Antwortkombinationen nutzen denselben Ziel- und Empfehlungsvertrag', () => {
  const moderateValues = ['u30', 'm30_75', 'm75_150', 'm150_300', 'ue300'];
  const intensiveValues = ['keine', 'u30', 'm30_75', 'm75_150', 'ue150'];
  const moderateGoal = new Set(['m150_300', 'ue300']);
  const intensiveGoal = new Set(['m75_150', 'ue150']);

  moderateValues.forEach((moderate) => intensiveValues.forEach((intensive) => {
    const a = { ...HEALTHY_ANSWERS, ausdauer_moderat: moderate, ausdauer_intensiv: intensive };
    const res = W.Scoring.computeResults(a);
    const ctx = W.Recommendations.buildContext(a, res);
    const activity = W.Scoring.activityStatus(a);
    const recIds = W.Recommendations.recommendationsForDimension('fitness', ctx).map((r) => r.id);
    const expectedGoal = moderateGoal.has(moderate) || intensiveGoal.has(intensive);
    const label = moderate + '/' + intensive;

    assert.strictEqual(activity.goalMet, expectedGoal, label + ': Zielstatus');
    if (expectedGoal) {
      assert.ok(res.scores.fitness >= 90, label + ': erfüllter Intensitätsweg wird im Score nicht durch den anderen Weg bestraft');
      assert.ok(!recIds.includes('fi_einstieg') && !recIds.includes('fi_ausdauer'), label + ': keine widersprüchliche Ausdauerempfehlung');
      assert.ok(W.Recommendations.keyStrengths(ctx, 5)
        .some((s) => s.id === 'st_bewegung' || s.id === 'st_fitness_top'),
      label + ': Bewegungsziel bleibt als eigene oder zusammengefasste Fitnessstärke sichtbar');
      assert.ok(!W.Recommendations.actionPlan(ctx).some((r) => r.id === 'fi_einstieg' || r.id === 'fi_ausdauer'), label + ': kein Ausdauerschritt');
    } else if (activity.needsEntry) {
      assert.ok(recIds.includes('fi_einstieg'), label + ': Einstiegsempfehlung');
    } else {
      assert.ok(recIds.includes('fi_ausdauer'), label + ': Ausbauempfehlung');
    }
  }));

  const low = { ...HEALTHY_ANSWERS, ausdauer_moderat: 'u30', ausdauer_intensiv: 'keine', krafttraining: 'tage0' };
  const lowRes = W.Scoring.computeResults(low);
  assert.ok(lowRes.signals.some((s) => s.id === 'bewegungsmangel'));

  const moderateRoute = W.Scoring.computeResults({
    ...HEALTHY_ANSWERS, ausdauer_moderat: 'm150_300', ausdauer_intensiv: 'keine',
  });
  const intensiveRoute = W.Scoring.computeResults({
    ...HEALTHY_ANSWERS, ausdauer_moderat: 'u30', ausdauer_intensiv: 'm75_150',
  });
  assert.strictEqual(moderateRoute.scores.fitness, intensiveRoute.scores.fitness,
    'äquivalente moderate und intensive Zielwege erhalten denselben Fitnessscore');
  const enduranceWhy = W.ResultCopy.get('recommendation.catalog.fi_ausdauer.why');
  assert.ok(enduranceWhy.includes('150 Minuten moderate'));
  assert.ok(enduranceWhy.includes('75 Minuten intensive'));
  assert.ok(!W.ResultCopy.get('recommendation.lever.lv_ausdauer.label').includes('150'),
    'Das Kurzlabel darf nicht nur einen der beiden gleichwertigen Aktivitätswege nennen');

  const neutralFitness = {
    ...HEALTHY_ANSWERS,
    ausdauer_moderat: 'm150_300',
    ausdauer_intensiv: 'keine',
    krafttraining: 'tage1',
    einkaufstaschen: 'maessig',
    beweglichkeit: 'maessig',
    treppen: 'etwas',
  };
  delete neutralFitness.einbeinstand;
  delete neutralFitness.liegestuetze;
  delete neutralFitness.wandsitz;
  const exactModerate = W.Scoring.computeResults(neutralFitness);
  const exactIntensive = W.Scoring.computeResults({
    ...neutralFitness,
    ausdauer_moderat: 'u30',
    ausdauer_intensiv: 'm75_150',
  });
  assert.strictEqual(exactModerate.scores.fitness, 57,
    'Aktivitätskomposit behält exakt zwei Drittel des Konditionsblocks');
  assert.strictEqual(exactIntensive.scores.fitness, 57,
    'max()-Vertrag bewertet den äquivalenten intensiven Zielweg identisch');
});

test('Mentale Unterstützung: Signal, Handlungsfeld und kritische Aktionskarte nutzen dieselbe Schwelle', () => {
  ['belastbarkeit', 'selbstwirksamkeit', 'coping'].forEach((id) => {
    const severe = { ...HEALTHY_ANSWERS, [id]: 'gar_nicht' };
    const severeRes = W.Scoring.computeResults(severe);
    const severeCtx = W.Recommendations.buildContext(severe, severeRes);
    assert.ok(severeRes.signals.some((s) => s.id === 'hohe_belastung'), id + ': hohes Signal');
    assert.strictEqual(severeRes.scores.mental, 50, id + ': kritisches Signal deckelt dieselbe Dimension');
    assert.ok(W.Recommendations.keyLevers(severeCtx, 3).some((l) => l.id === 'lv_mental_support'));
    assert.ok(W.Recommendations.actionPlan(severeCtx).some((r) => r.id === 'me_unterstuetzung'));
  });

  const lower = { ...HEALTHY_ANSWERS, sinnhaftigkeit: 'gar_nicht' };
  const lowerRes = W.Scoring.computeResults(lower);
  const lowerCtx = W.Recommendations.buildContext(lower, lowerRes);
  assert.ok(!lowerRes.signals.some((s) => s.id === 'hohe_belastung'));
  assert.ok(!W.Recommendations.actionPlan(lowerCtx).some((r) => r.id === 'me_unterstuetzung'), 'Keine kritische Karte ohne hohes Signal');
  assert.ok(W.Recommendations.actionPlan(lowerCtx).some((r) => r.id === 'me_sinn'), 'Niedrigschwellige Sinn-Empfehlung bleibt erhalten');
  assert.strictEqual(lowerRes.scores.mental, 88, 'Ein einzelner Sinn-Tiefstwert löst ohne hohes Signal keinen separaten Deckel aus');

  const positiveOnly = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, positive_emotionen: 'gar_nicht' });
  assert.ok(!positiveOnly.signals.some((signal) => signal.id === 'hohe_belastung'));
  assert.strictEqual(positiveOnly.scores.mental, 88,
    'Ein einzelner Tiefstwert positiver Emotionen löst ohne Sinn-Kombination keinen harten Deckel aus');

  const pairedMeaning = {
    ...HEALTHY_ANSWERS, sinnhaftigkeit: 'gar_nicht', positive_emotionen: 'gar_nicht',
  };
  const pairedResults = W.Scoring.computeResults(pairedMeaning);
  assert.ok(pairedResults.signals.some((s) => s.id === 'hohe_belastung'));
  assert.strictEqual(pairedResults.scores.mental, 50);

  const lowSelfEfficacy = { ...HEALTHY_ANSWERS, selbstwirksamkeit: 'eher_nicht' };
  const lowSelfEfficacyResults = W.Scoring.computeResults(lowSelfEfficacy);
  const lowSelfEfficacyCtx = W.Recommendations.buildContext(lowSelfEfficacy, lowSelfEfficacyResults);
  assert.ok(lowSelfEfficacyResults.signals.some((s) => s.id === 'belastung'), 'Negative Selbstwirksamkeit bleibt nicht unsichtbar');
  assert.ok(W.Recommendations.recommendationsForDimension('mental', lowSelfEfficacyCtx).some((r) => r.id === 'me_belastung'));
});

test('Priorisierung: topThree ist exakt ein Alias von actionPlan', () => {
  const a = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja' };
  const ctx = W.Recommendations.buildContext(a, W.Scoring.computeResults(a));
  assert.deepStrictEqual(
    W.Recommendations.topThree(ctx).map((r) => r.id),
    W.Recommendations.actionPlan(ctx).map((r) => r.id),
  );
});

test('Handlungsfelder: Bei Themenkollision rückt der zweitbeste Hebel einer Dimension nach', () => {
  const a = {
    ...HEALTHY_ANSWERS,
    alter: 70,
    stabilitaet: 'sehr_unsicher',
    ausdauer_moderat: 'm75_150', ausdauer_intensiv: 'm30_75',
    krafttraining: 'tage1', beweglichkeit: 'nicht', treppen: 'sehr_stark', einkaufstaschen: 'nicht',
  };
  delete a.einbeinstand;
  delete a.liegestuetze;
  delete a.wandsitz;
  const res = W.Scoring.computeResults(a);
  const ctx = W.Recommendations.buildContext(a, res);
  const fields = W.Recommendations.keyLevers(ctx, 3);
  assert.ok(fields.some((f) => f.id === 'lv_sturz' && f.dim === 'einfluss'));
  assert.ok(fields.some((f) => f.dim === 'fitness' && f.id !== 'lv_balance_fit'), 'Eigenständiger Fitness-Nachrücker bleibt sichtbar');
});

test('Detail-Fallback: Alle Dimensionen verwenden dieselben neutralen, soliden und starken Töne', () => {
  const answers = {
    ...HEALTHY_ANSWERS,
    schlafqualitaet: 'durchschnittlich',
    schlafdauer: 'ue9',
    schlafrhythmus: 'etwas_unregelmaessig',
    schlaf_auswirkung: 'gar_nicht',
  };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  assert.strictEqual(results.scores.schlaf, 50, 'reproduzierter neutraler Schlafscore');
  assert.deepStrictEqual(W.Recommendations.recommendationsForDimension('schlaf', ctx), []);
  ['einfluss', 'fitness', 'ernaehrung', 'schlaf', 'mental'].forEach((dimId) => {
    assert.ok(W.Recommendations.SOLIDS[dimId], dimId + ': solide Copy fehlt');
    assert.ok(W.Recommendations.POSITIVES[dimId], dimId + ': positive Copy fehlt');
    assert.strictEqual(W.Recommendations.dimensionFeedbackTone(50), 'neutral', dimId + ': Score 50 bleibt neutral');
  });
  [[0, 'neutral'], [39, 'neutral'], [40, 'neutral'], [59, 'neutral'],
    [60, 'solid'], [79, 'solid'], [80, 'positive'], [100, 'positive']]
    .forEach(([score, tone]) => assert.strictEqual(W.Recommendations.dimensionFeedbackTone(score), tone, String(score)));
  assert.notStrictEqual(W.Recommendations.SOLIDS.schlaf, W.Recommendations.POSITIVES.schlaf);

  const underweight = { ...HEALTHY_ANSWERS, groesse: 170, gewicht: 45 };
  const underweightResults = W.Scoring.computeResults(underweight);
  const underweightCtx = W.Recommendations.buildContext(underweight, underweightResults);
  assert.ok(underweightResults.signals.some((s) => s.id === 'untergewicht'));
  assert.strictEqual(W.Recommendations.hasOpenDimensionSignal('einfluss', underweightCtx), true);
  assert.strictEqual(W.Recommendations.hasOpenDimensionSignal('schlaf', underweightCtx), false);

  const scoringSource = fs.readFileSync(path.join(ROOT, 'js/scoring.js'), 'utf8');
  const signalIds = [...scoringSource.matchAll(/\badd\('([a-z0-9_]+)'/g)].map((match) => match[1]);
  assert.ok(signalIds.length > 0, 'keine Risikosignal-IDs im Scoring gefunden');
  [...new Set(signalIds)].forEach((signalId) => {
    const dimensions = ['einfluss', 'fitness', 'ernaehrung', 'schlaf', 'mental']
      .filter((dimId) => W.Recommendations.hasOpenDimensionSignal(dimId, { signals: [{ id: signalId }] }));
    assert.strictEqual(dimensions.length, 1, signalId + ': Signal muss genau einer Dimension zugeordnet sein');
  });
});

test('Sättigungsempfehlung und abgestufter Schlaf-Gegencheck bleiben kohärent', () => {
  const satietyRecommendationValues = new Set(['nie', 'selten', 'manchmal']);
  ['nie', 'selten', 'manchmal', 'oft', 'fast_immer'].forEach((saettigung) => {
    const answers = { ...HEALTHY_ANSWERS, saettigung };
    const results = W.Scoring.computeResults(answers);
    const context = W.Recommendations.buildContext(answers, results);
    const hasRecommendation = W.Recommendations.recommendationsForDimension('ernaehrung', context)
      .some((record) => record.id === 'er_saettigung');
    assert.strictEqual(results.scores.ernaehrung, 100,
      saettigung + ': Sättigung bleibt vollständig scorefrei');
    assert.strictEqual(hasRecommendation, satietyRecommendationValues.has(saettigung),
      saettigung + ': Empfehlung folgt weiterhin dem definierten Kontextvertrag');
  });

  const impairedSleep = { ...HEALTHY_ANSWERS, schlaf_auswirkung: 'spuerbar' };
  const impairedSleepResults = W.Scoring.computeResults(impairedSleep);
  const impairedSleepCtx = W.Recommendations.buildContext(impairedSleep, impairedSleepResults);
  assert.strictEqual(impairedSleepResults.scores.schlaf, 75, 'Spürbare Beeinträchtigung verhindert nur die starke Einordnung');
  assert.strictEqual(W.Scoring.statusForScore(impairedSleepResults.scores.schlaf).key, 'solide');
  assert.ok(W.Recommendations.recommendationsForDimension('schlaf', impairedSleepCtx).some((r) => r.id === 'sl_qualitaet'));
  const sleepQualityWhy = W.ResultCopy.get('recommendation.catalog.sl_qualitaet.why');
  assert.ok(sleepQualityWhy.includes('Schlafqualität oder die Auswirkungen'),
    'Die Empfehlung muss die disjunktive Auslöseregel wiedergeben');

  const barelyImpaired = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, schlaf_auswirkung: 'kaum' });
  assert.strictEqual(barelyImpaired.scores.schlaf, 100, 'Kaum beeinträchtigt verändert starke Kernwerte nicht');

  ['deutlich', 'massiv'].forEach((impact) => {
    const answers = { ...HEALTHY_ANSWERS, schlaf_auswirkung: impact };
    const results = W.Scoring.computeResults(answers);
    assert.strictEqual(results.scores.schlaf, 50, impact + ': deutliche Beeinträchtigung deckelt auf neutral');
  });
  const massiveResults = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, schlaf_auswirkung: 'massiv' });
  assert.deepStrictEqual(
    massiveResults.signals.find((signal) => signal.id === 'schlaf'),
    {
      id: 'schlaf', type: 'medizinisch', severity: 'mittel',
      label: W.ResultCopy.get('recommendation.risk_signal.schlaf.label'),
    },
  );
  assert.ok(W.ResultCopy.get('recommendation.lever.lv_schlaf_abklaerung.detail')
    .startsWith('Ihr Schlaf beeinträchtigt Ihren Alltag massiv.'));
  assert.ok(!W.ResultCopy.get('recommendation.lever.lv_schlaf_abklaerung.detail')
    .includes('lange genug'), 'Die Empfehlung darf keine nicht erhobene ausreichende Schlafdauer behaupten');

  const sixToSeven = { ...HEALTHY_ANSWERS, schlafdauer: 's6_7' };
  const sixToSevenCtx = W.Recommendations.buildContext(sixToSeven, W.Scoring.computeResults(sixToSeven));
  assert.ok(W.Recommendations.recommendationsForDimension('schlaf', sixToSevenCtx).some((r) => r.id === 'sl_dauer'));

  const overNine = { ...HEALTHY_ANSWERS, schlafdauer: 'ue9' };
  const overNineCtx = W.Recommendations.buildContext(overNine, W.Scoring.computeResults(overNine));
  assert.strictEqual(W.Scoring.questionNorm('schlafdauer', 'ue9'), 0);
  assert.ok(!W.Recommendations.recommendationsForDimension('schlaf', overNineCtx).some((r) => r.id === 'sl_dauer'));
});

test('Proteinfrage und Score bleiben ein transparenter Häufigkeitsindikator', () => {
  const nutrition = W.DIMENSIONS.find((dimension) => dimension.id === 'ernaehrung');
  const question = nutrition.questions.find((item) => item.id === 'protein');
  assert.ok(question.text.startsWith('Wie häufig gelingt es Ihnen'));
  assert.ok(question.help.includes('Sie berechnet <b>nicht</b>'));
  assert.ok(question.help.includes('1,4–1,6 g Protein pro kg Körpergewicht und Tag'));
  assert.ok(question.help.includes('2,0 g/kg/Tag'));
  assert.ok(!question.help.includes('35–40 g'), 'keine pauschale Grammvorgabe pro Mahlzeit');

  const light = { ...HEALTHY_ANSWERS, gewicht: 50, protein: 'selten' };
  const heavy = { ...HEALTHY_ANSWERS, gewicht: 100, protein: 'selten' };
  const lightResults = W.Scoring.computeResults(light);
  const heavyResults = W.Scoring.computeResults(heavy);
  assert.strictEqual(lightResults.scores.ernaehrung, heavyResults.scores.ernaehrung);
  assert.strictEqual(W.Scoring.questionNorm('protein', 'selten'), -2);
  [light, heavy].forEach((answers) => {
    const ctx = W.Recommendations.buildContext(answers, W.Scoring.computeResults(answers));
    assert.ok(W.Recommendations.recommendationsForDimension('ernaehrung', ctx)
      .some((record) => record.id === 'er_protein'));
  });
});

test('Proteinplan zeigt die Forschungswerte nur erwachsenen Krafttrainierenden', () => {
  const proteinCard = (overrides) => {
    const answers = { ...HEALTHY_ANSWERS, protein: 'selten', ...overrides };
    const ctx = W.Recommendations.buildContext(answers, W.Scoring.computeResults(answers));
    return W.Recommendations.recommendationsForDimension('ernaehrung', ctx)
      .find((record) => record.id === 'er_protein');
  };

  const trainedAdult = W.Coach.weekPlan(proteinCard({ alter: 45, krafttraining: 'tage2' }));
  assert.strictEqual(
    trainedAdult[1].text,
    W.ResultCopy.get('recommendation.plan.er_protein.weeks_2_3.strength_training')
  );
  assert.ok(trainedAdult[1].text.includes('1,6 g/kg/Tag'));
  assert.ok(trainedAdult[1].text.includes('2,0 g/kg/Tag'));
  assert.strictEqual(trainedAdult[1].sourceRef.href, 'https://pubmed.ncbi.nlm.nih.gov/28698222/');

  [
    proteinCard({ alter: 45, krafttraining: 'tage1' }),
    proteinCard({ alter: 17, krafttraining: 'tage3plus' }),
  ].forEach((card) => {
    const plan = W.Coach.weekPlan(card);
    assert.strictEqual(plan[1].text, W.ResultCopy.get('recommendation.plan.er_protein.weeks_2_3'));
    assert.strictEqual(plan[1].sourceRef, null);
    assert.ok(!plan[1].text.includes('2,0 g/kg/Tag'));
  });
});

test('Positive Proteinantwort wird als Routine und nicht als Versorgungsnachweis bezeichnet', () => {
  const answers = {
    ...HEALTHY_ANSWERS,
    verarbeitet: 'w1_2',
    zuckergetraenke: 'w1_3',
    pflanzenvielfalt: 'v18_25',
    protein: 'fast_immer',
  };
  const ctx = W.Recommendations.buildContext(answers, W.Scoring.computeResults(answers));
  const strength = W.Recommendations.keyStrengths(ctx, 5).find((item) => item.id === 'st_protein');
  assert.ok(strength, 'Proteinroutine wird als antwortbasierte Stärke erkannt');
  assert.strictEqual(strength.label, 'Proteinquellen regelmässig eingeplant');
  assert.ok(strength.detail.includes('nicht, ob Ihre persönliche Tagesmenge'));
  assert.ok(!strength.label.includes('Versorgung'));
});

test('Coach beantwortet Proteinfragen vor der allgemeinen Krafttrainingsroute', () => {
  const results = W.Scoring.computeResults(HEALTHY_ANSWERS);
  const ctx = W.Coach.botContext(results, []);
  assert.strictEqual(
    W.Coach.mockAnswer('Wie viel Protein brauche ich beim Krafttraining?', ctx),
    W.ResultCopy.get('coach.answer.protein')
  );
});

test('Kohärenz-Restprofile: Fitness, Schlaf, Bildschirmmuster und Taillenumfang bleiben widerspruchsfrei', () => {
  const mixedFitness = {
    ...HEALTHY_ANSWERS,
    ausdauer_moderat: 'm150_300', ausdauer_intensiv: 'keine', krafttraining: 'tage1',
    beweglichkeit: 'maessig', treppen: 'etwas', einkaufstaschen: 'maessig',
  };
  const mixedFitnessCtx = W.Recommendations.buildContext(mixedFitness, W.Scoring.computeResults(mixedFitness));
  const fitnessLevers = W.Recommendations.keyLevers(mixedFitnessCtx, 5);
  assert.ok(fitnessLevers.some((lever) => lever.id === 'lv_kraft'));
  assert.ok(!fitnessLevers.some((lever) => lever.id === 'lv_fitness_alltag'));

  const sixToSeven = { ...HEALTHY_ANSWERS, schlafdauer: 's6_7' };
  const sixToSevenCtx = W.Recommendations.buildContext(sixToSeven, W.Scoring.computeResults(sixToSeven));
  assert.ok(!W.Recommendations.keyStrengths(sixToSevenCtx, 5)
    .some((strength) => strength.id === 'st_schlaf' || strength.id === 'st_erholsamer_schlaf'));

  const massiveImpact = { ...HEALTHY_ANSWERS, schlaf_auswirkung: 'massiv' };
  const massiveResults = W.Scoring.computeResults(massiveImpact);
  const massiveCtx = W.Recommendations.buildContext(massiveImpact, massiveResults);
  const massivePlan = W.Recommendations.actionPlan(massiveCtx);
  assert.ok(massiveResults.signals.some((signal) => signal.id === 'schlaf'));
  assert.ok(massivePlan.some((record) => record.id === 'act_schlaf_abklaerung'));
  assert.ok(!massivePlan.some((record) => record.id === 'sl_qualitaet'));
  assert.ok(!W.Recommendations.keyStrengths(massiveCtx, 5)
    .some((strength) => strength.id === 'st_schlaf' || strength.id === 'st_erholsamer_schlaf'));

  const screenPattern = { ...HEALTHY_ANSWERS, socialmedia: 'oft', schlafrhythmus: 'unregelmaessig' };
  const screenCtx = W.Recommendations.buildContext(screenPattern, W.Scoring.computeResults(screenPattern));
  const screenPlanIds = W.Recommendations.actionPlan(screenCtx).map((record) => record.id);
  assert.ok(screenPlanIds.includes('act_bildschirm_abend'));
  assert.ok(!screenPlanIds.includes('ei_socialmedia'));
  assert.ok(!screenPlanIds.includes('sl_rhythmus'));

  const knownWaist = { ...HEALTHY_ANSWERS, bauchumfang: 90 };
  const knownWaistResults = W.Scoring.computeResults(knownWaist);
  assert.strictEqual(knownWaistResults.metrics.waistStatus, 'hoch');
  assert.deepStrictEqual(
    knownWaistResults.signals.find((signal) => signal.id === 'koerperzusammensetzung'),
    {
      id: 'koerperzusammensetzung', type: 'lebensstil', severity: 'mittel',
      label: W.ResultCopy.get('recommendation.risk_signal.koerperzusammensetzung.label'),
    },
  );
  const waistInsight = W.Recommendations.dimensionInsights(knownWaistResults, [])
    .einfluss.find((entry) => entry.id === 'koerperzusammensetzung');
  assert.ok(waistInsight);
  assert.strictEqual(waistInsight.dimension, 'einfluss');
  assert.strictEqual(
    waistInsight.insight,
    W.ResultCopy.format('recommendation.signal.koerperzusammensetzung.insight.with_waist', {
      waist: 90,
      waistStatusLabel: W.ResultCopy.get('ui.metrics.waist_status.hoch'),
    }),
  );
  assert.strictEqual(
    waistInsight.action,
    W.ResultCopy.get('recommendation.signal.koerperzusammensetzung.action.with_waist'),
  );
  assert.strictEqual(
    waistInsight.benefit,
    W.ResultCopy.get('recommendation.signal.koerperzusammensetzung.benefit'),
  );
});

test('Taillenumfang-Grenzen erzeugen klare Statusstufen und passende Signalpriorität', () => {
  const cases = [
    ['weiblich', 170, 63, 79, 'normal', null, 2],
    ['weiblich', 170, 63, 80, 'erhoeht', 'tief', 0],
    ['weiblich', 170, 63, 87, 'erhoeht', 'tief', 0],
    ['weiblich', 170, 63, 88, 'hoch', 'mittel', -2],
    ['maennlich', 170, 63, 93, 'normal', null, 2],
    ['maennlich', 170, 63, 94, 'erhoeht', 'tief', 0],
    ['maennlich', 170, 63, 101, 'erhoeht', 'tief', 0],
    ['maennlich', 170, 63, 102, 'hoch', 'mittel', -2],
    ['intersex', 200, 80, 96, 'normal', null, 0],
    ['intersex', 200, 80, 100, 'erhoeht', 'tief', 0],
    ['intersex', 200, 80, 119, 'erhoeht', 'tief', -1],
    ['intersex', 200, 80, 120, 'hoch', 'mittel', -2],
  ];

  cases.forEach(([geschlecht, groesse, gewicht, bauchumfang, status, severity, bodyNorm]) => {
    const results = W.Scoring.computeResults({
      ...HEALTHY_ANSWERS, geschlecht, groesse, gewicht, bauchumfang,
    });
    assert.strictEqual(results.metrics.waistStatus, status, `${geschlecht} ${bauchumfang} cm`);
    assert.strictEqual(results.metrics.bodyRisk.norm, bodyNorm, `${geschlecht} ${bauchumfang} cm Norm`);
    const signal = results.signals.find((item) => item.id === 'koerperzusammensetzung');
    assert.strictEqual(signal ? signal.severity : null, severity, `${geschlecht} ${bauchumfang} cm Signal`);
    if (signal) {
      const insight = W.Recommendations.dimensionInsights(results, []).einfluss
        .find((item) => item.id === 'koerperzusammensetzung');
      assert.ok(insight.insight.includes(String(bauchumfang)), 'persönlicher Wert fehlt');
      assert.ok(insight.insight.includes(W.ResultCopy.get(`ui.metrics.waist_status.${status}`)), 'Status fehlt');
    }
  });
});

test('Körperzusammensetzung unterscheidet Taillenumfang und BMI ohne falsche Behauptung', () => {
  const noWaist = { ...HEALTHY_ANSWERS, gewicht: 90 };
  delete noWaist.bauchumfang;
  const noWaistResults = W.Scoring.computeResults(noWaist);
  assert.deepStrictEqual(noWaistResults.metrics.bodyRisk, {
    source: 'bmi', norm: -2, severity: 'mittel',
  });
  const noWaistInsight = W.Recommendations.dimensionInsights(noWaistResults, []).einfluss
    .find((item) => item.id === 'koerperzusammensetzung');
  assert.ok(noWaistInsight);
  assert.strictEqual(
    noWaistInsight.insight,
    W.ResultCopy.format('recommendation.signal.koerperzusammensetzung.insight.bmi_without_waist', {
      bmi: noWaistResults.metrics.bmi,
      bmiClassLabel: W.ResultCopy.get(`ui.metrics.bmi_class.${noWaistResults.metrics.bmiClass}`),
    }),
  );
  assert.ok(!noWaistInsight.insight.includes('erhöhten Taillenumfang'));

  const normalWaistResults = W.Scoring.computeResults({ ...noWaist, bauchumfang: 70 });
  assert.strictEqual(normalWaistResults.metrics.waistStatus, 'normal');
  assert.deepStrictEqual(normalWaistResults.metrics.bodyRisk, {
    source: 'waist', norm: 2, severity: null,
  });
  assert.strictEqual(normalWaistResults.scores.einfluss, 100, 'Vorhandene Taille ist der zentrale Scorevertrag');
  const normalWaistInsight = W.Recommendations.dimensionInsights(normalWaistResults, []).einfluss
    .find((item) => item.id === 'koerperzusammensetzung');
  assert.strictEqual(normalWaistInsight, undefined, 'Normaler zentraler Körpervertrag erzeugt kein widersprüchliches BMI-Signal');

  const normalWaistRiskPattern = {
    ...HEALTHY_ANSWERS,
    gewicht: 90,
    bauchumfang: 79,
    sitzzeit: 's9_10',
    alkohol: 'w4plus',
  };
  const normalWaistRiskResults = W.Scoring.computeResults(normalWaistRiskPattern);
  const normalWaistRiskContext = W.Recommendations.buildContext(normalWaistRiskPattern, normalWaistRiskResults);
  assert.ok(!W.Recommendations.actionPlan(normalWaistRiskContext).some((record) => record.id === 'act_kardio'),
    'Hoher BMI darf bei vorhandener normaler Taille nicht heimlich ins Kardio-Muster einfliessen');

  const highWaistRiskPattern = { ...normalWaistRiskPattern, bauchumfang: 88 };
  const highWaistRiskResults = W.Scoring.computeResults(highWaistRiskPattern);
  const highWaistRiskContext = W.Recommendations.buildContext(highWaistRiskPattern, highWaistRiskResults);
  assert.ok(W.Recommendations.actionPlan(highWaistRiskContext).some((record) => record.id === 'act_kardio'),
    'Dasselbe Profil überschreitet mit hoher Taille nachvollziehbar die Kardio-Musterschwelle');

  const highWaist = {
    ...HEALTHY_ANSWERS, gewicht: 63, bauchumfang: 88, sitzzeit: 's9_10', alkohol: 'w4plus',
  };
  const highWaistResults = W.Scoring.computeResults(highWaist);
  assert.deepStrictEqual(highWaistResults.metrics.bodyRisk, {
    source: 'waist', norm: -2, severity: 'mittel',
  });
  assert.ok(highWaistResults.signals.some((signal) => signal.id === 'koerperzusammensetzung'));
  const highWaistCtx = W.Recommendations.buildContext(highWaist, highWaistResults);
  assert.ok(W.Recommendations.actionPlan(highWaistCtx).some((record) => record.id === 'act_kardio'),
    'Derselbe hohe Taillenvertrag fliesst auch ins Kardio-Muster ein');
});

test('Alle eigenständigen Dimensionshinweise besitzen Relevanz, Schritt und Nutzen', () => {
  const underweightResults = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, gewicht: 45 });
  const underweight = W.Recommendations.dimensionInsights(underweightResults, []).einfluss
    .find((item) => item.id === 'untergewicht');
  const bodyResults = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, bauchumfang: 88 });
  const body = W.Recommendations.dimensionInsights(bodyResults, []).einfluss
    .find((item) => item.id === 'koerperzusammensetzung');

  [underweight, body].forEach((item) => {
    assert.ok(item, 'eigenständiger Hinweis fehlt');
    assert.deepStrictEqual(item.relatedRecommendationIds, []);
    assert.ok(item.title && item.insight && (item.action || item.clarify) && item.benefit);
  });
});

test('Dimensionsdetails spiegeln jeden Top-Schritt in globaler Reihenfolge und ohne Duplikate', () => {
  const answers = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja' };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  const plan = W.Recommendations.actionPlan(ctx);
  const plannedInfluence = plan.filter((record) => record.dim === 'einfluss');
  const legacyDetails = W.Recommendations.recommendationsForDimension('einfluss', ctx);
  const projectedDetails = W.Recommendations.recommendationsForDimension('einfluss', ctx, plan);

  assert.ok(plannedInfluence.some((record) => record.id === 'act_kardio'), 'Spezialkarte liegt im Aktionsplan');
  assert.ok(!legacyDetails.some((record) => record.id === 'act_kardio'), 'Spezialkarte ist kein Katalogeintrag');
  assert.deepStrictEqual(
    projectedDetails.slice(0, plannedInfluence.length).map((record) => record.id),
    plannedInfluence.map((record) => record.id),
    'globale Aktionsplanreihenfolge bildet das Präfix der Dimension'
  );
  plannedInfluence.forEach((record, index) => {
    assert.strictEqual(projectedDetails[index], record, 'Titel und alle Copy-Felder stammen aus demselben Planobjekt');
  });
  assert.strictEqual(
    new Set(projectedDetails.map((record) => record.id)).size,
    projectedDetails.length,
    'jede Empfehlung erscheint im Dimensionsdetail höchstens einmal'
  );
});

test('Kohärenz: Kardio-Check bündelt Vorsorge und Blutdruck, Familienhinweis bleibt eigenständig', () => {
  const answers = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja', vorsorge: 'ja' };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  const plan = W.Recommendations.actionPlan(ctx);
  const kardio = plan.find((record) => record.id === 'act_kardio');
  assert.ok(kardio, 'Kardio-Check muss im Aktionsplan liegen');
  assert.strictEqual(
    kardio.step,
    W.ResultCopy.get('recommendation.special.act_kardio.step.already_assessed_hypertension'),
    'Breite Familienfrage wird nicht als kardiovaskuläre Anamnese ausgegeben'
  );

  const detailIds = W.Recommendations.recommendationsForDimension('einfluss', ctx, plan)
    .map((record) => record.id);
  assert.ok(detailIds.includes('act_kardio'));
  ['ei_vorsorge', 'ei_bluthochdruck'].forEach((id) => {
    assert.ok(!detailIds.includes(id), id + ' darf den gebündelten Kardio-Check nicht wiederholen');
  });
  assert.ok(detailIds.includes('ei_familie'), 'Die allgemeine Familienkarte bleibt als eigenständiger Hinweis sichtbar');
  assert.ok(!detailIds.includes('ei_familienwissen'), 'Die Familienkarte bündelt das Erheben der Details');

  const guidanceIds = W.Recommendations.dimensionInsights(results, plan).einfluss
    .map((item) => item.id);
  assert.ok(guidanceIds.includes('familie_hk'), 'Breites Familienrisiko wird nicht fälschlich durch Kardio-Check absorbiert');
  assert.ok(!guidanceIds.includes('bluthochdruck'), 'Blutdrucksignal ist im Kardio-Check abgedeckt');
});

test('Kohärenz: Familienhinweise bleiben ohne Kardio-Check sichtbar und nutzen beide neuen Varianten', () => {
  const familyOnly = { ...HEALTHY_ANSWERS, familie_hk: 'ja', vorsorge: 'nein' };
  const healthyResults = W.Scoring.computeResults(HEALTHY_ANSWERS);
  const familyOnlyResults = W.Scoring.computeResults(familyOnly);
  const familyOnlyCtx = W.Recommendations.buildContext(familyOnly, familyOnlyResults);
  const familyOnlyPlan = W.Recommendations.actionPlan(familyOnlyCtx);
  assert.deepStrictEqual(familyOnlyResults.scores, healthyResults.scores,
    'scorefreie Familien- und Vorsorgeantworten verändern keine Dimensionspunkte');
  assert.strictEqual(familyOnlyResults.overall, healthyResults.overall,
    'scorefreie Familien- und Vorsorgeantworten verändern den Gesamtscore nicht');
  assert.deepStrictEqual(
    familyOnlyResults.signals.map((signal) => signal.id).filter((id) => id === 'familie_hk' || id === 'vorsorge'),
    ['familie_hk', 'vorsorge']
  );
  const familyOnlyFields = W.Recommendations.keyLevers(familyOnlyCtx, 3);
  assert.strictEqual(familyOnlyFields[0].id, 'lv_familie',
    'die spezifische Familienabklärung steht trotz perfektem Einfluss-Score im Haupthandlungsfeld');
  assert.ok(familyOnlyFields[0].detail.includes('persönliche kardiovaskuläre Risikoeinschätzung'),
    'die konditionale kardiovaskuläre Vorsorge ist bereits im sichtbaren Haupthandlungsfeld konkret');
  assert.ok(!familyOnlyPlan.some((record) => record.id === 'act_kardio'));
  assert.strictEqual(familyOnlyPlan[0].id, 'ei_familie');
  assert.ok(!familyOnlyPlan.some((record) => record.id === 'ei_vorsorge'),
    'die Familienkarte bündelt die allgemeinere fehlende Vorsorge');
  const familyOnlyDetails = W.Recommendations.recommendationsForDimension('einfluss', familyOnlyCtx, familyOnlyPlan);
  const familyOnlyIds = familyOnlyDetails.map((record) => record.id);
  assert.ok(familyOnlyIds.includes('ei_familie'));
  assert.ok(!familyOnlyIds.includes('ei_vorsorge'), 'Spezifische Familienkarte bündelt den generischen Check-up');
  assert.ok(!familyOnlyIds.includes('ei_familienwissen'), 'Der Familienrisiko-Plan enthält das Erheben der Details bereits');
  const familyCard = familyOnlyDetails.find((record) => record.id === 'ei_familie');
  assert.ok(familyCard);
  assert.strictEqual(familyCard.plan[1].sourceRef, null,
    'Die breite Familienfrage darf keine pauschale Herzquelle erhalten');
  assert.ok(familyCard.plan[1].text.includes('Falls in Ihrer Familie früh Herz-Kreislauf-Erkrankungen'),
    'kardiovaskuläre Werte werden nur bei tatsächlich passender Familiengeschichte genannt');
  assert.ok(familyCard.plan[1].text.includes('Lp(a)'));
  assert.ok(familyCard.plan[1].text.includes('ApoB'));
  assert.ok(familyCard.plan[1].text.includes('hängt von Ihrem Risikoprofil ab'),
    'ApoB wird nicht als pauschaler Standardtest dargestellt');
  assert.ok(familyCard.plan[0].text.includes('Bei Herz-Kreislauf-Erkrankungen'),
    'Die Altersgrenzen müssen ausdrücklich auf Herz-Kreislauf-Erkrankungen begrenzt sein');
  assert.deepStrictEqual(
    W.Recommendations.dimensionInsights(familyOnlyResults, familyOnlyPlan).einfluss
      .filter((item) => item.id === 'familie_hk' || item.id === 'vorsorge'),
    [],
    'die vollständige Familienkarte unterdrückt doppelte Familien- und Vorsorgehinweise'
  );

  const familyPattern = { ...HEALTHY_ANSWERS, familie_hk: 'ja', sitzzeit: 's9_10', vorsorge: 'ja' };
  const familyPatternCtx = W.Recommendations.buildContext(familyPattern, W.Scoring.computeResults(familyPattern));
  const familyKardio = W.Recommendations.actionPlan(familyPatternCtx)
    .find((record) => record.id === 'act_kardio');
  assert.strictEqual(familyKardio, undefined, 'Breite Familienfrage plus Sitzen ist kein Kardio-Risikomodell');
  assert.ok(W.Recommendations.recommendationsForDimension('einfluss', familyPatternCtx)
    .some((record) => record.id === 'ei_familie'));

  const unknownPressure = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'weiss_nicht' };
  const unknownCtx = W.Recommendations.buildContext(unknownPressure, W.Scoring.computeResults(unknownPressure));
  const unknownPlan = W.Recommendations.actionPlan(unknownCtx);
  assert.ok(unknownPlan.some((record) => record.id === 'act_kardio'));
  assert.ok(
    W.Recommendations.recommendationsForDimension('einfluss', unknownCtx, unknownPlan)
      .some((record) => record.id === 'ei_bd_messen'),
    'Mehrere Ruhemessungen bleiben bei unbekanntem Blutdruck als eigenständiger Hinweis erhalten'
  );
});

test('Scorefreie Vorsorge ohne Familienangabe bleibt als Haupthandlungsfeld sichtbar', () => {
  const answers = { ...HEALTHY_ANSWERS, vorsorge: 'nein' };
  const baseline = W.Scoring.computeResults(HEALTHY_ANSWERS);
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  assert.deepStrictEqual(results.scores, baseline.scores);
  assert.strictEqual(results.overall, baseline.overall);
  assert.ok(results.signals.some((signal) => signal.id === 'vorsorge' && signal.type === 'medizinisch'));
  assert.strictEqual(W.Recommendations.keyLevers(ctx, 3)[0].id, 'lv_vorsorge');
  assert.deepStrictEqual(W.Recommendations.actionPlan(ctx).map((record) => record.id), ['ei_vorsorge']);
});

test('Untergewicht und auffälliges Körperprofil erhalten sichere Summary-Hinweise ohne Therapieplan', () => {
  const cases = [
    {
      label: 'Untergewicht',
      answers: { ...HEALTHY_ANSWERS, gewicht: 45 },
      signalId: 'untergewicht',
      leverId: 'lv_untergewicht',
    },
    {
      label: 'BMI-basiertes Körperprofil',
      answers: { ...HEALTHY_ANSWERS, gewicht: 100 },
      signalId: 'koerperzusammensetzung',
      leverId: 'lv_koerperprofil',
    },
    {
      label: 'Taillen-basiertes Körperprofil',
      answers: { ...HEALTHY_ANSWERS, bauchumfang: 100 },
      signalId: 'koerperzusammensetzung',
      leverId: 'lv_koerperprofil',
    },
  ];
  cases.forEach(({ label, answers, signalId, leverId }) => {
    const results = W.Scoring.computeResults(answers);
    const ctx = W.Recommendations.buildContext(answers, results);
    assert.ok(results.signals.some((signal) => signal.id === signalId), label + ': Signal fehlt');
    const lever = W.Recommendations.keyLevers(ctx, 3).find((item) => item.id === leverId);
    assert.ok(lever, label + ': Summary-Hinweis fehlt');
    assert.strictEqual(lever.summaryOnly, true, label + ': kein pauschaler 4-Wochen-Plan ableitbar');
    assert.ok(lever.label && lever.detail, label + ': laienverständliche Copy fehlt');
    assert.strictEqual(W.Recommendations.actionPlan(ctx).length, 0,
      label + ': aus Einzelmessungen wird bewusst kein Therapieplan erzeugt');
    assert.ok(W.Recommendations.dimensionInsights(results, []).einfluss.some((item) => item.id === signalId),
      label + ': ausführliche fachliche Einordnung bleibt erhalten');
  });

  const combined = { ...HEALTHY_ANSWERS, familie_hk: 'ja', vorsorge: 'nein', gewicht: 45 };
  const combinedResults = W.Scoring.computeResults(combined);
  const combinedCtx = W.Recommendations.buildContext(combined, combinedResults);
  assert.deepStrictEqual(
    W.Recommendations.keyLevers(combinedCtx, 3).map((field) => field.id),
    ['lv_familie', 'lv_untergewicht'],
    'unabhängige medizinische Summary-Hinweise bleiben bei freien Plätzen gemeinsam sichtbar'
  );
});

test('Kohärenz: Spezialaktionen entfernen nur ausdrücklich abgedeckte Detailkarten', () => {
  const massiveSleep = { ...HEALTHY_ANSWERS, schlaf_auswirkung: 'massiv' };
  const massiveCtx = W.Recommendations.buildContext(massiveSleep, W.Scoring.computeResults(massiveSleep));
  const massivePlan = W.Recommendations.actionPlan(massiveCtx);
  const massiveIds = W.Recommendations.recommendationsForDimension('schlaf', massiveCtx, massivePlan)
    .map((record) => record.id);
  assert.ok(massiveIds.includes('act_schlaf_abklaerung'));
  assert.ok(!massiveIds.includes('sl_qualitaet'), 'Abklärung bündelt die allgemeine Schlafqualitätskarte');

  const screenPattern = { ...HEALTHY_ANSWERS, socialmedia: 'oft', schlafrhythmus: 'unregelmaessig' };
  const screenCtx = W.Recommendations.buildContext(screenPattern, W.Scoring.computeResults(screenPattern));
  const screenPlan = W.Recommendations.actionPlan(screenCtx);
  const influenceIds = W.Recommendations.recommendationsForDimension('einfluss', screenCtx, screenPlan)
    .map((record) => record.id);
  const sleepIds = W.Recommendations.recommendationsForDimension('schlaf', screenCtx, screenPlan)
    .map((record) => record.id);
  assert.ok(sleepIds.includes('act_bildschirm_abend'));
  assert.ok(!influenceIds.includes('ei_socialmedia'), 'Abendaktion bündelt die überlappende Social-Media-Karte');
  assert.ok(sleepIds.includes('sl_rhythmus'), 'Eigenständiger Hinweis zu Aufstehzeit und Tageslicht bleibt erhalten');
});

test('Leerer Aktionsplan ist ein neutraler Zustand und keine automatische Erfolgsaussage', () => {
  const ctx = W.Recommendations.buildContext(HEALTHY_ANSWERS, W.Scoring.computeResults(HEALTHY_ANSWERS));
  assert.strictEqual(W.Recommendations.actionPlan(ctx).length, 0);
  const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.ok(/ui\.action_plan\.heading\./.test(appSource), 'UI nutzt den zentralen, anzahlabhängigen Heading-Key');
  assert.ok(/ui\.coach_handoff\.plan\./.test(appSource), 'Coach-Handoff nutzt einen expliziten Empty-Key');
  assert.ok(W.ResultCopy.get('ui.action_plan.heading.empty'));
  assert.ok(W.ResultCopy.get('ui.coach_handoff.plan.empty'));
  assert.ok(!/Ihre \$\{top3\.length\} nächsten Schritte/.test(appSource), 'Kein «0 nächste Schritte»-Textpfad');
  assert.ok(appSource.includes('class="dimension-feedback is-neutral"'), 'Kein grüner Empty-State allein wegen fehlender Karten');
  assert.ok(!appSource.includes('<div class="card positive">${I.spark}<div><b>${copy.get(\'ui.action_plan.empty.title\')}'));
});

test('Insights: Kardio-Muster wird dimensionsübergreifend erkannt (Beispielfall)', () => {
  const a = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja' };
  const res = W.Scoring.computeResults(a);
  const ctx = W.Recommendations.buildContext(a, res);
  const levers = W.Recommendations.keyLevers(ctx, 3);
  assert.strictEqual(levers.length, 3);
  assert.strictEqual(levers[0].dim, 'einfluss', 'Kardio-Hebel muss trotz tieferer Fitness-Scores zuoberst stehen');
  assert.strictEqual(levers[0].id, 'lv_kardio', 'Stabile Hebel-ID des kardiovaskulären Musters');
  assert.strictEqual(levers[0].label, W.ResultCopy.get('recommendation.lever.lv_kardio.label'));
  const factors = [
    'hypertension', 'smoking', 'body_composition',
  ].map((id) => W.ResultCopy.get('recommendation.special.act_kardio.risk_factor.' + id));
  const factorList = W.ResultCopy.format('recommendation.special.act_kardio.risk_factor_list.many', {
    preceding: factors.slice(0, -1).join(', '),
    last: factors[factors.length - 1],
  });
  assert.strictEqual(
    levers[0].detail,
    W.ResultCopy.format('recommendation.lever.lv_kardio.detail.with_risk_factors', { riskFactors: factorList }),
    'Dynamische Treiber stammen vollständig aus dem Content-Katalog'
  );
  assert.deepStrictEqual(
    levers.filter((lever) => lever.dim === 'einfluss').map((lever) => lever.id),
    ['lv_kardio', 'lv_rauchstopp'],
    'ein zweiter sehr hoch priorisierter Einfluss-Hebel bleibt als dokumentierte Sicherheitsausnahme sichtbar'
  );
});

test('Medizinischer Kardio-Check wird bei Bluthochdruck plus Rauchen nicht aus der Summary verdrängt', () => {
  const answers = { ...HEALTHY_ANSWERS, bluthochdruck: 'ja', rauchen: 'ja_regelmaessig' };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  const fields = W.Recommendations.keyLevers(ctx, 3);
  assert.strictEqual(fields[0].id, 'lv_kardio', 'das medizinische Mehrfaktorenmuster hat Summary-Vorrang');
  assert.ok(fields.some((field) => field.id === 'lv_rauchstopp'), 'Rauchstopp bleibt zusätzlich sichtbar');
  assert.ok(fields[0].detail.includes(W.ResultCopy.get('recommendation.special.act_kardio.risk_factor.hypertension')));
  assert.ok(fields[0].detail.includes(W.ResultCopy.get('recommendation.special.act_kardio.risk_factor.smoking')));
  const planIds = W.Recommendations.actionPlan(ctx).map((record) => record.id);
  assert.deepStrictEqual(planIds.slice(0, 2), ['act_kardio', 'ei_rauchstopp']);
});

test('Auch der Aktionsplan begrenzt hoch priorisierte Karten auf zwei je Dimension', () => {
  const answers = {
    ...HEALTHY_ANSWERS,
    alter: 70,
    bluthochdruck: 'ja',
    rauchen: 'ja_regelmaessig',
    stabilitaet: 'sehr_unsicher',
  };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  assert.deepStrictEqual(
    W.Recommendations.actionPlan(ctx).map((record) => record.id),
    ['act_kardio', 'ei_rauchstopp']
  );
});

test('Höchstens zwei hoch priorisierte Hebel derselben Dimension verdrängen keine mentale Unterstützung', () => {
  const answers = {
    ...HEALTHY_ANSWERS,
    alter: 70,
    bluthochdruck: 'ja',
    rauchen: 'ja_regelmaessig',
    stabilitaet: 'sehr_unsicher',
    belastbarkeit: 'gar_nicht',
    selbstwirksamkeit: 'gar_nicht',
    sinnhaftigkeit: 'gar_nicht',
    coping: 'gar_nicht',
    verbundenheit: 'gar_nicht',
    selbstfuersorge: 'gar_nicht',
    zukunft: 'gar_nicht',
    positive_emotionen: 'gar_nicht',
  };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  assert.ok(results.signals.some((signal) => signal.id === 'hohe_belastung'));
  assert.deepStrictEqual(
    W.Recommendations.keyLevers(ctx, 3).map((field) => field.id),
    ['lv_kardio', 'lv_rauchstopp', 'lv_mental_support']
  );
});

test('Insights: Stärken sind konkret & Fallback greift bei belastetem Profil', () => {
  const good = W.Scoring.computeResults(HEALTHY_ANSWERS);
  const goodCtx = W.Recommendations.buildContext(HEALTHY_ANSWERS, good);
  const st = W.Recommendations.keyStrengths(goodCtx, 3);
  assert.strictEqual(st.length, 3);
  assert.strictEqual(st[0].id, 'st_fitness_top', 'breit bestätigte Spitzenfitness steht an erster Stelle');
  assert.ok(st[0].detail.includes('WHO'), 'die zusammengefasste Fitnessstärke nennt das erreichte Bewegungsziel');
  assert.ok(st.some((s) => s.id === 'st_schlaf'), 'konsistenter Schlaf bleibt als Stärke sichtbar');
  assert.ok(!st.some((s) => s.id === 'st_rauchfrei'), 'ein einzelner Schutzfaktor verdrängt keine breiter belegte Stärke');
  assert.strictEqual(new Set(st.map((s) => s.dim)).size, st.length, 'max. eine Stärke pro Dimension');
  assert.deepStrictEqual(W.Recommendations.keyStrengths(goodCtx, 3), st, 'Stärkenrangfolge ist deterministisch');
  assert.strictEqual(W.Recommendations.keyLevers(goodCtx, 3).length, 0, 'Gesundes Profil → keine Hebel-Nörgelei');

  const bad = { ...DEFICIT_ANSWERS, rauchen: 'ja_regelmaessig', alkohol: 'w4plus', verbundenheit: 'gar_nicht', selbstfuersorge: 'gar_nicht', belastbarkeit: 'gar_nicht', sinnhaftigkeit: 'gar_nicht', positive_emotionen: 'gar_nicht', schlafqualitaet: 'sehr_schlecht' };
  const badRes = W.Scoring.computeResults(bad);
  const badCtx = W.Recommendations.buildContext(bad, badRes);
  const fallback = W.Recommendations.keyStrengths(badCtx, 3);
  assert.ok(fallback.length >= 1, 'Fallback: stabilste Dimension wird als Anker benannt');
});

test('Insights: Spitzenfitness verlangt WHO-Ziel, hohen Score und zwei unabhängige Top-Kurztests', () => {
  const withoutMuscleTest = { ...HEALTHY_ANSWERS };
  delete withoutMuscleTest.wandsitz;
  delete withoutMuscleTest.liegestuetze;
  const withoutMuscleResults = W.Scoring.computeResults(withoutMuscleTest);
  const withoutMuscleCtx = W.Recommendations.buildContext(withoutMuscleTest, withoutMuscleResults);
  const withoutMuscleStrengths = W.Recommendations.keyStrengths(withoutMuscleCtx, 5);
  assert.ok(!withoutMuscleStrengths.some((item) => item.id === 'st_fitness_top'));
  assert.strictEqual(withoutMuscleStrengths[0].id, 'st_bewegung', 'ohne Muskeltest bleibt die präzise WHO-Stärke');

  const muscleOnly = { ...HEALTHY_ANSWERS, geschlecht: 'maennlich', liegestuetze: 40 };
  delete muscleOnly.einbeinstand;
  const muscleOnlyResults = W.Scoring.computeResults(muscleOnly);
  const muscleOnlyCtx = W.Recommendations.buildContext(muscleOnly, muscleOnlyResults);
  assert.ok(!W.Recommendations.keyStrengths(muscleOnlyCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'zwei Muskeltests ersetzen keinen Balancetest');

  const openStrengthAction = { ...HEALTHY_ANSWERS, krafttraining: 'tage1' };
  const openStrengthResults = W.Scoring.computeResults(openStrengthAction);
  const openStrengthCtx = W.Recommendations.buildContext(openStrengthAction, openStrengthResults);
  assert.ok(!W.Recommendations.keyStrengths(openStrengthCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'offener Fitness-Handlungsbedarf verhindert die breite Topaussage');
  assert.ok(W.Recommendations.recommendationsForDimension('fitness', openStrengthCtx)
    .some((item) => item.id === 'fi_kraft'));

  const belowThresholdCtx = W.Recommendations.buildContext(HEALTHY_ANSWERS, W.Scoring.computeResults(HEALTHY_ANSWERS));
  belowThresholdCtx.scores = { ...belowThresholdCtx.scores, fitness: 89 };
  assert.ok(!W.Recommendations.keyStrengths(belowThresholdCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'Fitnessscore unter 90 reicht nicht');

  const belowGoal = { ...HEALTHY_ANSWERS, ausdauer_moderat: 'm75_150', ausdauer_intensiv: 'm30_75' };
  const belowGoalResults = W.Scoring.computeResults(belowGoal);
  const belowGoalCtx = W.Recommendations.buildContext(belowGoal, belowGoalResults);
  assert.ok(!W.Recommendations.keyStrengths(belowGoalCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'nicht erreichtes WHO-Ziel verhindert die breite Topaussage');

  const mixedTests = {
    ...HEALTHY_ANSWERS,
    geschlecht: 'maennlich',
    liegestuetze: 40,
    wandsitz: 50,
  };
  const mixedResults = W.Scoring.computeResults(mixedTests);
  const mixedCtx = W.Recommendations.buildContext(mixedTests, mixedResults);
  assert.ok(mixedResults.scores.fitness >= 90, 'Grenzfall behält einen hohen Gesamt-Fitnessscore');
  assert.strictEqual(mixedResults.fitnessTests.find((test) => test.id === 'wandsitz').norm, 0);
  assert.ok(!W.Recommendations.keyStrengths(mixedCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'ein nicht starker auswertbarer Kurztest verhindert die Topaussage');

  const unsafeStability = { ...HEALTHY_ANSWERS, stabilitaet: 'sehr_unsicher' };
  const unsafeResults = W.Scoring.computeResults(unsafeStability);
  const unsafeCtx = W.Recommendations.buildContext(unsafeStability, unsafeResults);
  assert.ok(unsafeResults.signals.some((signal) => signal.id === 'stabilitaet'));
  assert.ok(W.Recommendations.keyLevers(unsafeCtx, 3).some((field) => field.id === 'lv_sturz'));
  assert.ok(!W.Recommendations.keyStrengths(unsafeCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'offenes Stabilitätsfeld widerspricht einer breiten Top-Fitnessaussage');
});

test('Insights: nur passende Kurztest-Referenzen erzeugen eine Spitzenfitness', () => {
  const cases = [
    { ...HEALTHY_ANSWERS, alter: 17, geschlecht: 'maennlich', einbeinstand: 120, liegestuetze: 100, wandsitz: 300 },
    { ...HEALTHY_ANSWERS, alter: 45, geschlecht: 'intersex', einbeinstand: 120, liegestuetze: 100, wandsitz: 300 },
  ];
  cases.forEach((answers) => {
    const results = W.Scoring.computeResults(answers);
    const ctx = W.Recommendations.buildContext(answers, results);
    assert.ok(!W.Recommendations.keyStrengths(ctx, 5)
      .some((item) => item.id === 'st_fitness_top'), answers.alter + '/' + answers.geschlecht);
  });

  const femaleWithStandardPushup = { ...HEALTHY_ANSWERS, liegestuetze: 100 };
  delete femaleWithStandardPushup.wandsitz;
  const femaleResults = W.Scoring.computeResults(femaleWithStandardPushup);
  assert.strictEqual(
    femaleResults.fitnessTests.find((item) => item.id === 'liegestuetze').referenceStatus,
    'harmonized_orientation'
  );
  const femaleCtx = W.Recommendations.buildContext(femaleWithStandardPushup, femaleResults);
  assert.ok(W.Recommendations.keyStrengths(femaleCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'Standard-Liegestütze können die weibliche Topstärke belegen');

  const modeledMale = { ...HEALTHY_ANSWERS, alter: 72, geschlecht: 'maennlich' };
  const modeledMaleResults = W.Scoring.computeResults(modeledMale);
  assert.strictEqual(
    modeledMaleResults.fitnessTests.find((item) => item.id === 'liegestuetze').referenceStatus,
    'modeled_orientation',
  );
  const modeledMaleCtx = W.Recommendations.buildContext(modeledMale, modeledMaleResults);
  assert.ok(W.Recommendations.keyStrengths(modeledMaleCtx, 5)
    .some((item) => item.id === 'st_fitness_top'), 'ein starkes modelliertes 70+-Band kann Spitzenfitness mitbelegen');
});

test('Insights: Rauchfrei bleibt als Schutzfaktor verfügbar, aber nur als Füllkandidat', () => {
  const sparse = { alter: 45, geschlecht: 'weiblich', rauchen: 'nie' };
  const sparseResults = W.Scoring.computeResults(sparse);
  const sparseCtx = W.Recommendations.buildContext(sparse, sparseResults);
  assert.strictEqual(W.Recommendations.keyStrengths(sparseCtx, 3)[0].id, 'st_rauchfrei');

  const broadWithoutTests = { ...HEALTHY_ANSWERS };
  delete broadWithoutTests.einbeinstand;
  delete broadWithoutTests.liegestuetze;
  delete broadWithoutTests.wandsitz;
  const broadResults = W.Scoring.computeResults(broadWithoutTests);
  const broadCtx = W.Recommendations.buildContext(broadWithoutTests, broadResults);
  const broadStrengths = W.Recommendations.keyStrengths(broadCtx, 3);
  assert.strictEqual(broadStrengths[0].id, 'st_bewegung');
  assert.ok(!broadStrengths.some((item) => item.id === 'st_rauchfrei'),
    'mehrere persönliche Stärken stehen vor einem einzelnen Schutzfaktor');
});

test('Kohärenz: Aktionsplan folgt den Hebeln (Kardio-Check #1, Rauchstopp #2)', () => {
  const a = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja' }; // Raucher + Vorgeschichte
  const res = W.Scoring.computeResults(a);
  const ctx = W.Recommendations.buildContext(a, res);
  const plan = W.Recommendations.actionPlan(ctx);
  const fields = W.Recommendations.keyLevers(ctx, 3);
  assert.strictEqual(plan.length, 3);
  assert.strictEqual(plan[0].id, 'act_kardio', 'Plan #1 = konkreter Vorsorge-Check');
  assert.strictEqual(
    plan[0].step,
    W.ResultCopy.get('recommendation.special.act_kardio.step.assessment_needed_hypertension'),
    'Die passende Kardio-Variante wird über ihre stabile Text-ID aufgelöst'
  );
  assert.strictEqual(plan[1].id, 'ei_rauchstopp', 'Plan #2 = Rauchstopp (Top-Hebel derselben Dimension erlaubt)');
  assert.ok(!plan.some((r) => r.id === 'ei_bluthochdruck'), 'Keine separate Blutdruck-Karte neben dem Check');
  assert.strictEqual(fields[0].dim, plan[0].dim, 'Top-Handlungsfeld und Plan #1 zeigen dieselbe Dimension');
});

test('Kohärenz: Bluthochdruck ohne Kardio-Muster → eigene Begleit-Karte', () => {
  const a = { ...HEALTHY_ANSWERS, bluthochdruck: 'ja', familie_hk: 'nein' };
  const res = W.Scoring.computeResults(a);
  const ctx = W.Recommendations.buildContext(a, res);
  const plan = W.Recommendations.actionPlan(ctx);
  assert.ok(plan.some((r) => r.id === 'ei_bluthochdruck'), 'Begleit-Karte erscheint, wenn kein Check sie absorbiert');
  const fields = W.Recommendations.keyLevers(ctx, 3);
  assert.ok(fields.some((f) => f.id === 'lv_blutdruck'), 'Handlungsfeld-Karte zeigt denselben Hebel');
});

test('Kohärenz: «Erholsamer Schlaf» erscheint nicht neben Schlaf-Hebeln', () => {
  const a = { ...HEALTHY_ANSWERS, schlafqualitaet: 'gut', schlafdauer: 's5_6', schlaf_auswirkung: 'spuerbar' };
  const res = W.Scoring.computeResults(a);
  const ctx = W.Recommendations.buildContext(a, res);
  const st = W.Recommendations.keyStrengths(ctx, 3);
  assert.ok(!st.some((s) => s.id === 'st_erholsamer_schlaf'), 'Widerspruch Stärke ↔ Handlungsfeld aufgelöst');
});

test('Pläne: Kardio-Pflichtinhalte sind geschützt und Fachquellen strukturell verknüpft', () => {
  const a = { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja' };
  const res = W.Scoring.computeResults(a);
  const ctx = W.Recommendations.buildContext(a, res);
  const plan = W.Recommendations.actionPlan(ctx);
  const kardio = plan.find((r) => r.id === 'act_kardio');
  assert.ok(kardio && Array.isArray(kardio.plan) && kardio.plan.length === 3, 'Massgeschneiderter Plan vorhanden');
  const ids = [
    'recommendation.plan.act_kardio.this_week',
    'recommendation.plan.act_kardio.weeks_2_3',
    'recommendation.plan.act_kardio.week_4.age_40_plus',
  ];
  assert.deepStrictEqual(kardio.plan.map((s) => s.text), ids.map((id) => W.ResultCopy.get(id)));
  ids.forEach((id) => {
    const entry = contentEntry(id);
    assert.ok(Array.isArray(entry.requiredTerms) && entry.requiredTerms.length, 'Geschützte Fachelemente fehlen: ' + id);
    entry.requiredTerms.forEach((term) => assert.ok(entry.text.includes(term), 'Pflichtelement fehlt: ' + term));
  });
  const withSrc = kardio.plan.filter((s) => s.sourceRef);
  assert.ok(withSrc.length >= 2, 'Mindestens zwei Schritte tragen eine Fachquelle');
  withSrc.forEach((s) => assert.ok(/^https:\/\/swissheart\.ch\//.test(s.sourceRef.href), 'Quelle ist eine verifizierte URL'));
});

test('Pläne: Rauchstopp-Kontakt ist geschützt; Bewegungsplan kommt aus dem Katalog', () => {
  const smoker = { ...DEFICIT_ANSWERS, familie_hk: 'nein', bluthochdruck: 'nein' };
  const resS = W.Scoring.computeResults(smoker);
  const ctxS = W.Recommendations.buildContext(smoker, resS);
  const rauch = W.Recommendations.actionPlan(ctxS).find((r) => r.id === 'ei_rauchstopp');
  assert.ok(rauch, 'Rauchstopp im Plan');
  const smokeEntry = contentEntry('recommendation.plan.ei_rauchstopp.this_week');
  assert.deepStrictEqual(smokeEntry.requiredTerms, ['0848 000 181']);
  assert.strictEqual(rauch.plan[0].text, W.ResultCopy.get(smokeEntry.id));
  assert.ok(rauch.plan.some((s) => s.sourceRef && /stopsmoking\.ch/.test(s.sourceRef.href)), 'Quelle stopsmoking.ch');

  // Bewegungs-Einstieg muss eine intensive Komponente enthalten
  const move = W.Recommendations.CATALOG.find((r) => r.id === 'fi_einstieg');
  const ctxM = W.Recommendations.buildContext(DEFICIT_ANSWERS, W.Scoring.computeResults(DEFICIT_ANSWERS));
  const planM = W.Recommendations.actionPlan(ctxM).find((r) => r.id === 'fi_einstieg')
    || W.Recommendations.actionPlan(ctxM).find((r) => r.id === 'fi_ausdauer');
  assert.ok(move, 'Einstiegs-Empfehlung existiert');
  if (planM && planM.plan) {
    const planIds = ['this_week', 'weeks_2_3', 'week_4']
      .map((period) => `recommendation.plan.${planM.id}.${period}`);
    assert.deepStrictEqual(planM.plan.map((s) => s.text), planIds.map((id) => W.ResultCopy.get(id)));
  }
});

test('Dimensionshinweise ordnen jedes Signal genau einer fachlich passenden Dimension zu', () => {
  const expectedDimensions = {
    hohe_belastung: 'mental', belastung: 'mental', einsamkeit: 'mental',
    bluthochdruck: 'einfluss', blutdruck_unbekannt: 'einfluss', familie_hk: 'einfluss',
    vorsorge: 'einfluss', untergewicht: 'einfluss', rauchen: 'einfluss', alkohol: 'einfluss',
    koerperzusammensetzung: 'einfluss', sitzen: 'einfluss', stabilitaet: 'einfluss', socialmedia: 'einfluss',
    bewegungsmangel: 'fitness', keine_kraft: 'fitness', balance: 'fitness',
    schlaf: 'schlaf', ernaehrung: 'ernaehrung',
  };
  const results = {
    metrics: {},
    signals: Object.keys(expectedDimensions).map((id) => ({ id, type: 'lebensstil', severity: 'mittel' })),
  };
  const grouped = W.Recommendations.dimensionInsights(results, []);
  const dimensionIds = ['einfluss', 'fitness', 'ernaehrung', 'schlaf', 'mental'];

  assert.deepStrictEqual(Object.keys(grouped).sort(), dimensionIds.slice().sort());
  dimensionIds.forEach((dimension) => assert.ok(Array.isArray(grouped[dimension]), dimension));
  const items = dimensionIds.flatMap((dimension) => grouped[dimension]);
  assert.strictEqual(items.length, Object.keys(expectedDimensions).length);
  assert.strictEqual(new Set(items.map((item) => item.id)).size, items.length, 'jeder Hinweis erscheint höchstens einmal');
  items.forEach((item) => {
    assert.strictEqual(item.dimension, expectedDimensions[item.id], item.id);
    assert.ok(item.title, item.id + ': Titel fehlt');
    assert.ok(item.insight, item.id + ': Einordnung fehlt');
    assert.ok(item.action || item.clarify, item.id + ': nächster Schritt beziehungsweise medizinische Klärung fehlt');
  });
});

test('Dimensionshinweise unterdrücken Plan-Doppelungen und behalten eigenständige Hinweise', () => {
  const results = {
    metrics: {},
    signals: [
      'familie_hk', 'bluthochdruck', 'blutdruck_unbekannt', 'vorsorge', 'rauchen', 'bewegungsmangel',
      'untergewicht', 'koerperzusammensetzung', 'stabilitaet', 'balance', 'socialmedia',
    ].map((id) => ({ id, type: 'lebensstil', severity: 'mittel' })),
  };
  const plan = [
    { id: 'act_kardio' },
    { id: 'ei_rauchstopp' },
    { id: 'fi_einstieg' },
    { id: 'act_bildschirm_abend' },
  ];
  const grouped = W.Recommendations.dimensionInsights(results, plan);
  const items = Object.values(grouped).flat();
  const ids = items.map((item) => item.id);

  ['bluthochdruck', 'blutdruck_unbekannt', 'vorsorge', 'rauchen', 'bewegungsmangel', 'socialmedia']
    .forEach((id) => assert.ok(!ids.includes(id), id + ' ist bereits durch den Aktionsplan abgedeckt'));
  ['familie_hk', 'untergewicht', 'koerperzusammensetzung', 'stabilitaet', 'balance']
    .forEach((id) => assert.ok(ids.includes(id), id + ' muss als eigenständiger Dimensionshinweis bleiben'));
  assert.ok(grouped.einfluss.find((item) => item.id === 'untergewicht').clarify);
  assert.ok(grouped.einfluss.find((item) => item.id === 'koerperzusammensetzung').action);
  assert.ok(grouped.einfluss.some((item) => item.id === 'stabilitaet'));
  assert.ok(grouped.fitness.some((item) => item.id === 'balance'));
  assert.strictEqual(new Set(ids).size, ids.length, 'kein Hinweis wird dimensionsübergreifend doppelt ausgegeben');
});

test('Kompatibilität: signalInsights trennt breites Familienrisiko vom Kardio-Plan', () => {
  const results = {
    metrics: {},
    signals: [{ id: 'familie_hk', type: 'medizinisch', severity: 'hoch' }],
  };
  const legacy = W.Recommendations.signalInsights(results, [{ id: 'act_kardio' }]);
  assert.strictEqual(legacy.medical.length, 1);
  assert.strictEqual(legacy.lifestyle.length, 0);
  assert.strictEqual(legacy.medical[0].id, 'familie_hk');
  assert.strictEqual(legacy.medical[0].dimension, 'einfluss');
  assert.strictEqual(legacy.medical[0].planStep, null);
  assert.strictEqual(
    legacy.medical[0].deepen,
    W.ResultCopy.get('recommendation.signal.familie_hk.deepen'),
  );
  assert.strictEqual(W.Recommendations.dimensionInsights(results, [{ id: 'act_kardio' }]).einfluss.length, 1);
});

test('Fitness-Kurztests: 0, 1, 2 oder 3 ausgefüllte Werte werden vollständig und stabil ausgegeben', () => {
  const base = { ...HEALTHY_ANSWERS };
  delete base.einbeinstand;
  delete base.liegestuetze;
  delete base.wandsitz;
  assert.deepStrictEqual(W.Scoring.computeResults(base).fitnessTests, []);

  const one = W.Scoring.computeResults({ ...base, einbeinstand: 0 }).fitnessTests;
  assert.deepStrictEqual(one.map((test) => test.id), ['einbeinstand']);
  assert.strictEqual(one[0].value, 0, '0 ist ein ausgefüllter Testwert');
  assert.deepStrictEqual(
    W.Scoring.computeResults({ ...base, liegestuetze: 12, wandsitz: 30 }).fitnessTests.map((test) => test.id),
    ['liegestuetze', 'wandsitz'],
  );
  assert.deepStrictEqual(
    W.Scoring.computeResults({ ...base, einbeinstand: 12, liegestuetze: 12, wandsitz: 30 }).fitnessTests.map((test) => test.id),
    ['einbeinstand', 'liegestuetze', 'wandsitz'],
  );
});

test('Fitness-Kurztests: hohe Einbeinstand- und Wandsitz-Rohwerte bleiben sichtbar', () => {
  ['einbeinstand', 'wandsitz'].forEach((id) => {
    const answers = { ...HEALTHY_ANSWERS, alter: 45, geschlecht: 'maennlich', [id]: 1000 };
    const results = W.Scoring.computeResults(answers);
    const testResult = results.fitnessTests.find((test) => test.id === id);
    const insight = W.Recommendations.fitnessTestInsights(results, []).find((test) => test.id === id);

    assert.strictEqual(testResult.value, 1000, id + ': Die Score-Einordnung darf den eingegebenen Rohwert nicht deckeln');
    assert.strictEqual(testResult.statusKey, 'stark', id + ': Der Wert bleibt in der obersten Einordnungsstufe');
    assert.strictEqual(insight.value, 1000, id + ': Auch die Ergebnisdarstellung zeigt den Rohwert unverändert');
  });
});

test('Fitness-Kurztests: interne Schwellen werden auf vier sichtbare Statusstufen abgebildet', () => {
  const base = { ...HEALTHY_ANSWERS, alter: 52, geschlecht: 'maennlich' };
  delete base.einbeinstand;
  delete base.liegestuetze;
  delete base.wandsitz;
  const cases = [
    ['einbeinstand', [37, 24, 15, 8, 7], [2, 1, 0, -1, -2], 8],
    ['liegestuetze', [21, 13, 10, 7, 6], [2, 1, 0, -1, -2], 7],
  ];
  cases.forEach(([id, values, expectedNorms, expectedNext]) => {
    const actual = values.map((value) => W.Scoring.computeResults({ ...base, [id]: value }).fitnessTests[0]);
    assert.deepStrictEqual(actual.map((test) => test.norm), expectedNorms, id + ': fünf Normstufen');
    assert.deepStrictEqual(
      actual.map((test) => test.statusKey),
      ['stark', 'solide', 'ausbau', 'aufmerksam', 'aufmerksam'],
      id + ': fünf interne Normwerte ergeben vier sichtbare Statusstufen',
    );
    assert.strictEqual(actual[4].nextThreshold, expectedNext, id + ': nächste Schwelle nach -2');
    assert.strictEqual(actual[0].nextThreshold, null, id + ': oberstes Band hat keine nächste Schwelle');
  });

  const wallsit = [85, 60, 40, 39]
    .map((value) => W.Scoring.computeResults({ ...base, wandsitz: value }).fitnessTests[0]);
  assert.deepStrictEqual(wallsit.map((test) => test.norm), [2, 1, 0, -1]);
  assert.deepStrictEqual(wallsit.map((test) => test.statusKey), ['stark', 'solide', 'ausbau', 'aufmerksam']);
  assert.deepStrictEqual(wallsit.map((test) => test.nextThreshold), [null, 85, 60, 40]);
  wallsit.forEach((test) => {
    assert.strictEqual(test.referenceStatus, 'harmonized_orientation');
    assert.strictEqual(test.scorable, true);
  });
});

test('Fitness-Kurztests: Nullwerte folgen den dokumentierten untersten Normstufen', () => {
  const normFor = (alter, geschlecht, id) => W.Scoring.computeResults({
    alter,
    geschlecht,
    [id]: 0,
  }).fitnessTests[0].norm;

  assert.strictEqual(normFor(25, 'weiblich', 'liegestuetze'), -2,
    'Topend 25–29: 0 Standard-Liegestütze liegt im bereits implementierten −2-Band');
  assert.strictEqual(normFor(20, 'maennlich', 'liegestuetze'), -2,
    'CSEP Männer 20–29: 0 Standard-Liegestütze liegt im −2-Band');
  assert.strictEqual(normFor(24, 'weiblich', 'liegestuetze'), -1,
    'Adams 18–24 besitzt nur eine gemeinsame unterste Kategorie und kein eigenes −2-Band');
  assert.strictEqual(normFor(45, 'weiblich', 'einbeinstand'), -2,
    'Einbeinstand verwendet bei 0 Sekunden die fünfte Normstufe');
  assert.strictEqual(normFor(45, 'weiblich', 'wandsitz'), -1,
    'Wandsitz bleibt mangels vierter herleitbarer Grenze bewusst vierstufig');
});

test('Liegestütz: Standard-Protokoll besitzt stabile Frauen- und Männerbänder bis 94', () => {
  const bands = {
    maennlich: [
      [[20, 29], [36, 29, 22, 17], 'supported'],
      [[30, 39], [30, 22, 17, 12], 'supported'],
      [[40, 49], [25, 17, 13, 10], 'supported'],
      [[50, 59], [21, 13, 10, 7], 'supported'],
      [[60, 69], [18, 11, 8, 5], 'supported'],
      [[70, 79], [16, 10, 7, 4], 'modeled_orientation'],
      [[80, 89], [15, 9, 6, 4], 'modeled_orientation'],
      [[90, 94], [12, 7, 5, 3], 'modeled_orientation'],
    ],
    weiblich: [
      [[18, 24], [18, 8, 5, 0], 'harmonized_orientation'],
      [[25, 29], [33, 14, 9, 5], 'harmonized_orientation'],
      [[30, 39], [29, 13, 7, 3], 'harmonized_orientation'],
      [[40, 49], [21, 10, 5, 2], 'harmonized_orientation'],
      [[50, 59], [17, 9, 4, 2], 'harmonized_orientation'],
      [[60, 65], [13, 6, 3, 2], 'harmonized_orientation'],
      [[66, 69], [12, 6, 3, 2], 'modeled_orientation'],
      [[70, 79], [11, 5, 3, 2], 'modeled_orientation'],
      [[80, 89], [10, 5, 3, 2], 'modeled_orientation'],
      [[90, 94], [9, 4, 3, 2], 'modeled_orientation'],
    ],
  };

  Object.entries(bands).forEach(([geschlecht, ageBands]) => {
    ageBands.forEach(([ages, thresholds, expectedStatus]) => {
      ages.forEach((alter) => {
        const values = [thresholds[0], thresholds[1], thresholds[2], thresholds[3]];
        if (thresholds[3] > 0) values.push(thresholds[3] - 1);
        const tests = values
          .map((liegestuetze) => W.Scoring.computeResults({ alter, geschlecht, liegestuetze }).fitnessTests[0]);
        const expectedNorms = thresholds[3] > 0 ? [2, 1, 0, -1, -2] : [2, 1, 0, -1];
        const expectedNext = thresholds[3] > 0
          ? [null, thresholds[0], thresholds[1], thresholds[2], thresholds[3]]
          : [null, thresholds[0], thresholds[1], thresholds[2]];
        assert.deepStrictEqual(tests[0].thresholds, thresholds, `${geschlecht}, ${alter}: Altersband`);
        assert.deepStrictEqual(tests.map((item) => item.norm), expectedNorms);
        assert.deepStrictEqual(tests.map((item) => item.nextThreshold), expectedNext);
        tests.forEach((item) => {
          assert.strictEqual(item.referenceStatus, expectedStatus);
          assert.strictEqual(item.scorable, true);
        });
      });
    });
  });

  const tenAt24 = W.Scoring.computeResults({ alter: 24, geschlecht: 'weiblich', liegestuetze: 10 })
    .fitnessTests[0];
  const tenAt25 = W.Scoring.computeResults({ alter: 25, geschlecht: 'weiblich', liegestuetze: 10 })
    .fitnessTests[0];
  assert.strictEqual(tenAt24.norm, 1, '10 Standard-Liegestütze sind mit 18–24 gemäss Adams positiv');
  assert.strictEqual(tenAt24.statusKey, 'solide');
  assert.strictEqual(tenAt25.norm, 0, 'ab 25 greift transparent die praktische Topend-Reihe');
  assert.strictEqual(tenAt25.statusKey, 'ausbau');
});

test('Fitness-Kurztests: Altersgrenzen und unpassende Vergleichsgruppen bleiben konsistent', () => {
  const cases = [
    { alter: 17, geschlecht: 'weiblich', id: 'liegestuetze', expected: 'age_outside_reference' },
    { alter: 18, geschlecht: 'weiblich', id: 'liegestuetze', expected: 'harmonized_orientation' },
    { alter: 19, geschlecht: 'maennlich', id: 'liegestuetze', expected: 'age_outside_reference' },
    { alter: 20, geschlecht: 'maennlich', id: 'liegestuetze', expected: 'supported' },
    { alter: 94, geschlecht: 'weiblich', id: 'liegestuetze', expected: 'modeled_orientation' },
    { alter: 95, geschlecht: 'weiblich', id: 'liegestuetze', expected: 'age_outside_reference' },
    { alter: 94, geschlecht: 'maennlich', id: 'wandsitz', expected: 'harmonized_orientation' },
    { alter: 95, geschlecht: 'maennlich', id: 'wandsitz', expected: 'age_outside_reference' },
    { alter: 99, geschlecht: 'weiblich', id: 'einbeinstand', expected: 'supported' },
    { alter: 100, geschlecht: 'weiblich', id: 'einbeinstand', expected: 'age_outside_reference' },
    { alter: 45, geschlecht: 'intersex', id: 'liegestuetze', expected: 'reference_unavailable' },
    { alter: 45, geschlecht: 'intersex', id: 'wandsitz', expected: 'reference_unavailable' },
    { alter: 95, geschlecht: 'intersex', id: 'liegestuetze', expected: 'age_outside_reference' },
    { alter: 95, geschlecht: 'intersex', id: 'wandsitz', expected: 'age_outside_reference' },
  ];

  cases.forEach(({ alter, geschlecht, id, expected }) => {
    const answers = { alter, geschlecht, [id]: 5 };
    const result = W.Scoring.computeResults(answers);
    const testResult = result.fitnessTests.find((item) => item.id === id);
    assert.strictEqual(testResult.referenceStatus, expected, `${alter}/${geschlecht}/${id}`);
    assert.strictEqual(testResult.scorable, ['supported', 'harmonized_orientation', 'modeled_orientation'].includes(expected));
    const insight = W.Recommendations.fitnessTestInsights(result, []).find((item) => item.id === id);
    if (expected !== 'supported') assert.ok(insight.referenceNote, `${alter}/${geschlecht}/${id}: transparenter Hinweis`);
  });
});

test('Fitness-Kurztests: beide binären Referenzgruppen sind mit 94 Jahren vollständig abgedeckt', () => {
  ['weiblich', 'maennlich'].forEach((geschlecht) => {
    const results = W.Scoring.computeResults({
      alter: 94,
      geschlecht,
      einbeinstand: 10,
      liegestuetze: 10,
      wandsitz: 30,
    });
    assert.deepStrictEqual(results.fitnessTests.map((item) => item.id), ['einbeinstand', 'liegestuetze', 'wandsitz']);
    results.fitnessTests.forEach((item) => assert.strictEqual(item.scorable, true, `${geschlecht}/${item.id}`));
    assert.strictEqual(results.fitnessTests.find((item) => item.id === 'einbeinstand').referenceStatus, 'supported');
    assert.strictEqual(results.fitnessTests.find((item) => item.id === 'liegestuetze').referenceStatus, 'modeled_orientation');
    assert.strictEqual(results.fitnessTests.find((item) => item.id === 'wandsitz').referenceStatus, 'harmonized_orientation');
  });
});

test('Wandsitz: alle acht harmonisierten Altersbänder je Geschlecht besitzen stabile Grenzen', () => {
  const bands = {
    maennlich: [
      [[18, 29], [135, 95, 75]], [[30, 39], [120, 85, 65]], [[40, 49], [100, 70, 50]], [[50, 59], [85, 60, 40]],
      [[60, 69], [65, 45, 30]], [[70, 79], [50, 35, 20]], [[80, 89], [35, 25, 12]], [[90, 94], [25, 15, 5]],
    ],
    weiblich: [
      [[18, 29], [110, 80, 60]], [[30, 39], [100, 72, 55]], [[40, 49], [67, 50, 33]], [[50, 59], [61, 45, 30]],
      [[60, 69], [45, 30, 20]], [[70, 79], [35, 22, 12]], [[80, 89], [25, 15, 8]], [[90, 94], [15, 8, 3]],
    ],
  };

  Object.entries(bands).forEach(([geschlecht, ageBands]) => {
    ageBands.forEach(([ages, thresholds]) => {
      ages.forEach((alter) => {
        const tests = [thresholds[0], thresholds[1], thresholds[2], thresholds[2] - 1]
          .map((wandsitz) => W.Scoring.computeResults({ alter, geschlecht, wandsitz }).fitnessTests[0]);
        assert.deepStrictEqual(tests[0].thresholds, thresholds, `${geschlecht}, ${alter}: Altersband`);
        assert.deepStrictEqual(tests.map((item) => item.norm), [2, 1, 0, -1]);
        assert.deepStrictEqual(tests.map((item) => item.statusKey), ['stark', 'solide', 'ausbau', 'aufmerksam']);
        assert.deepStrictEqual(tests.map((item) => item.nextThreshold), [null, thresholds[0], thresholds[1], thresholds[2]]);
        tests.forEach((item) => {
          assert.strictEqual(item.referenceStatus, 'harmonized_orientation');
          assert.strictEqual(item.scorable, true);
        });
      });
    });
  });
});

test('Fitness-Kurztests: 40/40/20-Komponentenmodell bündelt beide Krafttests in der Muskulatur', () => {
  const neutral = {
    alter: 52,
    geschlecht: 'maennlich',
    ausdauer_moderat: 'm75_150',
    ausdauer_intensiv: 'm30_75',
    treppen: 'etwas',
    krafttraining: 'tage1',
    einkaufstaschen: 'maessig',
    beweglichkeit: 'maessig',
  };
  assert.strictEqual(W.Scoring.computeResults(neutral).scores.fitness, 50);
  assert.strictEqual(W.Scoring.computeResults({ ...neutral, wandsitz: 60 }).scores.fitness, 55);
  assert.strictEqual(W.Scoring.computeResults({ ...neutral, liegestuetze: 21 }).scores.fitness, 60);
  assert.strictEqual(
    W.Scoring.computeResults({ ...neutral, wandsitz: 60, liegestuetze: 21 }).scores.fitness,
    57,
    'Wandsitz und Liegestütze teilen sich die Testhälfte der Muskulatur',
  );
  assert.strictEqual(W.Scoring.computeResults({ ...neutral, einbeinstand: 37 }).scores.fitness, 55);
  assert.strictEqual(
    W.Scoring.computeResults({ ...neutral, wandsitz: 60, liegestuetze: 21, einbeinstand: 37 }).scores.fitness,
    63,
  );

  assert.strictEqual(
    W.Scoring.computeResults({ ...neutral, wandsitz: 60, liegestuetze: 6 }).scores.fitness,
    48,
    'gegenläufige Krafttests werden innerhalb der Muskulatur gemittelt',
  );
  assert.strictEqual(
    W.Scoring.computeResults({ ...neutral, wandsitz: 11, liegestuetze: 21 }).scores.fitness,
    53,
    'die Reihenfolge der Muskeltests ändert ihr gemeinsames Gewicht nicht',
  );

  const strongCondition = {
    ...neutral,
    ausdauer_moderat: 'ue300', ausdauer_intensiv: 'ue150', treppen: 'gar_nicht',
  };
  assert.strictEqual(W.Scoring.computeResults(strongCondition).scores.fitness, 70);
  assert.strictEqual(
    W.Scoring.computeResults({ ...strongCondition, wandsitz: 60 }).scores.fitness,
    75,
    'Wandsitz ergänzt die Muskulatur und wird nicht in die Kondition gemischt',
  );

  const strongMusculature = {
    ...neutral,
    krafttraining: 'tage3plus', einkaufstaschen: 'gar_nicht',
  };
  assert.strictEqual(W.Scoring.computeResults(strongMusculature).scores.fitness, 70);
  assert.strictEqual(
    W.Scoring.computeResults({ ...strongMusculature, wandsitz: 60 }).scores.fitness,
    65,
    'ein starker Wandsitz kann eine neutrale Kondition nicht aufwerten',
  );

  const fitnessTests = W.Scoring.computeResults({
    ...neutral, einbeinstand: 37, liegestuetze: 21, wandsitz: 60,
  }).fitnessTests;
  const legstand = fitnessTests.find((test) => test.id === 'einbeinstand');
  const pushup = fitnessTests.find((test) => test.id === 'liegestuetze');
  const wallsit = fitnessTests.find((test) => test.id === 'wandsitz');
  assert.strictEqual(legstand.scoreComponent, 'balance');
  assert.strictEqual(pushup.component, 'strength');
  assert.strictEqual(pushup.scoreComponent, 'musculature');
  assert.strictEqual(wallsit.component, 'strength_endurance');
  assert.strictEqual(wallsit.scoreComponent, 'musculature');
});

test('Fitness-Kurztests: Referenzqualität steuert Einordnung, Score und Empfehlungen', () => {
  const female = { ...HEALTHY_ANSWERS, liegestuetze: 0, krafttraining: 'tage3plus' };
  const femaleResults = W.Scoring.computeResults(female);
  const pushup = femaleResults.fitnessTests.find((test) => test.id === 'liegestuetze');
  assert.strictEqual(pushup.referenceStatus, 'harmonized_orientation');
  assert.strictEqual(pushup.scorable, true);
  const femaleCtx = W.Recommendations.buildContext(female, femaleResults);
  assert.ok(W.Recommendations.recommendationsForDimension('fitness', femaleCtx).some((r) => r.id === 'fi_kraft'));
  assert.ok(
    W.Recommendations.fitnessTestInsights(femaleResults, [])
      .find((item) => item.id === 'liegestuetze').referenceNote,
    'praktische Frauenorientierung bleibt im Ergebnis transparent',
  );

  const olderMale = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, alter: 72, geschlecht: 'maennlich', liegestuetze: 0 });
  const olderPushup = olderMale.fitnessTests.find((test) => test.id === 'liegestuetze');
  assert.strictEqual(olderPushup.referenceStatus, 'modeled_orientation');
  assert.strictEqual(olderPushup.scorable, true);
  assert.ok(
    W.Recommendations.fitnessTestInsights(olderMale, [])
      .find((item) => item.id === 'liegestuetze').referenceNote,
    'modellierte Altersorientierung bleibt im Ergebnis transparent',
  );
  const olderCtx = W.Recommendations.buildContext(
    { ...HEALTHY_ANSWERS, alter: 72, geschlecht: 'maennlich', liegestuetze: 0 },
    olderMale,
  );
  assert.ok(
    W.Recommendations.recommendationsForDimension('fitness', olderCtx).some((item) => item.id === 'fi_kraft'),
    'ein tiefer modellierter Wert bleibt score- und empfehlungswirksam',
  );
  assert.strictEqual(olderMale.fitnessTests.find((test) => test.id === 'wandsitz').referenceStatus, 'harmonized_orientation');

  const tooOld = W.Scoring.computeResults({ ...HEALTHY_ANSWERS, alter: 95, geschlecht: 'maennlich', liegestuetze: 20 });
  assert.strictEqual(tooOld.fitnessTests.find((test) => test.id === 'liegestuetze').referenceStatus, 'age_outside_reference');

  const unsupportedCases = [
    { alter: 17, geschlecht: 'maennlich', expectedStatus: 'age_outside_reference' },
    { alter: 45, geschlecht: 'intersex', expectedStatus: 'reference_unavailable' },
  ];
  unsupportedCases.forEach(({ alter, geschlecht, expectedStatus }) => {
    const withoutTest = W.Scoring.computeResults({
      alter, geschlecht,
      ausdauer_moderat: 'm75_150', ausdauer_intensiv: 'm30_75', treppen: 'etwas',
      krafttraining: 'tage1', einkaufstaschen: 'maessig', beweglichkeit: 'maessig',
    });
    const answers = {
      alter, geschlecht,
      ausdauer_moderat: 'm75_150', ausdauer_intensiv: 'm30_75', treppen: 'etwas',
      krafttraining: 'tage1', einkaufstaschen: 'maessig', beweglichkeit: 'maessig',
      wandsitz: 5,
    };
    const withTest = W.Scoring.computeResults(answers);
    const testResult = withTest.fitnessTests.find((item) => item.id === 'wandsitz');
    assert.strictEqual(testResult.referenceStatus, expectedStatus);
    assert.strictEqual(testResult.scorable, false);
    assert.strictEqual(withTest.scores.fitness, withoutTest.scores.fitness, 'neutraler Rohwert verändert den Fitness-Score nicht');
    const insights = W.Recommendations.fitnessTestInsights(
      withTest,
      W.Recommendations.actionPlan(W.Recommendations.buildContext(answers, withTest)),
    );
    const insight = insights.find((item) => item.id === 'wandsitz');
    assert.strictEqual(insight.ratingKey, 'unrated');
    assert.strictEqual(insight.ratingLabel, W.ResultCopy.get('ui.fitness_tests.personal_baseline'));
    assert.ok(insight.referenceNote);
    assert.strictEqual(insight.recommendationId, null);
  });
});

test('Fitness-Kurztests: 16- und 17-Jährige behalten Rohwerte ohne Score- oder Empfehlungswirkung', () => {
  [16, 17].forEach((alter) => {
    const base = {
      ...HEALTHY_ANSWERS,
      alter,
      geschlecht: 'maennlich',
      krafttraining: 'tage3plus',
      beweglichkeit: 'gar_nicht',
    };
    delete base.einbeinstand;
    delete base.liegestuetze;
    delete base.wandsitz;

    const withoutTests = W.Scoring.computeResults(base);
    const answers = { ...base, einbeinstand: 0, liegestuetze: 0, wandsitz: 0 };
    const withTests = W.Scoring.computeResults(answers);
    const byId = Object.fromEntries(withTests.fitnessTests.map((testResult) => [testResult.id, testResult]));

    ['einbeinstand', 'liegestuetze', 'wandsitz'].forEach((id) => {
      assert.strictEqual(byId[id].value, 0, alter + '/' + id + ': Rohwert bleibt erhalten');
      assert.strictEqual(byId[id].referenceStatus, 'age_outside_reference', alter + '/' + id + ': keine Jugend-Scheinnorm');
      assert.strictEqual(byId[id].scorable, false, alter + '/' + id + ': kein Score-Einfluss');
    });
    assert.strictEqual(withTests.scores.fitness, withoutTests.scores.fitness, alter + ': Fitness-Score bleibt unverändert');
    assert.ok(!withTests.signals.some((signal) => signal.id === 'balance'), alter + ': kein Balance-Signal aus ungescortem Einbeinstand');

    const context = W.Recommendations.buildContext(answers, withTests);
    const recommendationIds = W.Recommendations
      .recommendationsForDimension('fitness', context)
      .map((recommendation) => recommendation.id);
    assert.ok(!recommendationIds.includes('fi_beweglichkeit'), alter + ': keine Balance-Empfehlung aus ungescortem Einbeinstand');
    assert.ok(!recommendationIds.includes('fi_kraft'), alter + ': keine Kraftempfehlung aus ungescorteten Kurztests');
  });

  const adultAnswers = {
    ...HEALTHY_ANSWERS,
    alter: 18,
    geschlecht: 'maennlich',
    krafttraining: 'tage3plus',
    beweglichkeit: 'gar_nicht',
    einbeinstand: 0,
  };
  const adultResults = W.Scoring.computeResults(adultAnswers);
  const adultLegstand = adultResults.fitnessTests.find((testResult) => testResult.id === 'einbeinstand');
  assert.strictEqual(adultLegstand.referenceStatus, 'supported', 'Einbeinstand-Vertrag beginnt weiterhin mit 18');
  assert.strictEqual(adultLegstand.scorable, true);
  assert.ok(adultResults.signals.some((signal) => signal.id === 'balance'));
});

test('Fitness-Kurztests: tiefe valide Werte führen exakt zur fachlich passenden Empfehlung', () => {
  const base = {
    ...HEALTHY_ANSWERS,
    alter: 45,
    geschlecht: 'maennlich',
    krafttraining: 'tage3plus',
    beweglichkeit: 'gar_nicht',
    liegestuetze: 5,
    wandsitz: 5,
    einbeinstand: 45,
  };
  const strengthCtx = W.Recommendations.buildContext(base, W.Scoring.computeResults(base));
  const strengthIds = W.Recommendations.recommendationsForDimension('fitness', strengthCtx).map((r) => r.id);
  assert.strictEqual(strengthIds.filter((id) => id === 'fi_kraft').length, 1, 'zwei Krafttests ergeben nur eine Karte');
  assert.ok(!strengthIds.includes('fi_kondition'), 'ein tiefer Wandsitz erzeugt keine Konditionsempfehlung');

  const balance = { ...base, liegestuetze: 30, wandsitz: 90, einbeinstand: 5 };
  const balanceCtx = W.Recommendations.buildContext(balance, W.Scoring.computeResults(balance));
  const balanceIds = W.Recommendations.recommendationsForDimension('fitness', balanceCtx).map((r) => r.id);
  assert.ok(balanceIds.includes('fi_beweglichkeit'));
});

test('Fitness-Empfehlungen: erschwertes Tragen gehört zur Muskulatur, nicht zur Kondition', () => {
  const answers = {
    ...HEALTHY_ANSWERS,
    krafttraining: 'tage3plus',
    einkaufstaschen: 'nicht',
    treppen: 'gar_nicht',
  };
  delete answers.einbeinstand;
  delete answers.liegestuetze;
  delete answers.wandsitz;
  const ctx = W.Recommendations.buildContext(answers, W.Scoring.computeResults(answers));
  const recommendationIds = W.Recommendations.recommendationsForDimension('fitness', ctx).map((r) => r.id);
  const leverIds = W.Recommendations.keyLevers(ctx, 5).map((lever) => lever.id);
  assert.ok(recommendationIds.includes('fi_kraft'));
  assert.ok(!recommendationIds.includes('fi_kondition'));
  assert.ok(leverIds.includes('lv_kraft'));
  assert.ok(!leverIds.includes('lv_fitness_alltag'));
});

test('Fitness-Kurztests: Ergebnisdarstellung enthält alle Tests und verweist auf denselben Aktionsschritt', () => {
  const answers = {
    ...HEALTHY_ANSWERS,
    alter: 45,
    geschlecht: 'maennlich',
    krafttraining: 'tage3plus',
    liegestuetze: 5,
    wandsitz: 90,
    einbeinstand: 45,
  };
  const results = W.Scoring.computeResults(answers);
  const ctx = W.Recommendations.buildContext(answers, results);
  const plan = W.Recommendations.actionPlan(ctx);
  const insights = W.Recommendations.fitnessTestInsights(results, plan);
  assert.deepStrictEqual(insights.map((item) => item.id), ['einbeinstand', 'liegestuetze', 'wandsitz']);
  const pushup = insights.find((item) => item.id === 'liegestuetze');
  assert.strictEqual(pushup.recommendationId, 'fi_kraft');
  assert.strictEqual(pushup.planStep, plan.findIndex((record) => record.id === 'fi_kraft') + 1);
  const wallsit = insights.find((item) => item.id === 'wandsitz');
  assert.strictEqual(wallsit.ratingKey, 'solide');
  assert.strictEqual(wallsit.ratingLabel, W.ResultCopy.get('service.status_band.solide.label'));
  assert.strictEqual(
    wallsit.referenceNote,
    W.ResultCopy.get('recommendation.fitness_test.wandsitz.reference_note.harmonized_orientation'),
  );
  assert.ok(wallsit.nextReference.includes('100 Sekunden'));
});

test('Fitness-Kurztests: Woche 4 enthält Baseline, nächsten Vergleichswert und sichere Wandsitz-Ausnahme', () => {
  const pushAnswers = {
    ...HEALTHY_ANSWERS,
    alter: 45,
    geschlecht: 'maennlich',
    krafttraining: 'tage3plus',
    liegestuetze: 5,
    wandsitz: 90,
  };
  const pushCtx = W.Recommendations.buildContext(pushAnswers, W.Scoring.computeResults(pushAnswers));
  const pushCard = W.Recommendations.recommendationsForDimension('fitness', pushCtx).find((r) => r.id === 'fi_kraft');
  const pushPlan = W.Coach.weekPlan(pushCard);
  assert.strictEqual(pushPlan[0].text, W.ResultCopy.get('recommendation.plan.fi_kraft.this_week.test_result'));
  assert.strictEqual(pushPlan[2].retests.length, 1);
  assert.ok(pushPlan[2].retests[0].text.includes('Ausgangswert von 5 Wiederholungen'));
  assert.ok(pushPlan[2].retests[0].text.includes('bei 10 Wiederholungen'));

  const wallAnswers = { ...pushAnswers, liegestuetze: 30, wandsitz: 5, bluthochdruck: 'nein' };
  const wallCtx = W.Recommendations.buildContext(wallAnswers, W.Scoring.computeResults(wallAnswers));
  const wallCard = W.Recommendations.recommendationsForDimension('fitness', wallCtx).find((r) => r.id === 'fi_kraft');
  const wallRetest = W.Coach.weekPlan(wallCard)[2].retests[0];
  assert.strictEqual(wallRetest.caution, false);
  assert.ok(wallRetest.text.includes('Ausgangswert von 5 Sekunden'));
  assert.ok(wallRetest.text.includes('bei 50 Sekunden'));

  const hypertensionAnswers = { ...wallAnswers, bluthochdruck: 'ja' };
  const hypertensionCtx = W.Recommendations.buildContext(
    hypertensionAnswers,
    W.Scoring.computeResults(hypertensionAnswers),
  );
  const hypertensionCard = W.Recommendations.recommendationsForDimension('fitness', hypertensionCtx).find((r) => r.id === 'fi_kraft');
  const hypertensionRetest = W.Coach.weekPlan(hypertensionCard)[2].retests[0];
  assert.strictEqual(hypertensionRetest.caution, true);
  assert.ok(hypertensionRetest.text.includes('keinen automatischen maximalen Wandsitz-Retest'));
});

test('Architektur: Pläne sind zentral in PLANS (keine Inline-Pläne mehr in CATALOG)', () => {
  const inline = W.Recommendations.CATALOG.filter((r) => Array.isArray(r.plan) && r.plan.length);
  assert.strictEqual(inline.length, 0, 'Inline-Pläne in CATALOG: ' + inline.map((r) => r.id).join(', '));
});

test('Architektur: Ergebnis-Pläne referenzieren ausschliesslich zentral gepflegte Plantexte', () => {
  const centralPlanTexts = new Set(
    RECOMMENDATION_CONTENT.entries
      .filter((entry) => entry.id.startsWith('recommendation.plan.'))
      .map((entry) => entry.text)
  );
  const personas = [
    { ...DEFICIT_ANSWERS, familie_hk: 'ja', bluthochdruck: 'ja', rauchen: 'ja_regelmaessig' },
    { ...DEFICIT_ANSWERS, bluthochdruck: 'weiss_nicht', familienwissen: 'gar_nicht' },
    { ...DEFICIT_ANSWERS, omega3: 'nie', saettigung: 'nie', pflanzenvielfalt: 'u10' },
    { ...DEFICIT_ANSWERS, sinnhaftigkeit: 'gar_nicht', selbstfuersorge: 'gar_nicht', verbundenheit: 'gar_nicht' },
    { ...DEFICIT_ANSWERS, beweglichkeit: 'ziemlich', treppen: 'deutlich', einkaufstaschen: 'maessig' },
  ];
  const offenders = new Set();
  personas.forEach((a) => {
    const res = W.Scoring.computeResults(a);
    const ctx = W.Recommendations.buildContext(a, res);
    W.Recommendations.actionPlan(ctx).forEach((r) => {
      W.Coach.weekPlan(r).forEach((step) => {
        if (!centralPlanTexts.has(step.text)) offenders.add('PLAN:' + r.id);
      });
    });
    ['einfluss', 'fitness', 'ernaehrung', 'schlaf', 'mental'].forEach((d) => {
      W.Recommendations.recommendationsForDimension(d, ctx).forEach((r) => {
        W.Coach.weekPlan(r).forEach((step) => {
          if (!centralPlanTexts.has(step.text)) offenders.add('DETAIL:' + r.id);
        });
      });
    });
  });
  assert.strictEqual(offenders.size, 0, 'Nicht zentrale Plantexte: ' + [...offenders].join(', '));
});

test('Personalisierung: fi_kraft-Plan unterscheidet sich nach Alter', () => {
  const mk = (alter) => {
    const a = { ...DEFICIT_ANSWERS, alter, krafttraining: 'tage0' };
    const res = W.Scoring.computeResults(a);
    const ctx = W.Recommendations.buildContext(a, res);
    const card = W.Recommendations.recommendationsForDimension('fitness', ctx).find((r) => r.id === 'fi_kraft');
    return W.Coach.weekPlan(card).map((s) => s.text);
  };
  assert.notDeepStrictEqual(mk(28), mk(74), 'fi_kraft sollte alters­abhängig formulieren');
  assert.strictEqual(mk(74)[1], W.ResultCopy.get('recommendation.plan.fi_kraft.weeks_2_3.age_60_plus'));
});

test('Pläne: Jede Aktionsplan-Karte hat einen eigenen, konkreten 4-Wochen-Plan', () => {
  const base = { ...DEFICIT_ANSWERS, rauchen: 'nie', alkohol: 'nie_selten' };
  const personas = [
    { ...base, alkohol: 'w4plus' },
    { ...base, socialmedia: 'sehr_oft', schlafrhythmus: 'unregelmaessig', schlafqualitaet: 'schlecht' },
    { ...base, familienwissen: 'gar_nicht', bluthochdruck: 'weiss_nicht', familie_hk: 'ja' },
    { ...base, schlafdauer: 'u5', schlaf_auswirkung: 'massiv', schlafqualitaet: 'sehr_schlecht' },
    { ...base, selbstfuersorge: 'gar_nicht', belastbarkeit: 'gar_nicht', coping: 'eher_nicht', verbundenheit: 'eher_nicht' },
    { ...base, sitzzeit: 'ue10', stabilitaet: 'sehr_unsicher', alter: 72 },
    HEALTHY_ANSWERS,
  ];
  const offenders = new Set();
  personas.forEach((a) => {
    const res = W.Scoring.computeResults(a);
    const ctx = W.Recommendations.buildContext(a, res);
    W.Recommendations.actionPlan(ctx).forEach((r) => {
      if (!(Array.isArray(r.plan) && r.plan.length)) offenders.add(r.id);
    });
  });
  assert.strictEqual(offenders.size, 0, 'Karten ohne eigenen Plan: ' + [...offenders].join(', '));
});

/* ---------------- Runner (sequenziell) ---------------- */

(async function run() {
  console.log('Integrationsschicht & Regression\n');
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log('  ✓ ' + t.name);
    } catch (err) {
      failed++;
      console.error('  ✗ ' + t.name + '\n    → ' + err.message);
    }
  }
  console.log(`\n${passed}/${tests.length} Tests bestanden.`);
  process.exit(failed ? 1 : 0);
})();
