#!/usr/bin/env node
'use strict';

/* Dependency-freie Regressionstests fuer scripts/result-content.js. */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Workflow = require('../scripts/result-content.js');
const PROJECT_ROOT = path.join(__dirname, '..');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function fixtureEntry(overrides) {
  return Object.assign({
    id: 'result.test.primary',
    section: 'Testbereich',
    context: 'Testausspielung',
    kind: 'rich_text',
    reviewers: 'Marketing, Medizin',
    text: 'Zeile 1; "Zitat"\n<b>Hallo {{name}}</b>',
    requiredTerms: ['Zitat'],
    reviewStatus: 'approved',
    comment: 'Fachlicher Ausgangshinweis',
    reviewComment: 'Ausgangskommentar',
  }, overrides || {});
}

function writeFixture(root, entries) {
  const contentDir = path.join(root, 'content', 'result-texts');
  fs.mkdirSync(contentDir, { recursive: true });
  const data = {
    schemaVersion: 1,
    locale: 'de-CH',
    domain: 'test',
    entries: entries || [fixtureEntry()],
  };
  fs.writeFileSync(path.join(contentDir, 'test.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
  return {
    contentDir,
    jsonFile: path.join(contentDir, 'test.json'),
    generatedFile: path.join(root, 'js', 'result-copy.generated.js'),
    exportFile: path.join(root, 'exports', 'result-texte-de-CH.csv'),
    overviewFile: path.join(root, 'exports', 'result-texte-uebersicht.md'),
    csvFile: path.join(root, 'review.csv'),
  };
}

function withTempFixture(entries, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'result-content-test-'));
  try {
    const paths = writeFixture(root, entries);
    return fn(paths, root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeTranslationFixture(paths, locale, transform) {
  const base = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'de-CH' });
  const localeDir = path.join(paths.contentDir, 'locales', locale);
  fs.mkdirSync(localeDir, { recursive: true });
  base.files.forEach((file) => {
    const records = base.entries.filter((record) => record.domain === file.data.domain);
    const entries = records.map((record) => {
      const translated = {
        id: record.id,
        text: locale + ': ' + record.entry.text,
        requiredTerms: (record.entry.requiredTerms || []).slice(),
        reviewStatus: 'needs-review',
        translationState: 'translated',
        reviewComment: '',
        sourceContractHash: Workflow.computeTranslationSourceContractHash(record),
      };
      return transform ? transform(translated, record) || translated : translated;
    });
    fs.writeFileSync(path.join(localeDir, file.name), JSON.stringify({
      schemaVersion: 1,
      locale,
      domain: file.data.domain,
      entries,
    }, null, 2) + '\n', 'utf8');
  });
}

function writeAllTranslationFixtures(paths) {
  ['en-CH', 'fr-CH', 'it-CH'].forEach((locale) => writeTranslationFixture(paths, locale));
}

function csvWithReplacement(catalog, id, replacement, comment) {
  const rows = Workflow.catalogToCsvRows(catalog);
  const row = rows.find((item) => item['ID (technisch)'] === id);
  assert.ok(row, 'Fixture-ID im Export gefunden');
  row['Neuer Text'] = replacement;
  if (comment !== undefined) row['Review-Kommentar'] = comment;
  return Workflow.serializeCsv(rows);
}

test('Echter Katalog ist valide und alle generierten Artefakte sind aktuell', () => {
  const catalog = Workflow.loadCatalog();
  const summary = Workflow.validateCatalog(catalog);
  assert.ok(summary.domains >= 7, 'vollstaendiger mehrsprachiger Text-Domain-Vertrag erwartet');
  assert.ok(summary.entries >= 700, 'vollstaendiger Ergebnis-Textkatalog erwartet');
  const checked = Workflow.checkGenerated();
  assert.strictEqual(checked.entries, summary.entries);
});

test('Installationsmanifeste werden deterministisch aus dem jeweiligen Sprachkatalog erzeugt', () => {
  Workflow.SUPPORTED_LOCALES.forEach((locale) => {
    const catalog = Workflow.loadCatalog({ locale });
    const expected = Workflow.renderWebManifest(catalog);
    const manifestFile = path.join(PROJECT_ROOT, 'manifest.' + locale + '.webmanifest');
    assert.strictEqual(fs.readFileSync(manifestFile, 'utf8'), expected, locale + ': Manifest-Katalogbindung');
    const manifest = JSON.parse(expected);
    assert.strictEqual(manifest.lang, locale);
    assert.strictEqual(manifest.start_url, './');
  });
  assert.strictEqual(
    fs.readFileSync(path.join(PROJECT_ROOT, 'manifest.webmanifest'), 'utf8'),
    fs.readFileSync(path.join(PROJECT_ROOT, 'manifest.de-CH.webmanifest'), 'utf8'),
    'deutscher Kompatibilitaetsalias'
  );
});

test('Alle statischen und variantenbasierten Runtime-Text-IDs existieren', () => {
  const catalog = Workflow.loadCatalog();
  Workflow.validateCatalog(catalog);
  const ids = new Set(catalog.entries.map((record) => record.id));
  const referenced = new Set();
  const missing = new Set();
  const requireId = (id) => {
    referenced.add(id);
    if (!ids.has(id)) missing.add(id);
  };

  // Direkte get()/format()-Aufrufe lassen sich ohne JavaScript-Auswertung prüfen.
  const jsDir = path.join(PROJECT_ROOT, 'js');
  const literalReference = /\b(?:copy\.(?:get|format)|copyGet|copyFormat|window\.ResultCopy\.(?:get|format))\(\s*['"]([a-z][a-z0-9._-]+)['"]\s*(?=[,)])/g;
  fs.readdirSync(jsDir)
    .filter((name) => name.endsWith('.js') && name !== 'result-copy.generated.js')
    .forEach((name) => {
      const source = fs.readFileSync(path.join(jsDir, name), 'utf8');
      let match;
      while ((match = literalReference.exec(source)) !== null) requireId(match[1]);
    });

  // Statische Seitenkopie wird generisch über data-copy-Attribute ausgelesen;
  // die konkrete ID steht deshalb im HTML und nicht als ResultCopy-Literal in
  // page-i18n.js. Auch diese IDs gehören zum nachweisbaren Runtime-Vertrag.
  ['index.html', 'quellen.html'].forEach((name) => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, name), 'utf8');
    const attributeReference = /data-copy(?:-[a-z-]+)?="([a-z][a-z0-9._-]+)"/g;
    let match;
    while ((match = attributeReference.exec(source)) !== null) requireId(match[1]);
  });

  // Bei diesen beiden Ternaries wird die ID erst aus dem UI-Zustand gewählt;
  // der Literal-Scanner oben kann die beiden Äste nicht direkt zuordnen.
  [
    'ui.start.button.continue', 'ui.start.button.begin',
    'ui.quiz.button.results', 'ui.quiz.button.continue',
    Workflow.MANIFEST_COPY_IDS.name,
    Workflow.MANIFEST_COPY_IDS.shortName,
    Workflow.MANIFEST_COPY_IDS.description,
  ].forEach(requireId);

  const recommendationSource = fs.readFileSync(path.join(jsDir, 'recommendations.js'), 'utf8');
  const between = (start, end) => {
    const from = recommendationSource.indexOf(start);
    const to = recommendationSource.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, 'Codebereich nicht gefunden: ' + start);
    return recommendationSource.slice(from, to);
  };
  const objectIds = (source) => [...source.matchAll(/\bid:\s*'([a-z0-9_]+)'/g)].map((match) => match[1]);
  const objectKeys = (source) => [...source.matchAll(/^\s{4}([a-z0-9_]+):/gm)].map((match) => match[1]);

  // Copy wird für diese Regelobjekte über Präfix + stabile Objekt-ID angehängt.
  objectIds(between('const CATALOG_RULES = [', 'const CATALOG =')).forEach((id) => {
    ['title', 'why', 'step', 'benefit'].forEach((field) => requireId(`recommendation.catalog.${id}.${field}`));
  });

  const leverIds = objectIds(between('const LEVER_RULES = [', 'function attachLeverCopy'));
  const leverVariants = {
    lv_kardio: ['detail.with_risk_factors'],
    lv_ausdauer: ['detail.stairs_difficult', 'detail.default'],
    lv_kraft: ['detail.age_50_plus', 'detail.under_50'],
    lv_protein: ['detail.age_60_plus', 'detail.under_60'],
  };
  leverIds.forEach((id) => {
    requireId(`recommendation.lever.${id}.label`);
    (leverVariants[id] || ['detail']).forEach((suffix) => requireId(`recommendation.lever.${id}.${suffix}`));
  });

  objectIds(between('const STRENGTH_RULES = [', 'const STRENGTHS =')).forEach((id) => {
    ['label', 'detail'].forEach((field) => requireId(`recommendation.strength.${id}.${field}`));
  });

  objectKeys(between('const SOURCE_CONFIG = {', 'const SOURCES =')).forEach((id) => {
    requireId(`recommendation.source.${id}.label`);
  });

  const planIds = objectKeys(between('const PLAN_CONFIG = {', 'const PLAN_PERIOD_IDS'));
  planIds.forEach((id) => {
    if (id === 'fi_kraft') {
      ['this_week.zero_days', 'this_week.one_day', 'this_week.test_result', 'weeks_2_3.under_60', 'weeks_2_3.age_60_plus', 'week_4']
        .forEach((suffix) => requireId(`recommendation.plan.${id}.${suffix}`));
    } else if (id === 'sl_dauer') {
      ['this_week.under_5_hours', 'this_week.five_to_six_hours', 'this_week.six_to_seven_hours', 'weeks_2_3', 'week_4']
        .forEach((suffix) => requireId(`recommendation.plan.${id}.${suffix}`));
    } else if (id === 'act_kardio') {
      ['this_week', 'weeks_2_3', 'week_4.under_40', 'week_4.age_40_plus']
        .forEach((suffix) => requireId(`recommendation.plan.${id}.${suffix}`));
    } else if (id === 'er_protein') {
      ['this_week', 'weeks_2_3', 'weeks_2_3.strength_training', 'week_4']
        .forEach((suffix) => requireId(`recommendation.plan.${id}.${suffix}`));
    } else {
      ['this_week', 'weeks_2_3', 'week_4'].forEach((suffix) => requireId(`recommendation.plan.${id}.${suffix}`));
    }
  });

  const signalPresentation = between(
    'const SIGNAL_PRESENTATION = Object.freeze({',
    'const SIGNAL_COPY = Object.keys(SIGNAL_PRESENTATION).reduce'
  );
  const presentationEntries = [...signalPresentation.matchAll(/^\s{4}([a-z0-9_]+):\s*\{/gm)];
  assert.ok(presentationEntries.length > 0, 'keine Signal-Präsentationsverträge gefunden');
  presentationEntries.forEach((match, index) => {
    const end = presentationEntries[index + 1] ? presentationEntries[index + 1].index : signalPresentation.length;
    const block = signalPresentation.slice(match.index, end);
    const fields = block.match(/\bfields:\s*\[([^\]]+)\]/);
    assert.ok(fields, match[1] + ': fields-Vertrag fehlt');
    [...fields[1].matchAll(/'([a-z_]+)'/g)].forEach((field) => {
      requireId(`recommendation.signal.${match[1]}.${field[1]}`);
    });
  });

  [
    'hohe_belastung', 'belastung', 'einsamkeit', 'bluthochdruck',
    'blutdruck_unbekannt', 'familie_hk', 'vorsorge', 'untergewicht',
    'rauchen', 'alkohol', 'koerperzusammensetzung', 'bewegungsmangel',
    'keine_kraft', 'sitzen', 'stabilitaet', 'balance', 'schlaf',
    'socialmedia', 'ernaehrung',
  ].forEach((id) => requireId(`recommendation.risk_signal.${id}.label`));

  [
    'family_history', 'hypertension', 'smoking', 'body_composition',
    'long_sitting', 'low_activity', 'nutrition_pattern', 'alcohol',
  ].forEach((id) => requireId(`recommendation.special.act_kardio.risk_factor.${id}`));
  ['two', 'many'].forEach((id) => requireId(`recommendation.special.act_kardio.risk_factor_list.${id}`));
  [
    'assessment_needed', 'assessment_needed_family_history',
    'assessment_needed_hypertension', 'assessment_needed_family_history_hypertension',
    'already_assessed', 'already_assessed_family_history',
    'already_assessed_hypertension', 'already_assessed_family_history_hypertension',
  ].forEach((id) => requireId(`recommendation.special.act_kardio.step.${id}`));

  ['stark', 'solide', 'ausbau', 'aufmerksam'].forEach((status) => {
    requireId(`service.status_band.${status}.label`);
    requireId(`ui.dimension.classification.${status}`);
    requireId(`ui.hero.lead.balanced.${status}`);
  });
  ['untergewicht', 'normal', 'uebergewicht', 'adipositas1', 'adipositas2']
    .forEach((id) => requireId(`ui.metrics.bmi_class.${id}`));
  ['normal', 'erhoeht', 'hoch'].forEach((id) => requireId(`ui.metrics.waist_status.${id}`));
  ['one', 'two', 'three', 'empty'].forEach((id) => {
    requireId(`ui.action_plan.heading.${id}`);
    requireId(`ui.coach_handoff.plan.${id}`);
  });
  [
    'ui.hero.lead.spread.stark', 'ui.hero.lead.spread.solide',
    'ui.hero.lead.spread.ausbau.anchor_strong.singular',
    'ui.hero.lead.spread.ausbau.anchor_strong.plural',
    'ui.hero.lead.spread.ausbau.anchor_stable.singular',
    'ui.hero.lead.spread.ausbau.anchor_stable.plural',
    'ui.hero.lead.spread.aufmerksam.no_wind',
    'ui.hero.lead.spread.aufmerksam.with_wind.singular',
    'ui.hero.lead.spread.aufmerksam.with_wind.plural',
    'ui.action_plan.intro.one', 'ui.action_plan.intro.multiple',
    'ui.action_plan.intro.empty', 'ui.hero.action_plan_reference.empty', 'ui.hero.action_plan_verb.singular',
    'ui.hero.action_plan_verb.plural',
    'ui.dimension.classification.open_signal',
    'ui.dimension.empty.neutral', 'ui.dimension.empty.open_signal',
  ].forEach(requireId);
  [
    'ui.breathing.cycles.one', 'ui.breathing.cycles.multiple',
    'ui.chat.greeting', 'ui.chat.greeting.empty',
    'ui.plan.period.this_week', 'ui.plan.period.weeks_2_3', 'ui.plan.period.week_4',
    'ui.share_modal.status.copied', 'ui.share_modal.status.manual',
  ].forEach(requireId);

  assert.strictEqual(missing.size, 0, 'Fehlende Runtime-Text-IDs: ' + [...missing].sort().join(', '));
  const unused = [...ids].filter((id) => !referenced.has(id));
  assert.deepStrictEqual(unused, [], 'Katalog-IDs ohne Runtime-Vertrag: ' + unused.sort().join(', '));
});

test('Direkte format-Aufrufe erfüllen den Platzhaltervertrag des Katalogs', () => {
  const catalog = Workflow.loadCatalog();
  Workflow.validateCatalog(catalog);
  const texts = new Map(catalog.entries.map((record) => [record.id, record.entry.text]));
  const failures = [];
  const jsDir = path.join(PROJECT_ROOT, 'js');
  const formatCall = /\b(?:copy\.format|copyFormat|window\.ResultCopy\.format)\(\s*['"]([a-z][a-z0-9._-]+)['"]\s*,/g;

  function directObject(source, start) {
    let cursor = start;
    while (/\s/.test(source[cursor] || '')) cursor++;
    if (source[cursor] !== '{') return null; // Variablenobjekt wird separat typisiert/getestet.
    const begin = cursor;
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (; cursor < source.length; cursor++) {
      const char = source[cursor];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
      if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return source.slice(begin, cursor + 1);
    }
    return null;
  }

  fs.readdirSync(jsDir)
    .filter((name) => name.endsWith('.js') && name !== 'result-copy.generated.js')
    .forEach((name) => {
      const source = fs.readFileSync(path.join(jsDir, name), 'utf8');
      let match;
      while ((match = formatCall.exec(source)) !== null) {
        const values = directObject(source, formatCall.lastIndex);
        if (!values) continue;
        const required = [...String(texts.get(match[1]) || '').matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g)]
          .map((item) => item[1]);
        required.forEach((placeholder) => {
          const supplied = new RegExp('(?:^|[,\\{])\\s*' + placeholder + '\\s*(?::|[,\\}])').test(values);
          if (!supplied) failures.push(`${name}: ${match[1]} fehlt {{${placeholder}}}`);
        });
      }
    });

  assert.deepStrictEqual(failures, []);
});

test('Klartext-Sinks und verschachtelt eingesetzte Hero-Variablen enthalten kein Markup', () => {
  const catalog = Workflow.loadCatalog();
  Workflow.validateCatalog(catalog);
  const nestedTextEntries = catalog.entries.filter((record) =>
    ['label', 'source_label', 'title'].includes(record.entry.kind) ||
    /^recommendation\.signal\./.test(record.id) ||
    /^ui\.hero\.(?:topic(?:_suffix)?\.|dimension\.|action_plan_verb\.)/.test(record.id) ||
    /^ui\.action_plan\.heading\.(?:one|two|three)$/.test(record.id)
  );
  assert.ok(nestedTextEntries.length > 100, 'kuratierten Klartext-Vertrag gefunden');
  nestedTextEntries.forEach((record) => {
    assert.ok(
      !/<\/?[a-z][^>]*>/i.test(record.entry.text),
      record.id + ' wird als Klartext-Sink/format()-Variable eingesetzt und darf kein Markup enthalten'
    );
  });
});

test('Sichtbare Texte enthalten keine internen Navigator- oder Referenzmodell-Begriffe', () => {
  const catalog = Workflow.loadCatalog();
  Workflow.validateCatalog(catalog);
  const internalTerm = /\b(?:Health[\s-]?Navigator|Navigator|Referenzmodell|Orientierungsmodell)\b/i;
  const contentOffenders = catalog.entries
    .filter((record) => internalTerm.test(record.entry.text))
    .map((record) => record.id);
  assert.deepStrictEqual(
    contentOffenders,
    [],
    'interne Projekt- oder Modellbegriffe in kanonischen Laufzeittexten',
  );

  ['index.html', 'quellen.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8');
    assert.ok(!internalTerm.test(html), file + ': interner Begriff ist im sichtbaren Seitengerüst enthalten');
  });
});

test('ResultCopy bleibt trotz UI-Fehlergrenze bei unbekannten IDs und fehlenden Variablen fail-fast', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(PROJECT_ROOT, 'js', 'result-copy.generated.js'), 'utf8'),
    sandbox
  );
  vm.runInNewContext(
    fs.readFileSync(path.join(PROJECT_ROOT, 'js', 'result-copy.js'), 'utf8'),
    sandbox
  );
  assert.deepStrictEqual(
    Object.keys(sandbox.window.ResultCopy).sort(),
    ['format', 'get', 'locale', 'sourceHash', 'version'],
    'öffentliche ResultCopy-API bleibt minimal und dokumentiert'
  );
  assert.throws(() => sandbox.window.ResultCopy.get('ui.absichtlich.unbekannt'), /unbekannte Text-ID/);
  assert.throws(
    () => sandbox.window.ResultCopy.format('ui.hero.topic_suffix.one', {}),
    /Platzhalter \{\{topicOne\}\}/
  );
});

test('CSV-Roundtrip erhaelt Semikolon, Quotes, Zeilenumbrueche und Platzhalter', () => {
  withTempFixture([
    fixtureEntry(),
    fixtureEntry({
      id: 'result.test.formula',
      kind: 'plain_text',
      reviewers: ['Marketing'],
      text: '=Dieser Text beginnt absichtlich mit einem Gleichheitszeichen',
      requiredTerms: undefined,
      reviewStatus: '',
      comment: '',
    }),
  ], (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    Workflow.validateCatalog(catalog);
    const csv = Workflow.exportCsvText(catalog);
    assert.strictEqual(csv.charCodeAt(0), 0xfeff, 'UTF-8-BOM vorhanden');
    assert.ok(csv.includes(';'), 'Semikolon als Trennzeichen');
    assert.ok(csv.includes("'=Dieser Text"), 'Formula-Injection-Guard im Export');

    const rows = Workflow.csvObjectsFromText(csv);
    const primary = rows.find((row) => row['ID (technisch)'] === 'result.test.primary');
    const formula = rows.find((row) => row['ID (technisch)'] === 'result.test.formula');
    assert.strictEqual(primary['Aktueller Text'], fixtureEntry().text);
    assert.strictEqual(primary['Neuer Text'], '');
    assert.strictEqual(primary['Freigabe durch'], 'Marketing, Medizin');
    assert.strictEqual(primary['Platzhalter'], '{{name}}');
    assert.strictEqual(primary['Geschützte Begriffe'], 'Zitat');
    assert.strictEqual(primary['Prüfhinweis'], 'Fachlicher Ausgangshinweis');
    assert.strictEqual(primary['Review-Kommentar'], 'Ausgangskommentar');
    assert.strictEqual(primary['Freigabestatus'], 'Freigegeben');
    assert.strictEqual(formula['Aktueller Text'], '=Dieser Text beginnt absichtlich mit einem Gleichheitszeichen');
  });
});

test('Review-Export ist human-first, explizit und thematisch gruppiert', () => {
  assert.deepStrictEqual(Workflow.CSV_COLUMNS.slice(0, 8), [
    'Gesundheitsbereich',
    'Thema',
    'Seitenelement',
    'Textfunktion',
    'Kontext / Variante',
    'Aktueller Text',
    'Neuer Text',
    'Review-Kommentar',
  ]);
  assert.deepStrictEqual(Workflow.CSV_COLUMNS.slice(-5), [
    'ID (technisch)',
    'Domain (technisch)',
    'Austauschformat (technisch)',
    'Quellversion (technisch)',
    'Zeilen-Hash (technisch)',
  ]);

  const records = Workflow.buildReviewRecords(Workflow.loadCatalog());
  const byId = new Map(records.map((item) => [item.id, item]));
  assert.deepStrictEqual(
    [byId.get('recommendation.catalog.fi_kraft.title').area, byId.get('recommendation.catalog.fi_kraft.title').topic],
    ['Körperliche Fitness', 'Krafttraining & Muskulatur']
  );
  assert.deepStrictEqual(
    [byId.get('recommendation.special.act_kardio.title').area, byId.get('recommendation.special.act_kardio.title').topic],
    ['Einflussfaktoren', 'Herz-Kreislauf & Vorsorge']
  );
  assert.deepStrictEqual(
    [byId.get('recommendation.catalog.er_protein.title').area, byId.get('recommendation.catalog.er_protein.title').topic],
    ['Ernährung', 'Protein & Muskelerhalt']
  );
  assert.deepStrictEqual(
    [byId.get('coach.answer.emergency').area, byId.get('coach.answer.emergency').topic],
    ['Medizin & Sicherheit', 'Medizinische Hinweise & Notfallrouting'],
    'medizinisches Coach-Notfallrouting liegt nicht im allgemeinen Coach-Catch-all'
  );
  assert.strictEqual(byId.get('coach.answer.nutrition').area, 'Ernährung');
  assert.strictEqual(byId.get('coach.answer.fitness').area, 'Körperliche Fitness');
  assert.strictEqual(byId.get('coach.answer.sleep').area, 'Schlaf');
  assert.deepStrictEqual(
    records
      .filter((item) => item.id.startsWith('recommendation.fitness_test.'))
      .map((item) => item.area)
      .filter((area) => area !== 'Körperliche Fitness'),
    [],
    'alle Fitness-Kurztesttexte liegen im Gesundheitsbereich Körperliche Fitness'
  );
  assert.deepStrictEqual(
    records
      .filter((item) => item.id.startsWith('ui.hero.topic.') && item.area === 'Übergreifende Ergebnisdarstellung')
      .map((item) => item.id),
    [],
    'fachliche Hero-Themen werden nicht in die allgemeine Restgruppe einsortiert'
  );
  assert.deepStrictEqual(
    records
      .filter((item) => /[a-z]+_[a-z_]+|DIMENSIONS\.|signalInsights\(\)|HELSANA_OFFERS/.test(item.context))
      .map((item) => item.id),
    [],
    'redaktionelle Kontexte enthalten keine internen IDs oder Funktionsnamen'
  );
  assert.deepStrictEqual(
    records
      .filter((item) => ['Shared Quiz & Results', 'Chat-Container', 'Plan-Fallback', 'Antworttemplates'].includes(item.section))
      .map((item) => item.id),
    [],
    'redaktionelle Seitenelemente verwenden verständliche Bezeichnungen'
  );

  const orderedIds = records.map((item) => item.id);
  [
    'recommendation.catalog.fi_kraft.title',
    'recommendation.catalog.fi_kraft.why',
    'recommendation.catalog.fi_kraft.step',
    'recommendation.catalog.fi_kraft.benefit',
    'recommendation.plan.fi_kraft.this_week.zero_days',
    'recommendation.plan.fi_kraft.weeks_2_3.under_60',
    'recommendation.plan.fi_kraft.week_4',
  ].reduce((previousIndex, id) => {
    const index = orderedIds.indexOf(id);
    assert.ok(index > previousIndex, id + ': natürliche Review-Reihenfolge');
    return index;
  }, -1);
});

test('Spaltenreihenfolge ist flexibel und Legacy-CSV bleibt ohne Verlust importierbar', () => {
  withTempFixture(null, (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const currentRows = Workflow.catalogToCsvRows(catalog);
    const permuted = Workflow.serializeCsv(currentRows, Workflow.CSV_COLUMNS.slice().reverse());
    assert.strictEqual(Workflow.planImport(permuted, catalog).changes.length, 0);

    const record = catalog.entries[0];
    const version = Workflow.computeSourceVersion(catalog);
    const legacyRow = {
      'Quellversion': version,
      'Base-Hash pro Zeile': Workflow.computeRowHash(record),
      'ID': record.id,
      'Bereich': record.entry.section,
      'Ausspielung': record.entry.context,
      'Textart': record.entry.kind,
      'Prüfung durch': 'Marketing, Medizin',
      'Geschützte Elemente': '{{name}} | Zitat',
      'Aktueller Text': record.entry.text,
      'Neuer Text': '',
      'Review-Status': 'approved',
      'Marketing-Kommentar': record.entry.comment,
    };
    let plan = Workflow.planImport(
      Workflow.serializeCsv([legacyRow], Workflow.LEGACY_CSV_COLUMNS),
      catalog
    );
    assert.strictEqual(plan.csvFormat, '1');
    assert.strictEqual(plan.commentChanges.length, 0, 'alter Prüfhinweis wird nicht zum Review-Kommentar');

    legacyRow['Marketing-Kommentar'] = 'Neue Rückmeldung aus dem Review.';
    plan = Workflow.planImport(
      Workflow.serializeCsv([legacyRow], Workflow.LEGACY_CSV_COLUMNS),
      catalog
    );
    assert.strictEqual(plan.nextCatalog.entries[0].entry.comment, 'Fachlicher Ausgangshinweis');
    assert.strictEqual(plan.nextCatalog.entries[0].entry.reviewComment, 'Neue Rückmeldung aus dem Review.');
  });
});

test('Import schützt Review-Metadaten, Kopfzeile, IDs und Freigabewerte', () => {
  withTempFixture([
    fixtureEntry(),
    fixtureEntry({
      id: 'result.test.secondary',
      text: 'Zweiter Text mit "Zitat" und <b>{{name}}</b>',
    }),
  ], (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });

    let rows = Workflow.catalogToCsvRows(catalog);
    rows[0].Thema = 'Eigenmächtig geändertes Thema';
    assert.throws(
      () => Workflow.planImport(Workflow.serializeCsv(rows), catalog),
      /Schreibgeschuetzte CSV-Spalten/
    );

    rows = Workflow.catalogToCsvRows(catalog);
    rows[0].Thema = 'Manipuliertes Thema mit manipuliertem Hash';
    rows[0]['Zeilen-Hash (technisch)'] = '0'.repeat(64);
    assert.throws(
      () => Workflow.planImport(Workflow.serializeCsv(rows), catalog),
      /Zeilenkonflikt/
    );

    rows = Workflow.catalogToCsvRows(catalog);
    assert.throws(
      () => Workflow.planImport(
        Workflow.serializeCsv(rows, Workflow.CSV_COLUMNS.filter((column) => column !== 'Thema')),
        catalog
      ),
      /keinem unterstützten Format/
    );

    rows = Workflow.catalogToCsvRows(catalog);
    rows[1]['ID (technisch)'] = rows[0]['ID (technisch)'];
    assert.throws(
      () => Workflow.planImport(Workflow.serializeCsv(rows), catalog),
      /nicht exakt den aktuellen Content-Katalog/
    );

    rows = Workflow.catalogToCsvRows(catalog);
    rows[0].Freigabestatus = 'Nur Marketing freigegeben';
    assert.throws(
      () => Workflow.planImport(Workflow.serializeCsv(rows), catalog),
      /unbekannter Freigabestatus/
    );
  });
});

test('Export und leerer Reimport sind ein echter No-op', () => {
  withTempFixture(null, (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const beforeHash = Workflow.computeSourceHash(catalog);
    const csv = Workflow.exportCsvText(catalog);
    const plan = Workflow.planImport(csv, catalog);
    assert.strictEqual(plan.changes.length, 0);
    assert.strictEqual(plan.commentChanges.length, 0);
    assert.strictEqual(plan.statusChanges.length, 0);
    assert.strictEqual(Workflow.computeSourceHash(plan.nextCatalog), beforeHash);
  });
});

test('Review-Übersicht ist deterministisch, gruppiert und bewusst nicht importierbar', () => {
  withTempFixture([fixtureEntry({
    comment: '<img src=x onerror=alert(1)> [Link](javascript:alert(1))',
  })], (paths, root) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const first = Workflow.renderReviewOverview(catalog);
    const second = Workflow.renderReviewOverview(catalog);
    assert.strictEqual(first, second);
    assert.ok(first.includes('# Ergebnis-Texte – Review-Übersicht'));
    assert.ok(first.includes('## Arbeitsindex'));
    assert.ok(first.includes('[Übergreifende Ergebnisdarstellung](#bereich-ubergreifende-ergebnisdarstellung)'));
    assert.ok(first.includes('<a id="bereich-ubergreifende-ergebnisdarstellung"></a>'));
    assert.ok(first.includes('## 1. Übergreifende Ergebnisdarstellung'));
    assert.ok(first.includes('Seitenelement: Testbereich'));
    assert.ok(first.includes('Technische ID: `result.test.primary`'));
    assert.ok(first.includes('Geschützte Begriffe:'));
    assert.ok(first.includes('Zitat'));
    assert.ok(first.includes('Freigegeben: **1** · Offen: **0**'));
    assert.ok(first.includes('| Freigegeben | 1 |'));
    assert.ok(first.includes('Freigabestatus: Freigegeben'));
    assert.ok(first.includes('Prüfhinweis:'));
    assert.ok(first.includes('Review-Kommentar:'));
    assert.ok(first.includes('&lt;img'));
    assert.ok(!first.includes('<img'));
    assert.ok(!first.includes('[Link]('));
    assert.ok(!first.includes('Base-Hash pro Zeile'), 'Lesefassung darf nicht als Importdatei erscheinen');

    const outputFile = path.join(root, 'review.md');
    const result = Workflow.exportOverview({
      contentDir: paths.contentDir,
      outputFile,
    });
    assert.strictEqual(result.entries, 1);
    assert.strictEqual(fs.readFileSync(outputFile, 'utf8'), first);
  });
});

test('Dry Run meldet Textaenderung und setzt medizinische Freigabe nur im Plan zurueck', () => {
  withTempFixture(null, (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const replacement = 'Neue Zeile; "Zitat"\n<i>Hallo {{name}}</i>';
    const csv = csvWithReplacement(catalog, 'result.test.primary', replacement, 'Bitte fachlich pruefen.');
    const plan = Workflow.planImport(csv, catalog);

    assert.strictEqual(plan.changes.length, 1);
    assert.strictEqual(plan.commentChanges.length, 1);
    assert.strictEqual(plan.statusChanges.length, 1);
    assert.strictEqual(plan.changes[0].reviewReset, true);
    assert.strictEqual(plan.nextCatalog.entries[0].entry.reviewStatus, 'needs-review');
    assert.strictEqual(plan.nextCatalog.entries[0].entry.text, replacement);
    assert.strictEqual(catalog.entries[0].entry.reviewStatus, 'approved', 'Original bleibt unveraendert');
    assert.strictEqual(catalog.entries[0].entry.text, fixtureEntry().text, 'Originaltext bleibt unveraendert');
  });
});

test('import --dry-run schreibt weder JSON noch generierte Artefakte', () => {
  withTempFixture(null, (paths, root) => {
    Workflow.buildGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile });
    Workflow.exportCsv({ contentDir: paths.contentDir, outputFile: paths.exportFile });
    Workflow.exportOverview({ contentDir: paths.contentDir, outputFile: paths.overviewFile });
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const replacement = 'Dry Run mit "Zitat" und <b>{{name}}</b>';
    fs.writeFileSync(paths.csvFile, csvWithReplacement(catalog, 'result.test.primary', replacement), 'utf8');

    const beforeJson = fs.readFileSync(paths.jsonFile, 'utf8');
    const beforeGenerated = fs.readFileSync(paths.generatedFile, 'utf8');
    const beforeExport = fs.readFileSync(paths.exportFile, 'utf8');
    const beforeOverview = fs.readFileSync(paths.overviewFile, 'utf8');
    const result = Workflow.importCsv({
      inputFile: paths.csvFile,
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
      dryRun: true,
    });

    assert.strictEqual(result.changes.length, 1);
    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(fs.readFileSync(paths.jsonFile, 'utf8'), beforeJson);
    assert.strictEqual(fs.readFileSync(paths.generatedFile, 'utf8'), beforeGenerated);
    assert.strictEqual(fs.readFileSync(paths.exportFile, 'utf8'), beforeExport);
    assert.strictEqual(fs.readFileSync(paths.overviewFile, 'utf8'), beforeOverview);
    assert.strictEqual(fs.existsSync(path.join(root, 'exports', 'import-backups')), false);
  });
});

test('Freigegebener Marketingtext landet in JSON und allen generierten Artefakten', () => {
  withTempFixture(null, (paths, root) => {
    Workflow.buildGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile });
    Workflow.exportCsv({ contentDir: paths.contentDir, outputFile: paths.exportFile });
    Workflow.exportOverview({ contentDir: paths.contentDir, outputFile: paths.overviewFile });
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const replacement = 'Finaler Marketingtext mit "Zitat" und <i>{{name}}</i>';
    fs.writeFileSync(
      paths.csvFile,
      csvWithReplacement(catalog, 'result.test.primary', replacement, 'Final freigegeben.'),
      'utf8'
    );

    const result = Workflow.importCsv({
      inputFile: paths.csvFile,
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
    });
    const persisted = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(paths.generatedFile, 'utf8'), sandbox);

    assert.strictEqual(result.changes.length, 1);
    assert.ok(result.backupDir.startsWith(path.join(root, 'exports', 'import-backups')));
    const manifest = JSON.parse(fs.readFileSync(result.backupManifestFile, 'utf8'));
    const backupJson = JSON.parse(fs.readFileSync(
      path.join(result.backupDir, 'content', 'result-texts', 'test.json'),
      'utf8'
    ));
    assert.strictEqual(manifest.type, 'result-content-import-backup');
    assert.strictEqual(manifest.sourceVersion, Workflow.computeSourceVersion(catalog));
    assert.deepStrictEqual(manifest.changes.texts, ['result.test.primary']);
    assert.ok(manifest.files.some((file) => file.path === 'exports/result-texte-de-CH.csv' && file.sha256));
    assert.ok(manifest.files.some((file) => file.path === 'exports/result-texte-uebersicht.md' && file.sha256));
    assert.strictEqual(backupJson.entries[0].text, fixtureEntry().text);
    assert.ok(fs.existsSync(path.join(result.backupDir, 'js', 'result-copy.generated.js')));
    assert.ok(fs.existsSync(path.join(result.backupDir, 'exports', 'result-texte-de-CH.csv')));
    assert.ok(fs.existsSync(path.join(result.backupDir, 'exports', 'result-texte-uebersicht.md')));
    assert.strictEqual(persisted.entries[0].text, replacement);
    assert.strictEqual(persisted.entries[0].comment, 'Fachlicher Ausgangshinweis');
    assert.strictEqual(persisted.entries[0].reviewComment, 'Final freigegeben.');
    assert.strictEqual(sandbox.window.__RESULT_COPY_BUNDLE__.texts['result.test.primary'], replacement);
    const refreshedRows = Workflow.csvObjectsFromText(fs.readFileSync(paths.exportFile, 'utf8'));
    assert.strictEqual(refreshedRows[0]['Aktueller Text'], replacement);
    assert.ok(fs.readFileSync(paths.overviewFile, 'utf8').includes(
      'Finaler Marketingtext mit "Zitat" und _{{name}}_'
    ));
    assert.doesNotThrow(() => Workflow.checkGenerated({
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
    }));
  });
});

test('Import verwirft entfernte Platzhalter, verbotene Tags und fehlende Pflichtbegriffe', () => {
  withTempFixture(null, (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const invalid = [
      'Neuer Text mit "Zitat", aber ohne Variable.',
      'Neuer Text mit "Zitat" und <a href="/">{{name}}</a>.',
      'Neuer Text ohne Pflichtbegriff, aber mit <b>{{name}}</b>.',
    ];
    invalid.forEach((replacement) => {
      const csv = csvWithReplacement(catalog, 'result.test.primary', replacement);
      assert.throws(() => Workflow.planImport(csv, catalog), Workflow.ContentWorkflowError);
    });
  });
});

test('Import prueft auch die Anzahl mehrfach verwendeter Platzhalter', () => {
  withTempFixture([
    fixtureEntry({
      text: 'Erstes {{name}}, zweites <b>{{name}}</b> und "Zitat".',
    }),
  ], (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const csv = csvWithReplacement(
      catalog,
      'result.test.primary',
      'Nur noch ein <b>{{name}}</b> und "Zitat".'
    );
    assert.throws(
      () => Workflow.planImport(csv, catalog),
      (error) => error instanceof Workflow.ContentWorkflowError &&
        error.details.some((detail) => /Platzhalter/.test(detail))
    );
  });
});

test('Review-Status ist kontrolliert editierbar, wird bei medizinischer Textaenderung aber erzwungen zurueckgesetzt', () => {
  withTempFixture(null, (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const rows = Workflow.catalogToCsvRows(catalog);
    rows[0]['Freigabestatus'] = 'Prüfung erforderlich';
    let plan = Workflow.planImport(Workflow.serializeCsv(rows), catalog);
    assert.strictEqual(plan.changes.length, 0);
    assert.deepStrictEqual(plan.statusChanges, [{
      id: 'result.test.primary',
      oldStatus: 'approved',
      newStatus: 'needs-review',
    }]);

    rows[0]['Neuer Text'] = 'Medizinisch neuer Text mit "Zitat" und <b>{{name}}</b>';
    rows[0]['Freigabestatus'] = 'Freigegeben';
    plan = Workflow.planImport(Workflow.serializeCsv(rows), catalog);
    assert.strictEqual(plan.nextCatalog.entries[0].entry.reviewStatus, 'needs-review');
    assert.strictEqual(plan.changes[0].reviewReset, true);
  });
});

test('Status-only-Import persistiert JSON und aktualisiert alle generierten Artefakte', () => {
  withTempFixture(null, (paths) => {
    Workflow.buildGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile });
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const beforeBundle = fs.readFileSync(paths.generatedFile, 'utf8');
    const rows = Workflow.catalogToCsvRows(catalog);
    rows[0]['Freigabestatus'] = 'Prüfung erforderlich';
    fs.writeFileSync(paths.csvFile, Workflow.serializeCsv(rows), 'utf8');

    const result = Workflow.importCsv({
      inputFile: paths.csvFile,
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
    });
    const persisted = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    assert.strictEqual(result.changes.length, 0);
    assert.strictEqual(result.statusChanges.length, 1);
    assert.strictEqual(persisted.entries[0].reviewStatus, 'needs-review');
    assert.notStrictEqual(fs.readFileSync(paths.generatedFile, 'utf8'), beforeBundle);
    assert.ok(fs.existsSync(paths.exportFile), 'Standard-CSV wurde aktualisiert');
    assert.ok(fs.existsSync(paths.overviewFile), 'Review-Uebersicht wurde aktualisiert');
    assert.ok(fs.readFileSync(paths.overviewFile, 'utf8').includes('Freigabestatus: Prüfung erforderlich'));
    assert.doesNotThrow(() => Workflow.checkGenerated({
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
    }));
  });
});

test('Mehrdatei-Import stellt bei einem Schreibfehler automatisch den Gesamtstand wieder her', () => {
  withTempFixture(null, (paths) => {
    Workflow.buildGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile });
    Workflow.exportCsv({ contentDir: paths.contentDir, outputFile: paths.exportFile });
    Workflow.exportOverview({ contentDir: paths.contentDir, outputFile: paths.overviewFile });
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const replacement = 'Transaktionaler Test mit "Zitat" und <b>{{name}}</b>';
    const plan = Workflow.planImport(
      csvWithReplacement(catalog, 'result.test.primary', replacement),
      catalog
    );
    const tracked = [paths.jsonFile, paths.generatedFile, paths.exportFile, paths.overviewFile];
    const before = new Map(tracked.map((file) => [file, fs.readFileSync(file, 'utf8')]));

    assert.throws(
      () => Workflow.persistImport(plan, {
        contentDir: paths.contentDir,
        generatedFile: paths.generatedFile,
        exportFile: paths.exportFile,
        overviewFile: paths.overviewFile,
        transactionWriter(file, contents, index) {
          if (index === 2) throw new Error('simulierter Schreibfehler');
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, contents, 'utf8');
        },
      }),
      (error) => error instanceof Workflow.ContentWorkflowError &&
        /automatisch wiederhergestellt/.test(error.message)
    );

    tracked.forEach((file) => {
      assert.strictEqual(fs.readFileSync(file, 'utf8'), before.get(file), path.basename(file));
    });
  });
});

test('--allow-stale erlaubt unveraenderte Zeilen, aber nie einen Konflikt auf bearbeiteter Basis', () => {
  withTempFixture(null, (paths) => {
    const original = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const staleCsv = csvWithReplacement(
      original,
      'result.test.primary',
      'Marketingtext mit "Zitat" und <b>{{name}}</b>'
    );

    const data = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    data.entries[0].text = 'Inzwischen redaktionell geaendertes "Zitat" mit <b>{{name}}</b>';
    fs.writeFileSync(paths.jsonFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
    const current = Workflow.loadCatalog({ contentDir: paths.contentDir });

    assert.throws(() => Workflow.planImport(staleCsv, current), /veralteten Quellversion/);
    assert.throws(
      () => Workflow.planImport(staleCsv, current, { allowStale: true }),
      /Zeilenkonflikt/
    );
  });
});

test('Reviewer und Review-Status verwenden eine kontrollierte Wertemenge', () => {
  withTempFixture(null, (paths) => {
    const original = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));

    const badReviewer = JSON.parse(JSON.stringify(original));
    badReviewer.entries[0].reviewers = 'Marketing, Medzin';
    fs.writeFileSync(paths.jsonFile, JSON.stringify(badReviewer, null, 2) + '\n', 'utf8');
    assert.throws(
      () => Workflow.validateCatalog(Workflow.loadCatalog({ contentDir: paths.contentDir })),
      (error) => error instanceof Workflow.ContentWorkflowError &&
        error.details.some((detail) => /unbekannter Reviewer/.test(detail))
    );

    const badStatus = JSON.parse(JSON.stringify(original));
    badStatus.entries[0].reviewStatus = 'marketing-approved';
    fs.writeFileSync(paths.jsonFile, JSON.stringify(badStatus, null, 2) + '\n', 'utf8');
    assert.throws(
      () => Workflow.validateCatalog(Workflow.loadCatalog({ contentDir: paths.contentDir })),
      (error) => error instanceof Workflow.ContentWorkflowError &&
        error.details.some((detail) => /unbekannter reviewStatus/.test(detail))
    );
  });
});

test('Redaktionelle Felder haben Groessenlimits und verwerfen unsichtbare Steuerzeichen', () => {
  withTempFixture(null, (paths) => {
    const original = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    const tooLong = JSON.parse(JSON.stringify(original));
    tooLong.entries[0].text = 'x'.repeat(Workflow.FIELD_LIMITS.text + 1);
    fs.writeFileSync(paths.jsonFile, JSON.stringify(tooLong, null, 2) + '\n', 'utf8');
    assert.throws(
      () => Workflow.validateCatalog(Workflow.loadCatalog({ contentDir: paths.contentDir })),
      (error) => error.details.some((detail) => /Text ist zu lang/.test(detail))
    );

    const hiddenControl = JSON.parse(JSON.stringify(original));
    hiddenControl.entries[0].comment = 'Freigabe\u202Eoffen';
    fs.writeFileSync(paths.jsonFile, JSON.stringify(hiddenControl, null, 2) + '\n', 'utf8');
    assert.throws(
      () => Workflow.validateCatalog(Workflow.loadCatalog({ contentDir: paths.contentDir })),
      (error) => error.details.some((detail) => /Steuer- oder Bidi-Zeichen/.test(detail))
    );
  });
});

test('Review-Report zaehlt offene Freigaben je Status und Reviewer', () => {
  withTempFixture([
    fixtureEntry({ id: 'result.test.approved', reviewStatus: 'approved' }),
    fixtureEntry({
      id: 'result.test.not_set',
      reviewers: 'Marketing',
      reviewStatus: '',
      requiredTerms: undefined,
      text: 'Text ohne gesetzten Status',
    }),
    fixtureEntry({
      id: 'result.test.legal',
      reviewers: 'Marketing, Recht',
      reviewStatus: 'needs-review',
      requiredTerms: undefined,
      text: 'Rechtlich zu pruefender Text',
    }),
  ], (paths) => {
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir });
    const report = Workflow.buildReviewReport(catalog);
    assert.strictEqual(report.total, 3);
    assert.strictEqual(report.approved, 1);
    assert.strictEqual(report.open, 2);
    assert.deepStrictEqual(report.byStatus, { 'not-set': 1, 'needs-review': 1, approved: 1 });
    assert.deepStrictEqual(
      report.byReviewer.find((entry) => entry.reviewer === 'Recht'),
      { reviewer: 'Recht', total: 1, approved: 0, open: 1 }
    );
    assert.ok(Workflow.renderReviewOverview(catalog).includes('Freigabestatus: Nicht geprüft'));
  });
});

test('Review-Report kann alle vier Sprachen als gemeinsamen Release-Gate zusammenfassen', () => {
  withTempFixture(null, (paths) => {
    writeAllTranslationFixtures(paths);
    const report = Workflow.reviewReport({ contentDir: paths.contentDir, all: true });

    assert.strictEqual(report.all, true);
    assert.deepStrictEqual(report.locales.map((item) => item.locale), Workflow.SUPPORTED_LOCALES);
    assert.strictEqual(report.total, 4);
    assert.strictEqual(report.approved, 1);
    assert.strictEqual(report.open, 3);
    assert.deepStrictEqual(report.byStatus, { 'not-set': 0, 'needs-review': 3, approved: 1 });
    assert.strictEqual(report.locales.find((item) => item.locale === 'de-CH').open, 0);
    ['en-CH', 'fr-CH', 'it-CH'].forEach((locale) => {
      assert.strictEqual(report.locales.find((item) => item.locale === locale).open, 1, locale);
    });
    assert.deepStrictEqual(
      report.byReviewer.find((item) => item.reviewer === 'Medizin'),
      { reviewer: 'Medizin', total: 4, approved: 1, open: 3 }
    );
    assert.deepStrictEqual(
      report.openEntries.map((item) => item.locale).sort(),
      ['en-CH', 'fr-CH', 'it-CH']
    );
  });
});

test('Datenschutz-, Consent- und Coverage-Texte besitzen Legal-Gate und offenen Status', () => {
  const catalog = Workflow.loadCatalog();
  Workflow.validateCatalog(catalog);
  const byId = new Map(catalog.entries.map((record) => [record.id, record.entry]));
  [
    'ui.customer_context.chip',
    'ui.chat.description',
    'ui.chat.disclaimer',
    'ui.coach_handoff.consent_title',
    'ui.coach_handoff.note',
    'ui.contact.availability_legal',
    'ui.share_modal.privacy_warning',
    'coach.answer.coach_app',
    'service.dimension.grund.intro',
    'service.coverage.ernaehrung.hint',
    'service.coverage.bewegung.hint',
    'service.coverage.kraft.hint',
    'service.coverage.rauchstopp.hint',
    'service.coverage.stress.hint',
    'service.coverage.mentale_hilfe.hint',
    'service.coverage.vorsorge.hint',
  ].forEach((id) => {
    const entry = byId.get(id);
    assert.ok(entry, id + ': Eintrag fehlt');
    assert.ok(Workflow.ALLOWED_REVIEWERS.includes('Recht'));
    assert.ok(String(entry.reviewers).split(',').map((value) => value.trim()).includes('Recht'), id);
    assert.strictEqual(entry.reviewStatus, 'needs-review', id);
  });
});

test('Allgemeine positive Einordnungen wiederholen keine dimensionsspezifische Basisbotschaft', () => {
  const catalog = Workflow.loadCatalog();
  Workflow.validateCatalog(catalog);
  const byId = new Map(catalog.entries.map((record) => [record.id, record.entry]));
  ['stark', 'solide'].forEach((status) => {
    const id = 'ui.dimension.classification.' + status;
    const entry = byId.get(id);
    assert.ok(entry, id + ': Eintrag fehlt');
    assert.ok(!/\b(?:Basis|Grundlage)\b/i.test(entry.text), id + ': Nutzenbotschaft wird vorweggenommen');
  });
});

test('check prueft Runtime-Bundle, Standard-CSV und Review-Uebersicht bytegenau', () => {
  withTempFixture(null, (paths) => {
    Workflow.buildGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile });
    Workflow.exportCsv({ contentDir: paths.contentDir, outputFile: paths.exportFile });
    Workflow.exportOverview({ contentDir: paths.contentDir, outputFile: paths.overviewFile });
    assert.doesNotThrow(() => Workflow.checkGenerated({
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
    }));

    [paths.generatedFile, paths.exportFile, paths.overviewFile].forEach((file) => {
      const current = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, current + '\nveraltet\n', 'utf8');
      assert.throws(
        () => Workflow.checkGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile }),
        /Generiertes Artefakt ist veraltet/
      );
      fs.writeFileSync(file, current, 'utf8');
    });
  });
});

test('Uebersetzungs-Overlays sind schlank, vollstaendig und strukturell identisch zu de-CH', () => {
  withTempFixture(null, (paths) => {
    writeTranslationFixture(paths, 'en-CH');
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'en-CH' });
    const summary = Workflow.validateCatalog(catalog, {
      requireCurrentSource: true,
      requireTranslations: true,
    });
    assert.strictEqual(summary.entries, 1);
    assert.strictEqual(summary.locale, 'en-CH');
    assert.strictEqual(catalog.entries[0].entry.section, fixtureEntry().section, 'Struktur kommt aus de-CH');
    assert.strictEqual(catalog.entries[0].translationEntry.section, undefined, 'Overlay bleibt schlank');

    const rows = Workflow.catalogToCsvRows(catalog);
    assert.strictEqual(rows[0]['Sprache (technisch)'], 'en-CH');
    assert.strictEqual(rows[0]['Deutscher Ausgangstext'], fixtureEntry().text);
    assert.strictEqual(rows[0]['Austauschformat (technisch)'], '3');
    const csv = Workflow.exportCsvText(catalog);
    assert.deepStrictEqual(Workflow.parseCsv(csv)[0], Workflow.LOCALIZED_CSV_COLUMNS);
    const overview = Workflow.renderReviewOverview(catalog);
    assert.ok(overview.includes('Sprache: `en-CH`'));
    assert.ok(overview.includes('**Deutscher Ausgangstext**'));
  });
});

test('Multi-Locale-Bundle enthaelt exakt vier vollstaendige Bundles und behaelt den DE-Kompatibilitaetszeiger', () => {
  withTempFixture(null, (paths) => {
    writeAllTranslationFixtures(paths);
    const catalogs = Workflow.loadCatalogs({ contentDir: paths.contentDir, all: true });
    const registry = Workflow.buildBundleRegistry(catalogs);
    assert.deepStrictEqual(registry.supportedLocales, ['de-CH', 'en-CH', 'fr-CH', 'it-CH']);
    assert.deepStrictEqual(Object.keys(registry.bundles), registry.supportedLocales);
    registry.supportedLocales.forEach((locale) => {
      assert.strictEqual(Object.keys(registry.bundles[locale].texts).length, 1, locale);
    });

    const sandbox = { window: {} };
    vm.runInNewContext(Workflow.renderGeneratedRegistry(registry), sandbox);
    assert.strictEqual(sandbox.window.__RESULT_COPY_BUNDLES__.defaultLocale, 'de-CH');
    assert.strictEqual(
      sandbox.window.__RESULT_COPY_BUNDLE__.texts['result.test.primary'],
      fixtureEntry().text
    );
  });
});

test('Vier-Sprachen-Build und alle Review-Artefakte sind gemeinsam deterministisch pruefbar', () => {
  withTempFixture(null, (paths) => {
    writeAllTranslationFixtures(paths);
    Workflow.buildGenerated({ contentDir: paths.contentDir, generatedFile: paths.generatedFile, all: true });
    Workflow.exportCsvAll({ contentDir: paths.contentDir });
    Workflow.exportOverviewAll({ contentDir: paths.contentDir });
    const checked = Workflow.checkGenerated({
      contentDir: paths.contentDir,
      generatedFile: paths.generatedFile,
      all: true,
    });
    assert.deepStrictEqual(checked.locales, ['de-CH', 'en-CH', 'fr-CH', 'it-CH']);
  });
});

test('Overlay-Validierung verwirft fehlende IDs, HTML-Abweichungen und Attribute oder aktive Tags', () => {
  withTempFixture(null, (paths) => {
    writeTranslationFixture(paths, 'fr-CH');
    const overlayFile = path.join(paths.contentDir, 'locales', 'fr-CH', 'test.json');
    const valid = JSON.parse(fs.readFileSync(overlayFile, 'utf8'));

    const missing = JSON.parse(JSON.stringify(valid));
    missing.entries = [];
    fs.writeFileSync(overlayFile, JSON.stringify(missing, null, 2) + '\n', 'utf8');
    assert.throws(
      () => Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'fr-CH' }),
      /Uebersetzungsvalidierung/
    );

    [
      'FR: Zeile; "Zitat"\n<i>Hallo {{name}}</i>',
      'FR: Zeile; "Zitat"\n<b class="x">Hallo {{name}}</b>',
      'FR: Zeile; "Zitat"\n<script>Hallo {{name}}</script>',
      'FR: Zeile; "Zitat"\n<b onclick="x">Hallo {{name}}</b>',
    ].forEach((text) => {
      const invalid = JSON.parse(JSON.stringify(valid));
      invalid.entries[0].text = text;
      fs.writeFileSync(overlayFile, JSON.stringify(invalid, null, 2) + '\n', 'utf8');
      assert.throws(
        () => Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'fr-CH' }),
        Workflow.ContentWorkflowError
      );
    });
  });
});

test('Fertige Uebersetzungen duerfen geschuetzte Ausgangskonzepte nicht vollstaendig verlieren', () => {
  withTempFixture(null, (paths) => {
    writeTranslationFixture(paths, 'en-CH');
    const overlayFile = path.join(paths.contentDir, 'locales', 'en-CH', 'test.json');
    const overlay = JSON.parse(fs.readFileSync(overlayFile, 'utf8'));
    overlay.entries[0].requiredTerms = [];
    fs.writeFileSync(overlayFile, JSON.stringify(overlay, null, 2) + '\n', 'utf8');
    assert.throws(
      () => Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'en-CH' }),
      (error) => error instanceof Workflow.ContentWorkflowError &&
        error.details.some((detail) => /geschuetzte Begriffe des deutschen Ausgangstexts/.test(detail))
    );
  });
});

test('Alle fertigen Sprachfassungen schuetzen medizinisch relevante Nummern und Begriffe', () => {
  const german = Workflow.loadCatalog({ locale: 'de-CH' });
  const protectedIds = german.entries
    .filter((record) => (record.entry.requiredTerms || []).length)
    .map((record) => record.id);
  assert.ok(protectedIds.length > 0, 'DE-Katalog enthaelt geschuetzte Texte');

  const criticalTerms = {
    'en-CH': {
      'coach.answer.emergency': ['144', '0800 143 000', '6 to 11 p.m.'],
      'recommendation.plan.act_kardio.this_week': ['ApoB', 'Lp(a)'],
      'recommendation.plan.ei_rauchstopp.this_week': ['0848 000 181'],
      'ui.contact.phone': ['058 340 15 69'],
    },
    'fr-CH': {
      'coach.answer.emergency': ['144', '143'],
      'recommendation.plan.act_kardio.this_week': ['ApoB', 'Lp(a)'],
      'recommendation.plan.ei_rauchstopp.this_week': ['0848 000 181'],
      'ui.contact.phone': ['058 340 15 69'],
    },
    'it-CH': {
      'coach.answer.emergency': ['144', '143'],
      'recommendation.plan.act_kardio.this_week': ['ApoB', 'Lp(a)'],
      'recommendation.plan.ei_rauchstopp.this_week': ['0848 000 181'],
      'ui.contact.phone': ['058 340 15 69'],
    },
  };

  ['en-CH', 'fr-CH', 'it-CH'].forEach((locale) => {
    const translated = Workflow.loadCatalog({ locale });
    const byId = new Map(translated.entries.map((record) => [record.id, record.translationEntry]));
    protectedIds.forEach((id) => {
      const entry = byId.get(id);
      assert.ok(entry, locale + '/' + id + ': Uebersetzung fehlt');
      assert.ok(entry.requiredTerms.length > 0, locale + '/' + id + ': Schutzbegriffe fehlen');
    });
    Object.entries(criticalTerms[locale]).forEach(([id, terms]) => {
      const entry = byId.get(id);
      terms.forEach((term) => {
        assert.ok(entry.requiredTerms.includes(term), locale + '/' + id + ': Pflichtbegriff fehlt: ' + term);
      });
    });
  });
});

test('sync-locales erzeugt idempotente, klar unvollstaendige Skelette und ueberschreibt nichts', () => {
  withTempFixture(null, (paths) => {
    const first = Workflow.syncLocales({ contentDir: paths.contentDir, locale: 'it-CH' });
    assert.strictEqual(first[0].added, 1);
    const overlayFile = path.join(paths.contentDir, 'locales', 'it-CH', 'test.json');
    let overlay = JSON.parse(fs.readFileSync(overlayFile, 'utf8'));
    assert.strictEqual(overlay.entries[0].translationState, 'missing');
    assert.strictEqual(overlay.entries[0].reviewStatus, 'needs-review');
    assert.strictEqual(overlay.entries[0].reviewComment, '', 'Review-Kommentar bleibt fuer echte Rueckmeldungen leer');
    assert.throws(
      () => Workflow.validate({ contentDir: paths.contentDir, locale: 'it-CH' }),
      (error) => error instanceof Workflow.ContentWorkflowError &&
        error.details.some((detail) => /noch nicht uebersetzt/.test(detail))
    );

    overlay.entries[0].text = 'IT: Zeile 1; "Zitat"\n<b>Ciao {{name}}</b>';
    overlay.entries[0].translationState = 'translated';
    fs.writeFileSync(overlayFile, JSON.stringify(overlay, null, 2) + '\n', 'utf8');
    const second = Workflow.syncLocales({ contentDir: paths.contentDir, locale: 'it-CH' });
    assert.strictEqual(second[0].added, 0);
    overlay = JSON.parse(fs.readFileSync(overlayFile, 'utf8'));
    assert.ok(overlay.entries[0].text.startsWith('IT:'), 'bestehende Uebersetzung bleibt erhalten');
  });
});

test('Fehlende Uebersetzung kann nicht durch Status-only umgangen, aber explizit identisch bestaetigt werden', () => {
  withTempFixture(null, (paths) => {
    Workflow.syncLocales({ contentDir: paths.contentDir, locale: 'it-CH' });
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'it-CH' });
    const statusOnlyRows = Workflow.catalogToCsvRows(catalog);
    statusOnlyRows[0]['Freigabestatus'] = 'Freigegeben';
    assert.throws(
      () => Workflow.planImport(
        Workflow.serializeCsv(statusOnlyRows, Workflow.LOCALIZED_CSV_COLUMNS),
        catalog
      ),
      /nicht allein über den Freigabestatus bestätigt/
    );

    const explicitRows = Workflow.catalogToCsvRows(catalog);
    explicitRows[0]['Neuer Text'] = explicitRows[0]['Aktueller Text'];
    const plan = Workflow.planImport(
      Workflow.serializeCsv(explicitRows, Workflow.LOCALIZED_CSV_COLUMNS),
      catalog
    );
    assert.strictEqual(plan.changes.length, 1);
    assert.strictEqual(plan.changes[0].translationConfirmed, true);
    assert.strictEqual(plan.nextCatalog.entries[0].translationEntry.translationState, 'translated');
    assert.deepStrictEqual(plan.nextCatalog.missingTranslationIds, []);
    assert.doesNotThrow(() => Workflow.validateCatalog(plan.nextCatalog, {
      requireCurrentSource: true,
      requireTranslations: true,
    }));
  });
});

test('Locale-Import aktualisiert nur das Ziel-Overlay und lehnt Sprachmanipulation ab', () => {
  withTempFixture(null, (paths, root) => {
    writeTranslationFixture(paths, 'en-CH');
    const catalog = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'en-CH' });
    const rows = Workflow.catalogToCsvRows(catalog);
    rows[0]['Neuer Text'] = 'EN final: line; "Zitat"\n<b>Hello {{name}}</b>';
    const csv = Workflow.serializeCsv(rows, Workflow.LOCALIZED_CSV_COLUMNS);
    const plan = Workflow.planImport(csv, catalog);
    const result = Workflow.persistImport(plan, {
      contentDir: paths.contentDir,
      locale: 'en-CH',
      generatedFile: paths.generatedFile,
      now: new Date('2026-01-02T03:04:05.000Z'),
    });
    const overlay = JSON.parse(fs.readFileSync(
      path.join(paths.contentDir, 'locales', 'en-CH', 'test.json'),
      'utf8'
    ));
    const german = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    assert.strictEqual(overlay.entries[0].text, rows[0]['Neuer Text']);
    assert.strictEqual(overlay.entries[0].translationState, 'translated');
    assert.strictEqual(german.entries[0].text, fixtureEntry().text);
    assert.ok(result.backupDir.startsWith(path.join(root, 'exports', 'import-backups', 'en-CH')));

    rows[0]['Sprache (technisch)'] = 'fr-CH';
    assert.throws(
      () => Workflow.planImport(Workflow.serializeCsv(rows, Workflow.LOCALIZED_CSV_COLUMNS), catalog),
      /CSV-Sprache/
    );
  });
});

test('Geaenderter DE-Ausgangsvertrag macht Uebersetzungen sichtbar veraltet und erneut pruefpflichtig', () => {
  withTempFixture(null, (paths) => {
    writeTranslationFixture(paths, 'fr-CH', (entry) => {
      entry.reviewStatus = 'approved';
      return entry;
    });
    const baseData = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    baseData.entries[0].comment = 'Neuer fachlicher Ausgangshinweis';
    fs.writeFileSync(paths.jsonFile, JSON.stringify(baseData, null, 2) + '\n', 'utf8');

    const stale = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'fr-CH' });
    assert.deepStrictEqual(stale.staleSourceIds, ['result.test.primary']);
    assert.strictEqual(stale.entries[0].entry.reviewStatus, 'needs-review');
    assert.throws(
      () => Workflow.validate({ contentDir: paths.contentDir, locale: 'fr-CH' }),
      (error) => error.details.some((detail) => /geänderten deutschen Ausgangstext|geaenderten deutschen Ausgangstext/.test(detail))
    );

    const rows = Workflow.catalogToCsvRows(stale);
    rows[0]['Freigabestatus'] = 'Freigegeben';
    const plan = Workflow.planImport(
      Workflow.serializeCsv(rows, Workflow.LOCALIZED_CSV_COLUMNS),
      stale
    );
    assert.deepStrictEqual(plan.nextCatalog.staleSourceIds, []);
    assert.strictEqual(
      plan.nextCatalog.entries[0].translationEntry.sourceContractHash,
      Workflow.computeTranslationSourceContractHash(stale.entries[0].baseRecord)
    );
  });
});

test('Uebersetzungsvertrag bindet Text, section und context und migriert nur den exakten Altvertrag', () => {
  withTempFixture(null, (paths) => {
    writeTranslationFixture(paths, 'fr-CH');
    const base = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'de-CH' });
    const baseRecord = base.entries[0];
    const legacyHash = Workflow.sha256(Workflow.stableStringify({
      schemaVersion: Workflow.SCHEMA_VERSION,
      locale: Workflow.DEFAULT_LOCALE,
      domain: baseRecord.domain,
      id: baseRecord.id,
      text: baseRecord.entry.text,
      kind: baseRecord.entry.kind,
      reviewers: ['Marketing', 'Medizin'],
      requiredTerms: baseRecord.entry.requiredTerms,
      comment: baseRecord.entry.comment,
    }));
    const overlayFile = path.join(paths.contentDir, 'locales', 'fr-CH', 'test.json');
    const overlay = JSON.parse(fs.readFileSync(overlayFile, 'utf8'));
    overlay.entries[0].sourceContractHash = legacyHash;
    fs.writeFileSync(overlayFile, JSON.stringify(overlay, null, 2) + '\n', 'utf8');

    const migrated = Workflow.syncLocales({ contentDir: paths.contentDir, locale: 'fr-CH' });
    assert.strictEqual(migrated[0].migrated, 1);
    const before = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'fr-CH' });
    assert.deepStrictEqual(before.staleSourceIds, []);
    const initialHash = before.entries[0].translationEntry.sourceContractHash;
    assert.strictEqual(initialHash, Workflow.computeTranslationSourceContractHash(baseRecord));

    const baseData = JSON.parse(fs.readFileSync(paths.jsonFile, 'utf8'));
    baseData.entries[0].context = 'Neuer fachlicher Kontext';
    fs.writeFileSync(paths.jsonFile, JSON.stringify(baseData, null, 2) + '\n', 'utf8');
    const stale = Workflow.loadCatalog({ contentDir: paths.contentDir, locale: 'fr-CH' });
    assert.deepStrictEqual(stale.staleSourceIds, ['result.test.primary']);
    assert.notStrictEqual(
      Workflow.computeTranslationSourceContractHash(stale.entries[0].baseRecord),
      initialHash,
      'context muss den Quellvertrag veraendern'
    );

    const synced = Workflow.syncLocales({ contentDir: paths.contentDir, locale: 'fr-CH' });
    assert.strictEqual(synced[0].migrated, 0, 'fachlich veralteter Hash darf nicht automatisch erneuert werden');
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(
        overlayFile,
        'utf8'
      )).entries[0].sourceContractHash,
      initialHash
    );
  });
});

test('Unsicherer, ungequoteter Formelinhalt wird beim Import abgewiesen', () => {
  const header = Workflow.CSV_COLUMNS.map((value) => '"' + value + '"').join(';');
  const values = Workflow.CSV_COLUMNS.map((column) => column === 'Neuer Text' ? '=1+1' : 'x');
  const unsafe = '\ufeff' + header + '\r\n' + values.join(';') + '\r\n';
  assert.throws(() => Workflow.csvObjectsFromText(unsafe), /potenzielle Tabellenformel/);
});

(function run() {
  console.log('Content-Workflow\n');
  let passed = 0;
  let failed = 0;
  tests.forEach(({ name, fn }) => {
    try {
      fn();
      passed++;
      console.log('  \u2713 ' + name);
    } catch (error) {
      failed++;
      console.error('  \u2717 ' + name + '\n    \u2192 ' + error.stack);
    }
  });
  console.log('\n' + passed + '/' + tests.length + ' Tests bestanden.');
  process.exitCode = failed ? 1 : 0;
})();
