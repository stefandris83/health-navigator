#!/usr/bin/env node
'use strict';

/* Dependency-freie Tests für Datenschutz, Persistenz, Integration und A11y. */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function runScript(windowObject, relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  // Jedes klassische Browser-Skript erhält denselben isolierten window-Kontext.
  new Function('window', source)(windowObject);
}

function makeCore(configOverrides) {
  const windowObject = { HealthNavigatorConfig: configOverrides };
  runScript(windowObject, 'js/config.js');
  runScript(windowObject, 'js/url-safety.js');
  runScript(windowObject, 'js/result-copy.generated.js');
  runScript(windowObject, 'js/result-copy.js');
  runScript(windowObject, 'js/questions.js');
  runScript(windowObject, 'js/persistence.js');
  return windowObject;
}

function makeIntegrated(configOverrides, search, bootstrap) {
  const windowObject = makeCore(configOverrides);
  windowObject.location = { search: search || '' };
  windowObject.dispatchEvent = () => {};
  if (bootstrap) windowObject.HealthNavigatorBootstrap = bootstrap;
  runScript(windowObject, 'js/helsana.js');
  runScript(windowObject, 'js/integration.js');
  return windowObject;
}

test('Konfiguration aktiviert Links nur im Standalone-Mock automatisch und validiert Overrides', () => {
  const defaults = makeCore().HealthNavigatorConfig;
  assert.strictEqual(defaults.resultLinkEnabled, true);
  assert.strictEqual(defaults.resultLinkImportEnabled, true);
  assert.strictEqual(defaults.resultLinkBaseUrl, null);
  assert.strictEqual(defaults.storageTtlDays, 90);
  assert.strictEqual(defaults.adapterTimeoutMs, 4000);
  assert.strictEqual(defaults.integrationMode, 'mock');
  assert.strictEqual(defaults.demoProfilesEnabled, true);
  assert.strictEqual(defaults.coverageHintsEnabled, true);
  assert.strictEqual(Object.isFrozen(defaults), true);

  assert.strictEqual(makeCore({ integrationMode: 'live' }).HealthNavigatorConfig.resultLinkEnabled, false);
  assert.strictEqual(makeCore({ integrationMode: 'anonymous' }).HealthNavigatorConfig.resultLinkEnabled, false);
  assert.strictEqual(makeCore({ integrationMode: 'mock', resultLinkEnabled: false }).HealthNavigatorConfig.resultLinkEnabled, false);

  const custom = makeCore({
    resultLinkEnabled: true,
    resultLinkImportEnabled: false,
    resultLinkBaseUrl: 'https://example.test/health/?code=secret#old',
    storageTtlDays: 30,
    adapterTimeoutMs: 800,
    integrationMode: 'live',
    demoProfilesEnabled: true,
  }).HealthNavigatorConfig;
  assert.deepStrictEqual(custom, {
    resultLinkEnabled: true,
    resultLinkImportEnabled: false,
    resultLinkBaseUrl: 'https://example.test/health/',
    storageTtlDays: 30,
    adapterTimeoutMs: 800,
    integrationMode: 'live',
    demoProfilesEnabled: false,
    coverageHintsEnabled: false,
  });
  const invalid = makeCore({
    resultLinkEnabled: 'ja',
    resultLinkImportEnabled: 'nein',
    resultLinkBaseUrl: 'javascript:alert(1)',
    storageTtlDays: -1,
    adapterTimeoutMs: 1,
    integrationMode: 'production',
  }).HealthNavigatorConfig;
  assert.strictEqual(invalid.resultLinkEnabled, true);
  assert.strictEqual(invalid.resultLinkImportEnabled, true);
  assert.strictEqual(invalid.resultLinkBaseUrl, null);
  assert.strictEqual(invalid.storageTtlDays, 90);
  assert.strictEqual(invalid.adapterTimeoutMs, 4000);
  assert.strictEqual(invalid.integrationMode, 'mock');

  const hostConfig = { hostFeature: true };
  const hostWindow = { APP_CONFIG: hostConfig };
  runScript(hostWindow, 'js/config.js');
  assert.strictEqual(hostWindow.APP_CONFIG, hostConfig, 'generische Host-Konfiguration bleibt unangetastet');
  assert.strictEqual(hostWindow.HealthNavigatorConfig.integrationMode, 'mock');
});

test('URL-Allowlist akzeptiert nur absolute HTTPS-Ziele ohne Zugangsdaten', () => {
  const safety = makeCore().HealthUrlSafety;
  assert.strictEqual(Object.isFrozen(safety), true);
  assert.strictEqual(safety.safeHttps(' https://example.test/path?q=1#section '), 'https://example.test/path?q=1#section');
  [
    '', '#', '/relative', '//example.test/path',
    'http://example.test', 'javascript:alert(1)', 'data:text/html,test',
    'file:///tmp/test', 'https://user:secret@example.test/path', 'keine-url',
  ].forEach((value) => assert.strictEqual(safety.safeHttps(value), null, value));
  assert.deepStrictEqual(Object.keys(safety), ['safeHttps']);
});

test('Ergebnislink-Basis erlaubt file nur im Standalone-Mock und bevorzugt kanonisches HTTPS', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const match = appSource.match(/(function resultLinkLocale\(\) \{[\s\S]*?\n  \}\n)  function clearShareHash/);
  assert.ok(match, 'Locale- und resultLinkBaseUrl()-Vertrag muss extrahierbar bleiben');
  const resolve = new Function(
    'safeHttps',
    'config',
    'location',
    'window',
    `${match[1]}\nreturn resultLinkBaseUrl();`
  );
  const safeHttps = makeCore().HealthUrlSafety.safeHttps;
  const baseConfig = { integrationMode: 'mock', resultLinkBaseUrl: null };
  const noLocale = {};

  assert.strictEqual(
    resolve(safeHttps, baseConfig, { href: 'file:///Users/demo/Health/index.html?kunde=grund#alt' }, noLocale),
    'file:///Users/demo/Health/index.html'
  );
  assert.strictEqual(
    resolve(safeHttps, { ...baseConfig, integrationMode: 'live' }, { href: 'file:///Users/demo/Health/index.html' }, noLocale),
    null
  );
  assert.strictEqual(
    resolve(safeHttps, { ...baseConfig, integrationMode: 'anonymous' }, { href: 'file:///Users/demo/Health/index.html' }, noLocale),
    null
  );
  assert.strictEqual(
    resolve(safeHttps, baseConfig, { href: 'https://navigator.example/check/?kunde=x#alt' }, noLocale),
    'https://navigator.example/check/'
  );
  assert.strictEqual(
    resolve(safeHttps, baseConfig, { href: 'http://navigator.example/check/' }, noLocale),
    null
  );
  assert.strictEqual(
    resolve(
      safeHttps,
      { integrationMode: 'live', resultLinkBaseUrl: 'https://health.example/navigator/?secret=x#old' },
      { href: 'file:///Users/demo/Health/index.html' },
      noLocale
    ),
    'https://health.example/navigator/'
  );
  assert.strictEqual(
    resolve(safeHttps, baseConfig, { href: 'file:///Users/demo/Health/index.html?kunde=x#alt' }, {
      HealthLocale: {
        current: 'fr-CH',
        supported: ['de-CH', 'en-CH', 'fr-CH', 'it-CH'],
        normalize: (value) => value === 'fr-CH' ? value : null,
      },
    }),
    'file:///Users/demo/Health/index.html?lang=fr-CH'
  );
});

test('Storage v4: Roundtrip, Sanitisierung und Index-Clamping', () => {
  const windowObject = makeCore();
  const persistence = windowObject.HealthPersistence;
  const now = Date.now();
  const raw = persistence.serializeState({
    answers: {
      alter: '45',
      familie_hk: 'teilweise',
      familienwissen: 'nein',
      vorsorge: 'nein',
      rauchen: '<script>',
      fremd: 'x',
    },
    dimIndex: 999,
    maxReached: 999,
  }, now);
  assert.strictEqual(JSON.parse(raw).v, 4);
  assert.strictEqual(persistence.STORAGE_SCHEMA, 4);
  const stored = persistence.readState(raw, { now });
  assert.deepStrictEqual(stored.answers, {
    alter: 45,
    familie_hk: 'teilweise',
    familienwissen: 'nein',
    vorsorge: 'nein',
  });
  assert.strictEqual(stored.dimIndex, windowObject.DIMENSIONS.length - 1);
  assert.strictEqual(stored.maxReached, windowObject.DIMENSIONS.length - 1);
  assert.strictEqual(stored.migrated, false);
});

test('Storage v3/Hash v2 überführen die zusammengeführte Vorsorgeantwort eindeutig', () => {
  const windowObject = makeCore();
  const persistence = windowObject.HealthPersistence;
  const now = Date.now();
  const state = persistence.readState(JSON.stringify({
    v: 3,
    savedAt: now,
    answers: { alter: 45, vorsorge: 'aelter_unsicher' },
    dimIndex: 1,
    maxReached: 2,
  }), { now });
  assert.strictEqual(state.migrated, true);
  assert.deepStrictEqual(state.answers, { alter: 45, vorsorge: 'nein' });

  const previousHash = Buffer.from(JSON.stringify({
    v: 2,
    a: { alter: 45, vorsorge: 'aelter_unsicher' },
  })).toString('base64url');
  assert.deepStrictEqual(persistence.decodeAnswers(previousHash), { alter: 45, vorsorge: 'nein' });
});

test('Storage v2/Legacy behält sichere Antworten und fordert die drei semantisch geänderten Fragen neu an', () => {
  const windowObject = makeCore({ storageTtlDays: 90 });
  const persistence = windowObject.HealthPersistence;
  const now = Date.now();
  const influenceIndex = windowObject.DIMENSIONS.findIndex((dimension) => dimension.id === 'einfluss');
  const legacy = persistence.readState(JSON.stringify({
    answers: {
      alter: 52,
      rauchen: 'nie',
      familienwissen: 'sehr_gut',
      vorsorge: 'ja',
      familie_hk: 'weiss_nicht',
    },
    dimIndex: 1,
    maxReached: 2,
  }), { now });
  assert.strictEqual(legacy.migrated, true);
  assert.deepStrictEqual(legacy.answers, { alter: 52, rauchen: 'nie' });
  assert.strictEqual(legacy.dimIndex, influenceIndex,
    'migrierte Stände öffnen den Abschnitt mit den neu zu beantwortenden Fragen');
  assert.strictEqual(legacy.maxReached, 2,
    'ein bereits erreichter späterer Abschnitt bleibt nach der Migration erreichbar');

  const previous = persistence.readState(JSON.stringify({
    v: 2,
    savedAt: now,
    answers: {
      alkohol: 'nie_selten',
      familienwissen: 'nein',
      vorsorge: 'nein',
      familie_hk: 'ja',
    },
    dimIndex: windowObject.DIMENSIONS.length - 1,
    maxReached: windowObject.DIMENSIONS.length - 1,
  }), { now });
  assert.strictEqual(previous.migrated, true);
  assert.deepStrictEqual(previous.answers, { alkohol: 'nie_selten' },
    'auch zufällig noch gültige Werte werden wegen geänderter Semantik nicht übernommen');
  assert.strictEqual(previous.dimIndex, influenceIndex);
  assert.strictEqual(previous.maxReached, windowObject.DIMENSIONS.length - 1);

  const current = persistence.readState(JSON.stringify({
    v: 4,
    savedAt: now,
    answers: { familienwissen: 'nein', vorsorge: 'nein', familie_hk: 'ja' },
  }), { now });
  assert.strictEqual(current.migrated, false);
  assert.deepStrictEqual(current.answers, {
    familie_hk: 'ja',
    familienwissen: 'nein',
    vorsorge: 'nein',
  });

  const old = JSON.stringify({ v: 2, savedAt: now - 91 * 86400000, answers: {} });
  const future = JSON.stringify({ v: 4, savedAt: now + 3600000, answers: {} });
  assert.strictEqual(persistence.readState(old, { now }), null);
  assert.strictEqual(persistence.readState(future, { now }), null);
  assert.strictEqual(persistence.readState(JSON.stringify({ v: 99, savedAt: now, answers: {} }), { now }), null);
  assert.strictEqual(persistence.readState('{kaputt', { now }), null);
});

test('Plan-Häkchen sind versioniert, bereinigt, migrierbar und laufen ebenfalls ab', () => {
  const persistence = makeCore().HealthPersistence;
  const now = Date.now();
  const raw = persistence.serializePlan({ 'fi_kraft-0': true, 'fi_kraft-1': false, '<script>': true }, now);
  assert.strictEqual(JSON.parse(raw).v, 4);
  assert.deepStrictEqual(persistence.readPlan(raw, { now }), {
    items: { 'fi_kraft-0': true },
    migrated: false,
  });
  const legacy = persistence.readPlan(JSON.stringify({ 'sl_dauer-2': true }), { now });
  assert.strictEqual(legacy.migrated, true);
  assert.deepStrictEqual(legacy.items, { 'sl_dauer-2': true });
  const previous = persistence.readPlan(JSON.stringify({
    v: 3,
    savedAt: now,
    items: { 'ei_familie-0': true },
  }), { now });
  assert.deepStrictEqual(previous, { items: { 'ei_familie-0': true }, migrated: true });
  const expired = JSON.stringify({ v: 2, savedAt: now - 91 * 86400000, items: { 'sl_dauer-2': true } });
  assert.strictEqual(persistence.readPlan(expired, { now }), null);
  assert.strictEqual(persistence.readPlan(JSON.stringify({ v: 1, savedAt: now, items: {} }), { now }), null);
});

test('Ergebnis-Link v3 roundtript aktuelle Antworten und migriert v1 ohne semantisch geänderte Antworten', () => {
  const persistence = makeCore().HealthPersistence;
  const encoded = persistence.encodeAnswers({
    alter: 45,
    familie_hk: 'teilweise',
    familienwissen: 'nein',
    vorsorge: 'weiss_nicht',
    rauchen: 'nie',
    fremd: '<script>',
  });
  assert.strictEqual(persistence.HASH_SCHEMA, 3);
  assert.strictEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')).v, 3);
  assert.deepStrictEqual(persistence.decodeAnswers(encoded), {
    alter: 45,
    familie_hk: 'teilweise',
    familienwissen: 'nein',
    vorsorge: 'weiss_nicht',
    rauchen: 'nie',
  });
  assert.strictEqual(persistence.decodeAnswers('%%%'), null);
  assert.strictEqual(persistence.decodeAnswers('A'.repeat(persistence.HASH_MAX_LENGTH + 1)), null);
  const wrongVersion = Buffer.from(JSON.stringify({ v: 9, a: { alter: 45 } })).toString('base64url');
  assert.strictEqual(persistence.decodeAnswers(wrongVersion), null);

  const legacyAnswers = Buffer.from(JSON.stringify({
    v: 1,
    a: {
      alter: 52,
      rauchen: 'nie',
      familienwissen: 'gut',
      vorsorge: 'ja',
      familie_hk: 'nein',
    },
  })).toString('base64url');
  assert.deepStrictEqual(persistence.decodeAnswers(legacyAnswers), {
    alter: 52,
    rauchen: 'nie',
  });
});

test('Kundenkontext validiert Vertragsversion, dedupliziert und begrenzt Texte', () => {
  const integration = makeIntegrated().HelsanaIntegration;
  const normalized = integration.normalizeCustomerContext({
    contractVersion: 1,
    isAuthenticated: true,
    displayName: 'X'.repeat(200),
    products: [
      { id: 'a', category: 'BASIC', label: 'A'.repeat(200) },
      { id: 'a', category: 'SUPP_PREVENTION', label: 'Duplikat' },
      { id: 'b', category: 'UNBEKANNT', label: 'B' },
    ],
    ahvNumber: 'nicht übernehmen',
  });
  assert.strictEqual(normalized.products.length, 1);
  assert.strictEqual(normalized.displayName.length, 80);
  assert.strictEqual(normalized.products[0].label.length, 120);
  assert.strictEqual('ahvNumber' in normalized, false);
  assert.strictEqual(Object.isFrozen(normalized), true);
  assert.strictEqual(Object.isFrozen(normalized.products), true);
  assert.strictEqual(Object.isFrozen(normalized.products[0]), true);
  assert.strictEqual(integration.normalizeCustomerContext({ contractVersion: 2, isAuthenticated: true }).isAuthenticated, false);
  assert.strictEqual(integration.normalizeCustomerContext({ contractVersion: '1', isAuthenticated: true }).isAuthenticated, false);

  const many = integration.normalizeCustomerContext({
    contractVersion: 1,
    isAuthenticated: true,
    displayName: '  A\u202eB\u0000  C  ',
    products: Array.from({ length: 1000 }, (_value, index) => ({
      id: 'p' + index,
      category: 'BASIC',
      label: 'Label\u202e ' + index,
    })),
  });
  assert.strictEqual(many.products.length, integration.INTEGRATION_CONFIG.maxProducts);
  assert.ok(!/[\u202e\u0000]/.test(many.displayName));
  assert.ok(!/[\u202e\u0000]/.test(many.products[0].label));

  const hostile = {};
  Object.defineProperty(hostile, 'isAuthenticated', { get() { throw new Error('getter-boom'); } });
  assert.doesNotThrow(() => integration.normalizeCustomerContext(hostile));
  assert.strictEqual(integration.normalizeCustomerContext(hostile).isAuthenticated, false);
});

test('Live-Modus ignoriert Demo-Query und sperrt Coverage standardmässig', async () => {
  const integration = makeIntegrated({ integrationMode: 'live' }, '?kunde=zusatz-komplett').HelsanaIntegration;
  const initial = await integration.ready;
  assert.strictEqual(initial.isAuthenticated, false);
  integration.setContext({
    contractVersion: 1,
    isAuthenticated: true,
    products: [{ id: 'p', category: 'SUPP_PREVENTION', label: 'Prävention' }],
    source: 'live',
  });
  assert.strictEqual(integration.coverageHintFor('bewegung'), null);

  const noDemo = makeIntegrated({ integrationMode: 'mock', demoProfilesEnabled: false }).HelsanaIntegration;
  assert.strictEqual((await noDemo.init('zusatz-komplett')).isAuthenticated, false);
});

test('Anonymous-Modus ist eine harte Grenze für Bootstrap, Adapter und direkten Kontext', async () => {
  let adapterCalls = 0;
  const liveContext = {
    contractVersion: 1,
    isAuthenticated: true,
    displayName: 'Darf nicht übernommen werden',
    products: [{ id: 'p', category: 'SUPP_PREVENTION', label: 'Prävention' }],
    source: 'live',
  };
  const adapter = {
    async getCustomerContext() {
      adapterCalls++;
      return liveContext;
    },
  };
  const windowObject = makeIntegrated(
    { integrationMode: 'anonymous', coverageHintsEnabled: true },
    '?kunde=zusatz-komplett',
    { customerAdapter: adapter, customerContext: liveContext }
  );
  const integration = windowObject.HelsanaIntegration;

  assert.strictEqual(windowObject.HealthNavigatorBootstrap, undefined);
  assert.strictEqual((await integration.ready).isAuthenticated, false);
  assert.strictEqual(adapterCalls, 0, 'Anonymous-Modus ruft keinen Bootstrap-Adapter auf');
  assert.strictEqual(integration.setAdapter(adapter), false);
  assert.strictEqual(integration.setContext(liveContext).isAuthenticated, false);
  assert.strictEqual((await integration.init('zusatz-komplett')).isAuthenticated, false);
  assert.strictEqual(adapterCalls, 0);
});

test('Vorregistrierter Bootstrap-Adapter gewinnt vor dem initialen ready', async () => {
  const adapter = {
    async getCustomerContext(profileId) {
      assert.strictEqual(profileId, null, 'Live-Adapter erhält kein Demo-Profil');
      return { contractVersion: 1, isAuthenticated: true, products: [], source: 'live' };
    },
  };
  const windowObject = makeIntegrated({ integrationMode: 'live' }, '?kunde=zusatz-komplett', {
    customerAdapter: adapter,
  });
  assert.strictEqual(windowObject.HealthNavigatorBootstrap, undefined);
  assert.strictEqual((await windowObject.HelsanaIntegration.ready).isAuthenticated, true);
});

test('Adapter-Timeout liefert anonymen Fallback statt unbegrenzt zu warten', async () => {
  const integration = makeIntegrated({ adapterTimeoutMs: 100 }).HelsanaIntegration;
  integration.setAdapter({ getCustomerContext() { return new Promise(() => {}); } });
  const started = Date.now();
  const context = await integration.init();
  assert.strictEqual(context.isAuthenticated, false);
  assert.ok(Date.now() - started < 1000);
});

test('Timeout abortiert unterstützende Adapter und ready folgt dem neuesten init', async () => {
  const integration = makeIntegrated({ adapterTimeoutMs: 100, integrationMode: 'live' }).HelsanaIntegration;
  let aborted = false;
  integration.setAdapter({
    getCustomerContext(_profileId, options) {
      if (options.signal) options.signal.addEventListener('abort', () => { aborted = true; });
      return new Promise(() => {});
    },
  });
  const timed = integration.init();
  assert.strictEqual(integration.ready, timed);
  await timed;
  assert.strictEqual(aborted, true);

  integration.setAdapter({
    async getCustomerContext() {
      return { contractVersion: 1, isAuthenticated: true, products: [], source: 'live' };
    },
  });
  const refreshed = integration.init();
  assert.strictEqual(integration.ready, refreshed);
  assert.strictEqual((await integration.ready).isAuthenticated, true);
});

test('Adapterwechsel entwertet eine alte Antwort auch vor einem neuen init', async () => {
  const integration = makeIntegrated({ adapterTimeoutMs: 500, integrationMode: 'live' }).HelsanaIntegration;
  integration.setAdapter({
    getCustomerContext() {
      return new Promise((resolve) => setTimeout(() => resolve({
        contractVersion: 1,
        isAuthenticated: true,
        products: [],
        source: 'live',
      }), 50));
    },
  });
  const pending = integration.init();
  integration.setAdapter({ async getCustomerContext() { return null; } });
  await pending;
  assert.strictEqual(integration.getContext().isAuthenticated, false);
});

test('Verspätete Adapter-Antwort überschreibt einen neueren Logout nicht', async () => {
  const integration = makeIntegrated({ adapterTimeoutMs: 500 }).HelsanaIntegration;
  integration.setAdapter({
    getCustomerContext() {
      return new Promise((resolve) => setTimeout(() => resolve({
        isAuthenticated: true,
        products: [{ id: 'basic', category: 'BASIC', label: 'Grund' }],
      }), 80));
    },
  });
  const pending = integration.init();
  integration.clearContext();
  await pending;
  await sleep(100);
  assert.strictEqual(integration.getContext().isAuthenticated, false);
});

test('setContext und clearContext normalisieren direkte Login-/Logout-Updates', () => {
  const integration = makeIntegrated().HelsanaIntegration;
  const loggedIn = integration.setContext({
    isAuthenticated: true,
    products: [{ id: 'p', category: 'SUPP_PREVENTION', label: 'Prävention' }],
  });
  assert.strictEqual(loggedIn.isAuthenticated, true);
  assert.ok(integration.coverageHintFor('bewegung'));
  assert.strictEqual(integration.clearContext().isAuthenticated, false);
});

test('Statische Verträge: korrekte ARIA-Zustände, Link-Privacy und Ressourcen-Cleanup', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const cssSource = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  const radarSource = fs.readFileSync(path.join(ROOT, 'js/radar.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  assert.ok(appSource.includes('aria-checked="${pressed}"'));
  assert.ok(appSource.includes("opt.setAttribute('aria-checked', pressed)"));
  assert.ok(appSource.includes("role=\"${q.type === 'multi' ? 'group' : 'radiogroup'}\""));
  assert.ok(!appSource.includes('aria-pressed'));
  assert.ok(!cssSource.includes('aria-pressed'));
  assert.ok(appSource.includes('config.resultLinkEnabled'));
  assert.ok(appSource.includes('config.resultLinkImportEnabled === false'));
  assert.ok(appSource.includes('if (!sharedResultActive) save()'));
  assert.ok(appSource.includes('sharedResultActive = true'));
  assert.ok(appSource.includes("if (choice === 'dismiss') return"));
  assert.ok(appSource.includes("if (choice === 'cancel') reset()"));
  assert.ok(!appSource.includes('if (!keep) reset()'));
  const shareFunction = appSource.match(/function shareResultLink\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(shareFunction);
  assert.ok(shareFunction[1].includes('showLinkModal(url)'));
  assert.ok(!shareFunction[1].includes('clipboard'));
  assert.ok(appSource.includes("current.protocol === 'file:' && config.integrationMode === 'mock'"));
  assert.ok(appSource.includes('return safeHttps(current.href)'));
  assert.ok(appSource.includes("copy.get('ui.share_modal.local_file_warning')"));
  assert.ok(appSource.includes('value="${escAttr(url)}"'));
  assert.ok(!appSource.includes("history.replaceState(null, '', url)"));
  assert.ok(appSource.includes("window.Radar.destroy()"));
  assert.ok(radarSource.includes('window.Radar = Object.freeze({ renderRadar, destroy })'));
  assert.ok(radarSource.includes("role: 'group'"));
  assert.ok(!radarSource.includes("role: 'img'"));
  assert.ok(indexSource.indexOf('js/config.js') < indexSource.indexOf('js/questions.js'));
  assert.ok(indexSource.indexOf('js/url-safety.js') < indexSource.indexOf('js/helsana.js'));
  assert.ok(indexSource.indexOf('js/persistence.js') > indexSource.indexOf('js/questions.js'));
  assert.ok(!/target="_blank" rel="noopener"(?! noreferrer)/.test(indexSource + appSource));

  const radarWindow = {};
  runScript(radarWindow, 'js/radar.js');
  assert.strictEqual(Object.isFrozen(radarWindow.Radar), true);
});

test('Repository bleibt frei von Betriebssystemartefakten und lokalen Benutzerpfaden', () => {
  function collectFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(absolute) : [absolute];
    });
  }

  const files = collectFiles(ROOT);
  assert.deepStrictEqual(
    files.filter((file) => path.basename(file) === '.DS_Store'),
    [],
    '.DS_Store darf nicht im Projekt liegen'
  );
  const launch = fs.readFileSync(path.join(ROOT, '.vscode', 'launch.json'), 'utf8');
  assert.ok(launch.includes('${workspaceFolder}'));
  assert.ok(!/(?:\/Users\/|OneDrive|file:\/\/\/[A-Za-z](?:%3A|:)\/|["'\s][A-Za-z]:[\\/])/i.test(launch));
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.ok(/^\.DS_Store$/m.test(gitignore));
});

test('GitHub-Pages-Deployment prüft Content, Laufzeit und alle vier Sprachen vor dem Upload', () => {
  const workflowPath = path.resolve(ROOT, '..', '.github', 'workflows', 'deploy-pages.yml');
  assert.ok(fs.existsSync(workflowPath), 'Deployment-Workflow fehlt');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const requiredCommands = [
    'node scripts/result-content.js validate',
    'node scripts/result-content.js check',
    'node tests/content-workflow.test.js',
    'node tests/integration.test.js',
    'node tests/robustness.test.js',
    'node tests/ui-lifecycle.test.js',
    'node tests/i18n-static.test.js',
    'node tests/i18n-runtime.test.js',
  ];

  assert.ok(workflow.includes('uses: actions/setup-node@v4'));
  requiredCommands.forEach((command) => assert.ok(workflow.includes(command), command));
  assert.ok(workflow.includes('cp index.html quellen.html manifest*.webmanifest ../_site/'));
  assert.ok(workflow.includes('cp -R assets css js ../_site/'));
  assert.ok(
    workflow.indexOf('Anwendung vor der Veröffentlichung prüfen') <
      workflow.indexOf('Öffentliche Anwendung vorbereiten'),
    'Prüfungen müssen vor dem Erzeugen des Upload-Artefakts laufen'
  );
});

test('Quellenseite schützt Referrer und verwendet nur den verifizierten Herzstiftungs-Pfad', () => {
  const page = fs.readFileSync(path.join(ROOT, 'quellen.html'), 'utf8');
  const sourceCode = fs.readFileSync(path.join(ROOT, 'js', 'recommendations.js'), 'utf8');
  const documentation = fs.readFileSync(path.join(ROOT, 'docs', 'QUELLEN.md'), 'utf8');
  const retiredPath = 'so-bleiben-sie-gesund/gesund-leben/blutfette';
  const safePath = 'wissen-und-support/dossiers/diese-werte-muessen-sie-kennen';

  assert.ok(page.includes('<meta name="referrer" content="no-referrer"'));
  assert.ok(page.includes('Stand der Recherche: Juli 2026'));
  assert.ok(!/target="_blank" rel="noopener"(?! noreferrer)/.test(page));
  [page, sourceCode, documentation].forEach((text) => {
    assert.ok(!text.includes(retiredPath), 'Ausgemusterter Herzstiftungs-Pfad darf nicht vorkommen');
    assert.ok(text.includes(safePath), 'Verifizierter Herzstiftungs-Pfad fehlt');
  });
});

test('Doppelklick-Portabilität: lokale Assets existieren und klassische Script-Reihenfolge ist vollständig', () => {
  const pageFiles = ['index.html', 'quellen.html'];
  pageFiles.forEach((pageFile) => {
    const page = fs.readFileSync(path.join(ROOT, pageFile), 'utf8');
    const refs = [...page.matchAll(/(?:^|[\s<])(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    refs.forEach((ref) => {
      if (!ref || ref.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) return;
      assert.ok(!ref.startsWith('/'), pageFile + ': lokaler Pfad muss relativ sein: ' + ref);
      const localPath = ref.split(/[?#]/)[0];
      assert.ok(fs.existsSync(path.resolve(ROOT, path.dirname(pageFile), localPath)), pageFile + ': Datei fehlt: ' + ref);
    });
    assert.ok(!/<script\b[^>]*\btype="module"/i.test(page), pageFile + ': keine ES-Module über file://');
    assert.ok(!/\son[a-z]+\s*=/i.test(page), pageFile + ': keine Inline-Eventhandler');
    assert.ok(!/<a\b[^>]*aria-disabled="true"/i.test(page), pageFile + ': deaktivierte Platzhalter sind keine Links');
  });

  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...indexSource.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)]
    .map((match) => match[1]);
  assert.deepStrictEqual(scripts, [
    'js/locale.js',
    'js/config.js',
    'js/result-copy.generated.js',
    'js/result-copy.js',
    'js/page-i18n.js',
    'js/url-safety.js',
    'js/questions.js',
    'js/persistence.js',
    'js/helsana.js',
    'js/integration.js',
    'js/scoring.js',
    'js/recommendations.js',
    'js/coach.js',
    'js/radar.js',
    'js/app.js',
  ]);
  scripts.forEach((script) => {
    const source = fs.readFileSync(path.join(ROOT, script), 'utf8');
    assert.ok(/['"]use strict['"];/.test(source), script + ': Strict Mode fehlt');
  });
});

test('Mobile Installation: Manifest und lokale Android-/iOS-Icons sind vollständig und sicher', () => {
  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const expectedIcons = [
    ['assets/app-icon.svg', 'any', 'image/svg+xml'],
    ['assets/app-icon-192.png', '192x192', 'image/png'],
    ['assets/app-icon-512.png', '512x512', 'image/png'],
  ];

  assert.ok(indexSource.includes('rel="manifest" href="manifest.de-CH.webmanifest" data-locale-manifest'));
  assert.ok(indexSource.includes('rel="apple-touch-icon" href="assets/apple-touch-icon.png" sizes="180x180"'));
  ['manifest.webmanifest', 'manifest.de-CH.webmanifest', 'manifest.en-CH.webmanifest',
    'manifest.fr-CH.webmanifest', 'manifest.it-CH.webmanifest'].forEach((name) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
    const expectedLocale = name === 'manifest.webmanifest'
      ? 'de-CH'
      : name.replace(/^manifest\.|\.webmanifest$/g, '');
    assert.strictEqual(manifest.lang, expectedLocale, name + ': Sprache');
    assert.strictEqual(manifest.start_url, './', name + ': neutrale Startadresse');
    assert.strictEqual(manifest.scope, './');
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.theme_color, '#9A0941');
    assert.deepStrictEqual(
      manifest.icons.map((icon) => [icon.src, icon.sizes, icon.type]),
      expectedIcons,
      name + ': Icons'
    );
  });

  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'app-icon.svg'), 'utf8');
  assert.ok(/^<svg\b/.test(svg));
  assert.ok(svg.includes('id="helsana-red-gradient"'));
  ['#C01551', '#9A0941', '#5E0628'].forEach((color) => assert.ok(svg.includes(`stop-color="${color}"`)));
  assert.ok(svg.includes('stroke="#FFFFFF"'));
  assert.ok(svg.includes('stroke-linecap="round"'));
  assert.ok(svg.includes('stroke-linejoin="round"'));
  assert.ok(!/<script\b|<foreignObject\b|\son[a-z]+\s*=|\b(?:href|src)\s*=|javascript:/i.test(svg));

  [
    ['assets/app-icon-192.png', 192],
    ['assets/app-icon-512.png', 512],
    ['assets/apple-touch-icon.png', 180],
  ].forEach(([relativePath, expectedSize]) => {
    const png = fs.readFileSync(path.join(ROOT, relativePath));
    assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), relativePath + ': PNG-Signatur fehlt');
    assert.strictEqual(png.readUInt32BE(16), expectedSize, relativePath + ': falsche Breite');
    assert.strictEqual(png.readUInt32BE(20), expectedSize, relativePath + ': falsche Höhe');
  });
});

test('Helsana-Logo ist lokal, unverändert und frei von aktiven SVG-Inhalten', () => {
  const expectedLogoPath = 'assets/helsana-logo.svg';
  const pages = ['index.html', 'quellen.html'].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const logoRefs = pages.flatMap((page) => [...page.matchAll(/<img\b[^>]*class="brand-logo"[^>]*src="([^"]+)"[^>]*>/gsi)]
    .map((match) => match[1]));

  assert.deepStrictEqual(logoRefs, [expectedLogoPath, expectedLogoPath]);
  assert.ok(!pages.join('\n').includes('www.helsana.ch/content/dam/system/helsana/resources/helsana-logo.svg'));

  const svg = fs.readFileSync(path.join(ROOT, expectedLogoPath), 'utf8');
  assert.strictEqual(
    crypto.createHash('sha256').update(svg).digest('hex'),
    '27bdb75e28c6fc9b0ece9f1158e5f7e43b851a6784d5e5f555628df9f60a30d5'
  );
  assert.ok(/^<svg\b/.test(svg));
  assert.ok(svg.includes('viewBox="0 0 180 34"'));
  assert.ok(!/<script\b|<foreignObject\b|\son[a-z]+\s*=|\b(?:href|src)\s*=|javascript:/i.test(svg));
});

test('Alle Messillustrationen sind lokale quadratische PNG-Dateien und werden mit den Assets veröffentlicht', () => {
  const slugs = ['taillenumfang', 'einbeinstand', 'liegestuetze', 'wandsitz'];
  const variants = ['weiblich', 'maennlich'];
  slugs.forEach((slug) => variants.forEach((variant) => {
    const relativePath = `assets/illustrations/${slug}-${variant}.png`;
    const png = fs.readFileSync(path.join(ROOT, relativePath));
    assert.ok(
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      relativePath + ': PNG-Signatur fehlt'
    );
    assert.strictEqual(png.readUInt32BE(16), 1024, relativePath + ': falsche Breite');
    assert.strictEqual(png.readUInt32BE(20), 1024, relativePath + ': falsche Höhe');
  }));

  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  assert.ok(css.includes('.q-illustration-wrap {'));
  assert.ok(css.includes('width: min(100%, 420px)'));
  assert.ok(css.includes('filter: grayscale(1)'));
  assert.ok(css.includes('.q-illustration-wrap[hidden] { display: none; }'));
});

(async function run() {
  console.log('Robustheit, Datenschutz & A11y\n');
  let passed = 0;
  let failed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      passed++;
      console.log('  ✓ ' + item.name);
    } catch (error) {
      failed++;
      console.error('  ✗ ' + item.name + '\n    → ' + error.message);
    }
  }
  console.log(`\n${passed}/${tests.length} Tests bestanden.`);
  process.exit(failed ? 1 : 0);
})();
