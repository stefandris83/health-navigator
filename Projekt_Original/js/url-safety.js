/*
 * url-safety.js
 * ---------------------------------------------------------------------------
 * Kleine gemeinsame Protokoll-Allowlist für redaktionell/technisch gepflegte
 * externe Ziele. Angebote und Fachquellen dürfen ausschliesslich absolute
 * HTTPS-URLs ohne eingebettete Zugangsdaten verwenden.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  function safeHttps(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim() === '#') return null;
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      return parsed.href;
    } catch (error) { return null; }
  }

  if (typeof window !== 'undefined') {
    window.HealthUrlSafety = Object.freeze({ safeHttps });
  }
})();
