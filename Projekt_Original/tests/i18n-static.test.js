#!/usr/bin/env node
'use strict';

/* Dependency-freie Verträge für Locale-Runtime und statische Seitenkopie. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Workflow = require('../scripts/result-content.js');

const ROOT = path.join(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function runScript(windowObject, relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  new Function('window', source)(windowObject);
}

function makeLocale({ href, search, stored } = {}) {
  let storedValue = stored || null;
  const session = new Map();
  let assigned = null;
  const location = {
    href: href || 'file:///tmp/health/index.html',
    search: search || '',
    assign(value) { assigned = value; },
  };
  const windowObject = {
    location,
    localStorage: {
      getItem(key) { return key === 'health-navigator.locale.v1' ? storedValue : null; },
      setItem(key, value) { if (key === 'health-navigator.locale.v1') storedValue = value; },
    },
    sessionStorage: {
      getItem(key) { return session.has(key) ? session.get(key) : null; },
      setItem(key, value) { session.set(key, String(value)); },
      removeItem(key) { session.delete(key); },
    },
  };
  runScript(windowObject, 'js/locale.js');
  return {
    api: windowObject.HealthLocale,
    assigned: () => assigned,
    stored: () => storedValue,
    session,
  };
}

test('Locale-Vertrag erlaubt genau DE, EN, FR und IT für die Schweiz', () => {
  const { api } = makeLocale();
  assert.deepStrictEqual(api.supported, ['de-CH', 'en-CH', 'fr-CH', 'it-CH']);
  assert.strictEqual(api.current, 'de-CH');
  assert.strictEqual(api.getLocale(), 'de-CH');
  assert.strictEqual(api.normalize('de'), 'de-CH');
  assert.strictEqual(api.normalize('EN_ch'), 'en-CH');
  assert.strictEqual(api.normalize('fr-CH'), 'fr-CH');
  assert.strictEqual(api.normalize('it'), 'it-CH');
  assert.strictEqual(api.normalize('es'), null);
  assert.strictEqual(Object.isFrozen(api), true);
  assert.strictEqual(Object.isFrozen(api.supported), true);
});

test('Erlaubter lang-Parameter hat Vorrang vor separat gespeicherter Locale', () => {
  const explicit = makeLocale({ search: '?lang=fr', stored: 'it-CH' });
  assert.strictEqual(explicit.api.current, 'fr-CH');
  assert.strictEqual(explicit.stored(), 'fr-CH', 'Explizite Link-Sprache wird separat gemerkt');
  assert.strictEqual(makeLocale({ search: '?lang=xx', stored: 'it-CH' }).api.current, 'it-CH');
});

test('Sprachwechsel erhält bei file:// alle anderen Parameter und den Hash', () => {
  const runtime = makeLocale({
    href: 'file:///Users/demo/Health/index.html?kunde=grund&foo=bar#result=abc',
    search: '?kunde=grund&foo=bar',
  });
  const next = runtime.api.setLocale('fr');
  const parsed = new URL(next);
  assert.strictEqual(parsed.protocol, 'file:');
  assert.strictEqual(parsed.searchParams.get('kunde'), 'grund');
  assert.strictEqual(parsed.searchParams.get('foo'), 'bar');
  assert.strictEqual(parsed.searchParams.get('lang'), 'fr-CH');
  assert.strictEqual(parsed.hash, '#result=abc');
  assert.strictEqual(runtime.assigned(), next);
  assert.strictEqual(runtime.stored(), 'fr-CH');
});

test('Sprachwechsel kann die aktuelle Ergebnisansicht einmalig wiederherstellen', () => {
  const runtime = makeLocale();
  runtime.api.switchTo('it');
  assert.strictEqual(runtime.api.consumeReturnView(), null, 'ohne App-Ansicht kein Rücksprung');

  let assigned = null;
  const session = new Map();
  const windowObject = {
    location: {
      href: 'file:///tmp/health/index.html?lang=de-CH', search: '?lang=de-CH',
      assign(value) { assigned = value; },
    },
    document: { body: { dataset: { screen: 'results' } } },
    localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: {
      getItem(key) { return session.get(key) || null; },
      setItem(key, value) { session.set(key, String(value)); },
      removeItem(key) { session.delete(key); },
    },
  };
  runScript(windowObject, 'js/locale.js');
  windowObject.HealthLocale.switchTo('fr');
  assert.ok(assigned.includes('lang=fr-CH'));
  assert.strictEqual(windowObject.HealthLocale.consumeReturnView(), 'results');
  assert.strictEqual(windowObject.HealthLocale.consumeReturnView(), null, 'Ansicht wird nur einmal konsumiert');
});

test('Manifest- und externe URL-Zuordnung verwendet nur explizite Sprachpfade', () => {
  const { api } = makeLocale({ href: 'file:///tmp/health/index.html' });
  assert.strictEqual(api.manifestHref('en'), 'manifest.en-CH.webmanifest');
  assert.strictEqual(
    api.urlForLocale('fr', 'quellen.html'),
    'file:///tmp/health/quellen.html?lang=fr-CH',
    'Interne Navigation behält die gewählte Sprache auch ohne Storage'
  );
  assert.strictEqual(api.externalHref('helsana.private', 'it'), 'https://www.helsana.ch/it/privati.html');
  assert.strictEqual(api.externalHref('helsana.private', 'fr'), 'https://www.helsana.ch/fr/prives.html');
  assert.strictEqual(api.externalHref('helsana.business', 'en'), 'https://www.helsana.ch/en/companies.html');
  assert.strictEqual(api.externalHref('helsana.blog', 'fr'), 'https://www.helsana.ch/fr/blog.html');
  assert.strictEqual(api.externalHref('helsana.group', 'fr'), 'https://www.helsana.ch/fr/groupe-helsana.html');
  assert.strictEqual(
    api.externalHref('helsana.group', 'it'),
    'https://www.helsana.ch/it/gruppo-helsana.html'
  );
  assert.strictEqual(
    api.externalHref('helsana.myhelsana', 'it'),
    'https://portal.helsana.ch/helsana-login/myhelsana?language=de',
    'Nicht bestätigter Portalpfad fällt explizit auf DE zurück'
  );
  assert.strictEqual(api.externalHref('unbekannt', 'de'), null);
});

test('Alle statischen HTML-/Manifest-IDs existieren im deutschen Shell-/Quellenkatalog', () => {
  const files = ['content/result-texts/shell.json', 'content/result-texts/sources.json'];
  const catalogIds = new Set(files.flatMap((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    assert.strictEqual(data.locale, 'de-CH');
    return data.entries.map((entry) => entry.id);
  }));
  const html = ['index.html', 'quellen.html']
    .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
    .join('\n');
  const references = [...html.matchAll(/data-copy(?:-[a-z-]+)?="([^"]+)"/g)]
    .map((match) => match[1]);
  const generatedReferences = new Set(Object.values(Workflow.MANIFEST_COPY_IDS));
  references.forEach((id) => assert.ok(catalogIds.has(id), 'Katalog-ID fehlt: ' + id));
  catalogIds.forEach((id) => assert.ok(
    references.includes(id) || generatedReferences.has(id),
    'Statische Katalog-ID ohne HTML-/Manifest-Verwendung: ' + id
  ));
});

test('Startseite und Quellenseite verwenden denselben globalen Footer-Vertrag', () => {
  const pages = ['index.html', 'quellen.html'].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const footerReferences = (html) => {
    const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/i);
    assert.ok(footer, 'Footer fehlt');
    assert.ok(footer[1].includes('id="footer-global"'), 'Globaler Footer-Container fehlt');
    return [...footer[1].matchAll(/data-copy(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);
  };
  assert.deepStrictEqual(footerReferences(pages[0]), footerReferences(pages[1]));
});

test('Beide Seiten laden Locale vor Textbundle und statische Übersetzung danach', () => {
  ['index.html', 'quellen.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const locale = html.indexOf('src="js/locale.js"');
    const generated = html.indexOf('src="js/result-copy.generated.js"');
    const copy = html.indexOf('src="js/result-copy.js"');
    const page = html.indexOf('src="js/page-i18n.js"');
    assert.ok(locale >= 0 && locale < generated, file + ': Locale muss vor dem Bundle laden');
    assert.ok(generated < copy && copy < page, file + ': ungültige Text-Script-Reihenfolge');
  });
});

test('Alle Sprachschalter sind auf beiden Seiten aktiv und vollständig', () => {
  ['index.html', 'quellen.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const locales = [...html.matchAll(/<button[^>]+data-locale="([^"]+)"/g)].map((match) => match[1]);
    assert.deepStrictEqual(locales, ['de-CH', 'en-CH', 'fr-CH', 'it-CH'], file);
    assert.ok(!/lang-item[^>]+is-placeholder/.test(html), file + ': Sprachwahl darf kein Platzhalter sein');
  });
});

test('Navigation zwischen Check und Quellen bewahrt die Locale explizit', () => {
  const index = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const sources = fs.readFileSync(path.join(ROOT, 'quellen.html'), 'utf8');
  assert.ok(index.includes("localizedRoute('quellen.html')"));
  assert.strictEqual((sources.match(/data-locale-route="index\.html"/g) || []).length, 2);
});

test('Lokalisierte Manifeste sind vollständig und öffnen ihre Locale', () => {
  ['de-CH', 'en-CH', 'fr-CH', 'it-CH'].forEach((locale) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'manifest.' + locale + '.webmanifest'), 'utf8')
    );
    assert.strictEqual(manifest.lang, locale);
    assert.strictEqual(new URL(manifest.start_url, 'https://example.test/app/').searchParams.get('lang'), locale);
    assert.strictEqual(manifest.id, './', 'Alle Sprachen bleiben dieselbe installierbare App');
    manifest.icons.forEach((icon) => assert.ok(fs.existsSync(path.join(ROOT, icon.src)), icon.src));
  });
});

test('Quellenseite beschreibt die freigegebene Wandsitz-Orientierung widerspruchsfrei', () => {
  const html = fs.readFileSync(path.join(ROOT, 'quellen.html'), 'utf8');
  const sourceCopy = fs.readFileSync(path.join(ROOT, 'content/result-texts/sources.json'), 'utf8');
  [html, sourceCopy].forEach((source) => {
    assert.ok(source.includes('harmonisierte Trainingsorientierung'));
    assert.ok(!source.includes('fehlen klinisch validierte Altersnormen'));
    assert.ok(!source.includes('mangels klinisch validierter Altersnormen'));
  });
});

test('Statische Übersetzung verwendet nur ResultCopy und schreibt keine HTML-Fragmente', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/page-i18n.js'), 'utf8');
  assert.ok(source.includes('window.ResultCopy.get(id)'));
  assert.ok(!source.includes('innerHTML'));
  assert.ok(!/StaticCopyCatalog|fetch\s*\(/.test(source));
});

test('Page-I18n setzt Texte, Metadaten und den aktiven Sprachschalter über ResultCopy', () => {
  function element(attributes, textContent) {
    const attrs = { ...attributes };
    const classes = new Set();
    let click = null;
    return {
      textContent: textContent || '',
      getAttribute(name) { return attrs[name] == null ? null : attrs[name]; },
      setAttribute(name, value) { attrs[name] = String(value); },
      removeAttribute(name) { delete attrs[name]; },
      classList: {
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      addEventListener(type, handler) { if (type === 'click') click = handler; },
      click() { if (click) click(); },
      attrs,
    };
  }

  const title = element({ 'data-copy': 'shell.meta.index_title' }, 'Fallback');
  const description = element({ 'data-copy-content': 'shell.meta.index_description', content: 'Fallback' });
  const english = element({ 'data-locale': 'en-CH' }, 'EN');
  const french = element({ 'data-locale': 'fr-CH' }, 'FR');
  const selectors = {
    '[data-copy]': [title],
    '[data-copy-aria-label]': [],
    '[data-copy-title]': [],
    '[data-copy-content]': [description],
    '[data-copy-alt]': [],
    '[data-copy-placeholder]': [],
    '[data-locale]': [english, french],
  };
  const documentObject = {
    readyState: 'complete',
    querySelectorAll(selector) { return selectors[selector] || []; },
  };
  let switchedTo = null;
  const windowObject = {
    document: documentObject,
    ResultCopy: {
      get(id) {
        return {
          'shell.meta.index_title': 'Health Check',
          'shell.meta.index_description': 'English description',
        }[id];
      },
    },
    HealthLocale: {
      current: 'en-CH',
      normalize(value) { return value; },
      syncDocument() {},
      switchTo(value) { switchedTo = value; },
    },
  };

  runScript(windowObject, 'js/page-i18n.js');
  assert.strictEqual(title.textContent, 'Health Check');
  assert.strictEqual(description.attrs.content, 'English description');
  assert.strictEqual(english.classList.contains('is-active'), true);
  assert.strictEqual(english.attrs['aria-current'], 'true');
  assert.strictEqual(english.attrs['aria-pressed'], 'true');
  assert.strictEqual(french.attrs['aria-pressed'], 'false');
  french.click();
  assert.strictEqual(switchedTo, 'fr-CH');
});

(async () => {
  let passed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log('✓ ' + name);
    } catch (error) {
      console.error('✗ ' + name);
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    }
  }
  console.log('\n' + passed + '/' + tests.length + ' Tests bestanden.');
})();
