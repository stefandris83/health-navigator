/*
 * integration.js
 * ---------------------------------------------------------------------------
 * Integrationsschicht für die Helsana-Systemlandschaft (Vorbereitung).
 *
 * ZWECK
 *   Diese Datei ist die EINZIGE Stelle, an der die App mit «Kundenkontext»
 *   (eingeloggter Nutzer, Versicherungsprodukte) in Berührung kommt. Die
 *   restliche App fragt ausschliesslich über die öffentliche API
 *   `window.HelsanaIntegration` an – niemals direkt gegen Systeme.
 *
 * ANBINDUNGSPUNKT FÜR DIE IT
 *   `MockCustomerAdapter` liefert im expliziten Mock-Modus Demo-Profile. Für
 *   den Realbetrieb stellt die Host-Seite vor dem Laden dieses Scripts einen
 *   Adapter via `window.HealthNavigatorBootstrap` bereit oder registriert ihn
 *   später mit `HelsanaIntegration.setAdapter(...)`. Datenvertrag und sichere
 *   Reihenfolge: siehe docs/INTEGRATION.md.
 *
 * DATENSPARSAMKEIT
 *   - Es wird NICHTS persistiert (kein localStorage/sessionStorage/Cookie);
 *     der Kontext lebt nur im Speicher der laufenden Seite.
 *   - `normalizeCustomerContext()` arbeitet als Whitelist: Alles, was die App
 *     nicht braucht (Namen von Policen, Kundennummern, AHV-Nr., …), wird
 *     verworfen. Die App benötigt nur: eingeloggt ja/nein, optionaler
 *     Anzeigename, Produkt-KATEGORIEN.
 *
 * FACHLICHE ABGRENZUNG (wichtig)
 *   Diese Schicht erkennt nur TECHNISCH, welche Produktkategorien ein Kunde
 *   hat. Sie macht KEINE Leistungszusagen. Formulierungen in COVERAGE_HINTS
 *   bleiben bewusst unverbindlich («potenziell relevant», «kann … unterstützt
 *   werden») und sind vor Produktivgang fachlich/rechtlich zu prüfen.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Konfiguration                                                       *
   * ------------------------------------------------------------------ */
  const runtimeConfig = window.HealthNavigatorConfig || {};
  const INTEGRATION_CONFIG = Object.freeze({
    /** 'mock' = Demo · 'live' = Host-Adapter · 'anonymous' = ohne Kontext. */
    mode: runtimeConfig.integrationMode || 'mock',
    /** URL-Demoprofile sind nur im expliziten Mock-Modus erlaubt. */
    demoProfilesEnabled: runtimeConfig.demoProfilesEnabled !== false,
    /** Rechtlich noch nicht freigegebene Hinweise sind live standardmässig aus. */
    coverageHintsEnabled: runtimeConfig.coverageHintsEnabled !== false,
    /** URL-Parameter zum Testen der Demo-Profile, z. B. ?kunde=zusatz-praevention */
    demoProfileParam: 'kunde',
    /** Version des minimalen CustomerContext-Datenvertrags. */
    contractVersion: 1,
    /** Max. Wartezeit auf den Adapter, danach sicherer anonymer Fallback. */
    adapterTimeoutMs: runtimeConfig.adapterTimeoutMs || 4000,
    /** Schutz vor übergrossen oder manipulierten Produktlisten. */
    maxProducts: 20,
    maxRawProducts: 100,
  });

  /* ------------------------------------------------------------------ *
   * Produktmodell                                                       *
   * ------------------------------------------------------------------ *
   * Fachlich NEUTRALE Kategorien – bewusst KEINE echten Helsana-Produkt- *
   * codes oder Produktnamen. Die IT mappt beim Anbinden echte Produkte   *
   * auf diese Kategorien (ein Produkt → genau eine Kategorie).           *
   * Neue Kategorien: hier ergänzen + optional in COVERAGE_HINTS nutzen.  */
  const PRODUCT_CATEGORIES = Object.freeze({
    /** Obligatorische Grundversicherung (KVG). */
    BASIC: 'BASIC',
    /** Ambulante Zusatzversicherung (VVG) – Demo-Kategorie. */
    SUPP_AMBULANT: 'SUPP_AMBULANT',
    /** Spital-Zusatzversicherung (VVG) – Demo-Kategorie. */
    SUPP_HOSPITAL: 'SUPP_HOSPITAL',
    /** Zusatzversicherung mit Prävention/Gesundheitsförderung – Demo-Kategorie. */
    SUPP_PREVENTION: 'SUPP_PREVENTION',
  });

  /**
   * @typedef {Object} InsuranceProduct
   * @property {string} id        Technischer Schlüssel (Demo: frei; live: von IT vergeben)
   * @property {string} category  Einer der Werte aus PRODUCT_CATEGORIES
   * @property {string} label     Anzeigename (neutral, ohne Vertragsdetails)
   *
   * @typedef {Object} CustomerContext
   * @property {boolean} isAuthenticated
   * @property {?string} displayName   Optionaler Anzeigename (kann null sein)
   * @property {InsuranceProduct[]} products
 * @property {'none'|'mock'|'live'} source  Herkunft (für Diagnostik/Ereignis)
   */

  /** Normalisierte Kontexte sind unveränderlich, auch für externe Consumer. */
  function freezeContext(value) {
    const products = Object.freeze((value.products || []).map((product) => Object.freeze(product)));
    return Object.freeze(Object.assign({}, value, { products }));
  }

  /** Leerer Kontext = anonymer Nutzer (heutiger Normalfall). */
  function anonymousContext() {
    return freezeContext({ isAuthenticated: false, displayName: null, products: [], source: 'none' });
  }

  function cleanVisibleText(value, maxLength) {
    if (typeof value !== 'string') return '';
    let text = value;
    try { text = text.normalize('NFC'); } catch (e) {}
    text = text
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return Array.from(text).slice(0, maxLength).join('');
  }

  function cleanProductId(value, fallback) {
    let text = '';
    try { text = String(value == null || value === '' ? fallback : value); } catch (e) { return ''; }
    text = text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim();
    return Array.from(text).slice(0, 120).join('');
  }

  /**
   * Whitelist-Normalisierung (Datenvertrag & Datensparsamkeit).
   * Nimmt beliebige Rohdaten eines Adapters entgegen und behält NUR die
   * Felder, die die App wirklich braucht. Unbekannte Kategorien und
   * fehlerhafte Einträge werden verworfen statt durchgereicht.
   * @param {*} raw
   * @returns {CustomerContext}
   */
  function normalizeCustomerContext(raw) {
    try {
      if (!raw || typeof raw !== 'object' || raw.isAuthenticated !== true) return anonymousContext();
      const version = raw.contractVersion == null ? 1 : raw.contractVersion;
      if (version !== INTEGRATION_CONFIG.contractVersion) return anonymousContext();

      const validCats = Object.values(PRODUCT_CATEGORIES);
      const seen = new Set();
      const products = [];
      const incoming = Array.isArray(raw.products)
        ? raw.products.slice(0, INTEGRATION_CONFIG.maxRawProducts)
        : [];
      for (const item of incoming) {
        if (products.length >= INTEGRATION_CONFIG.maxProducts) break;
        try {
          if (!item || typeof item !== 'object' || !validCats.includes(item.category)) continue;
          const id = cleanProductId(item.id, item.category);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          products.push({
            id,
            category: item.category,
            label: cleanVisibleText(item.label, 120),
          });
        } catch (error) { /* Fehlerhafter Eintrag wird verworfen. */ }
      }

      const displayName = cleanVisibleText(raw.displayName, 80);
      const declaredSource = raw.source;
      const source = declaredSource === 'live'
        ? 'live'
        : (declaredSource === 'mock' && INTEGRATION_CONFIG.mode === 'mock'
          ? 'mock'
          : (INTEGRATION_CONFIG.mode === 'live'
            ? 'live'
            : (INTEGRATION_CONFIG.mode === 'mock' ? 'mock' : 'none')));
      return freezeContext({
        isAuthenticated: true,
        displayName: displayName || null,
        products,
        source,
      });
    } catch (error) {
      return anonymousContext();
    }
  }

  /* ------------------------------------------------------------------ *
   * Demo-Profile (nur für Mock-Betrieb & Tests)                         *
   * ------------------------------------------------------------------ */
  const DEMO_PROFILES = {
    anonym: null, // entspricht «nicht eingeloggt»
    grund: {
      isAuthenticated: true,
      displayName: 'Demo-Profil «Nur Grundversicherung»',
      products: [
        { id: 'demo-basic', category: PRODUCT_CATEGORIES.BASIC, label: 'Grundversicherung (Demo)' },
      ],
      source: 'mock',
    },
    'zusatz-praevention': {
      isAuthenticated: true,
      displayName: 'Demo-Profil «Grund + Prävention»',
      products: [
        { id: 'demo-basic', category: PRODUCT_CATEGORIES.BASIC, label: 'Grundversicherung (Demo)' },
        { id: 'demo-prev', category: PRODUCT_CATEGORIES.SUPP_PREVENTION, label: 'Zusatzversicherung Prävention (Demo)' },
      ],
      source: 'mock',
    },
    'zusatz-komplett': {
      isAuthenticated: true,
      displayName: 'Demo-Profil «Grund + Zusatz ambulant/Spital/Prävention»',
      products: [
        { id: 'demo-basic', category: PRODUCT_CATEGORIES.BASIC, label: 'Grundversicherung (Demo)' },
        { id: 'demo-amb', category: PRODUCT_CATEGORIES.SUPP_AMBULANT, label: 'Zusatzversicherung ambulant (Demo)' },
        { id: 'demo-hosp', category: PRODUCT_CATEGORIES.SUPP_HOSPITAL, label: 'Spital-Zusatzversicherung (Demo)' },
        { id: 'demo-prev', category: PRODUCT_CATEGORIES.SUPP_PREVENTION, label: 'Zusatzversicherung Prävention (Demo)' },
      ],
      source: 'mock',
    },
  };
  Object.keys(DEMO_PROFILES).forEach((key) => {
    const profile = DEMO_PROFILES[key];
    if (!profile) return;
    profile.products.forEach(Object.freeze);
    Object.freeze(profile.products);
    Object.freeze(profile);
  });
  Object.freeze(DEMO_PROFILES);

  /* ------------------------------------------------------------------ *
   * Adapter (>> AUSTAUSCHPUNKT IT <<)                                   *
   * ------------------------------------------------------------------ */
  /**
   * Heutiger Mock-Adapter. Liefert – je nach angefordertem Demo-Profil –
   * einen Beispiel-Kundenkontext oder «anonym».
   *
   * Realbetrieb (Skizze, KEIN echter Endpoint):
   *   const LiveCustomerAdapter = {
   *     async getCustomerContext() {
   *       const res = await fetch('<BACKEND-ENDPOINT Kundenkontext>', { credentials: 'include' });
   *       if (!res.ok) return null;             // nicht eingeloggt o. Fehler → anonym
   *       return await res.json();              // wird per Whitelist normalisiert
   *     },
   *   };
   *   window.HelsanaIntegration.setAdapter(LiveCustomerAdapter);
   */
  const MockCustomerAdapter = {
    /** @param {?string} profileId  @returns {Promise<*>} Rohdaten (werden normalisiert) */
    async getCustomerContext(profileId) {
      const p = profileId && Object.prototype.hasOwnProperty.call(DEMO_PROFILES, profileId)
        ? DEMO_PROFILES[profileId]
        : DEMO_PROFILES.anonym;
      return p; // null → anonym
    },
  };

  const AnonymousCustomerAdapter = Object.freeze({
    async getCustomerContext() { return null; },
  });

  // Optionaler One-shot-Bootstrap für Host-Seiten. Er wird vor dem Auto-Init
  // gelesen und danach entfernt, damit kein veralteter Rohkontext liegenbleibt.
  let bootstrapAdapter = null;
  let bootstrapContext;
  try {
    const bootstrap = window.HealthNavigatorBootstrap;
    if (INTEGRATION_CONFIG.mode !== 'anonymous' && bootstrap && typeof bootstrap === 'object') {
      if (bootstrap.customerAdapter && typeof bootstrap.customerAdapter.getCustomerContext === 'function') {
        bootstrapAdapter = bootstrap.customerAdapter;
      }
      if (Object.prototype.hasOwnProperty.call(bootstrap, 'customerContext')) {
        bootstrapContext = bootstrap.customerContext;
      }
    }
  } catch (error) {
    bootstrapAdapter = null;
    bootstrapContext = undefined;
  } finally {
    try { delete window.HealthNavigatorBootstrap; } catch (e) {
      try { window.HealthNavigatorBootstrap = undefined; } catch (ignored) {}
    }
  }

  let adapter = bootstrapAdapter || (
    INTEGRATION_CONFIG.mode === 'mock' ? MockCustomerAdapter : AnonymousCustomerAdapter
  );

  /* ------------------------------------------------------------------ *
   * Coverage-Hinweise (zentrale, fachlich pflegbare Zuordnung)          *
   * ------------------------------------------------------------------ *
   * Ordnet Angebots-Schlüsseln aus HELSANA_OFFERS (js/helsana.js) die     *
   * Produktkategorien zu, für die ein Hinweis sinnvoll ist. Der Hinweis   *
   * erscheint NUR, wenn der eingeloggte Kunde mindestens eine der         *
   * genannten Kategorien besitzt. Angebote ohne Eintrag zeigen nie einen  *
   * Hinweis. Wording bewusst unverbindlich (keine Leistungszusage!) –     *
   * Texte vor Produktivgang fachlich/rechtlich freigeben.                 */
  const DEFAULT_HINT =
    window.ResultCopy.get('service.coverage.ernaehrung.hint');

  const COVERAGE_HINTS = {
    ernaehrung: {
      categories: [PRODUCT_CATEGORIES.SUPP_AMBULANT, PRODUCT_CATEGORIES.SUPP_PREVENTION],
      hint: DEFAULT_HINT,
    },
    bewegung: {
      categories: [PRODUCT_CATEGORIES.SUPP_PREVENTION],
      hint: window.ResultCopy.get('service.coverage.bewegung.hint'),
    },
    kraft: {
      categories: [PRODUCT_CATEGORIES.SUPP_PREVENTION],
      hint: window.ResultCopy.get('service.coverage.kraft.hint'),
    },
    rauchstopp: {
      categories: [PRODUCT_CATEGORIES.SUPP_AMBULANT, PRODUCT_CATEGORIES.SUPP_PREVENTION],
      hint: window.ResultCopy.get('service.coverage.rauchstopp.hint'),
    },
    stress: {
      categories: [PRODUCT_CATEGORIES.SUPP_AMBULANT, PRODUCT_CATEGORIES.SUPP_PREVENTION],
      hint: window.ResultCopy.get('service.coverage.stress.hint'),
    },
    mentaleHilfe: {
      categories: [PRODUCT_CATEGORIES.SUPP_AMBULANT],
      hint: window.ResultCopy.get('service.coverage.mentale_hilfe.hint'),
    },
    vorsorge: {
      categories: [PRODUCT_CATEGORIES.SUPP_AMBULANT],
      hint: window.ResultCopy.get('service.coverage.vorsorge.hint'),
    },
    // Bewusst OHNE Hinweis: schlaf, metabolisch, blutdruck (Ratgeber-Inhalte),
    // plus/plusEntdecken (Bonusprogramm, keine Versicherungsleistung),
    // coachApp, feedback (Funktionslinks).
  };

  /* ------------------------------------------------------------------ *
   * Service-Zustand & öffentliche API                                   *
   * ------------------------------------------------------------------ */
  let context = anonymousContext();
  let requestSequence = 0;
  let activeAbortController = null;
  let readyPromise = Promise.resolve(context);

  /** Aktueller (bereits normalisierter) Kundenkontext – nie null. */
  function getContext() { return context; }

  /** @param {string} category  @param {CustomerContext} [ctx] */
  function hasCategory(category, ctx) {
    const c = ctx || context;
    return c.isAuthenticated && c.products.some((p) => p.category === category);
  }

  /**
   * Liefert den Hinweis-Text für ein Angebot – oder null, wenn (a) kein
   * Mapping existiert, (b) niemand eingeloggt ist oder (c) der Kunde keine
   * passende Produktkategorie besitzt.
   * @param {string} offerKey  Schlüssel aus HELSANA_OFFERS
   * @param {CustomerContext} [ctx]
   * @returns {?string}
   */
  function coverageHintFor(offerKey, ctx) {
    if (!INTEGRATION_CONFIG.coverageHintsEnabled) return null;
    const c = ctx || context;
    if (!c.isAuthenticated) return null;
    const entry = COVERAGE_HINTS[offerKey];
    if (!entry) return null;
    const match = entry.categories.some((cat) => hasCategory(cat, c));
    return match ? (entry.hint || DEFAULT_HINT) : null;
  }

  /** Demo-Profil aus der URL lesen (?kunde=…) – wird bewusst NICHT gespeichert. */
  function readProfileFromUrl() {
    if (INTEGRATION_CONFIG.mode !== 'mock' || !INTEGRATION_CONFIG.demoProfilesEnabled) return null;
    try {
      const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
      const value = new URLSearchParams(search).get(INTEGRATION_CONFIG.demoProfileParam);
      return value || null;
    } catch (e) { return null; }
  }

  /** Adapter ersetzen (für IT-Anbindung oder Tests). */
  function setAdapter(a) {
    if (INTEGRATION_CONFIG.mode === 'anonymous') return false;
    if (!a || typeof a.getCustomerContext !== 'function') return false;
    requestSequence++;
    cancelActiveRequest();
    adapter = a;
    readyPromise = Promise.resolve(context);
    return true;
  }

  function announceContext() {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('helsana:customer-context', { detail: { source: context.source } }));
      }
    } catch (e) { /* Event ist optionaler Komfort – Fehler hier sind unkritisch. */ }
  }

  function cancelActiveRequest() {
    if (!activeAbortController) return;
    try { activeAbortController.abort(); } catch (e) {}
    activeAbortController = null;
  }

  function withTimeout(promise, milliseconds, onTimeout, signal) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (signal && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', onAbort);
        }
        resolve(value);
      };
      const onAbort = () => finish(null);
      const timer = setTimeout(() => {
        if (!settled) {
          try { if (onTimeout) onTimeout(); } catch (e) {}
          finish(null);
        }
      }, milliseconds);
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', onAbort, { once: true });
      }
      promise.then(
        (value) => finish(value),
        () => finish(null)
      );
    });
  }

  /**
   * Kontext (neu) laden. `profileIdOverride` ist nur für Mock/Tests relevant;
   * ein Live-Adapter ignoriert den Parameter typischerweise.
   * Informiert die App per Event 'helsana:customer-context' (z. B. für ein
   * Re-Rendering der Ergebnisseite, falls der Kontext asynchron eintrifft).
   * @returns {Promise<CustomerContext>}
   */
  function init(profileIdOverride) {
    cancelActiveRequest();
    const sequence = ++requestSequence;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    activeAbortController = controller;
    const profileId = INTEGRATION_CONFIG.mode === 'mock' && INTEGRATION_CONFIG.demoProfilesEnabled
      ? (profileIdOverride != null ? profileIdOverride : readProfileFromUrl())
      : null;

    const task = (async () => {
      let raw = null;
      try {
        raw = await withTimeout(
          Promise.resolve(adapter.getCustomerContext(profileId, controller ? { signal: controller.signal } : {})),
          INTEGRATION_CONFIG.adapterTimeoutMs,
          () => { if (controller) controller.abort(); },
          controller ? controller.signal : null
        );
      } catch (e) { raw = null; }
      if (activeAbortController === controller) activeAbortController = null;
      if (sequence !== requestSequence) return context;
      context = normalizeCustomerContext(raw);
      announceContext();
      return context;
    })();
    readyPromise = task;
    return task;
  }

  /** Kontext direkt setzen, z. B. nach Login in einer einbettenden Seite. */
  function setContext(raw) {
    requestSequence++;
    cancelActiveRequest();
    context = INTEGRATION_CONFIG.mode === 'anonymous'
      ? anonymousContext()
      : normalizeCustomerContext(raw);
    readyPromise = Promise.resolve(context);
    announceContext();
    return context;
  }

  /** Laufende Anfragen entwerten und in den anonymen Zustand wechseln. */
  function clearContext() { return setContext(null); }

  const api = {
    INTEGRATION_CONFIG,
    PRODUCT_CATEGORIES,
    DEMO_PROFILES,
    init,
    getContext,
    setContext,
    clearContext,
    hasCategory,
    coverageHintFor,
    setAdapter,
    normalizeCustomerContext, // exportiert für Tests/IT-Verifikation
  };
  Object.defineProperty(api, 'ready', {
    enumerable: true,
    get() { return readyPromise; },
  });
  Object.freeze(api);

  if (typeof window !== 'undefined') {
    window.HelsanaIntegration = api;
  }

  // Ausser im harten Anonymous-Modus gewinnt ein vorab gesetzter Kontext vor
  // dem Auto-Init. Ansonsten lädt der vorregistrierte oder modusabhängige
  // Adapter genau einmal initial.
  if (INTEGRATION_CONFIG.mode !== 'anonymous' && bootstrapContext !== undefined) {
    context = normalizeCustomerContext(bootstrapContext);
    readyPromise = Promise.resolve(context);
  } else {
    init();
  }
})();
