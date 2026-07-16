/*
 * app.js
 * ---------------------------------------------------------------------------
 * Steuerung der Web-Applikation: Startscreen, Fragebogen und Ergebnisansicht.
 * Reine Client-Logik – die Antworten bleiben auf dem Gerät (localStorage) und
 * werden nicht an einen Server gesendet.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  function detectedLocale() {
    const localeApi = typeof window !== 'undefined' ? window.HealthLocale : null;
    let value = null;
    try {
      value = localeApi && typeof localeApi.getLocale === 'function'
        ? localeApi.getLocale()
        : (localeApi && localeApi.current);
      if (localeApi && typeof localeApi.normalize === 'function') value = localeApi.normalize(value);
    } catch (error) { value = null; }
    if (!value && typeof window !== 'undefined' && window.__RESULT_COPY_BUNDLE__) {
      value = window.__RESULT_COPY_BUNDLE__.locale;
    }
    if (!value && typeof document !== 'undefined' && document.documentElement) {
      value = document.documentElement.lang;
    }
    const language = String(value || 'de-CH').toLowerCase().split('-')[0];
    const localeByLanguage = { de: 'de-CH', en: 'en-CH', fr: 'fr-CH', it: 'it-CH' };
    return localeByLanguage[language] || 'de-CH';
  }

  function detectedLanguage() {
    return detectedLocale().split('-')[0];
  }

  // Dieser letzte Notfallzustand darf nicht vom redaktionellen Bundle abhängen:
  // Er muss auch dann verständlich bleiben, wenn genau dieses Bundle fehlt.
  const STATIC_FAILURE_COPY = Object.freeze({
    de: Object.freeze({
      title: 'Die Ansicht konnte nicht geladen werden.',
      message: 'Bitte laden Sie die Seite neu. Falls das Problem bestehen bleibt, versuchen Sie es später erneut.',
      reload: 'Seite neu laden',
    }),
    en: Object.freeze({
      title: 'The page could not be loaded.',
      message: 'Please reload the page. If the problem persists, try again later.',
      reload: 'Reload page',
    }),
    fr: Object.freeze({
      title: 'Impossible de charger la page.',
      message: 'Veuillez recharger la page. Si le problème persiste, réessayez plus tard.',
      reload: 'Recharger la page',
    }),
    it: Object.freeze({
      title: 'Non è stato possibile caricare la pagina.',
      message: 'Ricarichi la pagina. Se il problema persiste, riprovi più tardi.',
      reload: 'Ricaricare la pagina',
    }),
  });

  function reportStaticFailure(error) {
    let detail = 'HN_RENDER_FAILED';
    const message = error && typeof error.message === 'string' ? error.message : '';
    // Nur ResultCopy-Vertragsfehler enthalten eine kontrollierte technische ID.
    // Andere Fehler werden ohne Stack, Antworten oder DOM-Inhalte protokolliert.
    if (/^ResultCopy:/.test(message)) {
      detail = message.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
    }
    try {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[Health Navigator] Initialisierung/Rendering fehlgeschlagen: ' + detail);
      }
    } catch (ignored) {}
  }

  function showStaticFailure() {
    const root = document.getElementById('app');
    if (!root) return;
    if (document.body) document.body.dataset.screen = 'error';
    root.dataset.renderError = 'true';
    const fallback = STATIC_FAILURE_COPY[detectedLanguage()] || STATIC_FAILURE_COPY.de;
    root.innerHTML = `
      <section class="section fade-in" role="alert">
        <div class="card">
          <h1>${fallback.title}</h1>
          <p>${fallback.message}</p>
          <button class="btn btn-primary" type="button" data-action="reload">${fallback.reload}</button>
        </div>
      </section>`;
    const reload = root.querySelector('[data-action="reload"]');
    if (reload) reload.addEventListener('click', () => location.reload());
    const heading = root.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      try { heading.focus({ preventScroll: true }); } catch (error) { heading.focus(); }
    }
  }

  try {

  const app = document.getElementById('app');
  const copy = window.ResultCopy;
  const config = window.HealthNavigatorConfig || {};
  const persistence = window.HealthPersistence;
  const urlSafety = window.HealthUrlSafety;
  const STORAGE_KEY = 'helsana_gcheck_v1';
  const PLAN_KEY = 'helsana_gcheck_plan_v1';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

  function localizedRoute(route) {
    const localeApi = window.HealthLocale;
    if (!localeApi || typeof localeApi.urlForLocale !== 'function') return route;
    try { return localeApi.urlForLocale(detectedLocale(), route) || route; }
    catch (error) { return route; }
  }

  let planStore = {};
  function loadPlan() {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (!raw) return;
      const stored = persistence && persistence.readPlan(raw);
      if (!stored) { localStorage.removeItem(PLAN_KEY); return; }
      planStore = stored.items;
      if (stored.migrated) savePlan();
    } catch (e) { planStore = {}; }
  }
  function savePlan() {
    try {
      const value = persistence ? persistence.serializePlan(planStore) : JSON.stringify(planStore);
      localStorage.setItem(PLAN_KEY, value);
    } catch (e) {}
  }

  // Controller aller an eine konkrete Ergebnis-DOM gebundenen Nebenläufigkeiten.
  // Vor jedem Voll-Render werden sie zentral beendet, damit keine verzögerten
  // Callbacks mehr auf bereits entfernte Elemente zugreifen.
  let breathingCtl = null;
  let chatCtl = null;
  let scoreAnimationCtl = null;

  function safeHttps(value) {
    return urlSafety && typeof urlSafety.safeHttps === 'function'
      ? urlSafety.safeHttps(value)
      : null;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function cleanupInteractive() {
    if (breathingCtl) { breathingCtl.stop(); breathingCtl = null; }
    if (chatCtl) { chatCtl.stop(); chatCtl = null; }
    if (scoreAnimationCtl) { scoreAnimationCtl.stop(); scoreAnimationCtl = null; }
    if (window.Radar && typeof window.Radar.destroy === 'function') window.Radar.destroy();
  }

  /* -------------------------------------------------- Icons (inline SVG) -- */
  const I = {
    shield: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    metabolism: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
    activity: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="5" r="1.6"/><path d="M7 21l3-5 3 2 1-4 3 3M10 11l3-2 3 1"/></svg>',
    nutrition: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8c-1.5-3-6-3-7 .5C4 13 9 20 12 20s8-7 7-11.5C18 5 13.5 5 12 8z"/><path d="M12 8c0-2 1-4 3-5"/></svg>',
    sleep: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 6.5 6.5 0 1 0 20 14.5z"/></svg>',
    mind: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4.5A4.5 4.5 0 0 0 5 9c-1.2.6-2 1.8-2 3.2 0 1.3.7 2.4 1.8 3 .1 1.7 1.5 3 3.2 3 .6 0 1.1-.1 1.5-.4V4.8c-.3-.2-.7-.3-1-.3z"/><path d="M14.5 4.5A4.5 4.5 0 0 1 19 9c1.2.6 2 1.8 2 3.2 0 1.3-.7 2.4-1.8 3-.1 1.7-1.5 3-3.2 3-.6 0-1.1-.1-1.5-.4"/><path d="M12 4.5v15"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>',
    info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
    arrowR: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    alert: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
    spark: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-1 5"/><path d="M20 5v6h-6"/></svg>',
    stethoscope: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 16a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="11" r="2"/></svg>',
    leaf: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c8 2 13-3 14-13-9 0-15 3-14 13z"/><path d="M5 19c2-5 5-7 9-8"/></svg>',
  };
  const DIM_ICON = { shield: I.shield, metabolism: I.metabolism, activity: I.activity, nutrition: I.nutrition, sleep: I.sleep, mind: I.mind };

  /* -------------------------------------------------- State -------------- */
  const state = { screen: 'start', dimIndex: 0, maxReached: 0, answers: {} };
  // Geteilte Antworten werden nur angezeigt. Der bestehende lokale Stand darf
  // erst nach einer bewussten Bearbeitung oder Navigation überschrieben werden.
  let sharedResultActive = false;

  function sanitizeAnswers(raw) {
    const schema = window.HealthAnswerSchema;
    return schema ? schema.sanitizeAnswers(raw) : {};
  }

  function answersComplete(answers) {
    const schema = window.HealthAnswerSchema;
    return !!schema && schema.areAnswersComplete(answers);
  }

  function save() {
    try {
      const value = persistence
        ? persistence.serializeState(state)
        : JSON.stringify({ answers: sanitizeAnswers(state.answers), dimIndex: state.dimIndex, maxReached: state.maxReached });
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = persistence && persistence.readState(raw);
        if (!stored) { localStorage.removeItem(STORAGE_KEY); return; }
        state.answers = stored.answers;
        state.dimIndex = stored.dimIndex;
        state.maxReached = stored.maxReached;
        if (stored.migrated) save();
      }
    } catch (e) {}
  }
  function reset() {
    state.answers = {}; state.dimIndex = 0; state.maxReached = 0;
    planStore = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PLAN_KEY);
    } catch (e) {}
    clearShareHash();
  }

  function focusCurrentView() {
    const heading = app.querySelector('h1, .dim-intro h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      try { heading.focus({ preventScroll: true }); } catch (error) { heading.focus(); }
    } else {
      app.focus();
    }
  }

  function go(screen) {
    state.screen = screen;
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    focusCurrentView();
  }

  /* -------------------------------------------------- Start screen ------- */
  function renderStart() {
    const hasProgress = Object.keys(state.answers).length > 0;
    app.innerHTML = `
      <section class="hero fade-in">
        <p class="eyebrow">${copy.get('ui.start.eyebrow')}</p>
        <h1>${copy.get('ui.start.title')}</h1>
        <p class="lead">${copy.get('ui.start.lead')}</p>
        <div class="hero-points">
          <div class="hero-point">${I.spark}<div><b>${copy.get('ui.start.point.personal.title')}</b><span>${copy.get('ui.start.point.personal.detail')}</span></div></div>
          <div class="hero-point">${I.leaf}<div><b>${copy.get('ui.start.point.evidence.title')}</b><span>${copy.get('ui.start.point.evidence.detail')}</span></div></div>
          <div class="hero-point">${I.lock}<div><b>${copy.get('ui.start.point.private.title')}</b><span>${copy.get('ui.start.point.private.detail')}</span></div></div>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" data-action="start">${copy.get(hasProgress ? 'ui.start.button.continue' : 'ui.start.button.begin')} ${I.arrowR}</button>
          ${hasProgress ? `<button class="btn btn-ghost btn-lg" data-action="restart">${copy.get('ui.start.button.restart')}</button>` : ''}
        </div>
      </section>

      <div class="note-card fade-in">
        ${I.info}
        <div><b>${copy.get('ui.start.disclaimer.title')}</b> ${copy.get('ui.start.disclaimer.body')}
        <a class="link-button link-button-inline" href="${escAttr(localizedRoute('quellen.html'))}">${copy.get('ui.start.sources_link')}</a></div>
      </div>
    `;
  }

  /* -------------------------------------------------- Quiz --------------- */
  function dimValid(dim) {
    const schema = window.HealthAnswerSchema;
    return !!(schema && schema.isDimensionComplete(dim, state.answers));
  }

  function numberErrorText(q) {
    const variables = { min: q.min, max: q.max, unit: q.unit ? ` ${q.unit}` : '' };
    if (q.min != null && q.max != null) return copy.format('ui.quiz.number_error.between', variables);
    if (q.min != null) return copy.format('ui.quiz.number_error.minimum', variables);
    return copy.format('ui.quiz.number_error.maximum', variables);
  }

  function numberInputInvalid(q, raw) {
    if (!q || q.type !== 'number' || raw === '' || raw == null) return false;
    const n = Number(raw);
    return !Number.isFinite(n) || n < (q.min ?? -Infinity) || n > (q.max ?? Infinity);
  }

  function optionButton(q, opt) {
    const v = state.answers[q.id];
    const pressed = q.type === 'multi' ? (Array.isArray(v) && v.includes(opt.value)) : v === opt.value;
    return `<button type="button" class="option ${q.type === 'multi' ? 'multi' : ''}" role="${q.type === 'multi' ? 'checkbox' : 'radio'}"
      aria-checked="${pressed}" data-action="opt" data-q="${escAttr(q.id)}" data-type="${q.type}" data-value="${escAttr(opt.value)}"
      ${opt.exclusive ? 'data-exclusive="1"' : ''}>
      <span class="opt-label">${opt.label}</span><span class="tick">${I.check}</span></button>`;
  }

  function questionHTML(q) {
    let body = '';
    const noteId = q.note ? `q-note-${q.id}` : '';
    if (q.type === 'number') {
      const v = state.answers[q.id] ?? '';
      const invalid = numberInputInvalid(q, v);
      const errorId = `q-error-${q.id}`;
      const describedBy = [noteId, errorId].filter(Boolean).join(' ');
      body = `<div class="num-field">
        <input type="number" inputmode="numeric" data-action="num" data-q="${escAttr(q.id)}"
          min="${q.min ?? ''}" max="${q.max ?? ''}" value="${escAttr(v)}" placeholder="${escAttr(q.placeholder || '')}"
          aria-label="${escAttr(q.text)}" aria-describedby="${escAttr(describedBy)}"
          aria-required="${!q.optional}" aria-invalid="${invalid}" />
        ${q.unit ? `<span class="num-unit">${q.unit}</span>` : ''}
      </div>
      <div class="field-error" id="${escAttr(errorId)}" data-number-error aria-live="polite"${invalid ? '' : ' hidden'}>${escHtml(numberErrorText(q))}</div>
      ${q.optional ? `<div class="field-hint">${copy.get('ui.quiz.optional_hint')}</div>` : ''}`;
    } else {
      const opts = q.options.slice();
      if (q.dontKnow) opts.push(window.DONT_KNOW);
      const cols = opts.length > 3 && opts.every((o) => o.label.length < 28) ? 'cols-2' : '';
      body = `<div class="options ${cols}" role="${q.type === 'multi' ? 'group' : 'radiogroup'}" aria-label="${escAttr(q.text)}"${noteId ? ` aria-describedby="${escAttr(noteId)}"` : ''}>${opts.map((o) => optionButton(q, o)).join('')}</div>`;
    }
    return `<div class="question" data-qwrap="${escAttr(q.id)}">
      <div class="q-text">${q.text}</div>
      ${q.note ? `<div class="q-note" id="${escAttr(noteId)}">${q.note}</div>` : ''}
      ${q.help ? `<details class="q-help-wrap"><summary class="q-help-toggle">${I.info} ${escHtml(q.helpTitle || copy.get('ui.quiz.help_fallback'))}</summary><div class="q-help">${String(q.help).replace(/\n/g, '<br>')}</div></details>` : ''}
      ${body}
    </div>`;
  }

  function renderQuiz() {
    const dims = window.DIMENSIONS;
    const dim = dims[state.dimIndex];
    const total = dims.length;
    const isLast = state.dimIndex === total - 1;

    const steps = dims.map((d, i) => {
      const reachable = i <= state.maxReached;
      const status = i < state.dimIndex ? 'done' : (i === state.dimIndex ? 'current' : 'inactive');
      const conn = i > 0 ? `<span class="step-conn ${i - 1 < state.dimIndex ? 'done' : ''}"></span>` : '';
      const stateLabel = status === 'done'
        ? copy.get('ui.quiz.step_state.done')
        : (status === 'current' ? copy.get('ui.quiz.step_state.current') : '');
      return `${conn}<button class="step-dot ${status}" data-action="goto" data-idx="${i}"
        ${reachable ? '' : 'disabled'} title="${d.short}"
        aria-current="${i === state.dimIndex}" aria-label="${escAttr(copy.format('ui.quiz.step_aria', { current: i + 1, total, dimensionShort: d.short, stateLabel }))}">${status === 'done' ? I.check : i + 1}</button>`;
    }).join('');

    app.innerHTML = `
      <div class="quiz-head fade-in">
        <div class="stepper" role="group" aria-label="${escAttr(copy.get('ui.quiz.progress_aria'))}">${steps}</div>
      </div>

      <section class="card fade-in">
        <div class="dim-intro">
          <div class="dim-count">${copy.format('ui.quiz.dimension_count', { current: state.dimIndex + 1, total })}</div>
          <h1>${dim.title}</h1>
        </div>
        <p class="dim-lead">${dim.intro}</p>
        <div>${dim.questions.map(questionHTML).join('')}</div>
      </section>

      <div class="quiz-nav">
        <button class="btn btn-primary btn-block" data-action="next" id="next-btn">
          ${copy.get(isLast ? 'ui.quiz.button.results' : 'ui.quiz.button.continue')} ${I.arrowR}
        </button>
        <button class="btn btn-secondary btn-block" data-action="back">${I.arrowL} ${copy.get('ui.quiz.button.back')}</button>
      </div>
      <div id="nav-hint" class="field-error" style="text-align:right" role="status" aria-live="polite" hidden>
        ${copy.get('ui.quiz.incomplete_hint')}
      </div>
    `;
    updateNextState();
    // Instant-Scroll nach oben – scroll-behavior:smooth kurz deaktivieren
    const _el = document.documentElement;
    _el.style.scrollBehavior = 'auto';
    _el.scrollTop = 0;
    _el.style.scrollBehavior = '';
  }

  function updateNextState() {
    const dim = window.DIMENSIONS[state.dimIndex];
    const btn = document.getElementById('next-btn');
    if (!btn) return;
    const ok = dimValid(dim);
    btn.disabled = !ok;
  }

  /* -------------------------------------------------- Results ------------ */
  function statusFn(score) { return window.Scoring.statusForScore(score); }

  function offerHTML(key) {
    const o = window.HELSANA_OFFERS[key];
    if (!o) return '';
    const href = safeHttps(o.href);
    const ph = !href;
    // Kundenkontext-abhängiger Hinweis (Integrationsschicht, js/integration.js).
    // Erscheint nur für eingeloggte Nutzer mit passender Produktkategorie.
    const cov = window.HelsanaIntegration ? window.HelsanaIntegration.coverageHintFor(key) : null;
    const destination = href
      ? `<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">${o.label}</a>`
      : `<span class="is-placeholder" role="link" aria-disabled="true">${o.label}</span>`;
    return `<div class="offer">${I.link}
      <div>${destination}
      <span class="offer-fit"> – ${o.fit}</span>
      <span class="offer-coverage" data-coverage-offer="${escAttr(key)}"${cov ? '' : ' hidden'}>${I.shield}<span data-coverage-text>${cov ? escHtml(cov) : ''}</span></span>
      ${ph ? `<span class="offer-ph">${copy.format('ui.offer.placeholder_prefix', { placeholder: o.placeholder })}</span>` : ''}</div></div>`;
  }

  // Dezenter Hinweis auf der Ergebnisseite, wenn ein Kundenkontext vorliegt
  // (Demo-Profil oder später echter Login). Rein informativ, keine Zusage.
  function customerContextChipContentHTML() {
    const integ = window.HelsanaIntegration;
    const ctx = integ && integ.getContext();
    const coverageEnabled = !!(integ && integ.INTEGRATION_CONFIG &&
      integ.INTEGRATION_CONFIG.coverageHintsEnabled);
    // Das aktuelle Chip-Wording verspricht eine produktbezogene Einordnung.
    // Solange Coverage-Hinweise nicht freigegeben sind, bleibt daher auch der
    // Chip verborgen statt im Live-Default eine falsche Aussage zu zeigen.
    if (!ctx || !ctx.isAuthenticated || !coverageEnabled) return '';
    const name = ctx.displayName || copy.get('ui.customer_context.fallback_name');
    return `<div class="customer-chip">${I.lock}<span>${copy.format('ui.customer_context.chip', { displayName: name })}</span></div>`;
  }

  function customerContextChipHTML() {
    const content = customerContextChipContentHTML();
    return `<div data-customer-context-chip aria-live="polite"${content ? '' : ' hidden'}>${content}</div>`;
  }

  function refreshCustomerContextPresentation() {
    const chip = app.querySelector('[data-customer-context-chip]');
    if (chip) {
      const content = customerContextChipContentHTML();
      chip.innerHTML = content;
      chip.hidden = !content;
    }
    app.querySelectorAll('[data-coverage-offer]').forEach((slot) => {
      const key = slot.dataset.coverageOffer;
      const hint = window.HelsanaIntegration
        ? window.HelsanaIntegration.coverageHintFor(key)
        : null;
      const text = slot.querySelector('[data-coverage-text]');
      if (text) text.textContent = hint || '';
      slot.hidden = !hint;
    });
  }

  // Schlanker Pfeil-Link (Figma "Action-Link"), z. B. für Punkte-sammeln-/Feedback-Teaser
  function offerActionLinkHTML(key, label) {
    const o = window.HELSANA_OFFERS[key];
    if (!o) return '';
    const href = safeHttps(o.href);
    const ph = !href;
    const destination = href
      ? `<a class="action-link" href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">${I.arrowR}<span>${label || o.label}</span></a>`
      : `<span class="action-link is-placeholder" role="link" aria-disabled="true">${I.arrowR}<span>${label || o.label}</span></span>`;
    return `${destination}
      ${ph ? `<div class="offer-ph" style="margin-top:6px">${copy.format('ui.offer.placeholder_prefix', { placeholder: o.placeholder })}</div>` : ''}`;
  }

  function actionCardRowsHTML(r) {
    return `<div class="rec-row"><b>${copy.get('ui.action_card.label.why')}</b> ${r.why}</div>
      <div class="rec-row"><b>${copy.get('ui.action_card.label.step')}</b> ${r.step}</div>
      <div class="rec-row"><b>${copy.get('ui.action_card.label.benefit')}</b> ${r.benefit}</div>`;
  }

  function dimensionGuidanceHTML(item) {
    const nextStep = item.action || item.clarify;
    return `<article class="rec dimension-guidance-card">
      <h4>${escHtml(item.title)}</h4>
      <div class="rec-row"><b>${copy.get('ui.recommendation.label.why')}</b> ${escHtml(item.insight)}</div>
      <div class="rec-row"><b>${copy.get('ui.recommendation.label.step')}</b> ${escHtml(nextStep)}</div>
      <div class="rec-row"><b>${copy.get('ui.recommendation.label.benefit')}</b> ${escHtml(item.benefit)}</div>
    </article>`;
  }

  function recHTML(r, planStep) {
    const isActionPlanStep = Number.isInteger(planStep) && planStep > 0;
    const badge = isActionPlanStep
      ? `<div class="rec-plan-badge">${copy.format('ui.recommendation.action_plan_badge', { planStep })}</div>`
      : '';
    const rows = isActionPlanStep
      ? actionCardRowsHTML(r)
      : `<div class="rec-row"><b>${copy.get('ui.recommendation.label.why')}</b> ${r.why}</div>
        <div class="rec-row"><b>${copy.get('ui.recommendation.label.step')}</b> ${r.step}</div>
        <div class="rec-row"><b>${copy.get('ui.recommendation.label.benefit')}</b> ${r.benefit}</div>`;
    return `<div class="rec${isActionPlanStep ? ' is-action-plan-step' : ''}" id="recommendation-${escAttr(r.id)}">
      <h4>${r.title}</h4>
      ${badge}
      ${rows}
      ${r.offer ? offerHTML(r.offer) : ''}
    </div>`;
  }

  function fitnessTestsHTML(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const cards = items.map((item) => {
      const reference = item.referenceNote
        ? `<p class="fitness-test-note">${I.info}<span>${item.referenceNote}</span></p>`
        : '';
      const nextReference = item.nextReference
        ? `<p class="fitness-test-reference"><b>${copy.get('ui.fitness_tests.next_reference_label')}</b> ${item.nextReference}</p>`
        : '';
      const recommendationLabel = item.planStep
        ? copy.format('ui.fitness_tests.related_recommendation.top_step', {
          recommendationTitle: item.recommendationTitle || '',
          planStep: item.planStep,
        })
        : copy.format('ui.fitness_tests.related_recommendation.detail', {
          recommendationTitle: item.recommendationTitle || '',
        });
      const recommendation = item.recommendationId && item.recommendationTitle
        ? `<a class="fitness-test-recommendation" href="#recommendation-${escAttr(item.recommendationId)}">
            ${I.arrowR}<span>${recommendationLabel}</span>
          </a>`
        : '';
      return `<article class="fitness-test-card is-${escAttr(item.ratingKey)}">
        <div class="fitness-test-head">
          <h5>${item.title}</h5>
        </div>
        <p class="fitness-test-value"><strong>${item.ratingLabel}</strong><b>${escHtml(item.value)} ${item.unit}</b></p>
        <p><b>${copy.get('ui.fitness_tests.meaning_label')}</b> ${item.meaning}</p>
        <p><b>${copy.get('ui.fitness_tests.relevance_label')}</b> ${item.relevance}</p>
        ${nextReference}
        ${reference}
        ${recommendation}
      </article>`;
    }).join('');
    return `<section class="fitness-tests" aria-labelledby="fitness-tests-title">
      <div class="fitness-tests-intro">
        <h4 id="fitness-tests-title">${copy.get('ui.fitness_tests.title')}</h4>
        <p>${copy.get('ui.fitness_tests.description')}</p>
      </div>
      <div class="fitness-test-grid">${cards}</div>
    </section>`;
  }

  /* ---------------------------------------------------------------------
   * Ergebnisspezifische Zusammenfassung im Ergebnis-Hero.
   * Baut aus Gesamtstatus, stärkster/schwächster Dimension und den konkreten
   * Defizit-Themen (Frage-Normen via Scoring.questionNorm) 2–3 persönliche
   * Sätze – statt eines generischen Erklärtexts.
   * ------------------------------------------------------------------- */
  const DIM_PHRASES = {
    einfluss: { nom: copy.get('ui.hero.dimension.einfluss.nominative'), bei: copy.get('ui.hero.dimension.einfluss.prepositional'), pl: true },
    fitness: { nom: copy.get('ui.hero.dimension.fitness.nominative'), bei: copy.get('ui.hero.dimension.fitness.prepositional') },
    ernaehrung: { nom: copy.get('ui.hero.dimension.ernaehrung.nominative'), bei: copy.get('ui.hero.dimension.ernaehrung.prepositional') },
    schlaf: { nom: copy.get('ui.hero.dimension.schlaf.nominative'), bei: copy.get('ui.hero.dimension.schlaf.prepositional') },
    mental: { nom: copy.get('ui.hero.dimension.mental.nominative'), bei: copy.get('ui.hero.dimension.mental.prepositional') },
  };

  // Kurze Themen-Labels für die Nennung hinter «Stichwort:» (nur bewertete Fragen).
  const TOPIC_LABELS = {
    stabilitaet: copy.get('ui.hero.topic.stabilitaet'), sitzzeit: copy.get('ui.hero.topic.sitzzeit'),
    familienwissen: copy.get('ui.hero.topic.familienwissen'), rauchen: copy.get('ui.hero.topic.rauchen'),
    alkohol: copy.get('ui.hero.topic.alkohol'), socialmedia: copy.get('ui.hero.topic.socialmedia'),
    ausdauer_moderat: copy.get('ui.hero.topic.ausdauer_moderat'), ausdauer_intensiv: copy.get('ui.hero.topic.ausdauer_intensiv'),
    krafttraining: copy.get('ui.hero.topic.krafttraining'), beweglichkeit: copy.get('ui.hero.topic.beweglichkeit'),
    treppen: copy.get('ui.hero.topic.treppen'), einkaufstaschen: copy.get('ui.hero.topic.einkaufstaschen'),
    protein: copy.get('ui.hero.topic.protein'), pflanzenvielfalt: copy.get('ui.hero.topic.pflanzenvielfalt'),
    saettigung: copy.get('ui.hero.topic.saettigung'), verarbeitet: copy.get('ui.hero.topic.verarbeitet'),
    omega3: copy.get('ui.hero.topic.omega3'), zuckergetraenke: copy.get('ui.hero.topic.zuckergetraenke'),
    schlafqualitaet: copy.get('ui.hero.topic.schlafqualitaet'), schlafdauer: copy.get('ui.hero.topic.schlafdauer'),
    schlafrhythmus: copy.get('ui.hero.topic.schlafrhythmus'), schlaf_auswirkung: copy.get('ui.hero.topic.schlaf_auswirkung'),
    belastbarkeit: copy.get('ui.hero.topic.belastbarkeit'), selbstwirksamkeit: copy.get('ui.hero.topic.selbstwirksamkeit'),
    sinnhaftigkeit: copy.get('ui.hero.topic.sinnhaftigkeit'), coping: copy.get('ui.hero.topic.coping'),
    verbundenheit: copy.get('ui.hero.topic.verbundenheit'), selbstfuersorge: copy.get('ui.hero.topic.selbstfuersorge'),
    zukunft: copy.get('ui.hero.topic.zukunft'), positive_emotionen: copy.get('ui.hero.topic.positive_emotionen'),
  };

  // Die 1–2 konkretesten Defizit-Themen innerhalb einer Dimension (Norm ≤ −1).
  function weakestTopics(dimId, results, max) {
    const out = [];
    const dim = (window.DIMENSIONS || []).find((d) => d.id === dimId);
    const qn = window.Scoring.questionNorm;
    if (dim && typeof qn === 'function') {
      dim.questions.forEach((q) => {
        const label = TOPIC_LABELS[q.id];
        if (!label) return;
        const n = qn(q.id, state.answers[q.id]);
        if (n != null && n <= -1) out.push({ label, n });
      });
    }
    // Körperzusammensetzung zählt zu den Einflussfaktoren (S-1.1), ist aber
    // keine Frage-Norm – bei Adipositas-Einstufung als starkes Thema ergänzen.
    if (dimId === 'einfluss' && results.metrics && String(results.metrics.bmiClass || '').indexOf('adipositas') === 0) {
      out.push({ label: copy.get('ui.hero.topic.koerperzusammensetzung'), n: -2 });
    }
    out.sort((a, b) => a.n - b.n);
    return out.slice(0, max).map((d) => d.label);
  }

  function resultLeadHTML(results, planCount) {
    const order = window.DIMENSION_ORDER || Object.keys(results.scores);
    const entries = order.map((id) => ({ id, score: results.scores[id] }));
    const weakest = entries.reduce((a, b) => (b.score < a.score ? b : a));
    const strongest = entries.reduce((a, b) => (b.score > a.score ? b : a));
    const spread = strongest.score - weakest.score;

    const topics = weakestTopics(weakest.id, results, 2);
    const topicSuffix = topics.length === 2
      ? copy.format('ui.hero.topic_suffix.two', { topicOne: topics[0], topicTwo: topics[1] })
      : (topics.length === 1 ? copy.format('ui.hero.topic_suffix.one', { topicOne: topics[0] }) : '');
    const w = DIM_PHRASES[weakest.id] || {
      nom: copy.get('ui.hero.dimension.fallback.nominative'),
      bei: copy.get('ui.hero.dimension.fallback.prepositional'),
    };
    const s = DIM_PHRASES[strongest.id] || {
      nom: copy.get('ui.hero.dimension.fallback.nominative'),
      bei: copy.get('ui.hero.dimension.fallback.prepositional'),
    };
    const key = results.status.key;
    const vars = {
      weakestPrepositional: w.bei,
      weakestScore: weakest.score,
      strongestNominative: s.nom,
      strongestScore: strongest.score,
      topicSuffix,
      actionPlanReference: planCount === 0
        ? copy.get('ui.hero.action_plan_reference.empty')
        : (planCount === 1
          ? copy.get('ui.action_plan.heading.one')
          : (planCount === 2 ? copy.get('ui.action_plan.heading.two') : copy.get('ui.action_plan.heading.three'))),
      actionPlanVerb: copy.get('ui.hero.action_plan_verb.' + (planCount <= 1 ? 'singular' : 'plural')),
    };

    // Sonderfall: sehr ausgeglichenes Profil – Stärken/Schwächen-Kontrast weglassen.
    if (spread <= 6) {
      return copy.format('ui.hero.lead.balanced.' + key, vars);
    }

    if (key === 'stark') {
      return copy.format('ui.hero.lead.spread.stark', vars);
    }
    if (key === 'solide') {
      return copy.format('ui.hero.lead.spread.solide', vars);
    }
    if (key === 'ausbau') {
      const anchor = strongest.score >= 60 ? 'anchor_strong' : 'anchor_stable';
      return copy.format('ui.hero.lead.spread.ausbau.' + anchor + '.' + (s.pl ? 'plural' : 'singular'), vars);
    }
    // key === 'aufmerksam'
    const suffix = strongest.score >= 55 ? '.with_wind.' + (s.pl ? 'plural' : 'singular') : '.no_wind';
    return copy.format('ui.hero.lead.spread.aufmerksam' + suffix, vars);
  }

  function einordnungText(status, hasOpenSignal) {
    return copy.get(hasOpenSignal
      ? 'ui.dimension.classification.open_signal'
      : 'ui.dimension.classification.' + status.key);
  }

  function metricsLine(m) {
    const parts = [];
    if (m.bmi) {
      const lbl = copy.get('ui.metrics.bmi_class.' + m.bmiClass);
      parts.push(copy.format('ui.metrics.bmi', {
        bmi: window.HealthLocale.formatDecimal(m.bmi),
        bmiClassLabel: lbl,
      }));
    }
    if (m.waist) {
      const lbl = copy.get('ui.metrics.waist_status.' + m.waistStatus);
      parts.push(copy.format('ui.metrics.waist', { waist: m.waist, waistStatusLabel: lbl }));
    }
    return parts.length ? `<div class="metrics-summary">${I.info}<span>${copy.format('ui.metrics.line', {
      metrics: parts.join(copy.get('ui.metrics.separator')),
    })}</span></div>` : '';
  }

  function renderResults() {
    state.answers = sanitizeAnswers(state.answers);
    if (!answersComplete(state.answers)) {
      const schema = window.HealthAnswerSchema;
      const firstIncomplete = (window.DIMENSIONS || [])
        .findIndex((dim) => !schema.isDimensionComplete(dim, state.answers));
      state.screen = 'quiz';
      state.dimIndex = Math.max(0, firstIncomplete);
      state.maxReached = Math.max(state.maxReached, state.dimIndex);
      save();
      render();
      return;
    }
    if (!sharedResultActive) save();
    const results = window.Scoring.computeResults(state.answers);
    const ctx = window.Recommendations.buildContext(state.answers, results);
    const top3 = window.Recommendations.actionPlan(ctx);
    const planStepById = new Map(top3.map((record, index) => [record.id, index + 1]));
    const dims = window.SCORED_DIMENSIONS;
    const botCtx = window.Coach.botContext(results, top3);

    const status = results.status;
    const overall = results.overall;

    // Stärken / Handlungsfelder: konkrete, antwortbasierte Insights statt
    // reiner Score-Listen (Logik: keyStrengths/keyLevers in recommendations.js)
    const strengths = window.Recommendations.keyStrengths(ctx, 3);
    const fields = window.Recommendations.keyLevers(ctx, 3);

    const urgent = results.signals.filter((s) => s.type === 'dringend' || s.id === 'hohe_belastung');

    const urgentBanner = urgent.length ? `
      <div class="urgent-banner fade-in">${I.alert}
        <div><b class="urgent-title">${copy.get('ui.urgent.title')}</b>
        ${copy.get('ui.urgent.body')}</div>
      </div>` : '';

    // Top-3
    const top3html = top3.map((r, i) => {
      const steps = window.Coach.weekPlan(r);
      const planItems = steps.map((sp, k) => {
        const id = `${r.id}-${k}`;
        const linkHtml = sp.link && window.HELSANA_OFFERS[sp.link]
          ? `<span>${offerHTML(sp.link)}</span>` : '';
        const sourceHref = sp.sourceRef ? safeHttps(sp.sourceRef.href) : null;
        const srcHtml = sp.sourceRef
          ? (sourceHref
            ? `<a class="plan-source" href="${escAttr(sourceHref)}" target="_blank" rel="noopener noreferrer">${I.link}<span>${escHtml(sp.sourceRef.label)}</span></a>`
            : `<span class="plan-source is-placeholder" role="link" aria-disabled="true">${I.link}<span>${escHtml(sp.sourceRef.label)}</span></span>`)
          : '';
        const retestHtml = Array.isArray(sp.retests) && sp.retests.length
          ? `<div class="plan-retests">
              <b>${copy.get('ui.fitness_tests.retest_label')}</b>
              ${sp.retests.map((item) => `<span class="plan-retest${item.caution ? ' is-caution' : ''}">${item.text}</span>`).join('')}
            </div>`
          : '';
        return `<label class="plan-item">
            <input type="checkbox" data-plan-item="${escAttr(id)}"${planStore[id] ? ' checked' : ''}>
            <span class="plan-check">${I.check}</span>
            <span class="plan-text"><b>${sp.label}:</b> ${sp.text}${retestHtml}${srcHtml}${linkHtml}</span>
          </label>`;
      }).join('');
      const done = steps.filter((sp, k) => planStore[`${r.id}-${k}`]).length;
      return `
      <div class="card top3-card fade-in">
        <div class="top3-num">${i + 1}</div>
        <div class="top3-body">
          <h3>${r.title}</h3>
          ${actionCardRowsHTML(r)}
          ${r.offer ? offerHTML(r.offer) : ''}
          <details class="plan">
            <summary class="plan-summary">
              ${I.list}<span>${copy.get('ui.action_card.plan_title')}</span>
              <span class="plan-progress" data-plan-progress="${escAttr(r.id)}">${copy.format('ui.action_card.progress', { done, total: steps.length })}</span>
              <span class="plan-chevron">${I.chevron}</span>
            </summary>
            <div class="plan-body">${planItems}</div>
          </details>
        </div>
      </div>`;
    }).join('');
    const hasActionPlan = top3.length > 0;
    const actionPlanHeading = copy.get('ui.action_plan.heading.' + (
      top3.length === 1 ? 'one' : (top3.length === 2 ? 'two' : (top3.length === 3 ? 'three' : 'empty'))
    ));
    const actionPlanIntro = hasActionPlan
      ? copy.get(top3.length === 1 ? 'ui.action_plan.intro.one' : 'ui.action_plan.intro.multiple')
      : copy.get('ui.action_plan.intro.empty');
    const actionPlanBody = hasActionPlan
      ? `<div class="top3">${top3html}</div>`
      : `<div class="dimension-feedback is-neutral">${I.info}<div><b>${copy.get('ui.action_plan.empty.title')}</b><br>${copy.get('ui.action_plan.empty.body')}</div></div>`;

    // Nicht priorisierte Signale erscheinen direkt in ihrer fachlich passenden
    // Dimension. Themen aus den Top-Schritten werden hier nicht nochmals erklärt.
    const dimensionInsights = window.Recommendations.dimensionInsights(results, top3);
    const fitnessTestInsights = window.Recommendations.fitnessTestInsights(results, top3);

    // Dimension Details
    const detailHTML = dims.map((dim) => {
      const sc = results.scores[dim.id];
      const st = statusFn(sc);
      const recs = window.Recommendations.recommendationsForDimension(dim.id, ctx, top3);
      const guidance = dimensionInsights[dim.id] || [];
      const placedGuidance = new Set();
      const recommendationHTML = recs.map((record) => {
        const matchingGuidance = guidance.filter((item) => {
          if (placedGuidance.has(item.id) || !item.relatedRecommendationIds.includes(record.id)) return false;
          placedGuidance.add(item.id);
          return true;
        });
        return recHTML(record, planStepById.get(record.id));
      }).join('');
      const standaloneGuidanceHTML = guidance
        .filter((item) => !placedGuidance.has(item.id))
        .map((item) => dimensionGuidanceHTML(item))
        .join('');
      const hasOpenSignal = window.Recommendations.hasOpenDimensionSignal(dim.id, ctx);
      const feedbackTone = hasOpenSignal
        ? 'neutral'
        : window.Recommendations.dimensionFeedbackTone(sc);
      const feedbackText = feedbackTone === 'solid'
        ? window.Recommendations.SOLIDS[dim.id]
        : window.Recommendations.POSITIVES[dim.id];
      const recsHTML = recommendationHTML || standaloneGuidanceHTML
        ? recommendationHTML + standaloneGuidanceHTML
        : (feedbackTone !== 'neutral'
          ? `<div class="dimension-feedback is-${feedbackTone}">${feedbackTone === 'positive' ? I.spark : I.info}<div>${feedbackText}</div></div>`
          : `<div class="dimension-feedback is-neutral">${I.info}<div>${copy.get(hasOpenSignal ? 'ui.dimension.empty.open_signal' : 'ui.dimension.empty.neutral')}</div></div>`);
      const fitnessTests = dim.id === 'fitness' ? fitnessTestsHTML(fitnessTestInsights) : '';
      return `
        <details class="dim-card" id="detail-${dim.id}">
          <summary class="dim-card-head">
            <div class="dim-icon-wrap">
              <div class="dim-icon" style="color:${st.color}">${DIM_ICON[dim.icon] || I.shield}</div>
              <span class="dim-badge" style="background:${st.color}" aria-hidden="true"></span>
            </div>
            <div class="dch-main">
              <h3>${dim.title}</h3>
              <div class="dch-bar"><i style="width:${sc}%;background:${st.color}"></i></div>
            </div>
            <div class="dch-score"><b style="color:${st.color}">${sc}</b><small style="color:${st.color}">${st.label}</small></div>
            <span class="dch-chevron">${I.chevron}</span>
          </summary>
          <div class="dim-card-body">
            <p class="einordnung"><b>${einordnungText(st, hasOpenSignal)}</b> ${dim.intro}</p>
            ${dim.id === 'einfluss' ? metricsLine(results.metrics) : ''}
            ${fitnessTests}
            ${recsHTML}
          </div>
        </details>`;
    }).join('');

    // Atemübung – prominenter Hinweis, wenn Belastungssignale vorliegen
    const stressActive = results.signals.some((s) => s.id === 'hohe_belastung' || s.id === 'belastung');
    const stressHint = stressActive
      ? copy.get('ui.breathing.stress_hint')
      : '';
    const breathingSection = `
      <section class="section">
        <p class="section-title">${copy.get('ui.breathing.eyebrow')}</p>
        <h2>${copy.get('ui.breathing.title')}</h2>
        <p class="muted" style="margin-top:-6px">${copy.format('ui.breathing.description', { stressHint })}</p>
        <div class="card breathing-card">
          <div class="breathing-visual">
            <div class="breathing-circle"><span class="breathing-cue" role="status" aria-live="polite" aria-atomic="true">${copy.get('ui.breathing.cue.ready')}</span></div>
          </div>
          <div class="breathing-meta">
            <p class="breathing-count" data-breathing-count>${copy.get('ui.breathing.cycles.initial')}</p>
            <button class="btn btn-primary" type="button" data-action="breathe-toggle">${copy.get('ui.breathing.button.start')}</button>
            <p class="muted breathing-hint">${copy.get('ui.breathing.instructions')}</p>
          </div>
        </div>
      </section>`;

    // Chatbot-Mockup – kennt den echten Kontext, antwortet mit Beispielen (keine Daten verlassen das Gerät)
    const chips = window.Coach.suggestedPrompts(botCtx)
      .map((c) => `<button type="button" class="chat-chip" data-chat-q="${escAttr(c)}">${escHtml(c)}</button>`)
      .join('');
    const greeting = copy.format(hasActionPlan ? 'ui.chat.greeting' : 'ui.chat.greeting.empty', {
      overallScore: botCtx.overall,
      statusLabel: botCtx.statusLabel,
    });
    const chatSection = `
      <section class="section">
        <div class="chat-head">
          <p class="section-title" style="margin:0">${copy.get('ui.chat.eyebrow')}</p>
          <span class="chat-badge">${copy.get('ui.chat.badge')}</span>
        </div>
        <h2>${copy.get('ui.chat.title')}</h2>
        <p class="muted" style="margin-top:-6px">${copy.get('ui.chat.description')}</p>
        <div class="card chat-card">
          <div class="chat-log" data-chat-log role="log" aria-live="polite" aria-relevant="additions">
            <div class="chat-msg bot">
              <div class="chat-avatar">${I.spark}</div>
              <div class="chat-bubble">${greeting}</div>
            </div>
          </div>
          <div class="chat-chips">${chips}</div>
          <form class="chat-input" data-chat-form>
            <input type="text" data-chat-text placeholder="${escAttr(copy.get('ui.chat.input_placeholder'))}" aria-label="${escAttr(copy.get('ui.chat.input_placeholder'))}" autocomplete="off" maxlength="300">
            <button class="btn btn-primary" type="submit" aria-label="${escAttr(copy.get('ui.chat.send_aria'))}">${I.arrowR}</button>
          </form>
          <p class="chat-disclaimer">${I.info}<span>${copy.get('ui.chat.disclaimer')}</span></p>
        </div>
      </section>`;

    // Absprung zur Coach-App inkl. Vorschau der (nur mit Zustimmung) übergebenen Infos
    const focusTitles = fields.length
      ? new Intl.ListFormat(detectedLocale(), { style: 'long', type: 'conjunction' })
        .format([...new Set(fields.map((x) => x.dimTitle))])
      : copy.get('ui.coach_handoff.focus_fallback');
    const handoffPlanId = top3.length === 1 ? 'one' : (top3.length === 2 ? 'two' : (top3.length === 3 ? 'three' : 'empty'));
    const coachSection = `
      <section class="section">
        <div class="card coach-card">
          <div class="coach-card-head">
            <div class="coach-logo">${I.spark}</div>
            <div>
              <p class="section-title" style="margin:0">${copy.get('ui.coach_handoff.eyebrow')}</p>
              <h2 style="margin:2px 0 0">${copy.get('ui.coach_handoff.title')}</h2>
            </div>
          </div>
          <p>${copy.get('ui.coach_handoff.description')}</p>
          <div class="coach-handoff">
            <p class="coach-handoff-title">${I.lock}${copy.get('ui.coach_handoff.consent_title')}</p>
            <ul>
              <li>${copy.format('ui.coach_handoff.profile', { overallScore: overall, statusLabel: status.label })}</li>
              <li>${copy.format('ui.coach_handoff.focus', { focusTitles })}</li>
              <li>${copy.get('ui.coach_handoff.plan.' + handoffPlanId)}</li>
            </ul>
          </div>
          ${offerActionLinkHTML('coachApp', copy.get('ui.coach_handoff.cta'))}
          <p class="coach-note">${copy.get('ui.coach_handoff.note')}</p>
        </div>
      </section>`;

    app.innerHTML = `
      ${urgentBanner}
      <section class="result-hero fade-in">
        <div class="score-ring" style="--col:${status.color}" data-score="${overall}" role="img" aria-label="${escAttr(copy.format('ui.result.score_aria', { overallScore: overall }))}">
          <svg class="score-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-track" cx="60" cy="60" r="52" />
            <circle class="ring-fill" cx="60" cy="60" r="52" pathLength="100" />
          </svg>
          <div class="score-ring-center">
            <span class="score-val">0</span>
            <span class="score-max">${copy.get('ui.result.score_max')}</span>
          </div>
        </div>
        <div>
          <p class="section-title">${copy.get('ui.result.eyebrow')}</p>
          <h1>${copy.get('ui.result.title')}</h1>
          <span class="result-status-badge" style="background:${status.color}">${status.label}</span>
          ${customerContextChipHTML()}
          <p class="lead">${resultLeadHTML(results, top3.length)}</p>
        </div>
      </section>

      <section class="section">
        <div class="card radar-card fade-in">
          <div id="radar"></div>
          <div class="legend">
            ${window.Scoring.STATUS_BANDS.map((b) => `<span><i style="background:${b.color}"></i>${copy.format('ui.result.legend_item', {
              statusLabel: b.label,
              minimumScore: b.min,
            })}</span>`).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <p class="section-title">${copy.get('ui.overview.eyebrow')}</p>
        <h2>${copy.get('ui.overview.title')}</h2>
        <div class="signal-grid">
          <div class="card signal-box lifestyle">
            <h3>${I.spark} ${copy.get('ui.overview.strengths_title')}</h3>
            ${strengths.length ? `<ul class="insight-list">${strengths.map((x) => `<li><i class="insight-dot" style="background:${window.Scoring.statusForScore(results.scores[x.dim] ?? 50).color}"></i><div><b>${x.label}</b>${x.detail ? `<span class="insight-detail">${x.detail}</span>` : ''}</div></li>`).join('')}</ul>` : `<p class="muted">${copy.get('ui.overview.strengths_empty')}</p>`}
          </div>
          <div class="card signal-box medical">
            <h3>${I.list} ${copy.get('ui.overview.fields_title')}</h3>
            ${fields.length ? `<ul class="insight-list">${fields.map((x) => `<li><i class="insight-dot" style="background:${window.Scoring.statusForScore(results.scores[x.dim] ?? 50).color}"></i><div><b>${x.short}: ${x.label}</b>${x.detail ? `<span class="insight-detail">${x.detail}</span>` : ''}</div></li>`).join('')}</ul>` : `<p class="muted">${copy.get('ui.overview.fields_empty')}</p>`}
          </div>
        </div>
      </section>

      <section class="section">
        <p class="section-title">${copy.get('ui.action_plan.eyebrow')}</p>
        <h2>${actionPlanHeading}</h2>
        <p class="muted" style="margin-top:-6px">${actionPlanIntro}</p>
        <span class="plan-total-badge" data-plan-total></span>
        ${actionPlanBody}
      </section>

      ${breathingSection}

      <section class="section">
        <p class="section-title">${copy.get('ui.details.eyebrow')}</p>
        <h2>${copy.get('ui.details.title')}</h2>
        <p class="muted" style="margin-top:-6px">${copy.get('ui.details.description')}</p>
        <div class="dim-list">${detailHTML}</div>
      </section>

      ${chatSection}

      <section class="section">
        <div class="card med-block">
          <h2 style="display:flex;align-items:center;gap:10px">${I.stethoscope} ${copy.get('ui.medical_notice.title')}</h2>
          <p>${copy.get('ui.medical_notice.disclaimer')}</p>
          <p style="margin-bottom:6px"><b>${copy.get('ui.medical_notice.steps_title')}</b></p>
          <ul>
            <li>${copy.get('ui.medical_notice.step.discuss')}</li>
            <li>${copy.get('ui.medical_notice.step.measure')}</li>
            <li>${copy.get('ui.medical_notice.step.choose')}</li>
            <li>${copy.get('ui.medical_notice.step.emergency')}</li>
          </ul>
        </div>
      </section>

      <section class="contact-teaser">
        <div class="contact-card">
          <h2>${copy.get('ui.contact.title')}</h2>
          <div class="contact-phone-row">
            ${I.stethoscope}
            <div>
              <a class="contact-phone" href="tel:+41583401569">${copy.get('ui.contact.phone')}</a>
              <p class="contact-hint">${copy.get('ui.contact.availability_legal')}</p>
            </div>
          </div>
          <a class="action-link" href="tel:+41583401569">${I.arrowR}<span>${copy.get('ui.contact.cta')}</span></a>
        </div>
      </section>

      <section class="section">
        <div class="card promo-card">
          <h2>${copy.get('ui.promo.title')}</h2>
          <p>${copy.get('ui.promo.description')}</p>
          ${offerActionLinkHTML('plusEntdecken')}
        </div>
      </section>

      ${coachSection}

      <section class="section feedback-block">
        <p class="section-title">${copy.get('ui.feedback.eyebrow')}</p>
        <h2>${copy.get('ui.feedback.title')}</h2>
        <p class="muted" style="margin-top:-6px">${copy.get('ui.feedback.description')}</p>
        ${offerActionLinkHTML('feedback')}
      </section>

      <div class="results-edit-link">
        <button class="btn btn-ghost" data-action="edit">${I.arrowL} ${copy.get('ui.result_action.edit')}</button>
      </div>

      <div class="results-actions">
        ${config.resultLinkEnabled && resultLinkBaseUrl() ? `<button class="btn btn-primary" data-action="savelink">${I.link} ${copy.get('ui.result_action.save_link')}</button>` : ''}
        <button class="btn btn-secondary" data-action="restart">${I.refresh} ${copy.get('ui.result_action.restart')}</button>
      </div>
    `;

    // Radar zeichnen
    const radarEl = document.getElementById('radar');
    window.Radar.renderRadar(radarEl, dims.map((d) => ({ id: d.id, short: d.short })), results.scores, statusFn);

    // Score-Ring animieren (Ring füllt sich + Zahl zählt hoch)
    animateScoreRing();

    // Radar-Labels: Klick öffnet Detail
    radarEl.querySelectorAll('.radar-label').forEach((g) => {
      const open = () => {
        const d = document.getElementById('detail-' + g.dataset.dim);
        if (d) {
          d.open = true;
          const summary = d.querySelector('summary');
          if (summary) {
            try { summary.focus({ preventScroll: true }); } catch (error) { summary.focus(); }
          }
          d.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
        }
      };
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });

    // Interaktive Ergebnis-Module aufsetzen
    setupBreathing();
    setupChat(botCtx);
    updatePlanTotal();
  }

  /* -------------------------------------------------- Plan progress ------ */
  function updatePlanTotal() {
    const el = app.querySelector('[data-plan-total]');
    if (!el) return;
    const items = app.querySelectorAll('[data-plan-item]');
    if (!items.length) { el.textContent = ''; el.classList.remove('has-progress'); return; }
    const done = Array.prototype.filter.call(items, (x) => x.checked).length;
    el.textContent = done ? copy.format('ui.action_plan.total_progress', { done, total: items.length }) : '';
    el.classList.toggle('has-progress', done > 0);
  }

  /* -------------------------------------------------- Atemübung ---------- */
  function setupBreathing() {
    if (breathingCtl) { breathingCtl.stop(); breathingCtl = null; }
    const btn = app.querySelector('[data-action="breathe-toggle"]');
    const circle = app.querySelector('.breathing-circle');
    const cue = app.querySelector('.breathing-cue');
    const countEl = app.querySelector('[data-breathing-count]');
    if (!btn || !circle) return;

    const phases = [
      { name: copy.get('ui.breathing.cue.inhale'), ms: 4000, cls: 'inhale' },
      { name: copy.get('ui.breathing.cue.hold'), ms: 7000, cls: 'hold' },
      { name: copy.get('ui.breathing.cue.exhale'), ms: 8000, cls: 'exhale' },
    ];
    let running = false, timer = null, pi = 0, cycles = 0;

    function step() {
      const p = phases[pi];
      if (cue) cue.textContent = p.name;
      circle.classList.remove('inhale', 'hold', 'exhale');
      circle.classList.add(p.cls);
      timer = setTimeout(() => {
        pi = (pi + 1) % phases.length;
        if (pi === 0) {
          cycles++;
          if (countEl) countEl.textContent = copy.format(
            cycles === 1 ? 'ui.breathing.cycles.one' : 'ui.breathing.cycles.multiple',
            { cycleCount: cycles }
          );
        }
        if (running) step();
      }, p.ms);
    }
    function start() { running = true; pi = 0; btn.textContent = copy.get('ui.breathing.button.stop'); step(); }
    function stop() {
      running = false; clearTimeout(timer);
      if (btn) btn.textContent = copy.get('ui.breathing.button.start');
      if (cue) cue.textContent = copy.get('ui.breathing.cue.ready');
      circle.classList.remove('inhale', 'hold', 'exhale');
    }
    btn.addEventListener('click', () => { if (running) stop(); else start(); });
    breathingCtl = { stop };
  }

  /* -------------------------------------------------- Chatbot (Mockup) --- */
  function setupChat(botCtx) {
    if (chatCtl) { chatCtl.stop(); chatCtl = null; }
    const form = app.querySelector('[data-chat-form]');
    const log = app.querySelector('[data-chat-log]');
    const input = app.querySelector('[data-chat-text]');
    if (!form || !log) return;
    const timers = new Set();
    let active = true;

    function scrollLog() { log.scrollTop = log.scrollHeight; }
    function addUser(text) {
      const row = document.createElement('div');
      row.className = 'chat-msg user';
      const b = document.createElement('div');
      b.className = 'chat-bubble';
      b.textContent = text; // Nutzereingabe bewusst als Text (kein HTML) einsetzen
      row.appendChild(b);
      log.appendChild(row); scrollLog();
    }
    function addBot(html) {
      const row = document.createElement('div');
      row.className = 'chat-msg bot';
      row.innerHTML = `<div class="chat-avatar">${I.spark}</div><div class="chat-bubble">${html}</div>`;
      log.appendChild(row); scrollLog();
    }
    function typing() {
      const row = document.createElement('div');
      row.className = 'chat-msg bot chat-typing';
      row.innerHTML = `<div class="chat-avatar">${I.spark}</div><div class="chat-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
      log.appendChild(row); scrollLog();
      return row;
    }
    function ask(text) {
      const t = (text || '').trim();
      if (!t) return;
      addUser(t);
      const tp = typing();
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!active) return;
        tp.remove();
        addBot(window.Coach.mockAnswer(t, botCtx));
      }, 500);
      timers.add(timer);
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ask(input.value); input.value = ''; input.focus();
    });
    app.querySelectorAll('[data-chat-q]').forEach((chip) => {
      chip.addEventListener('click', () => ask(chip.dataset.chatQ));
    });
    chatCtl = {
      stop() {
        active = false;
        timers.forEach((timer) => clearTimeout(timer));
        timers.clear();
      },
    };
  }

  /* -------------------------------------------------- Score ring anim ---- */
  function animateScoreRing() {
    if (scoreAnimationCtl) { scoreAnimationCtl.stop(); scoreAnimationCtl = null; }
    const ring = document.querySelector('.score-ring');
    if (!ring) return;
    const score = Math.max(0, Math.min(100, Number(ring.dataset.score) || 0));
    const fill = ring.querySelector('.ring-fill');
    const valEl = ring.querySelector('.score-val');

    if (prefersReducedMotion()) {
      if (fill) fill.style.strokeDashoffset = String(100 - score);
      if (valEl) valEl.textContent = String(score);
      return;
    }

    let active = true;
    const frames = new Set();
    const frame = (callback) => {
      const id = requestAnimationFrame((now) => {
        frames.delete(id);
        if (active) callback(now);
      });
      frames.add(id);
    };
    scoreAnimationCtl = {
      stop() {
        active = false;
        frames.forEach((id) => cancelAnimationFrame(id));
        frames.clear();
      },
    };

    // Ring von 0 auf Zielwert füllen (stroke-dashoffset via Transition)
    if (fill) {
      fill.style.strokeDashoffset = '100';
      frame(() => frame(() => {
        fill.style.strokeDashoffset = String(100 - score);
      }));
    }

    // Zahl hochzählen, synchron zur Ringfüllung
    if (valEl) {
      const dur = 1200;
      const start = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        valEl.textContent = String(Math.round(ease(p) * score));
        if (p < 1) frame(tick);
        else valEl.textContent = String(score);
      };
      frame(tick);
    }
  }

  /* -------------------------------------------------- Render dispatch ---- */
  function render() {
    cleanupInteractive();
    try {
      delete app.dataset.renderError;
      document.body.dataset.screen = state.screen;
      if (state.screen === 'start') renderStart();
      else if (state.screen === 'quiz') renderQuiz();
      else renderResults();
    } catch (error) {
      reportStaticFailure(error);
      showStaticFailure();
    }
  }

  /* -------------------------------------------------- Events ------------- */
  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;

    switch (action) {
      case 'start': go('quiz'); break;
      case 'restart':
        showModal({
          title: copy.get('ui.result_action.restart_modal.title'),
          message: copy.get('ui.result_action.restart_confirm'),
          confirmText: copy.get('ui.result_action.restart_modal.continue'),
          cancelText: copy.get('ui.result_action.home_modal.restart'),
        }).then((choice) => {
          // Die hervorgehobene Aktion und jeder Abbruch behalten den Fortschritt.
          if (choice === 'cancel') { reset(); go('start'); }
        });
        break;
      case 'opt': handleOption(t); break;
      case 'back':
        if (state.dimIndex === 0) { go('start'); }
        else { state.dimIndex--; save(); renderQuiz(); focusCurrentView(); }
        break;
      case 'next': handleNext(); break;
      case 'goto': {
        const idx = Number(t.dataset.idx);
        if (idx <= state.maxReached) { state.dimIndex = idx; save(); renderQuiz(); focusCurrentView(); }
        break;
      }
      case 'edit': clearShareHash(); state.dimIndex = 0; go('quiz'); break;
      case 'savelink': if (config.resultLinkEnabled) shareResultLink(); break;
    }
  });

  app.addEventListener('input', (e) => {
    const t = e.target.closest('[data-action="num"]');
    if (!t) return;
    clearShareHash();
    const id = t.dataset.q;
    const val = t.value.trim();
    if (val === '') delete state.answers[id]; else state.answers[id] = val;
    const q = (window.DIMENSIONS || [])
      .flatMap((dim) => dim.questions || [])
      .find((question) => question.id === id);
    const invalid = numberInputInvalid(q, val);
    t.setAttribute('aria-invalid', String(invalid));
    const wrap = t.closest('[data-qwrap]');
    const error = wrap && wrap.querySelector('[data-number-error]');
    if (error) error.hidden = !invalid;
    save();
    updateNextState();
  });

  // 4-Wochen-Plan: Abhaken persistieren (bleibt auf dem Gerät)
  app.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-plan-item]');
    if (!cb) return;
    const id = cb.dataset.planItem;
    if (cb.checked) planStore[id] = true; else delete planStore[id];
    savePlan();
    const recId = id.slice(0, id.lastIndexOf('-'));
    const prog = app.querySelector(`[data-plan-progress="${recId}"]`);
    if (prog) {
      const items = app.querySelectorAll(`[data-plan-item^="${recId}-"]`);
      const done = Array.prototype.filter.call(items, (x) => x.checked).length;
      prog.textContent = copy.format('ui.action_card.progress', { done, total: items.length });
    }
    updatePlanTotal();
  });

  function handleOption(btn) {
    const id = btn.dataset.q;
    const type = btn.dataset.type;
    const value = btn.dataset.value;
    clearShareHash();

    if (type === 'single') {
      state.answers[id] = value;
    } else {
      let arr = Array.isArray(state.answers[id]) ? state.answers[id].slice() : [];
      const exclusive = btn.dataset.exclusive === '1';
      if (exclusive) {
        arr = arr.includes(value) ? [] : [value];
      } else {
        arr = arr.filter((v) => v !== 'keine'); // andere Auswahl hebt "keine" auf
        if (arr.includes(value)) arr = arr.filter((v) => v !== value); else arr.push(value);
      }
      state.answers[id] = arr;
    }
    save();

    // DOM der betroffenen Frage aktualisieren (ohne Komplett-Rerender)
    const wrap = document.querySelector(`[data-qwrap="${id}"]`);
    if (wrap) {
      wrap.querySelectorAll('.option').forEach((opt) => {
        const v = state.answers[id];
        const pressed = type === 'multi' ? (Array.isArray(v) && v.includes(opt.dataset.value)) : v === opt.dataset.value;
        opt.setAttribute('aria-checked', pressed);
      });
    }
    updateNextState();
  }

  function handleNext() {
    const dims = window.DIMENSIONS;
    const dim = dims[state.dimIndex];
    if (!dimValid(dim)) {
      const hint = document.getElementById('nav-hint');
      if (hint) hint.hidden = false;
      return;
    }
    if (state.dimIndex === dims.length - 1) {
      state.maxReached = dims.length - 1;
      save(); go('results');
    } else {
      state.dimIndex++;
      state.maxReached = Math.max(state.maxReached, state.dimIndex);
      save(); renderQuiz(); focusCurrentView();
    }
  }

  /* -------------------------------------------------- Modal -------------- */
  function trapFocus(root, event) {
    const focusable = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  function showModal({ title, message, confirmText, cancelText }) {
    return new Promise((resolve) => {
      const opener = document.activeElement;
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      back.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h2 id="modal-title">${title}</h2>
          <p>${message}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-modal="cancel">${cancelText}</button>
            <button class="btn btn-primary" data-modal="confirm">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(back);
      requestAnimationFrame(() => back.classList.add('open'));
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey);
        back.classList.remove('open');
        setTimeout(() => back.remove(), 180);
        if (opener && typeof opener.focus === 'function') {
          try { opener.focus(); } catch (e) {}
        }
        resolve(val);
      };
      function onKey(event) {
        if (event.key === 'Escape') done('dismiss');
        else if (event.key === 'Tab') trapFocus(back, event);
      }
      back.addEventListener('click', (e) => {
        if (e.target === back) done('dismiss');
        else if (e.target.closest('[data-modal="cancel"]')) done('cancel');
        else if (e.target.closest('[data-modal="confirm"]')) done('confirm');
      });
      document.addEventListener('keydown', onKey);
      const cBtn = back.querySelector('[data-modal="confirm"]'); if (cBtn) cBtn.focus();
    });
  }

  /* -------------------------------------------------- Logo -> Home ------- */
  const brandLink = document.querySelector('.site-header .brand');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      const hasProgress = Object.keys(state.answers).length > 0;
      if (state.screen !== 'start' && hasProgress) {
        showModal({
          title: copy.get('ui.result_action.home_modal.title'),
          message: copy.get('ui.result_action.home_modal.message'),
          confirmText: copy.get('ui.result_action.home_modal.keep'),
          cancelText: copy.get('ui.result_action.home_modal.restart'),
        }).then((choice) => {
          // Escape und Backdrop sind ein Abbruch, niemals eine Löschbestätigung.
          if (choice === 'dismiss') return;
          if (choice === 'cancel') reset();
          go('start');
        });
      } else {
        go('start');
      }
    });
  }

  /* -------------------------------------------------- Share / Permalink -- */
  function resultLinkLocale() {
    const localeApi = window.HealthLocale;
    if (!localeApi || typeof localeApi.normalize !== 'function') return null;
    try {
      const raw = typeof localeApi.getLocale === 'function'
        ? localeApi.getLocale()
        : localeApi.current;
      const normalized = localeApi.normalize(raw);
      const supported = Array.isArray(localeApi.supported) ? localeApi.supported : [];
      return normalized && (!supported.length || supported.includes(normalized)) ? normalized : null;
    } catch (error) { return null; }
  }

  function cleanResultLinkBase(parsed) {
    parsed.search = '';
    parsed.hash = '';
    const locale = resultLinkLocale();
    if (locale) parsed.searchParams.set('lang', locale);
    return parsed;
  }

  function resultLinkBaseUrl() {
    const configured = safeHttps(config.resultLinkBaseUrl);
    if (configured) {
      return cleanResultLinkBase(new URL(configured)).href;
    }
    try {
      const current = cleanResultLinkBase(new URL(location.href));
      // Die Standalone-Demo darf einen lokalen, gerätegebundenen Speicherlink
      // erzeugen. Live/anonymous benötigen weiterhin HTTPS oder eine konfigurierte
      // kanonische HTTPS-Basis und geben niemals einen lokalen Dateipfad aus.
      // Sämtliche Query-Werte ausser dem von HealthLocale validierten `lang`
      // werden bewusst entfernt, damit keine Host-Secrets geteilt werden.
      if (current.protocol === 'file:' && config.integrationMode === 'mock') return current.href;
      return safeHttps(current.href);
    } catch (error) { return null; }
  }
  function clearShareHash() {
    sharedResultActive = false;
    if (/[#&]r=/.test(location.hash)) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }
  }
  function restoreFromHash() {
    if (config.resultLinkImportEnabled === false) {
      clearShareHash();
      return false;
    }
    const m = location.hash.match(/[#&]r=([^&]+)/);
    if (!m) return false;
    const decoded = persistence.decodeAnswers(m[1]);
    const ans = sanitizeAnswers(decoded);
    if (!decoded || !answersComplete(ans)) {
      clearShareHash();
      return false;
    }
    const dims = window.DIMENSIONS || [];
    state.answers = ans;
    state.dimIndex = 0;
    state.maxReached = Math.max(0, dims.length - 1);
    state.screen = 'results';
    sharedResultActive = true;
    // Ein fremder Ergebnis-Link darf den eigenen lokalen Stand nicht
    // überschreiben. Erst eine aktive Bearbeitung speichert wieder.
    return true;
  }
  function shareResultLink() {
    const baseUrl = resultLinkBaseUrl();
    if (!baseUrl) return;
    const url = baseUrl + '#r=' + persistence.encodeAnswers(state.answers);
    // Erst informieren, dann nur auf einen expliziten Klick hin kopieren.
    showLinkModal(url);
  }
  function showLinkModal(url) {
    const localFileLink = url.startsWith('file:');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="lm-title">
        <h2 id="lm-title">${copy.get('ui.share_modal.title')}</h2>
        <p>${copy.get('ui.share_modal.description')}</p>
        ${localFileLink ? `<p class="muted link-local-warning">${copy.get('ui.share_modal.local_file_warning')}</p>` : ''}
        <div class="link-field">
          <input type="text" readonly value="${escAttr(url)}" aria-label="${escAttr(copy.get('ui.share_modal.input_aria'))}" />
          <button class="btn btn-primary" data-modal="copy" type="button">${copy.get('ui.share_modal.copy')}</button>
        </div>
        <p class="link-status" data-status role="status" aria-live="polite" aria-atomic="true">${copy.get('ui.share_modal.status.prompt')}</p>
        <p class="muted" style="font-size:13px;margin:8px 0 0">${copy.get('ui.share_modal.privacy_warning')}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal="close" type="button">${copy.get('ui.share_modal.close')}</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('open'));
    const input = back.querySelector('input');
    const status = back.querySelector('[data-status]');
    const opener = document.activeElement;
    let closed = false;
    let focusTimer = null;
    const close = () => {
      if (closed) return;
      closed = true;
      if (focusTimer) clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      back.classList.remove('open');
      setTimeout(() => back.remove(), 180);
      if (opener && typeof opener.focus === 'function') {
        try { opener.focus(); } catch (e) {}
      }
    };
    function onKey(event) {
      if (event.key === 'Escape') close();
      else if (event.key === 'Tab') trapFocus(back, event);
    }
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', async (e) => {
      if (e.target === back || e.target.closest('[data-modal="close"]')) { close(); return; }
      if (e.target.closest('[data-modal="copy"]')) {
        input.focus(); input.select();
        let ok = false;
        try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); ok = true; } } catch (e) {}
        if (!ok) { try { ok = document.execCommand('copy'); } catch (e) {} }
        if (status) status.textContent = copy.get(ok ? 'ui.share_modal.status.copied' : 'ui.share_modal.status.manual');
      }
    });
    focusTimer = setTimeout(() => {
      if (!closed) { input.focus(); input.select(); }
    }, 60);
  }

  /* -------------------------------------------------- Init --------------- */
  load();
  loadPlan();
  const restoredSharedResult = restoreFromHash();
  if (!restoredSharedResult && window.HealthLocale && typeof window.HealthLocale.consumeReturnView === 'function') {
    const returnView = window.HealthLocale.consumeReturnView();
    if (returnView === 'results' && answersComplete(state.answers)) state.screen = 'results';
    else if (returnView === 'quiz' && Object.keys(state.answers).length > 0) state.screen = 'quiz';
  }
  render();

  // Kundenkontext kann asynchron eintreffen. Nur die beiden kundenspezifischen
  // UI-Fragmente aktualisieren: Chat, offene Details, Fokus und Atemübung bleiben
  // dadurch bei Login/Logout unverändert.
  window.addEventListener('helsana:customer-context', () => {
    if (state.screen === 'results') refreshCustomerContextPresentation();
  });

  window.addEventListener('pagehide', (event) => {
    // Im Back/Forward-Cache bleibt dieselbe DOM samt Listenern erhalten; der
    // Browser pausiert dort Timer selbst. Nur bei echtem Verlassen aufräumen.
    if (!event.persisted) cleanupInteractive();
  });
  } catch (error) {
    reportStaticFailure(error);
    showStaticFailure();
  }
})();
