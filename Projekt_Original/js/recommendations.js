/*
 * recommendations.js
 * ---------------------------------------------------------------------------
 * Katalog personalisierter, evidenzbasierter Empfehlungen (Sie-Form).
 *
 * Jede Empfehlung folgt dem Format:
 *   title   – kurzer, motivierender Titel
 *   why     – «Warum das für Sie relevant ist»
 *   step    – «Konkreter nächster Schritt» (kleine Einstiegshürde)
 *   benefit – «Erwarteter Nutzen»
 *   offer   – Schlüssel in HELSANA_OFFERS (oder null)
 *
 * Dimensionen: einfluss · fitness · ernaehrung · schlaf · mental
 * Priorisierung über impact / urgency / ease (je 1–5) für die Top-3.
 * Inhalte sind präventiv formuliert und ersetzen keine ärztliche Beurteilung.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const oneOf = (v, ...vals) => vals.includes(v);

  const ResultCopy = window.ResultCopy;
  if (!ResultCopy || typeof ResultCopy.get !== 'function' || typeof ResultCopy.format !== 'function') {
    throw new Error('Recommendations: ResultCopy ist nicht initialisiert.');
  }
  const copyGet = (id) => ResultCopy.get(id);
  const copyFormat = (id, variables) => ResultCopy.format(id, variables);
  const formatDecimal = (value) => window.HealthLocale && typeof window.HealthLocale.formatDecimal === 'function'
    ? window.HealthLocale.formatDecimal(value)
    : String(value);
  const formatBmi = (value) => window.HealthLocale && typeof window.HealthLocale.formatBmi === 'function'
    ? window.HealthLocale.formatBmi(value)
    : formatDecimal(value);
  const formatRatio = (value) => window.HealthLocale && typeof window.HealthLocale.formatRatio === 'function'
    ? window.HealthLocale.formatRatio(value)
    : String(value);

  /* Katalog: Reihenfolge innerhalb einer Dimension = inhaltliche Priorität. */
  const CATALOG_RULES = [
    /* ---------------- S-1: Einflussfaktoren ---------------- */
    {
      id: 'ei_rauchstopp', dim: 'einfluss', impact: 5, urgency: 4, ease: 2,
      offer: 'rauchstopp',
      when: (c) => oneOf(c.a.rauchen, 'ja_regelmaessig', 'ja_gelegentlich'),
    },
    {
      id: 'ei_bluthochdruck', dim: 'einfluss', topic: 'blutdruck', impact: 5, urgency: 4, ease: 4,
      offer: 'blutdruck',
      when: (c) => c.a.bluthochdruck === 'ja',
    },
    {
      id: 'ei_bd_messen', dim: 'einfluss', topic: 'blutdruck', impact: 4, urgency: 3, ease: 5,
      offer: 'blutdruck',
      when: (c) => c.a.bluthochdruck === 'weiss_nicht',
    },
    {
      id: 'ei_familie', dim: 'einfluss', topic: 'vorsorge', impact: 4, urgency: 3, ease: 4,
      covers: ['ei_vorsorge', 'ei_vorsorgewissen'],
      offer: 'vorsorge',
      when: (c) => c.a.familie_hk === 'ja',
    },
    {
      id: 'ei_vorsorge', dim: 'einfluss', topic: 'vorsorge', impact: 3, urgency: 3, ease: 5,
      offer: 'vorsorge',
      when: (c) => oneOf(c.a.vorsorge, 'aelter_unsicher', 'nein', 'weiss_nicht'),
    },
    {
      id: 'ei_alkohol', dim: 'einfluss', impact: 4, urgency: 3, ease: 3,
      offer: 'ernaehrung',
      when: (c) => oneOf(c.a.alkohol, 'w4plus', 'w2_3'),
    },
    {
      id: 'ei_sitzen', dim: 'einfluss', impact: 3, urgency: 2, ease: 5,
      offer: 'bewegung',
      when: (c) => oneOf(c.a.sitzzeit, 'ue10', 's9_10'),
    },
    {
      id: 'ei_stabilitaet', dim: 'einfluss', topic: 'balance', impact: 4, urgency: 3, ease: 4,
      offer: 'kraft',
      when: (c) => oneOf(c.a.stabilitaet, 'unsicher', 'sehr_unsicher'),
    },
    {
      id: 'ei_socialmedia', dim: 'einfluss', topic: 'socialmedia', impact: 3, urgency: 2, ease: 4,
      offer: 'stress',
      when: (c) => oneOf(c.a.socialmedia, 'oft', 'sehr_oft'),
    },
    {
      id: 'ei_familienwissen', dim: 'einfluss', topic: 'vorsorge', impact: 2, urgency: 2, ease: 5,
      offer: 'vorsorge',
      when: (c) => oneOf(c.a.familie_hk, 'teilweise', 'weiss_nicht'),
    },
    {
      id: 'ei_vorsorgewissen', dim: 'einfluss', topic: 'vorsorge', impact: 2, urgency: 1, ease: 5,
      offer: 'vorsorge',
      when: (c) => oneOf(c.a.familienwissen, 'teilweise', 'nein'),
    },

    /* ---------------- S-2: Körperliche Fitness ---------------- */
    {
      id: 'fi_einstieg', dim: 'fitness', impact: 5, urgency: 3, ease: 5,
      offer: 'bewegung',
      when: (c) => c.activity.needsEntry,
    },
    {
      id: 'fi_kraft', dim: 'fitness', impact: 5, urgency: 3, ease: 4,
      offer: 'kraft',
      when: (c) => oneOf(c.a.krafttraining, 'tage0', 'tage1')
        || oneOf(c.a.einkaufstaschen, 'ziemlich', 'nicht')
        || hasActionableFitnessDeficit(c, ['liegestuetze', 'wandsitz']),
    },
    {
      id: 'fi_ausdauer', dim: 'fitness', impact: 4, urgency: 3, ease: 4,
      offer: 'bewegung',
      when: (c) => c.activity.hasData && !c.activity.goalMet && !c.activity.needsEntry,
    },
    {
      id: 'fi_beweglichkeit', dim: 'fitness', topic: 'balance', impact: 3, urgency: 2, ease: 4,
      offer: 'kraft',
      when: (c) => oneOf(c.a.beweglichkeit, 'ziemlich', 'nicht') || c.sig.has('balance')
        || hasActionableFitnessDeficit(c, ['einbeinstand']),
    },
    {
      id: 'fi_kondition', dim: 'fitness', impact: 3, urgency: 2, ease: 4,
      offer: 'bewegung',
      when: (c) => oneOf(c.a.treppen, 'deutlich', 'sehr_stark'),
    },

    /* ---------------- S-3: Ernährung ---------------- */
    {
      id: 'er_protein', dim: 'ernaehrung', impact: 4, urgency: 2, ease: 5,
      offer: 'ernaehrung',
      when: (c) => oneOf(c.a.protein, 'selten', 'manchmal'),
    },
    {
      id: 'er_vielfalt', dim: 'ernaehrung', impact: 4, urgency: 2, ease: 5,
      offer: 'ernaehrung',
      when: (c) => oneOf(c.a.pflanzenvielfalt, 'u10', 'v10_17'),
    },
    {
      id: 'er_verarbeitet', dim: 'ernaehrung', impact: 4, urgency: 2, ease: 4,
      offer: 'ernaehrung',
      when: (c) => oneOf(c.a.verarbeitet, 'fast_taeglich', 'mehrmals_taeglich'),
    },
    {
      id: 'er_getraenke', dim: 'ernaehrung', impact: 4, urgency: 3, ease: 5,
      offer: 'metabolisch',
      when: (c) => oneOf(c.a.zuckergetraenke, 'w4_6', 'taeglich'),
    },
    {
      id: 'er_omega3', dim: 'ernaehrung', impact: 3, urgency: 2, ease: 5,
      offer: 'ernaehrung',
      when: (c) => oneOf(c.a.omega3, 'nie', 'u1woche'),
    },
    {
      id: 'er_saettigung', dim: 'ernaehrung', impact: 3, urgency: 2, ease: 4,
      offer: 'ernaehrung',
      when: (c) => oneOf(c.a.saettigung, 'nie', 'selten', 'manchmal'),
    },

    /* ---------------- S-4: Schlaf ---------------- */
    {
      id: 'sl_dauer', dim: 'schlaf', impact: 4, urgency: 3, ease: 4,
      offer: 'schlaf',
      when: (c) => oneOf(c.a.schlafdauer, 'u5', 's5_6', 's6_7'),
    },
    {
      id: 'sl_qualitaet', dim: 'schlaf', topic: 'schlafqualitaet', impact: 4, urgency: 3, ease: 4,
      offer: 'schlaf',
      when: (c) => oneOf(c.a.schlafqualitaet, 'schlecht', 'sehr_schlecht')
        || oneOf(c.a.schlaf_auswirkung, 'spuerbar', 'deutlich', 'massiv'),
    },
    {
      id: 'sl_rhythmus', dim: 'schlaf', topic: 'schlafrhythmus', impact: 3, urgency: 2, ease: 5,
      offer: 'schlaf',
      when: (c) => oneOf(c.a.schlafrhythmus, 'unregelmaessig', 'sehr_unregelmaessig'),
    },

    /* ---------------- S-5: Mentales Wohlbefinden ---------------- */
    {
      id: 'me_unterstuetzung', dim: 'mental', critical: true, impact: 5, urgency: 5, ease: 4,
      offer: 'mentaleHilfe',
      when: (c) => c.sig.has('hohe_belastung'),
    },
    {
      id: 'me_belastung', dim: 'mental', impact: 4, urgency: 3, ease: 4,
      offer: 'stress',
      when: (c) => c.sig.has('belastung')
        || oneOf(c.a.belastbarkeit, 'eher_nicht', 'gar_nicht')
        || oneOf(c.a.selbstwirksamkeit, 'eher_nicht', 'gar_nicht')
        || oneOf(c.a.coping, 'eher_nicht', 'gar_nicht'),
    },
    {
      id: 'me_sozial', dim: 'mental', impact: 4, urgency: 3, ease: 4,
      offer: 'stress',
      when: (c) => c.sig.has('einsamkeit') || oneOf(c.a.verbundenheit, 'eher_nicht', 'gar_nicht'),
    },
    {
      id: 'me_selbstfuersorge', dim: 'mental', impact: 3, urgency: 2, ease: 5,
      offer: 'stress',
      when: (c) => oneOf(c.a.selbstfuersorge, 'eher_nicht', 'gar_nicht'),
    },
    {
      id: 'me_sinn', dim: 'mental', impact: 3, urgency: 2, ease: 4,
      offer: 'mentaleHilfe',
      when: (c) => oneOf(c.a.sinnhaftigkeit, 'eher_nicht', 'gar_nicht') || oneOf(c.a.zukunft, 'eher_nicht', 'gar_nicht'),
    },
  ];


  function attachCatalogCopy(rule) {
    const prefix = 'recommendation.catalog.' + rule.id + '.';
    const copiedRule = Object.assign({}, rule);
    if (Array.isArray(copiedRule.covers)) {
      copiedRule.covers = Object.freeze(copiedRule.covers.slice());
    }
    return Object.assign(copiedRule, {
      title: copyGet(prefix + 'title'),
      why: copyGet(prefix + 'why'),
      step: copyGet(prefix + 'step'),
      benefit: copyGet(prefix + 'benefit'),
    });
  }

  const CATALOG = CATALOG_RULES.map(attachCatalogCopy);
  CATALOG.forEach(Object.freeze);
  Object.freeze(CATALOG);

  /* ---------- Rückmeldungen für solide und starke Dimensionen ---------- */
  const SOLIDS = Object.freeze({
    einfluss: copyGet('recommendation.solid.einfluss'),
    fitness: copyGet('recommendation.solid.fitness'),
    ernaehrung: copyGet('recommendation.solid.ernaehrung'),
    schlaf: copyGet('recommendation.solid.schlaf'),
    mental: copyGet('recommendation.solid.mental'),
  });

  const POSITIVES = Object.freeze({
    einfluss: copyGet('recommendation.positive.einfluss'),
    fitness: copyGet('recommendation.positive.fitness'),
    ernaehrung: copyGet('recommendation.positive.ernaehrung'),
    schlaf: copyGet('recommendation.positive.schlaf'),
    mental: copyGet('recommendation.positive.mental'),
  });

  function dimensionFeedbackTone(score) {
    if (!Number.isFinite(score) || score < 60) return 'neutral';
    return score >= 80 ? 'positive' : 'solid';
  }

  /*
   * Ein Vertrag verbindet jedes Risikosignal mit genau einer Ergebnisdimension,
   * seinen sichtbaren Textfeldern und jenen Empfehlungen, die das Thema im
   * priorisierten Aktionsplan bereits ausreichend abdecken. So verwenden
   * Fallback-Logik, Dimensionshinweise und der bestehende Insight-Export dieselbe
   * Zuordnung statt drei voneinander driftender Tabellen.
   */
  const SIGNAL_PRESENTATION = Object.freeze({
    hohe_belastung: { dimension: 'mental', relatedRecommendationIds: ['me_unterstuetzung'], fields: ['title', 'insight', 'clarify', 'deepen'] },
    bluthochdruck: { dimension: 'einfluss', relatedRecommendationIds: ['ei_bluthochdruck', 'act_kardio'], fields: ['title', 'insight', 'clarify', 'deepen'] },
    blutdruck_unbekannt: { dimension: 'einfluss', relatedRecommendationIds: ['ei_bd_messen', 'act_kardio'], fields: ['title', 'insight', 'clarify'] },
    familie_hk: { dimension: 'einfluss', relatedRecommendationIds: ['ei_familie'], fields: ['title', 'insight', 'clarify', 'deepen'] },
    vorsorge: { dimension: 'einfluss', relatedRecommendationIds: ['act_kardio', 'ei_vorsorge', 'ei_familie'], fields: ['title', 'insight', 'clarify', 'deepen'] },
    untergewicht: { dimension: 'einfluss', relatedRecommendationIds: [], fields: ['title', 'insight', 'clarify', 'benefit'] },
    rauchen: { dimension: 'einfluss', relatedRecommendationIds: ['ei_rauchstopp'], fields: ['title', 'insight', 'action', 'deepen'] },
    alkohol: { dimension: 'einfluss', relatedRecommendationIds: ['ei_alkohol'], fields: ['title', 'insight', 'action'] },
    koerperzusammensetzung: { dimension: 'einfluss', relatedRecommendationIds: ['act_kardio'], fields: ['title', 'insight', 'action', 'benefit'] },
    bewegungsmangel: { dimension: 'fitness', relatedRecommendationIds: ['fi_einstieg', 'fi_ausdauer'], fields: ['title', 'insight', 'action', 'deepen'] },
    keine_kraft: { dimension: 'fitness', relatedRecommendationIds: ['fi_kraft'], fields: ['title', 'insight', 'action'] },
    sitzen: { dimension: 'einfluss', relatedRecommendationIds: ['ei_sitzen'], fields: ['title', 'insight', 'action'] },
    stabilitaet: { dimension: 'einfluss', relatedRecommendationIds: ['ei_stabilitaet'], fields: ['title', 'insight', 'action'] },
    balance: { dimension: 'fitness', relatedRecommendationIds: ['fi_beweglichkeit', 'ei_stabilitaet'], fields: ['title', 'insight', 'action'] },
    schlaf: { dimension: 'schlaf', relatedRecommendationIds: ['sl_dauer', 'sl_qualitaet', 'sl_rhythmus', 'act_schlaf_abklaerung', 'act_bildschirm_abend'], fields: ['title', 'insight', 'action'] },
    socialmedia: { dimension: 'einfluss', relatedRecommendationIds: ['ei_socialmedia', 'act_bildschirm_abend'], fields: ['title', 'insight', 'action'] },
    ernaehrung: { dimension: 'ernaehrung', relatedRecommendationIds: ['er_getraenke', 'er_verarbeitet'], fields: ['title', 'insight', 'action', 'deepen'] },
    belastung: { dimension: 'mental', relatedRecommendationIds: ['me_belastung', 'me_selbstfuersorge'], fields: ['title', 'insight', 'action'] },
    einsamkeit: { dimension: 'mental', relatedRecommendationIds: ['me_sozial'], fields: ['title', 'insight', 'action'] },
  });

  const SIGNAL_COPY = Object.keys(SIGNAL_PRESENTATION).reduce((out, id) => {
    const fields = SIGNAL_PRESENTATION[id].fields;
    const prefix = 'recommendation.signal.' + id + '.';
    const entry = {};
    fields.forEach((field) => { entry[field] = copyGet(prefix + field); });
    out[id] = entry;
    return out;
  }, {});

  function hasOpenDimensionSignal(dimId, ctx) {
    return !!(ctx && Array.isArray(ctx.signals)
      && ctx.signals.some((signal) => SIGNAL_PRESENTATION[signal.id]
        && SIGNAL_PRESENTATION[signal.id].dimension === dimId));
  }

  function buildContext(answers, results) {
    const schema = typeof window !== 'undefined' && window.HealthAnswerSchema;
    const cleanAnswers = schema && typeof schema.sanitizeAnswers === 'function'
      ? schema.sanitizeAnswers(answers)
      : answers;
    return {
      a: cleanAnswers,
      m: results.metrics,
      scores: results.scores,
      norms: results.norms || {},
      fitnessTests: results.fitnessTests || [],
      activity: window.Scoring.activityStatus(cleanAnswers),
      sig: new Set(results.signals.map((s) => s.id)),
      signals: results.signals,
    };
  }

  /**
   * Alle zutreffenden Empfehlungen einer Dimension. Ein bereits berechneter
   * Aktionsplan wird optional als priorisiertes Präfix gespiegelt. In diesem
   * UI-Pfad folgen keine Katalogkarten, die ein Plan-Schritt ausdrücklich über
   * stabile Empfehlungs-IDs abdeckt. Die eng gefasste `covers`-Liste verhindert
   * echte Textdopplungen, ohne nur thematisch verwandte Hinweise auszublenden.
   * Ohne drittes Argument bleibt der bisherige vollständige Katalogvertrag erhalten.
   */
  function recommendationsForDimension(dimId, ctx, actionPlanItems) {
    const out = [];
    const seen = new Set();
    const add = (record) => {
      if (!record || record.dim !== dimId || typeof record.id !== 'string' || seen.has(record.id)) return;
      seen.add(record.id);
      out.push(record);
    };
    const triggered = CATALOG.filter((record) => safeCheck(record.when, ctx));
    if (!Array.isArray(actionPlanItems)) {
      triggered.filter((record) => record.dim === dimId).map((record) => withPlan(record, ctx)).forEach(add);
      return addBodyContext(out, ctx);
    }

    const coveredIds = new Set();
    actionPlanItems.forEach((record) => {
      (record && record.covers || []).forEach((id) => coveredIds.add(id));
      add(record);
    });
    triggered.filter((record) => record.dim === dimId).forEach((record) => {
      if (coveredIds.has(record.id)) return;
      add(withPlan(record, ctx));
      (record.covers || []).forEach((id) => coveredIds.add(id));
    });
    return addBodyContext(out, ctx);
  }

  function safeCheck(predicate, ctx) {
    try { return !!predicate(ctx); } catch (e) { return false; }
  }

  function priority(r) {
    return r.impact * 2.2 + r.urgency * 2.6 + r.ease * 1.2 + (r.critical ? 1000 : 0);
  }

  /**
   * Rückwärtskompatibler Alias: Es gibt nur eine produktive Priorisierungs-
   * Engine. So können Tests und ältere Aufrufer nicht von `actionPlan()`
   * abweichende Empfehlungen erhalten.
   */
  function topThree(ctx) {
    return actionPlan(ctx, 3);
  }

  /* =====================================================================
   * «Auf einen Blick»-Insights: konkrete Stärken & grösste Hebel
   * ---------------------------------------------------------------------
   * Statt Dimension + Score (Dopplung zum Spinnennetz) leiten diese Kataloge
   * aus den KONKRETEN Antworten ab, (a) was pro Dimension der grösste Hebel
   * ist und (b) welche Stärken jemand tatsächlich mitbringt. Muster dürfen
   * dimensionsübergreifend denken – Beispiel: familiäre Vorbelastung +
   * Bluthochdruck + wenig Bewegung + ungünstige Ernährung ⇒ kardiovaskulärer
   * Vorsorge-Check als Top-Hebel der Einflussfaktoren, selbst wenn der
   * Fitness-Score der tiefste ist.
   * ===================================================================== */

  function ageOf(c) { return Number(c.a.alter) || 0; }
  function joinList(items) {
    if (items.length <= 1) return items.join('');
    if (items.length === 2) {
      return copyFormat('recommendation.special.act_kardio.risk_factor_list.two', {
        first: items[0],
        last: items[1],
      });
    }
    return copyFormat('recommendation.special.act_kardio.risk_factor_list.many', {
      preceding: items.slice(0, -1).join(', '),
      last: items[items.length - 1],
    });
  }

  function kardioFactor(id) {
    return copyGet('recommendation.special.act_kardio.risk_factor.' + id);
  }

  function positiveFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function validBmiValue(metrics) {
    const raw = positiveFiniteNumber(metrics && metrics.bmiRaw);
    return raw == null ? positiveFiniteNumber(metrics && metrics.bmi) : raw;
  }

  function bodyProfileInsight(metrics) {
    const m = metrics || {};
    const hasWaist = Number(m.waist) > 0;
    const whtr = positiveFiniteNumber(m.whtr);
    const bmi = validBmiValue(m);
    const hasHighBmi = bmi != null && String(m.bmiClass || '').indexOf('adipositas') === 0;
    if (hasWaist && m.bodyRisk && m.bodyRisk.source === 'whtr'
        && whtr != null && (m.waistStatus === 'erhoeht' || m.waistStatus === 'hoch')) {
      return copyFormat('recommendation.signal.koerperzusammensetzung.insight.with_waist', {
        waist: m.waist,
        whtr: formatRatio(whtr),
        waistStatusLabel: copyGet('ui.metrics.waist_status.' + m.waistStatus),
      });
    }
    if (!hasHighBmi) {
      return copyGet('recommendation.signal.koerperzusammensetzung.insight');
    }
    const bmiVariables = {
      bmi: formatBmi(bmi),
      bmiClassLabel: copyGet('ui.metrics.bmi_class.' + m.bmiClass),
    };
    if (hasWaist && whtr == null) {
      return copyGet('recommendation.signal.koerperzusammensetzung.insight');
    }
    if (hasWaist && whtr != null) {
      return copyFormat('recommendation.signal.koerperzusammensetzung.insight.' + (
        m.possibleMuscularBmiContext ? 'bmi_with_waist_muscular' : 'bmi_with_waist'
      ), Object.assign({}, bmiVariables, {
        waist: m.waist,
        whtr: formatRatio(whtr),
      }));
    }
    return copyFormat('recommendation.signal.koerperzusammensetzung.insight.' + (
      m.possibleMuscularBmiContext ? 'bmi_without_waist_muscular' : 'bmi_without_waist'
    ), bmiVariables);
  }

  function bodyProfileLeverDetail(c) {
    return copyFormat('recommendation.lever.lv_koerperprofil.detail.personalized', {
      personalAssessment: bodyProfileInsight(c.m),
      nextStep: copyGet('recommendation.lever.lv_koerperprofil.detail'),
    });
  }

  function bodyCompositionKardioFactor(c) {
    const m = c && c.m ? c.m : {};
    const whtr = positiveFiniteNumber(m.whtr);
    const bmi = validBmiValue(m);
    if (m.bodyRisk && m.bodyRisk.source === 'whtr'
        && whtr != null && oneOf(m.waistStatus, 'erhoeht', 'hoch')) {
      return copyFormat('recommendation.special.act_kardio.risk_factor.body_composition_whtr', {
        whtr: formatRatio(whtr),
        waistStatusLabel: copyGet('ui.metrics.waist_status.' + m.waistStatus),
      });
    }
    if (m.bodyRisk && m.bodyRisk.source === 'bmi'
        && bmi != null && oneOf(m.bmiClass, 'adipositas1', 'adipositas2')) {
      return copyFormat('recommendation.special.act_kardio.risk_factor.' + (
        m.possibleMuscularBmiContext ? 'body_composition_bmi_muscular' : 'body_composition_bmi'
      ), {
        bmi: formatBmi(bmi),
        bmiClassLabel: copyGet('ui.metrics.bmi_class.' + m.bmiClass),
      });
    }
    return kardioFactor('body_composition');
  }

  /** Kardiovaskuläres Risikomuster über mehrere Dimensionen hinweg. */
  function cvRiskPattern(c) {
    let r = 0;
    const why = [];
    const metrics = c && c.m ? c.m : {};
    if (c.a.bluthochdruck === 'ja') { r += 2; why.push(kardioFactor('hypertension')); }
    else if (c.a.bluthochdruck === 'weiss_nicht') { r += 0.5; }
    if (oneOf(c.a.rauchen, 'ja_regelmaessig', 'ja_gelegentlich')) { r += 2; why.push(kardioFactor('smoking')); }
    if (metrics.bodyRisk && oneOf(metrics.bodyRisk.severity, 'mittel', 'tief')) {
      r += metrics.bodyRisk.severity === 'mittel' ? 1.5 : 0.5;
      why.push(bodyCompositionKardioFactor(c));
    }
    if (oneOf(c.a.sitzzeit, 's9_10', 'ue10')) { r += 1; why.push(kardioFactor('long_sitting')); }
    if (c.activity.needsEntry) { r += 1; why.push(kardioFactor('low_activity')); }
    if ((c.scores.ernaehrung ?? 50) < 45) { r += 1; why.push(kardioFactor('nutrition_pattern')); }
    if (c.a.alkohol === 'w4plus') { r += 1; why.push(kardioFactor('alcohol')); }
    return { r, why };
  }

  /* Spezial-Aktionskarten für Muster-Hebel, für die es keinen passenden
   * Katalog-Eintrag gibt. Gleiche Struktur wie CATALOG-Einträge, damit
   * Rendering, 4-Wochen-Plan und Coach-Kontext identisch funktionieren. */
  function kardioAction(c) {
    const why = cvRiskPattern(c).why.slice(0, 4);
    const bd = c.a.bluthochdruck === 'ja';
    const assessmentCurrent = c.a.vorsorge === 'aktuell';
    let stepVariant = assessmentCurrent ? 'already_assessed' : 'assessment_needed';
    if (bd) stepVariant += '_hypertension';
    return {
      id: 'act_kardio', dim: 'einfluss', topic: 'vorsorge',
      title: copyGet('recommendation.special.act_kardio.title'),
      why: copyFormat('recommendation.special.act_kardio.why', { riskFactors: joinList(why) }),
      step: copyGet('recommendation.special.act_kardio.step.' + stepVariant),
      benefit: copyGet('recommendation.special.act_kardio.benefit'),
      offer: 'vorsorge',
    };
  }

  function fitnessTest(c, id) {
    return (c && c.fitnessTests || []).find((test) => test.id === id) || null;
  }

  function scorableFitnessReference(test) {
    return !!test && (
      test.referenceStatus === 'supported'
      || test.referenceStatus === 'harmonized_orientation'
      || test.referenceStatus === 'modeled_orientation'
    );
  }

  /* Eine negative Testnorm darf nur dann automatisch eine Empfehlung ausloesen,
   * wenn Testprotokoll und Referenz hinreichend zusammenpassen. */
  function actionableFitnessTest(test) {
    return scorableFitnessReference(test) && test.norm < 0;
  }

  function hasActionableFitnessDeficit(c, ids) {
    return ids.some((id) => actionableFitnessTest(fitnessTest(c, id)));
  }

  function fitnessDeficitSeverity(c, ids) {
    const deficient = ids.map((id) => fitnessTest(c, id)).filter(actionableFitnessTest);
    if (!deficient.length) return 0;
    return deficient.some((test) => test.norm === -2) ? 2 : 1;
  }

  const FITNESS_TEST_COPY = Object.freeze({
    einbeinstand: Object.freeze({
      title: copyGet('recommendation.fitness_test.einbeinstand.title'),
      relevance: copyGet('recommendation.fitness_test.einbeinstand.relevance'),
      unrated: copyGet('recommendation.fitness_test.einbeinstand.interpretation.unrated'),
      ageOutside: copyGet('recommendation.fitness_test.einbeinstand.reference_note.age_outside'),
      recommendationId: 'fi_beweglichkeit',
    }),
    liegestuetze: Object.freeze({
      title: copyGet('recommendation.fitness_test.liegestuetze.title'),
      relevance: copyGet('recommendation.fitness_test.liegestuetze.relevance'),
      unrated: copyGet('recommendation.fitness_test.liegestuetze.interpretation.unrated'),
      ageOutside: copyGet('recommendation.fitness_test.liegestuetze.reference_note.age_outside'),
      harmonizedOrientation: copyGet('recommendation.fitness_test.liegestuetze.reference_note.harmonized_orientation'),
      modeledOrientation: copyGet('recommendation.fitness_test.liegestuetze.reference_note.modeled_orientation'),
      referenceUnavailable: copyGet('recommendation.fitness_test.liegestuetze.reference_note.reference_unavailable'),
      recommendationId: 'fi_kraft',
    }),
    wandsitz: Object.freeze({
      title: copyGet('recommendation.fitness_test.wandsitz.title'),
      relevance: copyGet('recommendation.fitness_test.wandsitz.relevance'),
      unrated: copyGet('recommendation.fitness_test.wandsitz.interpretation.unrated'),
      ageOutside: copyGet('recommendation.fitness_test.wandsitz.reference_note.age_outside'),
      harmonizedOrientation: copyGet('recommendation.fitness_test.wandsitz.reference_note.harmonized_orientation'),
      referenceUnavailable: copyGet('recommendation.fitness_test.wandsitz.reference_note.reference_unavailable'),
      recommendationId: 'fi_kraft',
    }),
  });

  const FITNESS_TEST_STATUS_COPY = Object.freeze({
    stark: Object.freeze({
      label: copyGet('service.status_band.stark.label'),
      meaning: copyGet('recommendation.fitness_test.status.stark.meaning'),
    }),
    solide: Object.freeze({
      label: copyGet('service.status_band.solide.label'),
      meaning: copyGet('recommendation.fitness_test.status.solide.meaning'),
    }),
    ausbau: Object.freeze({
      label: copyGet('service.status_band.ausbau.label'),
      meaning: copyGet('recommendation.fitness_test.status.ausbau.meaning'),
    }),
    aufmerksam: Object.freeze({
      label: copyGet('service.status_band.aufmerksam.label'),
      meaning: copyGet('recommendation.fitness_test.status.aufmerksam.meaning'),
    }),
  });

  function fitnessReferenceNote(test, presentation) {
    if (test.referenceStatus === 'age_outside_reference') return presentation.ageOutside || null;
    if (test.referenceStatus === 'harmonized_orientation') return presentation.harmonizedOrientation || null;
    if (test.referenceStatus === 'modeled_orientation') return presentation.modeledOrientation || null;
    if (test.referenceStatus === 'reference_unavailable') return presentation.referenceUnavailable || null;
    return null;
  }

  /**
   * Redaktionell fertige, aber strukturiert gerenderte Kurztest-Ergebnisse.
   * Alle Texte stammen aus dem Marketing-Katalog; Referenzwerte bleiben als
   * testbare Logik in scoring.js. Nicht belastbare Normen werden nicht als
   * farbige oder klinische Bewertung ausgegeben.
   */
  function fitnessTestInsights(results, planRecs) {
    const planIndex = {};
    (planRecs || []).forEach((record, index) => { planIndex[record.id] = index + 1; });

    return (results.fitnessTests || []).map((test) => {
      const presentation = FITNESS_TEST_COPY[test.id];
      if (!presentation) return null;
      const rating = scorableFitnessReference(test)
        ? FITNESS_TEST_STATUS_COPY[test.statusKey]
        : null;
      const deficient = actionableFitnessTest(test);
      const recommendation = CATALOG.find((record) => record.id === presentation.recommendationId) || null;
      const unit = test.unitKey === 'repetitions'
        ? copyGet('ui.fitness_tests.unit.repetitions')
        : copyGet('ui.fitness_tests.unit.seconds');
      return {
        id: test.id,
        title: presentation.title,
        value: test.value,
        unit,
        ratingKey: rating ? test.statusKey : 'unrated',
        ratingLabel: rating ? rating.label : copyGet('ui.fitness_tests.personal_baseline'),
        meaning: rating ? rating.meaning : presentation.unrated,
        relevance: presentation.relevance,
        referenceNote: fitnessReferenceNote(test, presentation),
        nextReference: rating && test.nextThreshold != null
          ? copyFormat('ui.fitness_tests.next_reference', {
            nextThreshold: test.nextThreshold,
            unit,
          })
          : null,
        recommendationId: deficient ? presentation.recommendationId : null,
        recommendationTitle: deficient && recommendation ? recommendation.title : null,
        planStep: deficient ? (planIndex[presentation.recommendationId] || null) : null,
      };
    }).filter(Boolean);
  }

  function schlafAbklaerungAction() {
    return {
      id: 'act_schlaf_abklaerung', dim: 'schlaf', topic: 'schlaf_medizinisch',
      title: copyGet('recommendation.special.act_schlaf_abklaerung.title'),
      why: copyGet('recommendation.special.act_schlaf_abklaerung.why'),
      step: copyGet('recommendation.special.act_schlaf_abklaerung.step'),
      benefit: copyGet('recommendation.special.act_schlaf_abklaerung.benefit'),
      offer: 'schlaf',
    };
  }

  function bildschirmAbendAction() {
    return {
      id: 'act_bildschirm_abend', dim: 'schlaf', topic: 'schlafrhythmus',
      title: copyGet('recommendation.special.act_bildschirm_abend.title'),
      why: copyGet('recommendation.special.act_bildschirm_abend.why'),
      step: copyGet('recommendation.special.act_bildschirm_abend.step'),
      benefit: copyGet('recommendation.special.act_bildschirm_abend.benefit'),
      offer: 'schlaf',
    };
  }

  /* Hebel-Katalog: pro Dimension gewinnt der Eintrag mit der höchsten
   * Priorität. prio() skaliert mit dem Schweregrad der konkreten Antworten. */
  const LEVER_RULES = [
    /* ---- Einflussfaktoren ---- */
    {
      id: 'lv_kardio', dim: 'einfluss', topic: 'vorsorge',
      action: kardioAction,
      absorbs: ['blutdruck', 'koerperzusammensetzung'],
      covers: ['ei_bluthochdruck', 'ei_vorsorge'],
      when: (c) => cvRiskPattern(c).r >= 3,
      // Ein echtes Mehrfaktorenmuster mit bekanntem Bluthochdruck darf in der
      // Kurz-Zusammenfassung nicht hinter einem einzelnen Lifestyle-Hebel
      // verschwinden. Bei Gleichstand gewinnt die zusammengesetzte Regel durch
      // ihre frühere Position; Rauchstopp bleibt als zweiter Top-Hebel möglich.
      prio: (c) => {
        const assessmentPriority = c.a.vorsorge === 'nein'
          ? 0.5
          : (c.a.vorsorge === 'weiss_nicht' ? 0.35 : (c.a.vorsorge === 'aelter_unsicher' ? 0.25 : 0));
        return Math.min(10, 5.5 + cvRiskPattern(c).r + assessmentPriority);
      },
    },
    {
      id: 'lv_blutdruck', dim: 'einfluss', topic: 'blutdruck',
      rec: 'ei_bluthochdruck',
      scoreIndependent: true,
      when: (c) => c.a.bluthochdruck === 'ja',
      prio: () => 7.2,
    },
    {
      id: 'lv_bd_messen', dim: 'einfluss', topic: 'blutdruck',
      rec: 'ei_bd_messen',
      scoreIndependent: true,
      when: (c) => c.a.bluthochdruck === 'weiss_nicht',
      prio: () => 3.8,
    },
    {
      id: 'lv_familie', dim: 'einfluss', topic: 'vorsorge',
      rec: 'ei_familie',
      scoreIndependent: true,
      when: (c) => c.a.familie_hk === 'ja',
      prio: (c) => {
        if (c.a.vorsorge === 'nein') return 6.8;
        if (c.a.vorsorge === 'weiss_nicht') return 6.4;
        if (c.a.vorsorge === 'aelter_unsicher') return 6.2;
        return 5.8;
      },
    },
    {
      id: 'lv_vorsorge', dim: 'einfluss', topic: 'vorsorge',
      rec: 'ei_vorsorge',
      scoreIndependent: true,
      when: (c) => oneOf(c.a.vorsorge, 'aelter_unsicher', 'nein', 'weiss_nicht'),
      prio: (c) => {
        if (c.a.vorsorge === 'nein') return 5.5;
        if (c.a.vorsorge === 'weiss_nicht') return 5;
        return 4.5;
      },
    },
    {
      id: 'lv_untergewicht', dim: 'einfluss', topic: 'gewicht_medizinisch',
      // Aus den vorhandenen medizinisch geprüften Signaltexten entsteht ein
      // sichtbares Haupthandlungsfeld, bewusst jedoch kein standardisierter
      // 4-Wochen-Plan: Dafür fehlen Angaben zu Verlauf, Ursache und Beschwerden.
      summaryOnly: true,
      when: (c) => c.sig.has('untergewicht'),
      prio: () => 6.2,
    },
    {
      id: 'lv_koerperprofil', dim: 'einfluss', topic: 'koerperzusammensetzung',
      // Auch hier ist die Summary sicher ableitbar, eine pauschale Gewichts-
      // oder Therapieempfehlung aus BMI/Taille allein dagegen nicht.
      summaryOnly: true,
      when: (c) => c.sig.has('koerperzusammensetzung'),
      prio: (c) => {
        const signal = (c.signals || []).find((item) => item.id === 'koerperzusammensetzung');
        return signal && signal.severity === 'mittel' ? 6 : 4.5;
      },
    },
    {
      id: 'lv_rauchstopp', dim: 'einfluss', topic: 'rauchen',
      rec: 'ei_rauchstopp',
      when: (c) => oneOf(c.a.rauchen, 'ja_regelmaessig', 'ja_gelegentlich'),
      prio: (c) => (c.a.rauchen === 'ja_regelmaessig' ? 9.5 : 8.5),
    },
    {
      id: 'lv_alkohol', dim: 'einfluss', topic: 'alkohol',
      rec: 'ei_alkohol',
      when: (c) => c.a.alkohol === 'w4plus',
      prio: () => 6.5,
    },
    {
      id: 'lv_sturz', dim: 'einfluss', topic: 'balance',
      rec: 'ei_stabilitaet',
      when: (c) => oneOf(c.a.stabilitaet, 'unsicher', 'sehr_unsicher'),
      prio: (c) => 6 + (c.a.stabilitaet === 'sehr_unsicher' ? 1 : 0) + (ageOf(c) >= 65 ? 1 : 0),
    },
    {
      id: 'lv_sitzen', dim: 'einfluss', topic: 'sitzen',
      rec: 'ei_sitzen',
      when: (c) => oneOf(c.a.sitzzeit, 's9_10', 'ue10'),
      prio: (c) => (c.a.sitzzeit === 'ue10' ? 5.5 : 4.5),
    },
    {
      id: 'lv_familienwissen', dim: 'einfluss', topic: 'vorsorge',
      rec: 'ei_familienwissen',
      scoreIndependent: true,
      when: (c) => oneOf(c.a.familie_hk, 'teilweise', 'weiss_nicht'),
      prio: (c) => (c.a.familie_hk === 'weiss_nicht' ? 4.2 : 3.8),
    },
    {
      id: 'lv_vorsorgewissen', dim: 'einfluss', topic: 'vorsorge',
      rec: 'ei_vorsorgewissen',
      scoreIndependent: true,
      when: (c) => oneOf(c.a.familienwissen, 'teilweise', 'nein'),
      prio: (c) => (c.a.familienwissen === 'nein' ? 3.5 : 3),
    },
    {
      id: 'lv_socialmedia', dim: 'einfluss', topic: 'socialmedia',
      rec: 'ei_socialmedia',
      when: (c) => oneOf(c.a.socialmedia, 'oft', 'sehr_oft'),
      prio: (c) => (c.a.socialmedia === 'sehr_oft' ? 3.5 : 2.5),
    },

    /* ---- Körperliche Fitness ---- */
    {
      id: 'lv_ausdauer', dim: 'fitness', topic: 'bewegung',
      rec: (c) => c.activity.needsEntry ? 'fi_einstieg' : 'fi_ausdauer',
      when: (c) => !c.activity.goalMet
        && oneOf(c.a.ausdauer_moderat, 'u30', 'm30_75')
        && oneOf(c.a.ausdauer_intensiv, 'keine', 'u30'),
      prio: (c) => 6.5 + (oneOf(c.a.treppen, 'deutlich', 'sehr_stark') ? 0.5 : 0),
    },
    {
      id: 'lv_kraft', dim: 'fitness', topic: 'kraft',
      rec: 'fi_kraft',
      when: (c) => oneOf(c.a.krafttraining, 'tage0', 'tage1')
        || oneOf(c.a.einkaufstaschen, 'ziemlich', 'nicht')
        || hasActionableFitnessDeficit(c, ['liegestuetze', 'wandsitz']),
      prio: (c) => (c.a.krafttraining === 'tage0' ? 6 : 4.5)
        + (ageOf(c) >= 50 ? 1 : 0) + (oneOf(c.a.einkaufstaschen, 'ziemlich', 'nicht') ? 1 : 0)
        + fitnessDeficitSeverity(c, ['liegestuetze', 'wandsitz']),
    },
    {
      id: 'lv_balance_fit', dim: 'fitness', topic: 'balance',
      rec: 'fi_beweglichkeit',
      when: (c) => oneOf(c.a.beweglichkeit, 'ziemlich', 'nicht')
        || hasActionableFitnessDeficit(c, ['einbeinstand']),
      prio: (c) => 5.5 + (ageOf(c) >= 65 ? 1 : 0)
        + fitnessDeficitSeverity(c, ['einbeinstand']),
    },
    {
      id: 'lv_fitness_alltag', dim: 'fitness', topic: 'bewegung',
      rec: 'fi_kondition',
      when: (c) => oneOf(c.a.treppen, 'deutlich', 'sehr_stark'),
      prio: () => 3,
    },

    /* ---- Ernährung ---- */
    {
      id: 'lv_zucker', dim: 'ernaehrung', topic: 'zucker',
      rec: 'er_getraenke',
      when: (c) => oneOf(c.a.zuckergetraenke, 'w4_6', 'taeglich'),
      prio: (c) => (c.a.zuckergetraenke === 'taeglich' ? 7 : 5.5)
        + (c.m.bodyRisk && c.m.bodyRisk.norm <= 0 ? 0.5 : 0),
    },
    {
      id: 'lv_verarbeitet', dim: 'ernaehrung', topic: 'verarbeitet',
      rec: 'er_verarbeitet',
      when: (c) => oneOf(c.a.verarbeitet, 'fast_taeglich', 'mehrmals_taeglich'),
      prio: (c) => (c.a.verarbeitet === 'mehrmals_taeglich' ? 6.5 : 5),
    },
    {
      id: 'lv_protein', dim: 'ernaehrung', topic: 'protein',
      rec: 'er_protein',
      when: (c) => oneOf(c.a.protein, 'selten', 'manchmal'),
      prio: (c) => 5 + (ageOf(c) >= 60 ? 1 : 0),
    },
    {
      id: 'lv_pflanzen', dim: 'ernaehrung', topic: 'pflanzen',
      rec: 'er_vielfalt',
      when: (c) => oneOf(c.a.pflanzenvielfalt, 'u10', 'v10_17'),
      prio: (c) => (c.a.pflanzenvielfalt === 'u10' ? 4.5 : 3.5),
    },
    {
      id: 'lv_omega', dim: 'ernaehrung', topic: 'omega3',
      rec: 'er_omega3',
      when: (c) => c.a.omega3 === 'nie',
      prio: () => 3.5,
    },
    {
      id: 'lv_saettigung', dim: 'ernaehrung', topic: 'saettigung',
      rec: 'er_saettigung',
      when: (c) => oneOf(c.a.saettigung, 'nie', 'selten', 'manchmal'),
      prio: () => 4.2,
    },

    /* ---- Schlaf ---- */
    {
      id: 'lv_schlaf_abklaerung', dim: 'schlaf', topic: 'schlaf_medizinisch',
      action: schlafAbklaerungAction,
      absorbs: ['schlafqualitaet'],
      covers: ['sl_qualitaet'],
      when: (c) => c.a.schlaf_auswirkung === 'massiv',
      prio: () => 7.5,
    },
    {
      id: 'lv_schlafdauer', dim: 'schlaf', topic: 'schlafdauer',
      rec: 'sl_dauer',
      when: (c) => oneOf(c.a.schlafdauer, 'u5', 's5_6', 's6_7'),
      prio: (c) => (c.a.schlafdauer === 'u5' ? 7 : (c.a.schlafdauer === 's5_6' ? 5.5 : 4))
        + (oneOf(c.a.schlaf_auswirkung, 'deutlich', 'massiv') ? 0.5 : 0),
    },
    {
      id: 'lv_bildschirm_abend', dim: 'schlaf', topic: 'schlafrhythmus',
      action: bildschirmAbendAction,
      absorbs: ['socialmedia'],
      covers: ['ei_socialmedia'],
      when: (c) => oneOf(c.a.socialmedia, 'oft', 'sehr_oft')
        && (oneOf(c.a.schlafrhythmus, 'unregelmaessig', 'sehr_unregelmaessig') || oneOf(c.a.schlafqualitaet, 'schlecht', 'sehr_schlecht')),
      prio: () => 5.2,
    },
    {
      id: 'lv_schlafrhythmus', dim: 'schlaf', topic: 'schlafrhythmus',
      rec: 'sl_rhythmus',
      when: (c) => oneOf(c.a.schlafrhythmus, 'unregelmaessig', 'sehr_unregelmaessig'),
      prio: (c) => (c.a.schlafrhythmus === 'sehr_unregelmaessig' ? 6 : 4.5),
    },
    {
      id: 'lv_schlafqualitaet', dim: 'schlaf', topic: 'schlafqualitaet',
      rec: 'sl_qualitaet',
      when: (c) => oneOf(c.a.schlafqualitaet, 'schlecht', 'sehr_schlecht')
        || oneOf(c.a.schlaf_auswirkung, 'spuerbar', 'deutlich', 'massiv'),
      prio: (c) => oneOf(c.a.schlaf_auswirkung, 'deutlich', 'massiv') ? 5.5 : 5,
    },

    /* ---- Mentale Gesundheit ---- */
    {
      id: 'lv_mental_support', dim: 'mental', topic: 'mental_support',
      rec: 'me_unterstuetzung',
      when: (c) => c.sig.has('hohe_belastung'),
      prio: () => 8,
    },
    {
      id: 'lv_selbstfuersorge', dim: 'mental', topic: 'erholung',
      rec: 'me_selbstfuersorge',
      when: (c) => oneOf(c.a.selbstfuersorge, 'eher_nicht', 'gar_nicht'),
      prio: () => 5.5,
    },
    {
      id: 'lv_stresskompetenz', dim: 'mental', topic: 'stress',
      rec: 'me_belastung',
      when: (c) => oneOf(c.a.belastbarkeit, 'eher_nicht', 'gar_nicht')
        || oneOf(c.a.selbstwirksamkeit, 'eher_nicht', 'gar_nicht')
        || oneOf(c.a.coping, 'eher_nicht', 'gar_nicht'),
      prio: () => 5.2,
    },
    {
      id: 'lv_verbundenheit', dim: 'mental', topic: 'sozial',
      rec: 'me_sozial',
      when: (c) => oneOf(c.a.verbundenheit, 'eher_nicht', 'gar_nicht'),
      prio: () => 5,
    },
  ];

  function attachLeverCopy(rule) {
    const prefix = 'recommendation.lever.' + rule.id + '.';
    let detail;
    if (rule.id === 'lv_kardio') {
      detail = (c) => copyFormat(prefix + 'detail.with_risk_factors', {
        riskFactors: joinList(cvRiskPattern(c).why.slice(0, 3)),
      });
    } else if (rule.id === 'lv_ausdauer') {
      detail = (c) => copyGet(prefix + 'detail.' + (
        oneOf(c.a.treppen, 'deutlich', 'sehr_stark') ? 'stairs_difficult' : 'default'
      ));
    } else if (rule.id === 'lv_kraft') {
      detail = (c) => copyGet(prefix + 'detail.' + (ageOf(c) >= 50 ? 'age_50_plus' : 'under_50'));
    } else if (rule.id === 'lv_protein') {
      detail = (c) => copyGet(prefix + 'detail.' + (ageOf(c) >= 60 ? 'age_60_plus' : 'under_60'));
    } else if (rule.id === 'lv_koerperprofil') {
      detail = bodyProfileLeverDetail;
    } else {
      detail = copyGet(prefix + 'detail');
    }
    return Object.assign({}, rule, { label: copyGet(prefix + 'label'), detail });
  }

  const LEVERS = LEVER_RULES.map(attachLeverCopy);

  function hasOpenFitnessAction(c) {
    return CATALOG.some((record) => record.dim === 'fitness' && safeCheck(record.when, c));
  }

  function hasBroadlyConfirmedTopFitness(c) {
    const scorableTests = (c.fitnessTests || []).filter((test) => test.scorable);
    const testComponents = new Set(scorableTests.map((test) => test.scoreComponent));
    return Number(c.scores.fitness) >= 90
      && c.activity.hasData
      && c.activity.goalMet
      && testComponents.has('musculature')
      && testComponents.has('balance')
      && scorableTests.every((test) => test.norm === 2)
      && !c.sig.has('stabilitaet')
      && !hasOpenFitnessAction(c);
  }

  /*
   * Stärken-Katalog: konkrete, antwortbasierte Schutzfaktoren.
   * `salience` beschreibt die persönliche Aussagebreite, nicht ein klinisches
   * Risikogewicht: 3 = streng bestätigtes Mehrquellenprofil, 2 = erreichtes
   * Ziel oder konsistentes Mehrfachmuster, 1 = einzelne aktive Ressource,
   * 0 = einzelner Schutz-/Kontextfaktor.
   */
  const STRENGTH_RULES = [
    {
      id: 'st_fitness_top', dim: 'fitness', salience: 3, w: 10,
      when: hasBroadlyConfirmedTopFitness,
    },
    {
      id: 'st_rauchfrei', dim: 'einfluss', salience: 0, w: 8,
      when: (c) => c.a.rauchen === 'nie',
    },
    {
      id: 'st_rauchstopp', dim: 'einfluss', salience: 2, w: 7.5,
      when: (c) => c.a.rauchen === 'frueher',
    },
    {
      id: 'st_bewegung', dim: 'fitness', salience: 2, w: 7,
      when: (c) => c.activity.goalMet,
    },
    {
      id: 'st_kraft', dim: 'fitness', salience: 2, w: 6.5,
      when: (c) => oneOf(c.a.krafttraining, 'tage2', 'tage3plus'),
    },
    {
      id: 'st_schlaf', dim: 'schlaf', salience: 2, w: 6.5,
      when: (c) => c.a.schlafdauer === 's7_9'
        && oneOf(c.a.schlafqualitaet, 'sehr_gut', 'gut')
        && oneOf(c.a.schlafrhythmus, 'sehr_regelmaessig', 'regelmaessig')
        && oneOf(c.a.schlaf_auswirkung, 'gar_nicht', 'kaum'),
    },
    {
      id: 'st_ernaehrung_clean', dim: 'ernaehrung', salience: 2, w: 6,
      when: (c) => oneOf(c.a.verarbeitet, 'nie', 'u1woche') && oneOf(c.a.zuckergetraenke, 'nie', 'u1woche'),
    },
    {
      id: 'st_resilienz', dim: 'mental', salience: 2, w: 6,
      when: (c) => oneOf(c.a.belastbarkeit, 'voll', 'eher') && oneOf(c.a.coping, 'voll', 'eher'),
    },
    {
      id: 'st_alkohol', dim: 'einfluss', salience: 0, w: 6,
      when: (c) => c.a.alkohol === 'nie_selten',
    },
    {
      id: 'st_pflanzen', dim: 'ernaehrung', salience: 1, w: 5.5,
      when: (c) => oneOf(c.a.pflanzenvielfalt, 'v26_34', 'ue35'),
    },
    {
      id: 'st_sinn', dim: 'mental', salience: 2, w: 5.5,
      when: (c) => oneOf(c.a.sinnhaftigkeit, 'voll', 'eher') && oneOf(c.a.positive_emotionen, 'voll', 'eher'),
    },
    {
      id: 'st_erholsamer_schlaf', dim: 'schlaf', salience: 2, w: 5,
      // Nur eine echte Stärke, wenn neben der Qualität auch Dauer und
      // Alltagswirkung stimmen – sonst Widerspruch zu den Schlaf-Hebeln.
      when: (c) => oneOf(c.a.schlafqualitaet, 'sehr_gut', 'gut')
        && c.a.schlafdauer === 's7_9'
        && oneOf(c.a.schlaf_auswirkung, 'gar_nicht', 'kaum'),
    },
    {
      id: 'st_alltagsfit', dim: 'fitness', salience: 2, w: 5,
      when: (c) => c.a.beweglichkeit === 'gar_nicht' && oneOf(c.a.treppen, 'gar_nicht', 'kaum') && c.a.einkaufstaschen === 'gar_nicht',
    },
    {
      id: 'st_sozial', dim: 'mental', salience: 1, w: 5,
      when: (c) => c.a.verbundenheit === 'voll',
    },
    {
      id: 'st_sicherheit', dim: 'einfluss', salience: 1, w: 5,
      when: (c) => c.a.stabilitaet === 'sehr_sicher' && ageOf(c) >= 60,
    },
    {
      id: 'st_vorsorge', dim: 'einfluss', salience: 1, w: 4.5,
      when: (c) => c.a.vorsorge === 'aktuell' && c.a.familienwissen === 'ja',
    },
    {
      id: 'st_protein', dim: 'ernaehrung', salience: 1, w: 4,
      when: (c) => oneOf(c.a.protein, 'meistens', 'fast_immer'),
    },
  ];

  const STRENGTHS = STRENGTH_RULES.map((rule) => {
    const prefix = 'recommendation.strength.' + rule.id + '.';
    return Object.assign({}, rule, {
      label: copyGet(prefix + 'label'),
      detail: copyGet(prefix + 'detail'),
    });
  });

  /**
   * Grösste Hebel: pro Dimension der prioritärste Eintrag, global nach
   * Priorität (Tiebreak: tieferer Dimensions-Score zuerst) sortiert,
   * Themen-Dedup über Dimensionen hinweg (z. B. «Balance» nur einmal).
   */
  function keyLevers(ctx, max = 3) {
    const candidates = [];
    LEVERS.forEach((L, index) => {
      if (!safeCheck(L.when, ctx)) return;
      if (!L.summaryOnly && !leverAction(L, ctx)) return;
      let p = 0;
      try { p = L.prio(ctx) || 0; } catch (e) { p = 0; }
      if (p <= 0) return;
      candidates.push({ L, p, index });
    });
    const dims = (typeof window !== 'undefined' && window.SCORED_DIMENSIONS) || [];
    // Alle Kandidaten bleiben bis zur Themen-Deduplizierung erhalten. Kollidiert
    // der stärkste Hebel einer Dimension mit einem bereits gewählten Thema,
    // kann so der nächstbeste, thematisch eigenständige Hebel nachrücken.
    const items = candidates.sort((x, y) =>
      (y.p - x.p)
      || ((ctx.scores[x.L.dim] ?? 50) - (ctx.scores[y.L.dim] ?? 50))
      || (x.index - y.index));
    const out = [];
    const topics = new Set();
    const dimensionCounts = new Map();
    for (const it of items) {
      if (out.length >= max) break;
      // Wie im Aktionsplan darf ein zweiter, sehr hoch priorisierter Hebel
      // derselben Dimension sichtbar bleiben. Das schützt insbesondere einen
      // medizinischen Kardio-Check davor, durch Rauchstopp verdrängt zu werden.
      // Mehr als zwei Themen derselben Dimension würden andere dringende
      // Gesundheitsbereiche aus der dreiteiligen Kurzliste verdrängen.
      const dimensionCount = dimensionCounts.get(it.L.dim) || 0;
      const permitsSecond = it.p >= 8 || it.L.summaryOnly || it.L.scoreIndependent;
      if (dimensionCount >= 2 || (dimensionCount >= 1 && !permitsSecond)) continue;
      if (it.L.topic && topics.has(it.L.topic)) continue;
      if (it.L.topic) topics.add(it.L.topic);
      (it.L.absorbs || []).forEach((topic) => topics.add(topic));
      dimensionCounts.set(it.L.dim, dimensionCount + 1);
      const d = dims.find((x) => x.id === it.L.dim) || { title: it.L.dim, short: it.L.dim };
      out.push({
        id: it.L.id,
        dim: it.L.dim,
        dimTitle: d.title,
        short: d.short,
        score: ctx.scores[it.L.dim],
        label: it.L.label,
        detail: typeof it.L.detail === 'function' ? it.L.detail(ctx) : (it.L.detail || ''),
        summaryOnly: !!it.L.summaryOnly,
        scoreIndependent: !!it.L.scoreIndependent,
      });
    }
    return out;
  }

  /**
   * Konkrete Stärken: nach Aussagebreite, Dimensionsscore und bestehendem
   * Fachgewicht sortiert, max. eine pro Dimension.
   * Fallback bei sehr belastetem Profil: die relativ stabilste Dimension
   * als Anker benennen.
   */
  function keyStrengths(ctx, max = 3) {
    const dims = (typeof window !== 'undefined' && window.SCORED_DIMENSIONS) || [];
    const hits = STRENGTHS
      .map((strength, index) => {
        const score = ctx.scores[strength.dim] ?? 50;
        // Ein starkes Teilmuster in einer insgesamt nicht starken Dimension
        // bleibt sichtbar, verliert aber den Mehrfachmuster-Vorrang.
        const salience = strength.salience >= 2 && score < 80 ? 1 : strength.salience;
        return { strength, index, score, salience };
      })
      .filter((item) => safeCheck(item.strength.when, ctx))
      .sort((a, b) => (b.salience - a.salience)
        || (b.score - a.score)
        || (b.strength.w - a.strength.w)
        || (a.index - b.index));
    const out = [];
    const used = new Set();
    for (const item of hits) {
      if (out.length >= max) break;
      const s = item.strength;
      if (used.has(s.dim)) continue;
      // Kohärenz: keine «Stärke» in einer Dimension, die insgesamt klar
      // schwach abschneidet – sonst widerspricht die Karte den Handlungsfeldern.
      if ((ctx.scores[s.dim] ?? 50) < 45) continue;
      used.add(s.dim);
      out.push({
        id: s.id,
        dim: s.dim,
        label: s.label,
        detail: typeof s.detail === 'function' ? s.detail(ctx) : s.detail,
      });
    }
    if (!out.length && dims.length) {
      const best = dims
        .map((d) => ({ d, s: ctx.scores[d.id] ?? 50 }))
        .sort((a, b) => b.s - a.s)[0];
      out.push({
        id: 'fallback',
        dim: best.d.id,
        label: copyFormat('recommendation.strength.fallback.label', { dimensionTitle: best.d.title }),
        detail: copyGet('recommendation.strength.fallback.detail'),
      });
    }
    return out;
  }

  /** Löst die zu einem Hebel gehörende Aktionskarte auf (Katalog oder Spezial). */
  function leverAction(L, ctx) {
    let rec;
    if (typeof L.action === 'function') rec = L.action(ctx);
    else {
      const recId = typeof L.rec === 'function' ? L.rec(ctx) : L.rec;
      const catalogRecord = CATALOG.find((r) => r.id === recId) || null;
      rec = catalogRecord && safeCheck(catalogRecord.when, ctx) ? catalogRecord : null;
    }
    if (!rec || !Array.isArray(L.covers) || !L.covers.length) return rec;
    return Object.assign({}, rec, { covers: L.covers.slice() });
  }

  /**
   * Aktionsplan («Ihre nächsten drei Schritte») – EIN Gehirn mit den
   * Handlungsfeldern: dieselben Hebel, dieselben Prioritäten.
   *
   * Reihenfolge:
   *   0) Kritische Katalog-Einträge (z. B. mentale Unterstützung) immer zuerst.
   *   1) Feuernde Hebel in globaler Prioritätsreihenfolge, Themen-Dedup über
   *      alles hinweg. Eine ZWEITE Karte derselben Dimension ist nur für
   *      Top-Hebel (Priorität ≥ 8) erlaubt – so entsteht z. B. bewusst
   *      «Kardio-Vorsorge-Check» + «Rauchstopp» nacheinander, während sonst
   *      die Breite über die Dimensionen erhalten bleibt.
   *   2) Auffüllen mit klassisch getriggerten Empfehlungen (Breite zuerst,
   *      danach notfalls ohne Dimensions-Beschränkung).
   */
  function actionPlan(ctx, max = 3) {
    const picked = [];
    const usedTopics = new Set();
    const usedDims = {};
    const usedIds = new Set();

    const push = (rec, leverTopic, absorbs) => {
      if (!rec || usedIds.has(rec.id)) return false;
      picked.push(rec);
      usedIds.add(rec.id);
      usedDims[rec.dim] = (usedDims[rec.dim] || 0) + 1;
      if (leverTopic) usedTopics.add(leverTopic);
      if (rec.topic) usedTopics.add(rec.topic);
      (absorbs || []).forEach((t) => usedTopics.add(t));
      return true;
    };

    // 0) Kritische Empfehlungen (Sicherheit vor Systematik)
    CATALOG.filter((r) => r.critical && safeCheck(r.when, ctx)).forEach((r) => {
      if (picked.length < max) push(r, null, null);
    });

    // 1) Hebel-getrieben
    const fired = LEVERS
      .filter((L) => !L.summaryOnly && safeCheck(L.when, ctx))
      .map((L) => {
        let p = 0;
        try { p = L.prio(ctx) || 0; } catch (e) { p = 0; }
        return { L, p };
      })
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p);

    for (const { L, p } of fired) {
      if (picked.length >= max) break;
      if (L.topic && usedTopics.has(L.topic)) continue;
      const dimensionCount = usedDims[L.dim] || 0;
      if (dimensionCount >= 2 || (dimensionCount >= 1 && p < 8)) continue;
      const rec = leverAction(L, ctx);
      if (!rec) continue;
      if (rec.topic && usedTopics.has(rec.topic)) continue;
      push(rec, L.topic, L.absorbs);
    }

    // 2) Auffüllen aus dem Katalog (erst mit, dann ohne Dimensions-Breite)
    const triggered = CATALOG.filter((r) => safeCheck(r.when, ctx))
      .map((r) => ({ r, p: priority(r) }))
      .sort((a, b) => b.p - a.p);
    triggered.forEach(({ r }) => {
      if (picked.length >= max) return;
      if (usedIds.has(r.id)) return;
      if (r.topic && usedTopics.has(r.topic)) return;
      if ((usedDims[r.dim] || 0) >= 1) return;
      push(r, null, null);
    });
    triggered.forEach(({ r }) => {
      if (picked.length >= max) return;
      if (usedIds.has(r.id)) return;
      if (r.topic && usedTopics.has(r.topic)) return;
      if ((usedDims[r.dim] || 0) >= 2) return;
      push(r, null, null);
    });

    return addBodyContext(picked.slice(0, max).map((r) => withPlan(r, ctx)), ctx);
  }

  /* =====================================================================
   * Externe Fachquellen (verifizierte URLs, Stand Juli 2026)
   * ---------------------------------------------------------------------
   * Bewusst unabhängige Schweizer Fachstellen. Bitte vor Produktivgang
   * erneut prüfen (Linkrot) und mit Kommunikation/Legal freigeben.
   * ===================================================================== */
  const SOURCE_CONFIG = {
    swissheart_blutfette: {
      // Der frühere Zielpfad wird nicht mehr verwendet. Bis zur nächsten
      // Fachreview verweist auch dieser Kontext auf die verifizierte offizielle
      // Werte-Übersicht der Schweizerischen Herzstiftung.
      href: 'https://swissheart.ch/wissen-und-support/dossiers/diese-werte-muessen-sie-kennen',
    },
    swissheart_lpa: {
      href: 'https://swissheart.ch/wissen-und-support/dossiers/das-cholesterin-im-stammbaum',
    },
    swissheart_werte: {
      href: 'https://swissheart.ch/wissen-und-support/dossiers/diese-werte-muessen-sie-kennen',
    },
    stopsmoking: {
      href: 'https://www.stopsmoking.ch/',
    },
    bag_bewegung: {
      href: 'https://www.hepa.admin.ch/de/bewegungsempfehlungen',
    },
    morton_protein: {
      href: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
    },
  };

  const SOURCES = Object.keys(SOURCE_CONFIG).reduce((out, id) => {
    out[id] = Object.assign({}, SOURCE_CONFIG[id], {
      label: copyGet('recommendation.source.' + id + '.label'),
    });
    return out;
  }, {});
  Object.keys(SOURCES).forEach((id) => Object.freeze(SOURCES[id]));
  Object.freeze(SOURCES);

  /* =====================================================================
   * 4-Wochen-Pläne mit Substanz
   * ---------------------------------------------------------------------
   * Ersetzen die generischen Dimensions-Floskeln. Jeder Schritt ist
   * konkret, überprüfbar und trägt – wo sinnvoll – eine Fachquelle.
   * Werte-Angaben bleiben Orientierung, keine Diagnose oder Therapie.
   * Eintrag = Array ODER Funktion(ctx) → Array (für personalisierte Pläne).
   * ===================================================================== */
  const PLAN_CONFIG = {
    act_kardio: [{}, { source: 'swissheart_lpa' }, { source: 'swissheart_blutfette' }],
    ei_rauchstopp: [{ source: 'stopsmoking' }, {}, {}],
    ei_bluthochdruck: [{}, { source: 'swissheart_werte' }, { source: 'swissheart_blutfette' }],
    ei_bd_messen: [{}, { source: 'swissheart_werte' }, {}],
    fi_einstieg: [{}, {}, {}],
    fi_ausdauer: [{}, {}, {}],
    fi_kraft: [{}, {}, {}],
    sl_dauer: [{}, {}, {}],
    sl_rhythmus: [{}, {}, {}],
    er_getraenke: [{}, {}, {}],
    me_unterstuetzung: [{}, {}, {}],
    ei_stabilitaet: [{}, {}, {}],
    ei_vorsorge: [{ source: 'swissheart_werte' }, {}, {}],
    // Die Frage umfasst neben Herz-Kreislauf-Erkrankungen auch Diabetes und
    // andere erbliche Erkrankungen. Deshalb hier keine pauschale Herzquelle
    // verlinken; die passende Abklärung hängt von der konkreten Familienanamnese ab.
    ei_familie: [{}, {}, {}],
    fi_beweglichkeit: [{}, {}, {}],
    fi_kondition: [{}, { source: 'bag_bewegung' }, {}],
    er_omega3: [{}, {}, {}],
    er_saettigung: [{}, {}, {}],
    me_sinn: [{}, {}, {}],
    ei_alkohol: [{}, {}, {}],
    ei_sitzen: [{}, {}, {}],
    ei_socialmedia: [{}, {}, {}],
    ei_familienwissen: [{}, {}, {}],
    ei_vorsorgewissen: [{}, {}, {}],
    er_protein: (ctx) => [{}, proteinEvidenceApplies(ctx) ? { source: 'morton_protein' } : {}, {}],
    er_vielfalt: [{}, {}, {}],
    er_verarbeitet: [{}, {}, {}],
    sl_qualitaet: [{}, {}, {}],
    me_belastung: [{}, {}, {}],
    me_sozial: [{}, {}, {}],
    me_selbstfuersorge: [{}, {}, {}],
    act_schlaf_abklaerung: [{}, {}, {}],
    act_bildschirm_abend: [{}, {}, {}],
  };

  const PLAN_PERIOD_IDS = ['this_week', 'weeks_2_3', 'week_4'];
  const PLAN_PERIOD_LABEL_IDS = ['this_week', 'weeks_2_3', 'week_4'];

  function proteinEvidenceApplies(ctx) {
    return ageOf(ctx) >= 18 && oneOf(ctx.a.krafttraining, 'tage2', 'tage3plus');
  }

  function planTextId(recId, index, ctx) {
    const base = 'recommendation.plan.' + recId + '.' + PLAN_PERIOD_IDS[index];
    if (recId === 'act_kardio' && index === 2) {
      return base + '.' + (ageOf(ctx) >= 40 ? 'age_40_plus' : 'under_40');
    }
    if (recId === 'fi_kraft' && index === 0) {
      if (ctx.a.krafttraining === 'tage1') return base + '.one_day';
      if (ctx.a.krafttraining === 'tage0') return base + '.zero_days';
      return base + '.test_result';
    }
    if (recId === 'fi_kraft' && index === 1) {
      return base + '.' + (ageOf(ctx) >= 60 ? 'age_60_plus' : 'under_60');
    }
    if (recId === 'sl_dauer' && index === 0) {
      if (ctx.a.schlafdauer === 'u5') return base + '.under_5_hours';
      if (ctx.a.schlafdauer === 's5_6') return base + '.five_to_six_hours';
      return base + '.six_to_seven_hours';
    }
    if (recId === 'er_protein' && index === 1 && proteinEvidenceApplies(ctx)) {
      return base + '.strength_training';
    }
    return base;
  }

  function attachPlanCopy(recId, rawPlan, ctx) {
    return rawPlan.map((step, index) => Object.assign({}, step, {
      label: copyGet('ui.plan.period.' + PLAN_PERIOD_LABEL_IDS[index]),
      text: copyGet(planTextId(recId, index, ctx)),
    }));
  }

  function fitnessRetestItems(recId, ctx) {
    const testIds = recId === 'fi_kraft'
      ? ['liegestuetze', 'wandsitz']
      : (recId === 'fi_beweglichkeit' ? ['einbeinstand'] : []);
    return testIds.map((id) => fitnessTest(ctx, id)).filter(actionableFitnessTest).map((test) => {
      if (test.id === 'einbeinstand') {
        return {
          id: test.id,
          text: copyFormat('recommendation.fitness_test.retest.einbeinstand', {
            baselineValue: test.value,
            orientationValue: test.nextThreshold,
          }),
        };
      }
      if (test.id === 'liegestuetze') {
        return {
          id: test.id,
          text: copyFormat('recommendation.fitness_test.retest.liegestuetze', {
            baselineValue: test.value,
            orientationValue: test.nextThreshold,
          }),
        };
      }
      const isHypertensionCaution = ctx.a.bluthochdruck === 'ja';
      const retestText = isHypertensionCaution
        ? copyFormat('recommendation.fitness_test.retest.wandsitz.medical_clearance', {
          baselineValue: test.value,
        })
        : copyFormat('recommendation.fitness_test.retest.wandsitz', {
          baselineValue: test.value,
          orientationValue: test.nextThreshold,
        });
      return {
        id: test.id,
        caution: isHypertensionCaution,
        text: retestText,
      };
    });
  }

  const PLANS = Object.keys(PLAN_CONFIG).reduce((out, recId) => {
    const configured = PLAN_CONFIG[recId];
    out[recId] = typeof configured === 'function'
      ? (ctx) => attachPlanCopy(recId, configured(ctx), ctx)
      : (ctx) => attachPlanCopy(recId, configured, ctx);
    return out;
  }, {});

  /* Ein ungünstiger Körpermarker erzeugt keine neuen Defizite in anderen
   * Dimensionen. Er ergänzt nur die erste ohnehin ausgelöste, fachlich passende
   * Empfehlung je Dimension um einen kurzen persönlichen Zusammenhang. */
  const BODY_CONTEXT_RECOMMENDATIONS = Object.freeze({
    fi_einstieg: 'fitness',
    fi_ausdauer: 'fitness',
    fi_kraft: 'fitness',
    fi_kondition: 'fitness',
    er_getraenke: 'ernaehrung',
    er_verarbeitet: 'ernaehrung',
    er_vielfalt: 'ernaehrung',
    er_saettigung: 'ernaehrung',
    sl_dauer: 'schlaf',
    sl_qualitaet: 'schlaf',
    sl_rhythmus: 'schlaf',
    me_belastung: 'mental',
    me_selbstfuersorge: 'mental',
  });

  function addBodyContext(records, ctx) {
    if (!ctx || !ctx.m || !ctx.m.bodyRisk || !ctx.m.bodyRisk.severity) return records;
    const usedDimensions = new Set();
    return records.map((record) => {
      if (record.bodyContext) usedDimensions.add(record.dim);
      const contextDimension = BODY_CONTEXT_RECOMMENDATIONS[record.id];
      if (!contextDimension || usedDimensions.has(contextDimension)) return record;
      usedDimensions.add(contextDimension);
      return Object.assign({}, record, {
        bodyContext: copyGet('recommendation.body_context.' + contextDimension),
      });
    });
  }

  /** Hängt – falls vorhanden – den massgeschneiderten Plan an eine Empfehlung. */
  function withPlan(rec, ctx) {
    const p = PLANS[rec.id];
    if (!p) return rec;
    const retests = fitnessRetestItems(rec.id, ctx);
    const plan = p(ctx);
    return Object.assign({}, rec, {
      plan: plan.map((s, index) => Object.assign({}, s, {
        sourceRef: s.source ? SOURCES[s.source] : null,
        retests: index === 2 && retests.length ? retests.map((item) => Object.assign({}, item)) : [],
      })),
    });
  }

  const SIGNAL_SEVERITY_RANK = Object.freeze({ hoch: 0, mittel: 1, tief: 2 });

  function signalItem(results, signal) {
    const presentation = SIGNAL_PRESENTATION[signal.id];
    const signalCopy = SIGNAL_COPY[signal.id];
    if (!presentation || !signalCopy) return null;
    const item = {
      id: signal.id,
      type: signal.type,
      severity: signal.severity,
      dimension: presentation.dimension,
      relatedRecommendationIds: presentation.relatedRecommendationIds.slice(),
      title: signalCopy.title,
      insight: signalCopy.insight,
      action: signal.id === 'koerperzusammensetzung' && results.metrics && results.metrics.waist
        ? copyGet('recommendation.signal.koerperzusammensetzung.action.with_waist')
        : (signalCopy.action || null),
      clarify: signalCopy.clarify || null,
      benefit: signalCopy.benefit || null,
      deepen: signalCopy.deepen || null,
    };
    if (signal.id === 'koerperzusammensetzung') {
      item.insight = bodyProfileInsight(results.metrics || {});
    }
    return item;
  }

  function sortSignals(a, b) {
    return (SIGNAL_SEVERITY_RANK[a.severity] ?? 3) - (SIGNAL_SEVERITY_RANK[b.severity] ?? 3);
  }

  /**
   * Liefert nur nicht bereits priorisierte Signalhinweise, gruppiert nach der
   * Dimension, in der sie auf der Ergebnisseite erscheinen. Ein Hinweis wird
   * vollständig unterdrückt, sobald einer seiner stabilen Empfehlungs-IDs im
   * Aktionsplan steht; die ausführliche Top-Karte wird dort bereits gespiegelt.
   */
  function dimensionInsights(results, planRecs) {
    const out = { einfluss: [], fitness: [], ernaehrung: [], schlaf: [], mental: [] };
    const planIds = new Set((planRecs || []).map((record) => record.id));
    (results.signals || []).forEach((signal) => {
      const item = signalItem(results, signal);
      if (!item) return;
      if (item.relatedRecommendationIds.some((id) => planIds.has(id))) return;
      out[item.dimension].push(item);
    });
    Object.keys(out).forEach((dimension) => out[dimension].sort(sortSignals));
    return out;
  }

  /**
   * Reichert die Risikosignale zu Quick Insights an und markiert jene,
   * die bereits im Aktionsplan als Schritt erscheinen (Dedup ohne Verlust).
   * @returns {{medical: Array, lifestyle: Array}}
   */
  function signalInsights(results, planRecs) {
    const planIndex = {};
    (planRecs || []).forEach((r, i) => { planIndex[r.id] = i + 1; });

    const out = { medical: [], lifestyle: [] };
    (results.signals || []).forEach((s) => {
      const item = signalItem(results, s);
      if (!item) return;
      let step = 0;
      item.relatedRecommendationIds.forEach((rid) => { if (planIndex[rid]) step = planIndex[rid]; });
      item.planStep = step || null;
      (s.type === 'medizinisch' ? out.medical : out.lifestyle).push(item);
    });

    out.medical.sort(sortSignals);
    out.lifestyle.sort(sortSignals);
    return out;
  }

  window.Recommendations = Object.freeze({
    buildContext,
    recommendationsForDimension,
    topThree,
    actionPlan,
    keyStrengths,
    keyLevers,
    fitnessTestInsights,
    dimensionInsights,
    signalInsights,
    dimensionFeedbackTone,
    hasOpenDimensionSignal,
    SOURCES,
    SOLIDS,
    POSITIVES,
    CATALOG,
  });
})();
