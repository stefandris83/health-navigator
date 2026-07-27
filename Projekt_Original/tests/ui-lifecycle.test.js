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

test('Wandsitz akzeptiert optionale Werte von 0 bis 1’000 Sekunden', () => {
  const windowObject = makeQuestions();
  const question = windowObject.DIMENSIONS
    .flatMap((dimension) => dimension.questions)
    .find((candidate) => candidate.id === 'wandsitz');
  const dimension = { questions: [question] };
  const schema = windowObject.HealthAnswerSchema;

  assert.strictEqual(question.max, 1000);
  assert.strictEqual(schema.isDimensionComplete(dimension, { wandsitz: 0 }), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { wandsitz: 1000 }), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { wandsitz: 1001 }), false);
});

test('Einbeinstand akzeptiert optionale Werte von 0 bis 1’000 Sekunden', () => {
  const windowObject = makeQuestions();
  const question = windowObject.DIMENSIONS
    .flatMap((dimension) => dimension.questions)
    .find((candidate) => candidate.id === 'einbeinstand');
  const dimension = { questions: [question] };
  const schema = windowObject.HealthAnswerSchema;

  assert.strictEqual(question.max, 1000);
  assert.strictEqual(schema.isDimensionComplete(dimension, { einbeinstand: 0 }), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { einbeinstand: 1000 }), true);
  assert.strictEqual(schema.isDimensionComplete(dimension, { einbeinstand: 1001 }), false);
});

test('Messhilfen besitzen lokale Geschlechtsvarianten und zeigen standardmässig die weibliche Illustration', () => {
  const windowObject = makeQuestions();
  const questions = Object.fromEntries(windowObject.DIMENSIONS
    .flatMap((dimension) => dimension.questions)
    .filter((question) => question.illustrations)
    .map((question) => [question.id, question]));
  const expectedSlugs = {
    bauchumfang: 'taillenumfang',
    einbeinstand: 'einbeinstand',
    liegestuetze: 'liegestuetze',
    wandsitz: 'wandsitz',
  };

  assert.deepStrictEqual(Object.keys(questions).sort(), Object.keys(expectedSlugs).sort());
  Object.entries(expectedSlugs).forEach(([id, slug]) => {
    assert.deepStrictEqual(questions[id].illustrations, {
      weiblich: `assets/illustrations/${slug}-weiblich.png`,
      maennlich: `assets/illustrations/${slug}-maennlich.png`,
    });
  });

  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const variantSource = source.match(/function questionIllustrationVariant\(gender\) \{[\s\S]*?\n  \}/);
  assert.ok(variantSource, 'Geschlechtszuordnung der Illustrationen fehlt');
  const variant = new Function(`${variantSource[0]}; return questionIllustrationVariant;`)();
  assert.strictEqual(variant('maennlich'), 'maennlich');
  assert.strictEqual(variant('weiblich'), 'weiblich');
  assert.strictEqual(variant('intersex'), 'weiblich');
  assert.strictEqual(variant(undefined), 'weiblich');

  const refreshSource = source.match(/function refreshQuestionIllustrations\(\) \{[\s\S]*?\n  \}/);
  assert.ok(refreshSource, 'Dynamische Aktualisierung der Illustrationen fehlt');
  const state = { answers: {} };
  const image = {
    dataset: { srcWeiblich: 'frau.png', srcMaennlich: 'mann.png' },
    src: '',
    closest() { return wrapper; },
  };
  const wrapper = { hidden: false };
  const refresh = new Function(
    'state',
    'app',
    `${variantSource[0]}; ${refreshSource[0]}; return refreshQuestionIllustrations;`
  )(state, { querySelectorAll: () => [image] });
  refresh();
  assert.strictEqual(image.src, 'frau.png');
  assert.strictEqual(wrapper.hidden, false);
  state.answers.geschlecht = 'maennlich';
  refresh();
  assert.strictEqual(image.src, 'mann.png');
  assert.strictEqual(wrapper.hidden, false);
  state.answers.geschlecht = 'weiblich';
  refresh();
  assert.strictEqual(image.src, 'frau.png');
  state.answers.geschlecht = 'intersex';
  refresh();
  assert.strictEqual(image.src, 'frau.png');

  assert.ok(source.includes('if (id === \'geschlecht\') refreshQuestionIllustrations();'));
  assert.ok(source.includes('loading="lazy" decoding="async"'));
  assert.ok(source.includes('alt="" aria-hidden="true"'));
  assert.ok(source.includes("if (wrapper) wrapper.hidden = false;"));
  assert.ok(source.includes('<div class="q-help">${String(q.help).replace(/\\n/g, \'<br>\')}</div>'));
  assert.ok(source.includes('${body}\n      ${questionIllustrationHTML(q)}'));
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
  assert.ok(source.includes('const current = cleanResultLinkBase(new URL(location.href));'));
  assert.ok(source.includes("parsed.search = '';"));
  assert.ok(source.includes("parsed.hash = '';"));
  assert.ok(source.includes("parsed.searchParams.set('lang', locale)"));
  assert.ok(source.includes("typeof localeApi.normalize !== 'function'"));
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
  assert.ok(source.includes('const noteId = q.note ? `q-note-${q.id}` : \'\';'));
  assert.ok(source.includes("const describedBy = [noteId, invalid ? errorId : ''].filter(Boolean).join(' ');"));
  assert.ok(source.includes('describedBy ? ` aria-describedby="${escAttr(describedBy)}"` : \'\''));
  assert.ok(source.includes("if (describedBy) t.setAttribute('aria-describedby', describedBy);"));
  assert.ok(source.includes("else t.removeAttribute('aria-describedby');"));
  assert.ok(source.includes('role="group" aria-label="${escAttr(copy.get(\'ui.quiz.progress_aria\'))}"'));
  assert.ok(source.includes('<h1>${dim.title}</h1>'));
  assert.ok(source.includes('role="log" aria-live="polite" aria-relevant="additions"'));
  assert.ok(source.includes('role="status" aria-live="polite" aria-atomic="true"'));
});

test('Eigene Radio-Gruppen verwenden Roving-Tabindex und die vollständige Pfeiltastensteuerung', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

  assert.ok(source.includes('const rovingTabindex = q.type === \'multi\' ? \'\' :'));
  assert.ok(source.includes('opts.findIndex((option) => state.answers[q.id] === option.value)'));
  assert.ok(source.includes('optionButton(q, o, index, selectedIndex)'));
  assert.ok(source.includes("event.target.closest('.option[role=\"radio\"][data-action=\"opt\"]')"));
  ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].forEach((key) => {
    assert.ok(source.includes(`event.key === '${key}'`), key);
  });
  assert.ok(source.includes('nextRadio.focus();'));
  assert.ok(source.includes("if (nextRadio.getAttribute('aria-checked') !== 'true') handleOption(nextRadio);"));
  assert.ok(source.includes("if (type === 'single') opt.tabIndex = pressed ? 0 : -1;"));
});

test('Modals isolieren den Hintergrund und stellen ARIA-, Inert- und Fokuszustand wieder her', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

  assert.ok(source.includes('function isolateModal(backdrop)'));
  assert.ok(source.includes("hadInert: element.hasAttribute('inert')"));
  assert.ok(source.includes("ariaHidden: element.getAttribute('aria-hidden')"));
  assert.ok(source.includes("element.setAttribute('inert', '')"));
  assert.ok(source.includes("element.setAttribute('aria-hidden', 'true')"));
  assert.ok(source.includes("document.addEventListener('focusin', guardFocus, true)"));
  assert.ok(source.includes("document.removeEventListener('focusin', guardFocus, true)"));
  assert.ok(source.includes("if (!hadInert) element.removeAttribute('inert')"));
  assert.ok(source.includes("if (ariaHidden == null) element.removeAttribute('aria-hidden')"));
  assert.strictEqual((source.match(/const releaseIsolation = isolateModal\(back\);/g) || []).length, 2);
  assert.strictEqual((source.match(/releaseIsolation\(\);/g) || []).length, 2);
  assert.ok(source.includes('if (!opener || !opener.isConnected'));
});

test('Hilfstexte und kleine Ergebnis-Badges erfüllen mindestens WCAG AA bei Normalschrift', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  const scoring = fs.readFileSync(path.join(ROOT, 'js/scoring.js'), 'utf8');

  function token(name) {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(match, `CSS-Token --${name} fehlt`);
    return match[1];
  }
  function luminance(hex) {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  }
  function contrast(first, second) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  const muted = token('muted');
  assert.ok(contrast(muted, '#ffffff') >= 4.5);
  assert.ok(contrast(muted, token('bg')) >= 4.5);
  assert.ok(css.includes('color: var(--status-label-ink);'));
  assert.ok(css.includes('.step-dot.done { background: var(--success); color: var(--status-label-ink); }'));
  assert.ok(contrast(token('status-label-ink'), token('success')) >= 4.5);

  const statusBlock = scoring.match(/const STATUS_BANDS = \[([\s\S]*?)\n\];/);
  assert.ok(statusBlock, 'Statusfarben fehlen');
  const statusColors = Array.from(statusBlock[1].matchAll(/color:\s*'(#[0-9a-f]{6})'/gi), (match) => match[1]);
  assert.strictEqual(statusColors.length, 4);
  statusColors.forEach((background) => {
    assert.ok(contrast(token('status-label-ink'), background) >= 4.5, background);
  });
});

test('Ergebnisse bearbeiten verwendet den zentralen Fokus- und Renderpfad', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const editCase = source.match(/case 'edit':([^\n]*?)break;/);

  assert.ok(editCase, 'Edit-Eventhandler fehlt');
  assert.ok(editCase[1].includes("clearShareHash(); state.dimIndex = 0; go('quiz');"));
  assert.ok(!editCase[1].includes('render()'));
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
  assert.ok(source.includes('const coveredGuidanceIds = new Set('));
  assert.ok(source.includes('.filter((item) => !coveredGuidanceIds.has(item.id))'));
  assert.ok(!source.includes('matchingGuidance'));
  assert.ok(!source.includes('placedGuidance'));
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
  assert.ok(source.includes("x.scoreIndependent ? 'var(--brand)'") ,
    'scorefreie medizinische Handlungsfelder verwenden keinen irreführenden grünen Scorepunkt');
  assert.ok(source.includes('const hasClarificationOnly = !hasActionPlan && fields.some((field) => field.summaryOnly)'));
  assert.ok(source.includes("ui.action_plan.heading.clarification"));
  assert.ok(source.includes("ui.action_plan.intro.clarification"));
  assert.ok(source.includes("ui.action_plan.clarification.body"));
  assert.ok(/\.signal-box \.insight-list li > div\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;[^}]*\}/s.test(css),
    'lange lokalisierte Stärken- und Handlungsfeldtexte dürfen auf Mobile keinen horizontalen Überlauf erzeugen');
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
  assert.ok(!app.includes('fitness-test-note'));
  assert.ok(!app.includes('item.referenceNote'));
  assert.ok(app.includes('class="plan-retests"'));
  assert.ok(coach.includes('retests: Array.isArray(p.retests)'));
  assert.ok(css.includes('.fitness-test-grid'));
  assert.ok(css.includes('.fitness-test-card {'));
  assert.ok(css.includes('border-left: 4px solid var(--border-strong)'));
  ['stark', 'solide', 'ausbau', 'aufmerksam'].forEach((status) => {
    assert.ok(css.includes(`.fitness-test-card.is-${status}`));
  });
  assert.ok(!css.includes('.fitness-test-rating'));
  assert.ok(!css.includes('.fitness-test-note'));
  assert.ok(css.includes('.fitness-test-recommendation:focus-visible'));
  assert.ok(css.includes('.plan-retests'));
});

test('Mobile Ergebnisansicht nutzt die Kartenbreite und hält die Telefonnummer zusammen', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  const phoneRule = css.match(/\.contact-phone\s*\{([^}]*)\}/);

  assert.ok(css.includes('grid-template-columns: 40px minmax(0, 1fr);'));
  assert.ok(css.includes('.top3-body { display: contents; }'));
  assert.ok(css.includes('.top3-body > :not(h3) { grid-column: 1 / -1; }'));
  assert.ok(phoneRule, 'Telefonregel fehlt');
  assert.match(phoneRule[1], /white-space:\s*nowrap/);
  assert.ok(css.includes('.contact-phone { font-size: clamp(28px, 9vw, 36px);'));
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
