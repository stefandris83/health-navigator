/*
 * persistence.js
 * ---------------------------------------------------------------------------
 * Testbare Datenhärtung für localStorage und Ergebnis-Links. Persistierte und
 * geteilte Gesundheitsantworten gelten immer als nicht vertrauenswürdig und
 * werden über HealthAnswerSchema normalisiert.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  const STORAGE_SCHEMA = 2;
  const HASH_SCHEMA = 1;
  const HASH_MAX_LENGTH = 32 * 1024;
  const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function sanitizeAnswers(raw) {
    const schema = typeof window !== 'undefined' && window.HealthAnswerSchema;
    return schema ? schema.sanitizeAnswers(raw) : {};
  }

  function effectiveTtlDays(options) {
    const configured = typeof window !== 'undefined' && window.HealthNavigatorConfig
      ? Number(window.HealthNavigatorConfig.storageTtlDays)
      : NaN;
    const override = options && Number(options.ttlDays);
    if (Number.isFinite(override) && override > 0) return override;
    return Number.isFinite(configured) && configured > 0 ? configured : 90;
  }

  function validTimestamp(savedAt, now, ttlDays) {
    if (!Number.isFinite(savedAt)) return false;
    if (savedAt > now + FUTURE_TOLERANCE_MS) return false;
    return now - savedAt <= ttlDays * 24 * 60 * 60 * 1000;
  }

  function clampIndex(value, total) {
    return Math.min(Math.max(0, Math.floor(Number(value) || 0)), Math.max(0, total - 1));
  }

  function readState(raw, options) {
    let data;
    try { data = JSON.parse(raw); } catch (error) { return null; }
    if (!isPlainObject(data)) return null;

    const now = options && Number.isFinite(options.now) ? options.now : Date.now();
    const ttlDays = effectiveTtlDays(options);
    const migrated = data.v == null;
    if (!migrated && data.v !== STORAGE_SCHEMA) return null;
    if (!migrated && !validTimestamp(data.savedAt, now, ttlDays)) return null;

    const total = (typeof window !== 'undefined' && window.DIMENSIONS && window.DIMENSIONS.length) || 1;
    const dimIndex = clampIndex(data.dimIndex, total);
    const maxReached = Math.max(dimIndex, clampIndex(data.maxReached, total));
    return {
      answers: sanitizeAnswers(data.answers),
      dimIndex,
      maxReached,
      migrated,
    };
  }

  function serializeState(state, now) {
    return JSON.stringify({
      v: STORAGE_SCHEMA,
      savedAt: Number.isFinite(now) ? now : Date.now(),
      answers: sanitizeAnswers(state && state.answers),
      dimIndex: state && state.dimIndex,
      maxReached: state && state.maxReached,
    });
  }

  function sanitizePlanItems(raw) {
    if (!isPlainObject(raw)) return {};
    const items = {};
    Object.keys(raw).forEach((id) => {
      if (/^[a-z0-9_]+-\d+$/.test(id) && raw[id] === true) items[id] = true;
    });
    return items;
  }

  function readPlan(raw, options) {
    let data;
    try { data = JSON.parse(raw); } catch (error) { return null; }
    if (!isPlainObject(data)) return null;

    const now = options && Number.isFinite(options.now) ? options.now : Date.now();
    const ttlDays = effectiveTtlDays(options);
    const migrated = data.v == null;
    if (!migrated && data.v !== STORAGE_SCHEMA) return null;
    if (!migrated && !validTimestamp(data.savedAt, now, ttlDays)) return null;
    return { items: sanitizePlanItems(migrated ? data : data.items), migrated };
  }

  function serializePlan(items, now) {
    return JSON.stringify({
      v: STORAGE_SCHEMA,
      savedAt: Number.isFinite(now) ? now : Date.now(),
      items: sanitizePlanItems(items),
    });
  }

  function encodeAnswers(raw) {
    const payload = JSON.stringify({ v: HASH_SCHEMA, a: sanitizeAnswers(raw) });
    const bytes = new TextEncoder().encode(payload);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeAnswers(encoded) {
    try {
      if (typeof encoded !== 'string' || !encoded || encoded.length > HASH_MAX_LENGTH) return null;
      if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
      const base = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base + '='.repeat((4 - (base.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!isPlainObject(data) || data.v !== HASH_SCHEMA || !isPlainObject(data.a)) return null;
      return sanitizeAnswers(data.a);
    } catch (error) {
      return null;
    }
  }

  if (typeof window !== 'undefined') {
    window.HealthPersistence = Object.freeze({
      STORAGE_SCHEMA,
      HASH_SCHEMA,
      HASH_MAX_LENGTH,
      readState,
      serializeState,
      readPlan,
      serializePlan,
      encodeAnswers,
      decodeAnswers,
    });
  }
})();
