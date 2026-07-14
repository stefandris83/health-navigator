/*
 * config.js
 * ---------------------------------------------------------------------------
 * Kleine, zentrale Betriebskonfiguration. Eine einbettende Seite kann Werte
 * vor dem Laden dieser Datei über `window.HealthNavigatorConfig` setzen.
 * `window.APP_CONFIG` wird nur noch als Legacy-Input gelesen und niemals
 * überschrieben, damit eine Host-Seite ihre eigene Konfiguration behält.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  const defaults = {
    // Ergebnis-Links enthalten Gesundheitsantworten (codiert, nicht verschlüsselt).
    // In der lokalen Standalone-Demo ist die Funktion sichtbar. Produktive Modi
    // bleiben ohne ein ausdrückliches Host-Override standardmässig deaktiviert.
    resultLinkEnabled: true,
    // Bereits ausgestellte Links bleiben standardmässig lesbar. Für eine
    // vollständige Deaktivierung kann die Zielumgebung auch den Import sperren.
    resultLinkImportEnabled: true,
    // Optionaler kanonischer HTTPS-Pfad für portable Ergebnis-Links.
    resultLinkBaseUrl: null,
    // Lokale Antworten und Plan-Häkchen laufen auf gemeinsam genutzten Geräten ab.
    storageTtlDays: 90,
    // Ein nicht antwortender Kundenkontext-Adapter darf die App nicht blockieren.
    adapterTimeoutMs: 4000,
    // Standalone-Demo als Default; Produktiv-Hosts setzen 'live' oder 'anonymous'.
    integrationMode: 'mock',
    demoProfilesEnabled: true,
  };

  const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const namespaced = typeof window !== 'undefined' && isPlainObject(window.HealthNavigatorConfig)
    ? window.HealthNavigatorConfig
    : null;
  const legacy = typeof window !== 'undefined' && isPlainObject(window.APP_CONFIG)
    ? window.APP_CONFIG
    : null;
  const provided = namespaced || legacy || {};
  const positiveNumber = (key, fallback, min, max) => {
    const value = Number(provided[key]);
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };

  const allowedModes = ['mock', 'live', 'anonymous'];
  const integrationMode = allowedModes.includes(provided.integrationMode)
    ? provided.integrationMode
    : defaults.integrationMode;
  const resultLinkEnabled = typeof provided.resultLinkEnabled === 'boolean'
    ? provided.resultLinkEnabled
    : integrationMode === 'mock' && defaults.resultLinkEnabled;

  function httpsBaseUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      parsed.search = '';
      parsed.hash = '';
      return parsed.href;
    } catch (error) { return null; }
  }

  const config = {
    resultLinkEnabled,
    resultLinkImportEnabled: typeof provided.resultLinkImportEnabled === 'boolean'
      ? provided.resultLinkImportEnabled
      : defaults.resultLinkImportEnabled,
    resultLinkBaseUrl: httpsBaseUrl(provided.resultLinkBaseUrl),
    storageTtlDays: positiveNumber('storageTtlDays', defaults.storageTtlDays, 1, 3650),
    adapterTimeoutMs: positiveNumber('adapterTimeoutMs', defaults.adapterTimeoutMs, 100, 60000),
    integrationMode,
    demoProfilesEnabled: integrationMode === 'mock' && (
      typeof provided.demoProfilesEnabled === 'boolean'
        ? provided.demoProfilesEnabled
        : defaults.demoProfilesEnabled
    ),
    // Ungeprüfte Coverage-Hinweise bleiben im Live-Modus standardmässig aus.
    coverageHintsEnabled: typeof provided.coverageHintsEnabled === 'boolean'
      ? provided.coverageHintsEnabled
      : integrationMode === 'mock',
  };

  if (typeof window !== 'undefined') window.HealthNavigatorConfig = Object.freeze(config);
})();
