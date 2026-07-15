/*
 * result-copy.js
 * ---------------------------------------------------------------------------
 * Kleine Laufzeit-API fuer alle Texte der Ergebnisseite. Die eigentlichen
 * Texte werden aus content/result-texts/*.json und den Sprach-Overlays unter
 * content/result-texts/locales/ generiert und davor als
 * js/result-copy.generated.js geladen. Dadurch bleibt die App ohne Build-
 * Schritt direkt per index.html startbar, waehrend Marketing und Fachreview
 * mit sprachspezifischen CSV-Dateien arbeiten koennen.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  const root = typeof window !== 'undefined' ? window : null;
  const registry = root && root.__RESULT_COPY_BUNDLES__;
  const localeApi = root && root.HealthLocale;
  const requestedLocale = localeApi && typeof localeApi.getLocale === 'function'
    ? localeApi.getLocale()
    : 'de-CH';

  let bundle = null;
  if (registry) {
    if (!registry.bundles || !registry.bundles[requestedLocale]) {
      throw new Error('ResultCopy: Text-Bundle fuer Sprache "' + requestedLocale + '" fehlt.');
    }
    bundle = registry.bundles[requestedLocale];
  } else if (root && root.__RESULT_COPY_BUNDLE__) {
    // Rueckwaertskompatibilitaet fuer isolierte Integrations- und Unit-Tests.
    // Ein altes Einsprach-Bundle darf aber nie als stiller DE-Fallback fuer
    // eine andere angeforderte Sprache dienen.
    bundle = root.__RESULT_COPY_BUNDLE__;
    if (requestedLocale !== 'de-CH' && bundle.locale !== requestedLocale) {
      throw new Error('ResultCopy: Text-Bundle fuer Sprache "' + requestedLocale + '" fehlt.');
    }
  }
  if (!bundle || !bundle.texts) {
    throw new Error('ResultCopy: js/result-copy.generated.js fehlt oder ist ungueltig.');
  }

  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Liefert einen Text ueber seine dauerhaft stabile Content-ID. */
  function get(id) {
    if (!own(bundle.texts, id)) {
      throw new Error('ResultCopy: unbekannte Text-ID "' + id + '".');
    }
    return bundle.texts[id];
  }

  /**
   * Setzt {{platzhalter}} ein. Variablen werden HTML-escaped; die wenigen im
   * Katalog explizit erlaubten Formatierungs-Tags bleiben erhalten. Fehlende Variablen sind ein
   * harter Fehler, damit nie halbfertige Texte bei Nutzenden erscheinen.
   */
  function format(id, variables) {
    const vars = variables || {};
    return get(id).replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_match, name) => {
      if (!own(vars, name)) {
        throw new Error('ResultCopy: Platzhalter {{' + name + '}} fuer "' + id + '" fehlt.');
      }
      return escapeHtml(vars[name]);
    });
  }

  if (root) {
    root.ResultCopy = Object.freeze({
      locale: bundle.locale || requestedLocale,
      version: bundle.version,
      sourceHash: bundle.sourceHash,
      get,
      format,
    });
  }
})();
