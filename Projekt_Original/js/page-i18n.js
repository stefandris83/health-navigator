/*
 * js/page-i18n.js
 * ---------------------------------------------------------------------------
 * Uebersetzt statische HTML-Inhalte ausschliesslich ueber ResultCopy. Nur wenn
 * das gesamte Textbundle im Deployment fehlt oder defekt ist, bleibt das
 * deutsche HTML-Grundgeruest als enger Bootstrap-Notfallfallback sichtbar.
 * ResultCopy selbst faellt bei fehlenden IDs nie still auf Deutsch zurueck.
 * ---------------------------------------------------------------------------
 */
(function initPageI18n(window) {
  'use strict';

  const COPY_BINDINGS = Object.freeze([
    Object.freeze({ selector: '[data-copy]', dataAttribute: 'data-copy', targetAttribute: null }),
    Object.freeze({ selector: '[data-copy-aria-label]', dataAttribute: 'data-copy-aria-label', targetAttribute: 'aria-label' }),
    Object.freeze({ selector: '[data-copy-title]', dataAttribute: 'data-copy-title', targetAttribute: 'title' }),
    Object.freeze({ selector: '[data-copy-content]', dataAttribute: 'data-copy-content', targetAttribute: 'content' }),
    Object.freeze({ selector: '[data-copy-alt]', dataAttribute: 'data-copy-alt', targetAttribute: 'alt' }),
    Object.freeze({ selector: '[data-copy-placeholder]', dataAttribute: 'data-copy-placeholder', targetAttribute: 'placeholder' }),
  ]);

  function collectCopies(documentObject) {
    if (!window.ResultCopy || typeof window.ResultCopy.get !== 'function') return null;
    const copies = [];
    try {
      COPY_BINDINGS.forEach((binding) => {
        documentObject.querySelectorAll(binding.selector).forEach((element) => {
          const id = element.getAttribute(binding.dataAttribute);
          const value = id ? window.ResultCopy.get(id) : null;
          if (typeof value !== 'string') throw new Error('Ungueltiger statischer Text: ' + id);
          copies.push({ element, targetAttribute: binding.targetAttribute, value });
        });
      });
      return copies;
    } catch (error) {
      return null;
    }
  }

  function applyCopies(copies) {
    copies.forEach((copy) => {
      if (copy.targetAttribute) copy.element.setAttribute(copy.targetAttribute, copy.value);
      else copy.element.textContent = copy.value;
    });
  }

  function bindLanguageSwitches(documentObject) {
    const locale = window.HealthLocale;
    if (!locale) return;

    documentObject.querySelectorAll('[data-locale]').forEach((control) => {
      const selected = locale.normalize(control.getAttribute('data-locale'));
      const isActive = selected === locale.current;
      control.classList.toggle('is-active', isActive);
      control.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) control.setAttribute('aria-current', 'true');
      else control.removeAttribute('aria-current');

      if (control.getAttribute('data-locale-bound') === 'true') return;
      control.setAttribute('data-locale-bound', 'true');
      control.addEventListener('click', () => locale.switchTo(selected));
    });
  }

  function apply(documentObject) {
    const doc = documentObject || window.document;
    if (!doc || !doc.querySelectorAll) return false;

    if (window.HealthLocale) window.HealthLocale.syncDocument(doc);
    let copies = collectCopies(doc);
    if (!copies && window.ResultCopy && typeof window.ResultCopy.__useDefaultFallback === 'function' &&
        window.ResultCopy.__useDefaultFallback()) {
      if (window.HealthLocale) window.HealthLocale.syncDocument(doc);
      copies = collectCopies(doc);
    }
    if (!copies && window.HealthLocale && typeof window.HealthLocale.useRuntimeFallback === 'function') {
      window.HealthLocale.useRuntimeFallback('de-CH');
      window.HealthLocale.syncDocument(doc);
      copies = collectCopies(doc);
    }
    // Erst nach erfolgreicher Vollstaendigkeitspruefung schreiben. So bleibt
    // bei einem Deployment-Fehler das komplette deutsche HTML-Grundgeruest
    // erhalten, statt einzelne deutsche und uebersetzte Texte zu mischen.
    if (copies) applyCopies(copies);
    bindLanguageSwitches(doc);
    return !!copies;
  }

  const api = Object.freeze({ apply });
  window.HealthPageI18n = api;

  if (window.document && window.document.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', () => apply(), { once: true });
  } else {
    apply();
  }
})(window);
