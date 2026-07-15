/*
 * coach.js
 * ---------------------------------------------------------------------------
 * "Coach"-Bausteine für die Ergebnisseite – inspiriert von der Coach-App-
 * Weiterentwicklung (kontextbewusster Begleiter, kleine Umsetzungspläne,
 * Techniken, Absprung zur Coach-App). Ansprache in der Sie-Form.
 *
 *  - weekPlan(rec)               kleiner 4-Wochen-Umsetzungsplan zu einer Empfehlung
 *  - botContext(results, top3)   kompakter, anonymer Gesundheitskontext für den Bot
 *  - suggestedPrompts(ctx)       Vorschlags-Chips, aus dem eigenen Kontext abgeleitet
 *  - mockAnswer(text, ctx)       regelbasierte Beispielantworten (Demo, OHNE LLM)
 *
 * WICHTIG: Alles läuft rein clientseitig. Es werden KEINE Daten gesendet – der
 * Chat ist eine Konzept-Vorschau mit Beispielantworten. Ein echter Coach
 * benötigt eine separat freigegebene Zielarchitektur, Datenschutzprüfung und
 * eine ausdrückliche Einwilligung; dieses Modul trifft keine Anbieterentscheidung.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  const copy = window.ResultCopy;

  const INTENT_LEXICONS = Object.freeze({
    de: Object.freeze({
      emergency: ['notfall', 'akut', 'brust ', 'brustschmerz', 'atemnot', 'luftnot', 'keine luft', 'herzinfarkt', 'schlaganfall', 'bewusstlos', 'starke blutung', 'suizid', 'selbstmord', 'selbstverletz', 'nicht mehr leben', '144', '143'],
      score: ['score', 'gesamt', 'punkte', 'wie stehe', 'wie gut'],
      firstStep: ['fang', 'anfang', 'starten', 'zuerst', 'beginn', 'erst'],
      breathing: ['atem', 'stress', 'entspann', 'runter', 'ruhe', 'anspannung', 'burnout', 'überforder', 'ueberforder'],
      sleep: ['schlaf', 'müde', 'muede', 'einschlaf', 'schlecht schlaf'],
      protein: ['protein', 'eiweiss', 'eiweiß'],
      fitness: ['beweg', 'sport', 'trainier', 'laufen', 'schritte', 'fitness', 'kraft'],
      nutrition: ['ernähr', 'ernaehr', 'essen', 'abnehm', 'gewicht', 'diät', 'diaet'],
      medicalValues: ['blutdruck', 'cholesterin', 'blutzucker', 'labor', 'mein wert', 'werte'],
      coach: ['coach', 'app', 'begleit', 'weiter'],
      improve: ['verbesser', 'besser werden'],
    }),
    en: Object.freeze({
      emergency: ['emergency', 'acute', 'chest pain', 'shortness of breath', 'cannot breathe', "can't breathe", 'heart attack', 'stroke', 'unconscious', 'severe bleeding', 'suicide', 'suicidal', 'self-harm', "don't want to live", '144', '143'],
      score: ['score', 'overall', 'points', 'how am i doing', 'how good'],
      firstStep: ['start', 'begin', 'first', 'where do i start'],
      breathing: ['breath', 'stress', 'relax', 'calm', 'tension', 'burnout', 'overwhelm'],
      sleep: ['sleep', 'tired', 'fall asleep', 'sleeping badly'],
      protein: ['protein'],
      fitness: ['move', 'exercise', 'sport', 'train', 'run', 'steps', 'fitness', 'strength'],
      nutrition: ['nutrition', 'food', 'eat', 'weight loss', 'weight', 'diet'],
      medicalValues: ['blood pressure', 'cholesterol', 'blood sugar', 'laboratory', 'lab result', 'my value', 'my values'],
      coach: ['coach', 'app', 'support', 'continue'],
      improve: ['improve', 'get better'],
    }),
    fr: Object.freeze({
      emergency: ['urgence', 'aigu', 'douleur thoracique', 'douleur à la poitrine', 'difficulté respiratoire', 'essoufflement', "n'arrive pas à respirer", 'infarctus', 'crise cardiaque', 'avc', 'inconscient', 'hémorragie', 'suicide', 'suicidaire', 'automutilation', 'ne plus vivre', '144', '143'],
      score: ['score', 'total', 'points', 'où en suis', 'résultat'],
      firstStep: ['commencer', 'début', 'premier', 'par quoi commencer'],
      breathing: ['respir', 'stress', 'détendre', 'calme', 'tension', 'burn-out', 'épuis', 'débord'],
      sleep: ['sommeil', 'dormir', 'fatigu', 'endormir', 'dors mal'],
      protein: ['protéine'],
      fitness: ['bouger', 'mouvement', 'exercice', 'sport', 'entraîn', 'courir', 'pas', 'fitness', 'force'],
      nutrition: ['nutrition', 'alimentation', 'manger', 'maigrir', 'poids', 'régime'],
      medicalValues: ['tension artérielle', 'pression artérielle', 'cholestérol', 'glycémie', 'laboratoire', 'ma valeur', 'mes valeurs'],
      coach: ['coach', 'app', 'accompagn', 'continuer'],
      improve: ['amélior', 'progresser'],
    }),
    it: Object.freeze({
      emergency: ['emergenza', 'acuto', 'dolore al petto', 'dolore toracico', 'difficoltà respiratoria', 'fiato corto', 'non riesco a respirare', 'infarto', 'ictus', 'incosciente', 'emorragia', 'suicidio', 'suicida', 'autolesionismo', 'non voglio vivere', '144', '143'],
      score: ['punteggio', 'totale', 'punti', 'come sto andando', 'risultato'],
      firstStep: ['iniziare', 'cominciare', 'primo', 'da dove comincio'],
      breathing: ['respir', 'stress', 'rilass', 'calma', 'tensione', 'burnout', 'esaur', 'sopraffatt'],
      sleep: ['sonno', 'dormire', 'stanc', 'addorment', 'dormo male'],
      protein: ['proteina', 'proteine'],
      fitness: ['muover', 'movimento', 'esercizio', 'sport', 'allen', 'correre', 'passi', 'fitness', 'forza'],
      nutrition: ['nutrizione', 'alimentazione', 'mangiare', 'dimagrire', 'peso', 'dieta'],
      medicalValues: ['pressione sanguigna', 'pressione arteriosa', 'colesterolo', 'glicemia', 'laboratorio', 'mio valore', 'miei valori'],
      coach: ['coach', 'app', 'accompagn', 'continuare'],
      improve: ['miglior', 'progredire'],
    }),
  });

  function activeLanguage() {
    const localeApi = window.HealthLocale;
    let locale = null;
    try {
      locale = localeApi && typeof localeApi.getLocale === 'function'
        ? localeApi.getLocale()
        : (localeApi && localeApi.current);
      if (localeApi && typeof localeApi.normalize === 'function') locale = localeApi.normalize(locale);
    } catch (error) { locale = null; }
    if (!locale && window.__RESULT_COPY_BUNDLE__) locale = window.__RESULT_COPY_BUNDLE__.locale;
    const language = String(locale || 'de-CH').toLowerCase().split('-')[0];
    return Object.prototype.hasOwnProperty.call(INTENT_LEXICONS, language) ? language : 'de';
  }

  /* ---------- Phase 1: kleiner Umsetzungsplan pro Empfehlung ---------- */
  // Jede Empfehlung bringt ihren konkreten, teils antwortabhängigen 4-Wochen-Plan
  // aus js/recommendations.js mit (zentrale Quelle: PLANS + withPlan). Pläne können
  // pro Schritt einen internen Angebots-Link (link) oder eine externe Fachquelle
  // (sourceRef) tragen.
  //
  // Der Block unten ist ein rein DEFENSIVER Minimal-Fallback: Er greift nur, falls
  // versehentlich eine Empfehlung ohne eigenen Plan ins System kommt, und baut dann
  // wenigstens aus dem konkreten Startschritt (rec.step) einen sinnvollen ersten
  // Schritt. Im Normalbetrieb wird er nie erreicht (durch Test abgesichert).
  function weekPlan(rec) {
    if (rec && Array.isArray(rec.plan) && rec.plan.length) {
      return rec.plan.map((p) => ({
        label: p.label,
        text: p.text,
        link: p.link || null,           // internes Helsana-Angebot (HELSANA_OFFERS-Key)
        sourceRef: p.sourceRef || null, // externe Fachquelle { label, href }
        retests: Array.isArray(p.retests) ? p.retests.map((item) => ({
          id: item.id,
          text: item.text,
          caution: !!item.caution,
        })) : [],
      }));
    }
    // Defensiver Fallback (sollte nicht auftreten – jede Karte hat einen Plan).
    return [
      {
        label: copy.get('coach.week_plan.fallback.label.this_week'),
        text: rec && rec.step ? rec.step : copy.get('coach.week_plan.fallback.step.this_week'),
      },
      {
        label: copy.get('coach.week_plan.fallback.label.weeks_two_three'),
        text: copy.get('coach.week_plan.fallback.step.weeks_two_three'),
      },
      {
        label: copy.get('coach.week_plan.fallback.label.week_four'),
        text: copy.get('coach.week_plan.fallback.step.week_four'),
      },
    ];
  }

  /* ---------- Phase 2: Kontext für den (Mock-)Chatbot ---------- */
  // Bewusst anonym: nur Scores, Status, Signale und die Top-Schritte – keine
  // Rohdaten wie Grösse/Gewicht, kein Name (wird ohnehin nicht erhoben).
  // Berücksichtigt nur die bewerteten Dimensionen (ohne Grundinformation).
  function botContext(results, top3) {
    const dims = (typeof window !== 'undefined' && (window.SCORED_DIMENSIONS || window.DIMENSIONS)) || [];
    const byId = {};
    const list = dims.map((d) => {
      const score = results.scores[d.id];
      byId[d.id] = { id: d.id, title: d.title, score: score };
      return { id: d.id, title: d.title, score: score };
    });
    const sorted = list.slice().sort((a, b) => a.score - b.score);
    return {
      overall: results.overall,
      statusLabel: results.status.label,
      byId: byId,
      weakest: sorted[0] || null,
      strongest: sorted[sorted.length - 1] || null,
      signals: (results.signals || []).map((s) => s.id),
      top: (top3 || []).map((r) => ({ title: r.title, step: r.step, dim: r.dim })),
    };
  }

  function scoreFor(ctx, id) {
    return ctx.byId[id] ? ctx.byId[id].score + '/100' : copy.get('coach.context.score_unknown');
  }

  function suggestedPrompts(ctx) {
    const chips = [copy.get('coach.prompt.overall_score')];
    if (ctx.top && ctx.top[0]) chips.push(copy.get('coach.prompt.first_step'));
    if (ctx.weakest) chips.push(copy.format('coach.prompt.improve_dimension', { dimensionTitle: ctx.weakest.title }));
    if (ctx.signals.indexOf('hohe_belastung') !== -1 || ctx.signals.indexOf('belastung') !== -1)
      chips.push(copy.get('coach.prompt.breathing'));
    chips.push(copy.get('coach.prompt.coach_app'));
    return chips.slice(0, 5);
  }

  function improveDim(ctx, dim) {
    const rec = (ctx.top || []).filter((t) => t.dim === dim.id)[0];
    if (rec)
      return copy.format('coach.improve_dimension.with_recommendation', {
        dimensionTitle: dim.title,
        recommendationStep: rec.step,
      });
    return copy.format('coach.improve_dimension.without_recommendation', {
      dimensionTitle: dim.title,
      dimensionScore: dim.score,
    });
  }

  // Regelbasierte Beispielantworten. Gibt fertiges (sicheres) HTML zurück –
  // es wird KEIN Nutzertext in dieses HTML eingesetzt.
  function mockAnswer(text, ctx) {
    const q = (text || '').toLowerCase();
    const w = ctx.weakest || { id: '', title: copy.get('coach.context.weakest_title_fallback'), score: 0 };
    const s = ctx.strongest || { title: copy.get('coach.context.strongest_title_fallback'), score: 0 };
    const first = ctx.top && ctx.top[0];
    const hasIntent = function (intent, allLanguages) {
      const languages = allLanguages ? Object.keys(INTENT_LEXICONS) : [activeLanguage()];
      return languages.some((language) => (INTENT_LEXICONS[language][intent] || [])
        .some((keyword) => q.indexOf(keyword) !== -1));
    };

    // Akute Begriffe immer vor Stress-/Atemübungsrouten prüfen. Dies ist keine
    // Diagnose, sondern leitet konservativ auf den bestehenden Notfallhinweis.
    if (hasIntent('emergency', true))
      return copy.get('coach.answer.emergency');

    if (hasIntent('score'))
      return copy.format('coach.answer.overall_score', {
        overallScore: ctx.overall,
        statusLabel: ctx.statusLabel,
        strongestTitle: s.title,
        strongestScore: s.score,
        weakestTitle: w.title,
        weakestScore: w.score,
      });

    if (hasIntent('firstStep'))
      return first
        ? copy.format('coach.answer.first_step.with_plan', {
          recommendationTitle: first.title,
          recommendationStep: first.step,
        })
        : copy.get('coach.answer.first_step.without_plan');

    if (hasIntent('breathing'))
      return copy.get('coach.answer.breathing');

    if (hasIntent('sleep'))
      return copy.format('coach.answer.sleep', { sleepScore: scoreFor(ctx, 'schlaf') });

    // Vor der allgemeinen Fitnessroute prüfen, damit «Protein beim Krafttraining»
    // nicht fälschlich nur eine Bewegungsantwort erhält.
    if (hasIntent('protein'))
      return copy.get('coach.answer.protein');

    if (hasIntent('fitness'))
      return copy.format('coach.answer.fitness', { fitnessScore: scoreFor(ctx, 'fitness') });

    if (hasIntent('nutrition'))
      return copy.format('coach.answer.nutrition', { nutritionScore: scoreFor(ctx, 'ernaehrung') });

    if (hasIntent('medicalValues'))
      return copy.get('coach.answer.medical_values');

    if (hasIntent('coach'))
      return copy.get('coach.answer.coach_app');

    if (hasIntent('improve') || (w.title && q.indexOf(w.title.toLowerCase()) !== -1))
      return improveDim(ctx, w);

    return copy.format('coach.answer.fallback', {
      weakestTitle: w.title,
      weakestScore: w.score,
    });
  }

  if (typeof window !== 'undefined') {
    window.Coach = Object.freeze({ weekPlan, botContext, suggestedPrompts, mockAnswer });
  }
})();
