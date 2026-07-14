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
    const has = function () {
      for (var i = 0; i < arguments.length; i++) if (q.indexOf(arguments[i]) !== -1) return true;
      return false;
    };

    // Akute Begriffe immer vor Stress-/Atemübungsrouten prüfen. Dies ist keine
    // Diagnose, sondern leitet konservativ auf den bestehenden Notfallhinweis.
    if (has(
      'notfall', 'akut', 'brust ', 'brustschmerz', 'atemnot', 'luftnot', 'keine luft',
      'herzinfarkt', 'schlaganfall', 'bewusstlos', 'starke blutung', 'suizid',
      'selbstmord', 'selbstverletz', 'nicht mehr leben', '144', '143'
    ))
      return copy.get('coach.answer.emergency');

    if (has('score', 'gesamt', 'punkte', 'wie stehe', 'wie gut'))
      return copy.format('coach.answer.overall_score', {
        overallScore: ctx.overall,
        statusLabel: ctx.statusLabel,
        strongestTitle: s.title,
        strongestScore: s.score,
        weakestTitle: w.title,
        weakestScore: w.score,
      });

    if (has('fang', 'anfang', 'starten', 'zuerst', 'beginn', 'erst'))
      return first
        ? copy.format('coach.answer.first_step.with_plan', {
          recommendationTitle: first.title,
          recommendationStep: first.step,
        })
        : copy.get('coach.answer.first_step.without_plan');

    if (has('atem', 'stress', 'entspann', 'runter', 'ruhe', 'anspannung', 'burnout', 'überforder', 'ueberforder'))
      return copy.get('coach.answer.breathing');

    if (has('schlaf', 'müde', 'muede', 'einschlaf', 'schlecht schlaf'))
      return copy.format('coach.answer.sleep', { sleepScore: scoreFor(ctx, 'schlaf') });

    // Vor der allgemeinen Fitnessroute prüfen, damit «Protein beim Krafttraining»
    // nicht fälschlich nur eine Bewegungsantwort erhält.
    if (has('protein', 'eiweiss', 'eiweiß'))
      return copy.get('coach.answer.protein');

    if (has('beweg', 'sport', 'trainier', 'laufen', 'schritte', 'fitness', 'kraft'))
      return copy.format('coach.answer.fitness', { fitnessScore: scoreFor(ctx, 'fitness') });

    if (has('ernähr', 'ernaehr', 'essen', 'abnehm', 'gewicht', 'diät', 'diaet'))
      return copy.format('coach.answer.nutrition', { nutritionScore: scoreFor(ctx, 'ernaehrung') });

    if (has('blutdruck', 'cholesterin', 'blutzucker', 'labor', 'mein wert', 'werte'))
      return copy.get('coach.answer.medical_values');

    if (has('coach', 'app', 'begleit', 'weiter'))
      return copy.get('coach.answer.coach_app');

    if (has('verbesser', 'besser werden', (w.title || '').toLowerCase()))
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
