#!/usr/bin/env node
'use strict';

/* Gezielte, dependency-freie Verträge für UI-Härtung und Lifecycle. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function runScript(windowObject, relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  new Function('window', source)(windowObject);
}

function makeQuestions() {
  const windowObject = {};
  runScript(windowObject, 'js/result-copy.generated.js');
  runScript(windowObject, 'js/result-copy.js');
  runScript(windowObject, 'js/questions.js');
  return windowObject;
}

test('Optionale Zahlenfelder sind leer erlaubt, aber nicht mit ungültigem Inhalt', () => {
  const windowObject = makeQuestions();
  const question = windowObject.DIMENSIONS
    .flatMap((dimension) => dimension.questions)
    .find((candidate) => candidate.id === 'bauchumfang');
  const dimension = { questions: [question] };
  const schema = windowObject.HealthAnswerSchema;

  assert.strictEqual(schema.isDimensionComplete(dimension, {}), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { bauchumfang: '' }), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { bauchumfang: 92 }), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { bauchumfang: 999 }), false);
  assert.strictEqual(schema.isDimensionComplete(dimension, { bauchumfang: 'kein Wert' }), false);
});

test('URL-Allowlist akzeptiert nur absolute HTTPS-Ziele ohne Zugangsdaten', () => {
  const windowObject = {};
  runScript(windowObject, 'js/url-safety.js');
  const safety = windowObject.HealthUrlSafety;
  assert.strictEqual(safety.safeHttps('https://example.test/path'), 'https://example.test/path');
  ['#', '', 'http://example.test', 'javascript:alert(1)', 'data:text/html,x',
    'file:///tmp/test', '//example.test', 'https://user:secret@example.test']
    .forEach((value) => assert.strictEqual(safety.safeHttps(value), null, value));
});

test('App rendert Placeholder nicht als Links oder Inline-Handler', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.ok(!/onclick\s*=/.test(source));
  assert.ok(source.includes('class="action-link is-placeholder" role="link" aria-disabled="true"'));
  assert.ok(source.includes('class="plan-source is-placeholder" role="link" aria-disabled="true"'));
  assert.ok(source.includes('class="is-placeholder" role="link" aria-disabled="true"'));
  assert.ok(source.includes('const href = safeHttps(o.href)'));
});

test('Kundenkontext aktualisiert nur markierte Fragmente', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.ok(source.includes('data-customer-context-chip'));
  assert.ok(source.includes('data-coverage-offer'));
  assert.ok(source.includes("if (state.screen === 'results') refreshCustomerContextPresentation();"));
  assert.ok(source.includes('integ.INTEGRATION_CONFIG.coverageHintsEnabled'));
  assert.ok(!/helsana:customer-context[\s\S]{0,180}state\.screen === 'results'\) render\(\)/.test(source));
});

test('View-Cleanup umfasst Atemübung, Chat, Score-RAF und Radar', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  ['breathingCtl.stop()', 'chatCtl.stop()', 'scoreAnimationCtl.stop()', 'window.Radar.destroy()']
    .forEach((contract) => assert.ok(source.includes(contract), contract));
  assert.ok(source.includes('timers.forEach((timer) => clearTimeout(timer))'));
  assert.ok(source.includes('frames.forEach((id) => cancelAnimationFrame(id))'));
  assert.ok(source.includes('cleanupInteractive();'));
});

test('Bootstrap- und Renderfehler zeigen einen katalogunabhängigen Reload-Zustand statt einer leeren App', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  let reloadHandler = null;
  let reloadCount = 0;
  let headingFocused = false;
  const diagnostic = [];
  const reloadButton = {
    addEventListener(type, handler) { if (type === 'click') reloadHandler = handler; },
  };
  const heading = {
    setAttribute() {},
    focus() { headingFocused = true; },
  };
  const root = {
    dataset: {},
    innerHTML: '',
    querySelector(selector) {
      if (selector === '[data-action="reload"]') return reloadButton;
      if (selector === 'h1') return heading;
      return null;
    },
  };
  const documentObject = {
    body: { dataset: {} },
    getElementById(id) { return id === 'app' ? root : null; },
  };
  const windowObject = {
    HealthNavigatorConfig: {},
    HealthPersistence: {},
    ResultCopy: {
      get() { throw new Error('simuliertes veraltetes Textbundle'); },
      format() { throw new Error('simuliertes veraltetes Textbundle'); },
    },
  };
  const locationObject = { reload() { reloadCount++; } };
  const consoleObject = { error(message) { diagnostic.push(message); } };

  assert.doesNotThrow(() => {
    new Function('window', 'document', 'location', 'console', source)(
      windowObject,
      documentObject,
      locationObject,
      consoleObject
    );
  });
  assert.strictEqual(root.dataset.renderError, 'true');
  assert.strictEqual(documentObject.body.dataset.screen, 'error');
  assert.ok(root.innerHTML.includes('Bitte laden Sie die Seite neu'));
  assert.strictEqual(headingFocused, true);
  assert.strictEqual(typeof reloadHandler, 'function');
  reloadHandler();
  assert.strictEqual(reloadCount, 1);
  assert.strictEqual(diagnostic.length, 1);
  assert.ok(diagnostic[0].includes('HN_RENDER_FAILED'));
  assert.ok(!diagnostic[0].includes('stack'));
});

test('Ergebnislinks bleiben produktiv HTTPS-beschränkt und erlauben file nur im Standalone-Mock', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.ok(source.includes('const current = new URL(location.href);'));
  assert.ok(source.includes("current.search = '';"));
  assert.ok(source.includes("current.hash = '';"));
  assert.ok(source.includes("current.protocol === 'file:' && config.integrationMode === 'mock'"));
  assert.ok(source.includes('return safeHttps(current.href);'));
  assert.ok(source.includes('config.resultLinkEnabled && resultLinkBaseUrl()'));
  assert.ok(source.includes("copy.get('ui.share_modal.local_file_warning')"));
  assert.ok(source.includes('if (!decoded || !answersComplete(ans))'));
  assert.ok(source.includes('clearShareHash();'));
});

test('Formfelder und dynamische Statusbereiche besitzen belastbare ARIA-Verträge', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.ok(source.includes('aria-required="${!q.optional}" aria-invalid="${invalid}"'));
  assert.ok(source.includes('role="log" aria-live="polite" aria-relevant="additions"'));
  assert.ok(source.includes('role="status" aria-live="polite" aria-atomic="true"'));
});

test('Neu beginnen auf der Startseite verwendet das App-Modal statt eines nativen Browserdialogs', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const restartCase = source.match(/case 'restart':([\s\S]*?)case 'opt':/);

  assert.ok(restartCase, 'Restart-Eventhandler fehlt');
  assert.ok(!/\bconfirm\s*\(/.test(source), 'Native confirm()-Abfrage ist noch vorhanden');
  assert.ok(restartCase[1].includes('showModal({'));
  assert.ok(restartCase[1].includes("copy.get('ui.result_action.restart_modal.title')"));
  assert.ok(restartCase[1].includes("copy.get('ui.result_action.restart_confirm')"));
  assert.ok(restartCase[1].includes("copy.get('ui.result_action.restart_modal.continue')"));
  assert.ok(restartCase[1].includes("copy.get('ui.result_action.home_modal.restart')"));
  assert.ok(restartCase[1].includes("if (choice === 'cancel') { reset(); go('start'); }"));
});

test('Dimensionsdetails zeigen eigenständige Hinweise vollständig, statusgerecht und ohne Doppelunterkasten', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

  assert.ok(source.includes('const planStepById = new Map(top3.map'));
  assert.ok(source.includes('dimensionInsights(results, top3)'));
  assert.ok(source.includes('recommendationsForDimension(dim.id, ctx, top3)'));
  assert.ok(source.includes("copy.format('ui.recommendation.action_plan_badge', { planStep })"));
  assert.ok(source.includes('class="rec dimension-guidance-card"'));
  assert.ok(!source.includes('class="rec dimension-guidance-card is-${severity}"'));
  assert.ok(source.includes("copy.get('ui.recommendation.label.why')"));
  assert.ok(source.includes("copy.get('ui.recommendation.label.step')"));
  assert.ok(source.includes("copy.get('ui.recommendation.label.benefit')"));
  assert.ok(!source.includes('dimension-guidance-addon'));
  assert.ok(!source.includes('guidanceItems'));
  assert.ok(!source.includes('ui.signal.label.quick_win'));
  assert.ok(!source.includes('ui.signal.label.clarify'));
  assert.ok(source.includes('hasOpenDimensionSignal(dim.id, ctx)'));
  assert.ok(source.includes("'ui.dimension.classification.open_signal'"));
  assert.ok(source.includes("'ui.dimension.empty.open_signal'"));
  assert.ok(source.includes('dimensionFeedbackTone(sc)'));
  assert.ok(source.includes('window.Recommendations.SOLIDS[dim.id]'));
  assert.ok(source.includes('window.Recommendations.POSITIVES[dim.id]'));
  assert.ok(source.includes('class="dimension-feedback is-${feedbackTone}"'));
  assert.ok(source.includes("feedbackTone === 'positive' ? I.spark : I.info"));
  assert.ok(source.includes('class="dimension-feedback is-neutral"'));
  assert.ok(!source.includes(`<div class="positive">\${I.info}`));
  assert.ok(!/ui\.classification\./.test(source));
  assert.ok(!source.includes('ui.signal.in_plan_reference'));
  assert.ok(!source.includes('ui.signal.empty.medical'));
  assert.ok(!source.includes('ui.signal.empty.lifestyle'));
  assert.ok(css.includes('.rec.is-action-plan-step'));
  assert.ok(css.includes('.rec-plan-badge'));
  assert.ok(!css.includes('.dimension-guidance-card.is-hoch'));
  assert.ok(!css.includes('.dimension-guidance-card.is-mittel'));
  assert.ok(!css.includes('.dimension-guidance-card.is-tief'));
  assert.ok(css.includes('.metrics-summary'));
  assert.ok(!css.includes('.dimension-guidance.is-quick-win'));
  assert.ok(!css.includes('.dimension-guidance-addon'));
  assert.ok(css.includes('.dimension-feedback.is-neutral'));
  assert.ok(css.includes('.dimension-feedback.is-solid'));
  assert.ok(css.includes('background: var(--info-bg)'));
  assert.ok(!css.includes('.insight-ref'));
  assert.ok(!css.includes('.signal-box.empty'));
});

test('Fitness-Kurztests erscheinen nur in der Fitness-Dimension und verlinken Empfehlung sowie Woche-4-Retest', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const coach = fs.readFileSync(path.join(ROOT, 'js/coach.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

  assert.ok(app.includes('if (!Array.isArray(items) || !items.length) return')); // kein leerer Block
  assert.ok(app.includes('window.Recommendations.fitnessTestInsights(results, top3)'));
  assert.ok(app.includes("dim.id === 'fitness' ? fitnessTestsHTML(fitnessTestInsights) : ''"));
  assert.ok(app.includes('id="recommendation-${escAttr(r.id)}"'));
  assert.ok(app.includes('href="#recommendation-${escAttr(item.recommendationId)}"'));
  assert.ok(app.includes('<strong>${item.ratingLabel}</strong><b>${escHtml(item.value)} ${item.unit}</b>'));
  assert.ok(!app.includes('fitness-test-rating'));
  assert.ok(app.includes('class="plan-retests"'));
  assert.ok(coach.includes('retests: Array.isArray(p.retests)'));
  assert.ok(css.includes('.fitness-test-grid'));
  assert.ok(css.includes('.fitness-test-card {'));
  assert.ok(css.includes('border-left: 4px solid var(--border-strong)'));
  ['stark', 'solide', 'ausbau', 'aufmerksam'].forEach((status) => {
    assert.ok(css.includes(`.fitness-test-card.is-${status}`));
  });
  assert.ok(!css.includes('.fitness-test-rating'));
  assert.ok(css.includes('.fitness-test-recommendation:focus-visible'));
  assert.ok(css.includes('.plan-retests'));
});

let passed = 0;
tests.forEach(({ name, fn }) => {
  try {
    fn();
    passed++;
    console.log('✓ ' + name);
  } catch (error) {
    console.error('✗ ' + name);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
});

console.log(`\n${passed}/${tests.length} Tests bestanden.`);
