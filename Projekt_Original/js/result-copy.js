/*
 * result-copy.js
 * ---------------------------------------------------------------------------
 * Kleine Laufzeit-API fuer alle Texte der Ergebnisseite. Die eigentlichen
 * Texte werden aus content/result-texts/*.json generiert und davor als
 * js/result-copy.generated.js geladen. Dadurch bleibt die App ohne Build-
 * Schritt direkt per index.html startbar, waehrend Marketing mit einer CSV
 * arbeiten kann.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  const bundle = (typeof window !== 'undefined' && window.__RESULT_COPY_BUNDLE__) || null;
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
   * Katalog erlaubten <b>/<i>-Tags bleiben erhalten. Fehlende Variablen sind ein
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

  if (typeof window !== 'undefined') {
    window.ResultCopy = Object.freeze({
      version: bundle.version,
      sourceHash: bundle.sourceHash,
      get,
      format,
    });
  }
})();
