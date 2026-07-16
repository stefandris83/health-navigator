/*
 * js/locale.js
 * ---------------------------------------------------------------------------
 * Sprachwahl fuer die build-freie Anwendung. Die Locale wird bewusst getrennt
 * von Gesundheitsantworten gespeichert. Ein Sprachwechsel setzt lediglich den
 * erlaubten `lang`-Parameter und laedt dieselbe URL neu; alle anderen Query-
 * Parameter sowie der Hash bleiben unveraendert.
 * ---------------------------------------------------------------------------
 */
(function initHealthLocale(window) {
  'use strict';

  const SUPPORTED_LOCALES = Object.freeze(['de-CH', 'en-CH', 'fr-CH', 'it-CH']);
  const DEFAULT_LOCALE = 'de-CH';
  const STORAGE_KEY = 'health-navigator.locale.v1';
  const RETURN_VIEW_STORAGE_KEY = 'health-navigator.locale-return-view.v1';
  const QUERY_PARAMETER = 'lang';

  const MANIFESTS = Object.freeze({
    'de-CH': 'manifest.de-CH.webmanifest',
    'en-CH': 'manifest.en-CH.webmanifest',
    'fr-CH': 'manifest.fr-CH.webmanifest',
    'it-CH': 'manifest.it-CH.webmanifest',
  });

  // Nur bestaetigte Sprachpfade werden hier lokalisiert. Bei noch nicht
  // bestaetigten Zielen bleibt der explizite deutsche Fallback bestehen.
  const EXTERNAL_URLS = Object.freeze({
    'helsana.private': Object.freeze({
      'de-CH': 'https://www.helsana.ch/de/private.html',
      'en-CH': 'https://www.helsana.ch/en/individuals.html',
      'fr-CH': 'https://www.helsana.ch/fr/prives.html',
      'it-CH': 'https://www.helsana.ch/it/privati.html',
    }),
    'helsana.business': Object.freeze({
      'de-CH': 'https://www.helsana.ch/de/unternehmen.html',
      'en-CH': 'https://www.helsana.ch/en/companies.html',
      'fr-CH': 'https://www.helsana.ch/fr/entreprises.html',
      'it-CH': 'https://www.helsana.ch/it/aziende.html',
    }),
    'helsana.group': Object.freeze({
      'de-CH': 'https://www.helsana.ch/de/helsana-gruppe.html',
      'en-CH': 'https://www.helsana.ch/en/helsana-group.html',
      'fr-CH': 'https://www.helsana.ch/fr/groupe-helsana.html',
      'it-CH': 'https://www.helsana.ch/it/gruppo-helsana.html',
    }),
    'helsana.blog': Object.freeze({
      'de-CH': 'https://www.helsana.ch/de/blog.html',
      'en-CH': 'https://www.helsana.ch/en/blog.html',
      'fr-CH': 'https://www.helsana.ch/fr/blog.html',
      'it-CH': 'https://www.helsana.ch/it/blog.html',
    }),
    'helsana.myhelsana': Object.freeze({
      'de-CH': 'https://portal.helsana.ch/helsana-login/myhelsana?language=de',
    }),
  });

  function normalize(candidate) {
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.trim().replace(/_/g, '-').toLowerCase();
    const aliases = {
      de: 'de-CH',
      'de-ch': 'de-CH',
      en: 'en-CH',
      'en-ch': 'en-CH',
      fr: 'fr-CH',
      'fr-ch': 'fr-CH',
      it: 'it-CH',
      'it-ch': 'it-CH',
    };
    return aliases[normalized] || null;
  }

  function queryLocale() {
    try {
      const search = window.location && typeof window.location.search === 'string'
        ? window.location.search
        : '';
      return normalize(new URLSearchParams(search).get(QUERY_PARAMETER));
    } catch (error) {
      return null;
    }
  }

  function storedLocale() {
    try {
      return normalize(window.localStorage && window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  let current = queryLocale() || storedLocale() || DEFAULT_LOCALE;

  function remember(locale) {
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, locale);
    } catch (error) {
      // Private Modi oder restriktive Einbettungen duerfen die Sprachwahl nicht
      // blockieren. Der URL-Parameter bleibt in diesem Fall die Quelle.
    }
  }

  // Ein expliziter Link mit `?lang=` wird damit auch bei der anschliessenden
  // internen Navigation beibehalten, ohne Antworten oder Plaene anzufassen.
  remember(current);

  function manifestHref(locale) {
    return MANIFESTS[normalize(locale) || DEFAULT_LOCALE];
  }

  // Ein unvollstaendiges Sprachbundle darf nie zu einer gemischten Seite
  // fuehren. ResultCopy kann fuer den aktuellen Seitenaufruf deshalb auf das
  // vollstaendige deutsche Notfallbundle umschalten. Die gespeicherte
  // Sprachpraeferenz bleibt bewusst unangetastet und wird nach einem behobenen
  // Deployment beim naechsten Aufruf wieder versucht.
  function useRuntimeFallback(locale) {
    const selected = normalize(locale);
    if (selected !== DEFAULT_LOCALE) {
      throw new RangeError('Runtime-Fallback ist nur fuer ' + DEFAULT_LOCALE + ' erlaubt.');
    }
    current = selected;
    return current;
  }

  function externalHref(key, locale) {
    const localized = EXTERNAL_URLS[key];
    if (!localized) return null;
    const selected = normalize(locale) || DEFAULT_LOCALE;
    return localized[selected] || localized[DEFAULT_LOCALE] || null;
  }

  // Der Health Check zeigt den BMI mit hoechstens einer Nachkommastelle. Die
  // Schweizer Sprachfassungen verwenden dabei ihre locale-gerechten
  // Dezimalzeichen: Punkt in de-CH/en-CH, Komma in fr-CH/it-CH.
  function formatDecimal(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value == null ? '' : value);
    const rounded = Math.round(number * 10) / 10;
    const formatted = String(rounded);
    return ['fr-CH', 'it-CH'].includes(current) ? formatted.replace('.', ',') : formatted;
  }

  function urlForLocale(locale, href) {
    const selected = normalize(locale);
    if (!selected) throw new RangeError('Nicht unterstuetzte Locale: ' + locale);
    const source = href || (window.location && window.location.href);
    if (!source) return null;
    const base = window.location && window.location.href ? window.location.href : undefined;
    const url = new URL(source, base);
    url.searchParams.set(QUERY_PARAMETER, selected);
    return url.href;
  }

  function syncDocument(documentObject) {
    const doc = documentObject || window.document;
    if (!doc) return;
    if (doc.documentElement) doc.documentElement.lang = current;

    const manifest = doc.querySelector && doc.querySelector('link[rel="manifest"][data-locale-manifest]');
    if (manifest) manifest.setAttribute('href', manifestHref(current));

    if (doc.querySelectorAll) {
      doc.querySelectorAll('[data-locale-href]').forEach((element) => {
        const href = externalHref(element.getAttribute('data-locale-href'), current);
        if (href) element.setAttribute('href', href);
      });
      doc.querySelectorAll('[data-locale-route]').forEach((element) => {
        const route = element.getAttribute('data-locale-route');
        if (!route) return;
        const href = urlForLocale(current, route);
        if (href) element.setAttribute('href', href);
      });
    }
  }

  function switchTo(locale) {
    const selected = normalize(locale);
    if (!selected) throw new RangeError('Nicht unterstuetzte Locale: ' + locale);
    remember(selected);
    try {
      const view = window.document && window.document.body && window.document.body.dataset
        ? window.document.body.dataset.screen
        : null;
      if (window.sessionStorage && ['quiz', 'results'].includes(view)) {
        window.sessionStorage.setItem(RETURN_VIEW_STORAGE_KEY, view);
      }
    } catch (error) {
      // Die Sprachwahl funktioniert auch ohne Session-Speicher; lediglich die
      // aktuelle Ansicht kann dann nach dem Reload nicht wiederhergestellt werden.
    }
    const nextUrl = urlForLocale(selected);
    if (!nextUrl || !window.location) return nextUrl;
    if (typeof window.location.assign === 'function') window.location.assign(nextUrl);
    else window.location.href = nextUrl;
    return nextUrl;
  }

  function consumeReturnView() {
    try {
      if (!window.sessionStorage) return null;
      const view = window.sessionStorage.getItem(RETURN_VIEW_STORAGE_KEY);
      window.sessionStorage.removeItem(RETURN_VIEW_STORAGE_KEY);
      return ['quiz', 'results'].includes(view) ? view : null;
    } catch (error) { return null; }
  }

  const api = Object.freeze({
    SUPPORTED_LOCALES,
    supported: SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    STORAGE_KEY,
    RETURN_VIEW_STORAGE_KEY,
    QUERY_PARAMETER,
    get current() { return current; },
    getLocale: () => current,
    normalize,
    manifestHref,
    useRuntimeFallback,
    externalHref,
    formatDecimal,
    urlForLocale,
    consumeReturnView,
    syncDocument,
    setLocale: switchTo,
    switchTo,
  });

  window.HealthLocale = api;
  syncDocument();
  if (window.document && window.document.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', () => syncDocument(), { once: true });
  }
})(window);
