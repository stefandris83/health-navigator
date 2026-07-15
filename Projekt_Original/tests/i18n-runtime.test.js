#!/usr/bin/env node
'use strict';

/*
 * Verifiziert den wichtigsten Mehrsprachigkeitsvertrag: Die Locale verändert
 * ausschliesslich sichtbare Texte, niemals Frage-IDs, Antwortwerte, Scoring,
 * Risikosignale oder die Priorisierung der Empfehlungen.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LOCALES = ['de-CH', 'en-CH', 'fr-CH', 'it-CH'];
const MODULES = [
  'js/locale.js',
  'js/config.js',
  'js/url-safety.js',
  'js/result-copy.generated.js',
  'js/result-copy.js',
  'js/questions.js',
  'js/helsana.js',
  'js/scoring.js',
  'js/recommendations.js',
];

const ANSWERS = {
  alter: 52, geschlecht: 'maennlich', groesse: 178, gewicht: 96, bauchumfang: 105,
  stabilitaet: 'unsicher', sitzzeit: 'ue10', familienwissen: 'wenig', vorsorge: 'nein',
  rauchen: 'ja_regelmaessig', alkohol: 'w4plus', socialmedia: 'oft',
  familie_hk: 'ja', bluthochdruck: 'ja',
  ausdauer_moderat: 'u30', ausdauer_intensiv: 'keine', krafttraining: 'tage0',
  beweglichkeit: 'ziemlich', treppen: 'deutlich', einkaufstaschen: 'maessig',
  einbeinstand: 12, liegestuetze: 5, wandsitz: 25,
  protein: 'selten', pflanzenvielfalt: 'u10', saettigung: 'selten',
  verarbeitet: 'mehrmals_taeglich', omega3: 'nie', zuckergetraenke: 'taeglich',
  schlafqualitaet: 'schlecht', schlafdauer: 's5_6',
  schlafrhythmus: 'unregelmaessig', schlaf_auswirkung: 'deutlich',
  belastbarkeit: 'eher_nicht', selbstwirksamkeit: 'teils', sinnhaftigkeit: 'teils',
  coping: 'teils', verbundenheit: 'teils', selbstfuersorge: 'eher_nicht',
  zukunft: 'teils', positive_emotionen: 'teils',
};

function runModule(context, relativePath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), context, {
    filename: relativePath,
  });
}

function loadLocale(locale) {
  const storage = new Map();
  const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  context.window = context;
  context.location = {
    href: 'file:///tmp/health-navigator/index.html?lang=' + encodeURIComponent(locale),
    search: '?lang=' + encodeURIComponent(locale),
  };
  context.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  MODULES.forEach((module) => runModule(context, module));
  return context;
}

function technicalQuestionContract(runtime) {
  return JSON.parse(JSON.stringify(runtime.DIMENSIONS.map((dimension) => ({
    id: dimension.id,
    scored: dimension.scored !== false,
    questions: dimension.questions.map((question) => ({
      id: question.id,
      type: question.type,
      min: question.min == null ? null : question.min,
      max: question.max == null ? null : question.max,
      optional: question.optional === true,
      dontKnow: question.dontKnow === true,
      options: (question.options || []).map((option) => ({
        value: option.value,
        exclusive: option.exclusive === true,
      })),
    })),
  }))));
}

function scoringContract(runtime) {
  const results = runtime.Scoring.computeResults(ANSWERS);
  const context = runtime.Recommendations.buildContext(ANSWERS, results);
  return JSON.parse(JSON.stringify({
    overall: results.overall,
    scores: results.scores,
    metrics: results.metrics,
    signals: results.signals.map((signal) => ({
      id: signal.id,
      type: signal.type,
      severity: signal.severity,
    })),
    actionPlanIds: runtime.Recommendations.actionPlan(context).map((item) => item.id),
    dimensionRecommendationIds: runtime.DIMENSION_ORDER.reduce((all, dimensionId) => {
      all[dimensionId] = runtime.Recommendations
        .recommendationsForDimension(dimensionId, context)
        .map((item) => item.id);
      return all;
    }, {}),
  }));
}

const runtimes = new Map(LOCALES.map((locale) => [locale, loadLocale(locale)]));
const german = runtimes.get('de-CH');
const registry = german.__RESULT_COPY_BUNDLES__;

assert.ok(registry, 'Multi-Locale-Registry fehlt');
assert.deepStrictEqual(Array.from(registry.supportedLocales), LOCALES);

const germanIds = Object.keys(registry.bundles['de-CH'].texts).sort();
assert.ok(germanIds.length >= 1000, 'vollständiger Textkatalog erwartet');

const germanQuestions = technicalQuestionContract(german);
const germanScoring = scoringContract(german);
const localizedQuestionTexts = new Set();
const expectedBmiByLocale = {
  'de-CH': '31.5',
  'en-CH': '31.5',
  'fr-CH': '31,5',
  'it-CH': '31,5',
};

LOCALES.forEach((locale) => {
  const runtime = runtimes.get(locale);
  assert.strictEqual(runtime.HealthLocale.current, locale, locale + ': Locale-Auswahl');
  assert.strictEqual(runtime.ResultCopy.locale, locale, locale + ': aktives Textbundle');
  assert.deepStrictEqual(
    Object.keys(registry.bundles[locale].texts).sort(),
    germanIds,
    locale + ': ID-Parität'
  );
  assert.deepStrictEqual(
    technicalQuestionContract(runtime),
    germanQuestions,
    locale + ': technischer Fragenvertrag darf sich nicht ändern'
  );
  assert.deepStrictEqual(
    scoringContract(runtime),
    germanScoring,
    locale + ': Scoring und Empfehlungen dürfen sich nicht ändern'
  );
  localizedQuestionTexts.add(runtime.ResultCopy.get('questionnaire.question.alter.text'));

  assert.strictEqual(
    runtime.HealthLocale.formatDecimal(31.5),
    expectedBmiByLocale[locale],
    locale + ': BMI-Dezimaltrennzeichen'
  );
  const bmiSignal = runtime.Recommendations.signalInsights({
    metrics: { bmi: 31.5, bmiClass: 'adipositas1', waist: null, waistStatus: null },
    signals: [{ id: 'koerperzusammensetzung', type: 'medizinisch', severity: 'mittel' }],
  }, []).medical[0];
  assert.ok(bmiSignal, locale + ': BMI-Signal erwartet');
  assert.ok(
    bmiSignal.insight.includes(expectedBmiByLocale[locale]),
    locale + ': personalisierter BMI-Hinweis muss locale-gerecht formatiert sein'
  );
});

assert.strictEqual(
  localizedQuestionTexts.size,
  LOCALES.length,
  'Ein repräsentativer Fragetext muss in jeder Sprache wirklich lokalisiert sein'
);

console.log('✓ Vier vollständige Locale-Bundles mit identischen technischen IDs');
console.log('✓ Fragenvertrag, Scoring, Signale und Empfehlungen sind sprachinvariant');
console.log('✓ Repräsentative Texte sind in DE, EN, FR und IT unterschiedlich');
console.log('✓ BMI verwendet in DE/EN einen Punkt und in FR/IT ein Komma');
console.log('\n4/4 Tests bestanden.');
