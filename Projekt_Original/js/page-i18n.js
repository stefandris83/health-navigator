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

  function getCopy(id) {
    if (!id || !window.ResultCopy || typeof window.ResultCopy.get !== 'function') return null;
    try {
      const value = window.ResultCopy.get(id);
      return typeof value === 'string' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function applyTextCopies(documentObject) {
    documentObject.querySelectorAll('[data-copy]').forEach((element) => {
      const value = getCopy(element.getAttribute('data-copy'));
      if (value !== null) element.textContent = value;
    });
  }

  function applyAttributeCopies(documentObject, dataAttribute, targetAttribute) {
    documentObject.querySelectorAll('[' + dataAttribute + ']').forEach((element) => {
      const value = getCopy(element.getAttribute(dataAttribute));
      if (value !== null) element.setAttribute(targetAttribute, value);
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
    applyTextCopies(doc);
    applyAttributeCopies(doc, 'data-copy-aria-label', 'aria-label');
    applyAttributeCopies(doc, 'data-copy-title', 'title');
    applyAttributeCopies(doc, 'data-copy-content', 'content');
    applyAttributeCopies(doc, 'data-copy-alt', 'alt');
    applyAttributeCopies(doc, 'data-copy-placeholder', 'placeholder');
    bindLanguageSwitches(doc);
    return true;
  }

  const api = Object.freeze({ apply });
  window.HealthPageI18n = api;

  if (window.document && window.document.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', () => apply(), { once: true });
  } else {
    apply();
  }
})(window);
