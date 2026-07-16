#!/usr/bin/env node
'use strict';

/*
 * Dependency-freier Workflow fuer die Texte der Ergebnisseite.
 *
 * Kanonische DE-Quelle: content/result-texts/*.json
 * Uebersetzungen:       content/result-texts/locales/<locale>/*.json
 * Austauschformat:   UTF-8-BOM, Semikolon, RFC-4180-Quoting
 * Runtime-Artefakt:  js/result-copy.generated.js
 *
 * Dieses Modul verwendet ausschliesslich Node.js-Bordmittel. Es kann als CLI
 * ausgefuehrt oder in Tests/weiteren Werkzeugen per require() verwendet werden.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONTENT_DIR = path.join(PROJECT_ROOT, 'content', 'result-texts');
const DEFAULT_GENERATED_FILE = path.join(PROJECT_ROOT, 'js', 'result-copy.generated.js');
const DEFAULT_EXPORT_FILE = path.join(PROJECT_ROOT, 'exports', 'result-texte-de-CH.csv');
const DEFAULT_OVERVIEW_FILE = path.join(PROJECT_ROOT, 'exports', 'result-texte-uebersicht.md');
const DEFAULT_BACKUP_ROOT = path.join(PROJECT_ROOT, 'exports', 'import-backups');
const SCHEMA_VERSION = 1;
const DEFAULT_LOCALE = 'de-CH';
const LOCALE = DEFAULT_LOCALE;
const SUPPORTED_LOCALES = Object.freeze(['de-CH', 'en-CH', 'fr-CH', 'it-CH']);
const MANIFEST_COPY_IDS = Object.freeze({
  name: 'shell.manifest.name',
  shortName: 'shell.meta.app_title',
  description: 'shell.manifest.description',
});
const CSV_FORMAT_VERSION = '2';
const LOCALIZED_CSV_FORMAT_VERSION = '3';

const ALLOWED_REVIEWERS = Object.freeze(['Marketing', 'Medizin', 'Recht']);
const ALLOWED_REVIEW_STATUSES = Object.freeze(['', 'needs-review', 'approved']);
const FIELD_LIMITS = Object.freeze({
  id: 160,
  section: 160,
  context: 1000,
  kind: 80,
  reviewer: 40,
  text: 8000,
  requiredTerm: 500,
  reviewStatus: 40,
  comment: 4000,
  reviewComment: 4000,
});

// Tabulatoren und Zeilenumbrueche sind in redaktionellen Texten erlaubt. Andere
// ASCII-Steuerzeichen sowie unsichtbare Bidi-Steuerzeichen koennen Reviews,
// CSV-Ausgaben und die sichtbare Leserichtung verfälschen und werden abgelehnt.
const FORBIDDEN_CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

const TOP_LEVEL_FIELDS = ['schemaVersion', 'locale', 'domain', 'entries'];
const ENTRY_REQUIRED_FIELDS = ['id', 'section', 'context', 'kind', 'reviewers', 'text'];
const ENTRY_OPTIONAL_FIELDS = ['requiredTerms', 'reviewStatus', 'comment', 'reviewComment'];
const TRANSLATION_ENTRY_REQUIRED_FIELDS = [
  'id',
  'text',
  'requiredTerms',
  'reviewStatus',
  'translationState',
  'sourceContractHash',
];
const TRANSLATION_ENTRY_OPTIONAL_FIELDS = ['reviewComment'];

const CSV_COLUMNS = [
  'Gesundheitsbereich',
  'Thema',
  'Seitenelement',
  'Textfunktion',
  'Kontext / Variante',
  'Aktueller Text',
  'Neuer Text',
  'Review-Kommentar',
  'Freigabe durch',
  'Freigabestatus',
  'Prüfhinweis',
  'Platzhalter',
  'Geschützte Begriffe',
  'ID (technisch)',
  'Domain (technisch)',
  'Austauschformat (technisch)',
  'Quellversion (technisch)',
  'Zeilen-Hash (technisch)',
];

// Format 3 wird ausschliesslich fuer Uebersetzungen verwendet. Die deutsche
// Referenz und die unveraenderliche Sprache machen die Datei fuer Reviews
// selbsterklaerend und verhindern versehentliche Cross-Locale-Importe.
const LOCALIZED_CSV_COLUMNS = [
  'Gesundheitsbereich',
  'Thema',
  'Seitenelement',
  'Textfunktion',
  'Kontext / Variante',
  'Deutscher Ausgangstext',
  'Aktueller Text',
  'Neuer Text',
  'Review-Kommentar',
  'Freigabe durch',
  'Freigabestatus',
  'Prüfhinweis',
  'Platzhalter',
  'Geschützte Begriffe',
  'ID (technisch)',
  'Domain (technisch)',
  'Sprache (technisch)',
  'Austauschformat (technisch)',
  'Quellversion (technisch)',
  'Zeilen-Hash (technisch)',
];

// CSV-Version 1 bleibt als Importformat lesbar. So gehen bereits versandte
// Review-Dateien durch die redaktionelle Verbesserung des Exports nicht verloren.
const LEGACY_CSV_COLUMNS = [
  'Quellversion',
  'Base-Hash pro Zeile',
  'ID',
  'Bereich',
  'Ausspielung',
  'Textart',
  'Prüfung durch',
  'Geschützte Elemente',
  'Aktueller Text',
  'Neuer Text',
  'Review-Status',
  'Marketing-Kommentar',
];

const REVIEW_STATUS_LABELS = Object.freeze({
  '': 'Nicht geprüft',
  'needs-review': 'Prüfung erforderlich',
  approved: 'Freigegeben',
});

const REVIEW_KIND_LABELS = Object.freeze({
  accessibility_label: 'Barrierefreie Beschriftung',
  action: 'Nächster Schritt',
  benefit: 'Erwarteter Nutzen',
  clarify: 'Medizinische Klärung',
  deepen: 'Vertiefung',
  detail: 'Detailtext',
  dynamic_fragment: 'Dynamischer Textbaustein',
  explanation: 'Begründung / Einordnung',
  insight: 'Persönliche Einordnung',
  label: 'Beschriftung',
  legal_notice: 'Rechtlicher Hinweis',
  medical_notice: 'Medizinischer Hinweis',
  plan_step: '4-Wochen-Plan',
  question: 'Frage',
  option_label: 'Antwortoption',
  help: 'Hilfetext',
  help_title: 'Titel des Hilfetexts',
  safety_note: 'Sicherheitshinweis',
  unit: 'Einheit',
  placeholder: 'Eingabehinweis',
  navigation: 'Navigation',
  metadata: 'Metadaten',
  positive_feedback: 'Positive Rückmeldung',
  signal_label: 'Risikosignal',
  solid_feedback: 'Solide Rückmeldung',
  source_label: 'Quellenbezeichnung',
  template: 'Dynamischer Text',
  title: 'Überschrift',
});

const REVIEW_AREA_ORDER = Object.freeze([
  'Fragebogen',
  'Einflussfaktoren',
  'Körperliche Fitness',
  'Ernährung',
  'Schlaf',
  'Mentales Wohlbefinden',
  'Digital Coach',
  'Helsana-Angebote & Versicherung',
  'Medizin & Sicherheit',
  'Globale Navigation',
  'Quellen & Transparenz',
  'Übergreifende Ergebnisdarstellung',
]);

const REVIEW_SECTION_LABELS = Object.freeze({
  'Antworttemplates': 'Coach-Antworten',
  'Chat-Container': 'Coach-Dialog',
  'Ergebnis-Hero': 'Ergebnis-Einstieg',
  'Gemeinsame UI-Texte': 'Gemeinsame Oberflächentexte',
  'Kompatibilität & Signalvertiefung': 'Zusatzhinweise bei abgedeckten Aktionsschritten',
  'Plan-Fallback': 'Defensiver Ersatzplan',
  'Share-Modal': 'Ergebnislink-Dialog',
  'Shared Quiz & Results': 'Gemeinsame Bereichstexte (Fragebogen und Ergebnis)',
});

const REVIEW_DIMENSION_LABELS = Object.freeze({
  einfluss: 'Einflussfaktoren',
  ernaehrung: 'Ernährung',
  fitness: 'Körperliche Fitness',
  grund: 'Grundversicherung',
  mental: 'Mentales Wohlbefinden',
  schlaf: 'Schlaf',
});

const REVIEW_VARIANT_LABELS = Object.freeze({
  already_assessed_family_history_hypertension: 'Werte bereits abgeklärt · familiäre Vorbelastung · Bluthochdruck',
  assessment_needed_family_history_hypertension: 'Abklärung erforderlich · familiäre Vorbelastung · Bluthochdruck',
  already_assessed_family_history: 'Werte bereits abgeklärt · familiäre Vorbelastung',
  already_assessed_hypertension: 'Werte bereits abgeklärt · Bluthochdruck',
  assessment_needed_family_history: 'Abklärung erforderlich · familiäre Vorbelastung',
  assessment_needed_hypertension: 'Abklärung erforderlich · Bluthochdruck',
  already_assessed: 'Werte bereits abgeklärt',
  assessment_needed: 'Abklärung erforderlich',
});

class ContentWorkflowError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ContentWorkflowError';
    this.details = details || [];
  }
}

function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (!isPlainObject(value)) return value;
  const out = {};
  Object.keys(value).sort().forEach((key) => {
    if (value[key] !== undefined) out[key] = normalized(value[key]);
  });
  return out;
}

function stableStringify(value) {
  return JSON.stringify(normalized(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function assertKnownFields(obj, allowed, location, errors) {
  Object.keys(obj).forEach((key) => {
    if (!allowed.includes(key)) errors.push(location + ': unbekanntes Feld "' + key + '".');
  });
}

function validateEditorialString(value, field, maxLength, location, errors, allowEmpty) {
  if (typeof value !== 'string') {
    errors.push(location + ': ' + field + ' muss eine Zeichenkette sein.');
    return false;
  }
  if (!allowEmpty && value.trim() === '') {
    errors.push(location + ': ' + field + ' muss eine nicht-leere Zeichenkette sein.');
  }
  if (value.length > maxLength) {
    errors.push(location + ': ' + field + ' ist zu lang (maximal ' + maxLength + ' Zeichen).');
  }
  if (FORBIDDEN_CONTROL_RE.test(value)) {
    errors.push(location + ': ' + field + ' enthaelt unzulaessige Steuer- oder Bidi-Zeichen.');
  }
  return true;
}

function placeholderNames(text) {
  return [...new Set(placeholderOccurrences(text))].sort();
}

function placeholderOccurrences(text) {
  const names = [];
  const re = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
  let match;
  while ((match = re.exec(String(text))) !== null) names.push(match[1]);
  return names.sort();
}

function validatePlaceholders(text, location, errors) {
  const stripped = String(text).replace(/\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/g, '');
  if (stripped.includes('{{') || stripped.includes('}}')) {
    errors.push(location + ': ungueltiger Platzhalter; erlaubt ist {{name}}.');
  }
}

function validateAllowedHtml(text, location, errors) {
  const source = String(text);
  const stack = [];
  const tagRe = /<[^>]*>/g;
  let cursor = 0;
  let match;

  while ((match = tagRe.exec(source)) !== null) {
    const between = source.slice(cursor, match.index);
    if (between.includes('<') || between.includes('>')) {
      errors.push(location + ': unvollstaendiges oder ungueltiges HTML.');
      return;
    }

    const token = match[0];
    const parsed = token.match(/^<(\/)?(b|i|ul|li|br)>$/);
    if (!parsed) {
      errors.push(
        location + ': nur <b>, <i>, <ul>, <li> und <br> ohne Attribute sind erlaubt (gefunden: ' + token + ').'
      );
      return;
    }

    const closing = !!parsed[1];
    const name = parsed[2];
    if (name === 'br') {
      if (closing) {
        errors.push(location + ': </br> ist nicht erlaubt; verwenden Sie <br>.');
        return;
      }
    } else if (!closing) {
      stack.push(name);
    } else if (stack.pop() !== name) {
      errors.push(location + ': HTML-Tags sind nicht korrekt verschachtelt.');
      return;
    }
    cursor = match.index + token.length;
  }

  const tail = source.slice(cursor);
  if (tail.includes('<') || tail.includes('>')) {
    errors.push(location + ': unvollstaendiges oder ungueltiges HTML.');
    return;
  }
  if (stack.length) errors.push(location + ': nicht geschlossener <' + stack[stack.length - 1] + '>-Tag.');
}

function htmlTagOccurrences(text) {
  return String(text).match(/<\/?(?:b|i|ul|li|br)>/g) || [];
}

function validateTextAgainstEntry(text, entry, location, errors) {
  if (!validateEditorialString(text, 'Text', FIELD_LIMITS.text, location, errors, false)) return;
  if (typeof text !== 'string' || text.trim() === '') return;
  validatePlaceholders(text, location, errors);
  validateAllowedHtml(text, location, errors);
  (entry.requiredTerms || []).forEach((term) => {
    if (!text.includes(term)) errors.push(location + ': geschuetztes Element fehlt: "' + term + '".');
  });
}

function makeCatalog(files, contentDir, options) {
  const opts = options || {};
  const catalogLocale = opts.locale || (files[0] && files[0].data && files[0].data.locale) || DEFAULT_LOCALE;
  const entries = [];
  files.forEach((file) => {
    const data = file.data;
    if (data && Array.isArray(data.entries)) {
      data.entries.forEach((entry, entryIndex) => {
        entries.push({
          id: entry && entry.id,
          entry,
          entryIndex,
          domain: data.domain,
          file,
          locale: catalogLocale,
        });
      });
    }
  });
  return {
    contentDir,
    files,
    entries,
    locale: catalogLocale,
    isTranslation: !!opts.isTranslation,
    baseCatalog: opts.baseCatalog || null,
    translationFiles: opts.translationFiles || [],
    staleSourceIds: opts.staleSourceIds || [],
    missingTranslationIds: opts.missingTranslationIds || [],
  };
}

function assertSupportedLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new ContentWorkflowError(
      'Nicht unterstuetzte Sprache "' + locale + '". Erlaubt: ' + SUPPORTED_LOCALES.join(', ') + '.'
    );
  }
  return locale;
}

function loadBaseCatalog(options) {
  const opts = options || {};
  const contentDir = path.resolve(opts.contentDir || DEFAULT_CONTENT_DIR);
  if (!fs.existsSync(contentDir)) {
    throw new ContentWorkflowError('Content-Verzeichnis fehlt: ' + contentDir);
  }

  const names = fs.readdirSync(contentDir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'de'));
  if (!names.length) {
    throw new ContentWorkflowError('Keine JSON-Dateien in ' + contentDir + ' gefunden.');
  }

  const files = names.map((name) => {
    const filePath = path.join(contentDir, name);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new ContentWorkflowError(name + ': ungueltiges JSON: ' + error.message);
    }
    return { name, path: filePath, data };
  });
  return makeCatalog(files, contentDir, { locale: DEFAULT_LOCALE });
}

function translationSourceContract(record) {
  const entry = record.entry;
  return {
    schemaVersion: SCHEMA_VERSION,
    locale: DEFAULT_LOCALE,
    domain: record.domain,
    id: record.id,
    section: entry.section,
    context: entry.context,
    text: entry.text,
    kind: entry.kind,
    reviewers: reviewersAsArray(entry.reviewers),
    requiredTerms: (entry.requiredTerms || []).slice(),
    comment: entry.comment || '',
  };
}

// Vor Juli 2026 waren section/context nicht Teil des Vertrags. Dieser exakt
// abgegrenzte Altvertrag dient ausschliesslich dazu, bestehende, sonst aktuelle
// Overlays beim sync-locales-Befehl verlustfrei auf den staerkeren Vertrag zu
// migrieren. Wirklich veraltete Hashes werden weiterhin nicht ueberschrieben.
function legacyTranslationSourceContractHash(record) {
  const entry = record.entry;
  return sha256(stableStringify({
    schemaVersion: SCHEMA_VERSION,
    locale: DEFAULT_LOCALE,
    domain: record.domain,
    id: record.id,
    text: entry.text,
    kind: entry.kind,
    reviewers: reviewersAsArray(entry.reviewers),
    requiredTerms: (entry.requiredTerms || []).slice(),
    comment: entry.comment || '',
  }));
}

function computeTranslationSourceContractHash(record) {
  return sha256(stableStringify(translationSourceContract(record)));
}

function readJsonFile(filePath, displayName) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new ContentWorkflowError((displayName || filePath) + ': ungueltiges JSON: ' + error.message);
  }
}

function loadTranslationCatalog(baseCatalog, locale, options) {
  const opts = options || {};
  const contentDir = baseCatalog.contentDir;
  const localeDir = path.resolve(opts.localeDir || path.join(contentDir, 'locales', locale));
  if (!fs.existsSync(localeDir)) {
    throw new ContentWorkflowError('Uebersetzungsverzeichnis fehlt: ' + localeDir);
  }

  const errors = [];
  const staleSourceIds = [];
  const missingTranslationIds = [];
  const translationFiles = [];
  const baseDomains = new Map(baseCatalog.files.map((file) => [file.data.domain, file]));
  const overlayNames = fs.readdirSync(localeDir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'de'));
  const overlayByDomain = new Map();

  overlayNames.forEach((name) => {
    const filePath = path.join(localeDir, name);
    const data = readJsonFile(filePath, path.join('locales', locale, name));
    const at = path.join('locales', locale, name);
    if (!isPlainObject(data)) {
      errors.push(at + ': Wurzel muss ein Objekt sein.');
      return;
    }
    assertKnownFields(data, TOP_LEVEL_FIELDS, at, errors);
    TOP_LEVEL_FIELDS.forEach((field) => {
      if (!own(data, field)) errors.push(at + ': Pflichtfeld "' + field + '" fehlt.');
    });
    if (data.schemaVersion !== SCHEMA_VERSION) errors.push(at + ': schemaVersion muss ' + SCHEMA_VERSION + ' sein.');
    if (data.locale !== locale) errors.push(at + ': locale muss "' + locale + '" sein.');
    if (typeof data.domain !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(data.domain)) {
      errors.push(at + ': domain muss einer stabilen ID entsprechen.');
    } else if (overlayByDomain.has(data.domain)) {
      errors.push(at + ': domain "' + data.domain + '" ist doppelt definiert.');
    } else {
      overlayByDomain.set(data.domain, { name, path: filePath, data });
    }
    if (!Array.isArray(data.entries) || !data.entries.length) {
      errors.push(at + ': entries muss ein nicht-leeres Array sein.');
    }
  });

  const missingDomains = [...baseDomains.keys()].filter((domain) => !overlayByDomain.has(domain));
  const extraDomains = [...overlayByDomain.keys()].filter((domain) => !baseDomains.has(domain));
  if (missingDomains.length) errors.push(locale + ': fehlende Domains: ' + missingDomains.join(', ') + '.');
  if (extraDomains.length) errors.push(locale + ': unbekannte Domains: ' + extraDomains.join(', ') + '.');

  const mergedFiles = [];
  baseCatalog.files.forEach((baseFile) => {
    const overlayFile = overlayByDomain.get(baseFile.data.domain);
    if (!overlayFile || !Array.isArray(overlayFile.data.entries)) return;
    translationFiles.push(overlayFile);
    const baseById = new Map(baseFile.data.entries.map((entry) => [entry.id, entry]));
    const overlayById = new Map();

    overlayFile.data.entries.forEach((entry, index) => {
      const fallback = overlayFile.name + ':entries[' + index + ']';
      if (!isPlainObject(entry)) {
        errors.push(fallback + ': Eintrag muss ein Objekt sein.');
        return;
      }
      const location = entry.id ? overlayFile.name + ':' + entry.id : fallback;
      assertKnownFields(
        entry,
        TRANSLATION_ENTRY_REQUIRED_FIELDS.concat(TRANSLATION_ENTRY_OPTIONAL_FIELDS),
        location,
        errors
      );
      TRANSLATION_ENTRY_REQUIRED_FIELDS.forEach((field) => {
        if (!own(entry, field)) errors.push(location + ': Pflichtfeld "' + field + '" fehlt.');
      });
      if (typeof entry.id !== 'string') errors.push(location + ': id muss eine Zeichenkette sein.');
      else if (overlayById.has(entry.id)) errors.push(location + ': ID ist im Overlay doppelt.');
      else overlayById.set(entry.id, entry);
    });

    const missing = [...baseById.keys()].filter((id) => !overlayById.has(id));
    const extra = [...overlayById.keys()].filter((id) => !baseById.has(id));
    if (missing.length) errors.push(locale + '/' + baseFile.data.domain + ': fehlende IDs: ' + missing.join(', ') + '.');
    if (extra.length) errors.push(locale + '/' + baseFile.data.domain + ': unbekannte IDs: ' + extra.join(', ') + '.');

    const mergedEntries = baseFile.data.entries.map((baseEntry) => {
      const translated = overlayById.get(baseEntry.id);
      if (!translated) return cloneJson(baseEntry);
      const baseRecord = { id: baseEntry.id, domain: baseFile.data.domain, entry: baseEntry };
      const location = overlayFile.name + ':' + baseEntry.id;
      const expectedHash = computeTranslationSourceContractHash(baseRecord);
      const translatedTerms = translated.requiredTerms;
      if (!Array.isArray(translatedTerms)) {
        errors.push(location + ': requiredTerms muss ein Array sein.');
      } else if (translated.translationState === 'translated' &&
          Array.isArray(baseEntry.requiredTerms) && baseEntry.requiredTerms.length && !translatedTerms.length) {
        errors.push(
          location + ': geschuetzte Begriffe des deutschen Ausgangstexts duerfen in einer fertigen Uebersetzung nicht vollstaendig entfallen.'
        );
      }
      if (!ALLOWED_REVIEW_STATUSES.includes(translated.reviewStatus)) {
        errors.push(location + ': unbekannter reviewStatus "' + translated.reviewStatus + '".');
      }
      if (!['missing', 'translated'].includes(translated.translationState)) {
        errors.push(location + ': translationState muss "missing" oder "translated" sein.');
      } else if (translated.translationState === 'missing') {
        missingTranslationIds.push(baseEntry.id);
      }
      if (typeof translated.sourceContractHash !== 'string' || !/^[a-f0-9]{64}$/.test(translated.sourceContractHash)) {
        errors.push(location + ': sourceContractHash muss ein SHA-256-Hash sein.');
      } else if (translated.sourceContractHash !== expectedHash) {
        staleSourceIds.push(baseEntry.id);
      }
      const expectedPlaceholders = placeholderOccurrences(baseEntry.text);
      const actualPlaceholders = placeholderOccurrences(translated.text);
      if (expectedPlaceholders.join('|') !== actualPlaceholders.join('|')) {
        errors.push(location + ': Platzhalter muessen exakt dem deutschen Ausgangstext entsprechen.');
      }
      const expectedTags = htmlTagOccurrences(baseEntry.text);
      const actualTags = htmlTagOccurrences(translated.text);
      if (expectedTags.join('|') !== actualTags.join('|')) {
        errors.push(location + ': erlaubte HTML-Tags muessen exakt dem deutschen Ausgangstext entsprechen.');
      }
      const translatedForValidation = {
        text: translated.text,
        requiredTerms: Array.isArray(translatedTerms) ? translatedTerms : [],
      };
      validateTextAgainstEntry(translated.text, translatedForValidation, location, errors);
      if (translated.reviewComment !== undefined) {
        validateEditorialString(
          translated.reviewComment,
          'reviewComment',
          FIELD_LIMITS.reviewComment,
          location,
          errors,
          true
        );
      }
      const merged = cloneJson(baseEntry);
      merged.text = translated.text;
      merged.requiredTerms = Array.isArray(translatedTerms) ? translatedTerms.slice() : [];
      merged.reviewStatus = translated.sourceContractHash === expectedHash
        ? (translated.translationState === 'missing' ? 'needs-review' : translated.reviewStatus)
        : 'needs-review';
      if (translated.reviewComment !== undefined) merged.reviewComment = translated.reviewComment;
      else delete merged.reviewComment;
      return merged;
    });

    mergedFiles.push({
      name: baseFile.name,
      path: overlayFile.path,
      data: {
        schemaVersion: SCHEMA_VERSION,
        locale,
        domain: baseFile.data.domain,
        entries: mergedEntries,
      },
      overlayData: overlayFile.data,
      baseFile,
    });
  });

  if (errors.length) {
    throw new ContentWorkflowError(
      'Uebersetzungsvalidierung fuer ' + locale + ' fehlgeschlagen (' + errors.length + ' Fehler).',
      errors
    );
  }

  const catalog = makeCatalog(mergedFiles, contentDir, {
    locale,
    isTranslation: true,
    baseCatalog,
    translationFiles,
    staleSourceIds,
    missingTranslationIds,
  });
  const baseIndex = recordIndex(baseCatalog);
  const overlayIndex = new Map();
  translationFiles.forEach((file) => {
    file.data.entries.forEach((entry) => overlayIndex.set(entry.id, entry));
  });
  catalog.entries.forEach((record) => {
    record.baseRecord = baseIndex.get(record.id);
    record.translationEntry = overlayIndex.get(record.id);
    record.locale = locale;
  });
  return catalog;
}

function loadCatalog(options) {
  const opts = options || {};
  const locale = assertSupportedLocale(opts.locale || DEFAULT_LOCALE);
  const baseCatalog = loadBaseCatalog(opts);
  validateCatalog(baseCatalog);
  if (locale === DEFAULT_LOCALE) return baseCatalog;
  return loadTranslationCatalog(baseCatalog, locale, opts);
}

function validateCatalog(catalog, options) {
  const opts = options || {};
  const errors = [];
  const ids = new Map();
  const domains = new Map();
  let locale = null;
  let schemaVersion = null;

  if (!catalog || !Array.isArray(catalog.files) || !catalog.files.length) {
    throw new ContentWorkflowError('Der Content-Katalog ist leer oder ungueltig.');
  }

  catalog.files.forEach((file) => {
    const data = file.data;
    const at = file.name;
    if (!isPlainObject(data)) {
      errors.push(at + ': Wurzel muss ein Objekt sein.');
      return;
    }
    assertKnownFields(data, TOP_LEVEL_FIELDS, at, errors);
    TOP_LEVEL_FIELDS.forEach((field) => {
      if (!own(data, field)) errors.push(at + ': Pflichtfeld "' + field + '" fehlt.');
    });

    if (data.schemaVersion !== SCHEMA_VERSION) {
      errors.push(at + ': schemaVersion muss ' + SCHEMA_VERSION + ' sein.');
    }
    const expectedLocale = catalog.locale || DEFAULT_LOCALE;
    if (!SUPPORTED_LOCALES.includes(data.locale)) {
      errors.push(at + ': locale ist nicht unterstuetzt: "' + data.locale + '".');
    } else if (data.locale !== expectedLocale) {
      errors.push(at + ': locale muss "' + expectedLocale + '" sein.');
    }
    if (schemaVersion == null) schemaVersion = data.schemaVersion;
    if (locale == null) locale = data.locale;

    if (typeof data.domain !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(data.domain)) {
      errors.push(at + ': domain muss einer stabilen ID entsprechen (z. B. "recommendations").');
    } else if (domains.has(data.domain)) {
      errors.push(at + ': domain "' + data.domain + '" ist bereits in ' + domains.get(data.domain) + ' definiert.');
    } else {
      domains.set(data.domain, at);
    }

    if (!Array.isArray(data.entries)) {
      errors.push(at + ': entries muss ein Array sein.');
      return;
    }
    if (!data.entries.length) errors.push(at + ': entries darf nicht leer sein.');

    data.entries.forEach((entry, index) => {
      const fallback = at + ':entries[' + index + ']';
      if (!isPlainObject(entry)) {
        errors.push(fallback + ': Eintrag muss ein Objekt sein.');
        return;
      }
      const location = entry.id ? at + ':' + entry.id : fallback;
      assertKnownFields(entry, ENTRY_REQUIRED_FIELDS.concat(ENTRY_OPTIONAL_FIELDS), location, errors);
      ENTRY_REQUIRED_FIELDS.forEach((field) => {
        if (!own(entry, field)) errors.push(location + ': Pflichtfeld "' + field + '" fehlt.');
      });

      if (typeof entry.id !== 'string' || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(entry.id)) {
        errors.push(location + ': id muss eine stabile, kleingeschriebene Content-ID sein.');
      } else if (entry.id.length > FIELD_LIMITS.id) {
        errors.push(location + ': id ist zu lang (maximal ' + FIELD_LIMITS.id + ' Zeichen).');
      } else if (ids.has(entry.id)) {
        errors.push(location + ': doppelte globale ID; bereits in ' + ids.get(entry.id) + '.');
      } else {
        ids.set(entry.id, location);
      }

      ['section', 'context', 'kind'].forEach((field) => {
        validateEditorialString(
          entry[field],
          field,
          FIELD_LIMITS[field],
          location,
          errors,
          false
        );
      });

      const reviewerValues = Array.isArray(entry.reviewers)
        ? entry.reviewers
        : (typeof entry.reviewers === 'string'
          ? entry.reviewers.split(',').map((value) => value.trim()).filter(Boolean)
          : []);
      if (!reviewerValues.length) {
        errors.push(location + ': reviewers muss eine nicht-leere Zeichenkette oder ein nicht-leeres Array sein.');
      } else {
        const seenReviewers = new Set();
        reviewerValues.forEach((reviewer) => {
          if (typeof reviewer !== 'string' || !/^[\p{L}][\p{L}0-9 _/-]*$/u.test(reviewer)) {
            errors.push(location + ': ungueltiger Reviewer "' + String(reviewer) + '".');
          } else if (reviewer.length > FIELD_LIMITS.reviewer) {
            errors.push(location + ': Reviewer "' + reviewer + '" ist zu lang.');
          } else if (!ALLOWED_REVIEWERS.includes(reviewer)) {
            errors.push(
              location + ': unbekannter Reviewer "' + reviewer + '". Erlaubt: ' +
              ALLOWED_REVIEWERS.join(', ') + '.'
            );
          } else if (seenReviewers.has(reviewer)) {
            errors.push(location + ': Reviewer "' + reviewer + '" ist doppelt.');
          }
          seenReviewers.add(reviewer);
        });
      }

      if (entry.requiredTerms !== undefined) {
        if (!Array.isArray(entry.requiredTerms)) {
          errors.push(location + ': requiredTerms muss ein Array sein.');
        } else {
          const seenTerms = new Set();
          entry.requiredTerms.forEach((term) => {
            if (typeof term !== 'string' || term === '') {
              errors.push(location + ': requiredTerms duerfen nur nicht-leere Zeichenketten enthalten.');
            } else if (term.length > FIELD_LIMITS.requiredTerm) {
              errors.push(location + ': requiredTerm ist zu lang (maximal ' + FIELD_LIMITS.requiredTerm + ' Zeichen).');
            } else if (FORBIDDEN_CONTROL_RE.test(term)) {
              errors.push(location + ': requiredTerm enthaelt unzulaessige Steuer- oder Bidi-Zeichen.');
            } else if (seenTerms.has(term)) {
              errors.push(location + ': requiredTerm "' + term + '" ist doppelt.');
            }
            seenTerms.add(term);
          });
        }
      }
      if (entry.reviewStatus !== undefined) {
        if (validateEditorialString(
          entry.reviewStatus,
          'reviewStatus',
          FIELD_LIMITS.reviewStatus,
          location,
          errors,
          true
        ) && !ALLOWED_REVIEW_STATUSES.includes(entry.reviewStatus)) {
          errors.push(
            location + ': unbekannter reviewStatus "' + entry.reviewStatus + '". Erlaubt: ' +
            ALLOWED_REVIEW_STATUSES.map((status) => status || '(leer)').join(', ') + '.'
          );
        }
      }
      if (entry.comment !== undefined) {
        validateEditorialString(
          entry.comment,
          'comment',
          FIELD_LIMITS.comment,
          location,
          errors,
          true
        );
      }
      if (entry.reviewComment !== undefined) {
        validateEditorialString(
          entry.reviewComment,
          'reviewComment',
          FIELD_LIMITS.reviewComment,
          location,
          errors,
          true
        );
      }

      validateTextAgainstEntry(entry.text, entry, location, errors);
    });
  });

  if (opts.requireCurrentSource && catalog.staleSourceIds && catalog.staleSourceIds.length) {
    errors.push(
      catalog.locale + ': ' + catalog.staleSourceIds.length +
      ' Uebersetzung(en) basieren auf einem geaenderten deutschen Ausgangstext: ' +
      catalog.staleSourceIds.join(', ') + '.'
    );
  }
  if (opts.requireTranslations && catalog.missingTranslationIds && catalog.missingTranslationIds.length) {
    errors.push(
      catalog.locale + ': ' + catalog.missingTranslationIds.length +
      ' Text(e) sind noch nicht uebersetzt: ' + catalog.missingTranslationIds.join(', ') + '.'
    );
  }

  if (errors.length) {
    throw new ContentWorkflowError(
      'Content-Validierung fehlgeschlagen (' + errors.length + ' Fehler).',
      errors
    );
  }

  return {
    files: catalog.files.length,
    domains: domains.size,
    entries: ids.size,
    schemaVersion: schemaVersion,
    locale: locale,
    staleSourceEntries: catalog.staleSourceIds ? catalog.staleSourceIds.length : 0,
    missingTranslations: catalog.missingTranslationIds ? catalog.missingTranslationIds.length : 0,
  };
}

function sortedRecords(catalog) {
  return catalog.entries.slice().sort((a, b) => String(a.id).localeCompare(String(b.id), 'de'));
}

function canonicalSnapshot(catalog) {
  return {
    schemaVersion: SCHEMA_VERSION,
    locale: catalog.locale || DEFAULT_LOCALE,
    domains: catalog.files
      .map((file) => ({
        domain: file.data.domain,
        entries: file.data.entries.slice().sort((a, b) => a.id.localeCompare(b.id, 'de')).map((entry) => {
          const snapshot = normalized(entry);
          if (file.overlayData) {
            const translation = file.overlayData.entries.find((item) => item.id === entry.id);
            snapshot.translationContract = translation ? {
              translationState: translation.translationState,
              sourceContractHash: translation.sourceContractHash,
            } : null;
          }
          return snapshot;
        }),
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain, 'de')),
  };
}

function computeSourceHash(catalog) {
  return sha256(stableStringify(canonicalSnapshot(catalog)));
}

function computeSourceVersion(catalog) {
  return 'v' + SCHEMA_VERSION + ':' + computeSourceHash(catalog);
}

function computeRowHash(record) {
  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    locale: record.locale || (record.file && record.file.data && record.file.data.locale) || DEFAULT_LOCALE,
    domain: record.domain,
    entry: record.entry,
  };
  if (record.translationEntry) {
    snapshot.translationContract = {
      translationState: record.translationEntry.translationState,
      sourceContractHash: record.translationEntry.sourceContractHash,
    };
  }
  return sha256(stableStringify(snapshot));
}

function buildBundle(catalog) {
  validateCatalog(catalog);
  const sourceHash = computeSourceHash(catalog);
  const texts = {};
  sortedRecords(catalog).forEach((record) => { texts[record.id] = record.entry.text; });
  return {
    schemaVersion: SCHEMA_VERSION,
    locale: catalog.locale || DEFAULT_LOCALE,
    version: 'v' + SCHEMA_VERSION + ':' + sourceHash,
    sourceHash,
    texts,
  };
}

function buildBundleRegistry(catalogs, options) {
  const opts = options || {};
  if (!Array.isArray(catalogs) || !catalogs.length) {
    throw new ContentWorkflowError('Fuer das Multi-Locale-Bundle fehlt der Content-Katalog.');
  }
  const byLocale = new Map();
  catalogs.forEach((catalog) => {
    validateCatalog(catalog, {
      requireCurrentSource: opts.allowIncomplete ? false : true,
      requireTranslations: opts.allowIncomplete ? false : true,
    });
    byLocale.set(catalog.locale, buildBundle(catalog));
  });
  const missing = SUPPORTED_LOCALES.filter((locale) => !byLocale.has(locale));
  if (missing.length) {
    throw new ContentWorkflowError('Multi-Locale-Bundle unvollstaendig. Fehlend: ' + missing.join(', ') + '.');
  }
  const bundles = {};
  SUPPORTED_LOCALES.forEach((locale) => { bundles[locale] = byLocale.get(locale); });
  const sourceHash = sha256(stableStringify({
    schemaVersion: 2,
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: SUPPORTED_LOCALES,
    bundles,
  }));
  return {
    schemaVersion: 2,
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: SUPPORTED_LOCALES.slice(),
    version: 'v2:' + sourceHash,
    sourceHash,
    bundles,
  };
}

function renderGenerated(bundle) {
  const json = JSON.stringify(bundle, null, 2).replace(/<\//g, '<\\/');
  return [
    '/* AUTO-GENERATED by scripts/result-content.js. DO NOT EDIT. */',
    '(function () {',
    "  'use strict';",
    '  const bundle = ' + json.replace(/\n/g, '\n  ') + ';',
    '  Object.freeze(bundle.texts);',
    '  Object.freeze(bundle);',
    "  if (typeof window !== 'undefined') window.__RESULT_COPY_BUNDLE__ = bundle;",
    '})();',
    '',
  ].join('\n');
}

function renderGeneratedRegistry(registry) {
  const json = JSON.stringify(registry, null, 2).replace(/<\//g, '<\\/');
  return [
    '/* AUTO-GENERATED by scripts/result-content.js. DO NOT EDIT. */',
    '(function () {',
    "  'use strict';",
    '  const registry = ' + json.replace(/\n/g, '\n  ') + ';',
    '  Object.keys(registry.bundles).forEach(function (locale) {',
    '    Object.freeze(registry.bundles[locale].texts);',
    '    Object.freeze(registry.bundles[locale]);',
    '  });',
    '  Object.freeze(registry.bundles);',
    '  Object.freeze(registry.supportedLocales);',
    '  Object.freeze(registry);',
    "  if (typeof window !== 'undefined') {",
    '    window.__RESULT_COPY_BUNDLES__ = registry;',
    '    window.__RESULT_COPY_BUNDLE__ = registry.bundles[registry.defaultLocale];',
    '  }',
    '})();',
    '',
  ].join('\n');
}

function atomicWriteFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = filePath + '.tmp-' + process.pid + '-' + crypto.randomBytes(5).toString('hex');
  try {
    fs.writeFileSync(temporary, contents, 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function expectedGenerated(options) {
  const opts = options || {};
  const catalog = loadCatalog(Object.assign({}, opts, { locale: opts.locale || DEFAULT_LOCALE }));
  validateCatalog(catalog, {
    requireCurrentSource: catalog.locale !== DEFAULT_LOCALE,
    requireTranslations: catalog.locale !== DEFAULT_LOCALE,
  });
  const bundle = buildBundle(catalog);
  return {
    catalog,
    bundle,
    contents: renderGenerated(bundle),
    csvContents: exportCsvText(catalog),
    overviewContents: renderReviewOverview(catalog),
  };
}

function requestedLocales(options, defaultAll) {
  const opts = options || {};
  if (opts.locale) return [assertSupportedLocale(opts.locale)];
  if (Array.isArray(opts.locales) && opts.locales.length) {
    return [...new Set(opts.locales.map(assertSupportedLocale))];
  }
  if (opts.all || (defaultAll && !opts.contentDir)) return SUPPORTED_LOCALES.slice();
  return [DEFAULT_LOCALE];
}

function loadCatalogs(options, defaultAll) {
  const opts = options || {};
  return requestedLocales(opts, defaultAll).map((locale) => loadCatalog(Object.assign({}, opts, { locale })));
}

function expectedAllGenerated(options) {
  const opts = options || {};
  const catalogs = loadCatalogs(Object.assign({}, opts, { all: true }), true);
  catalogs.forEach((catalog) => validateCatalog(catalog));
  const registry = buildBundleRegistry(catalogs);
  return {
    catalogs,
    registry,
    contents: renderGeneratedRegistry(registry),
  };
}

function inferredProjectRoot(options) {
  const opts = options || {};
  if (opts.projectRoot) return path.resolve(opts.projectRoot);
  const contentDir = path.resolve(opts.contentDir || DEFAULT_CONTENT_DIR);
  return path.dirname(path.dirname(contentDir));
}

function generatedArtifactFiles(options) {
  const opts = options || {};
  const root = inferredProjectRoot(opts);
  const locale = opts.locale || DEFAULT_LOCALE;
  return {
    generatedFile: path.resolve(opts.generatedFile || path.join(root, 'js', 'result-copy.generated.js')),
    exportFile: path.resolve(opts.exportFile || path.join(root, 'exports', 'result-texte-' + locale + '.csv')),
    overviewFile: path.resolve(opts.overviewFile || path.join(
      root,
      'exports',
      locale === DEFAULT_LOCALE ? 'result-texte-uebersicht.md' : 'result-texte-uebersicht-' + locale + '.md'
    )),
    localeOverviewFile: path.resolve(path.join(root, 'exports', 'result-texte-uebersicht-' + locale + '.md')),
    manifestFile: path.resolve(path.join(root, 'manifest.' + locale + '.webmanifest')),
    legacyManifestFile: path.resolve(path.join(root, 'manifest.webmanifest')),
  };
}

function managesManifests(options) {
  const opts = options || {};
  if (opts.manifests === false) return false;
  if (opts.manifests === true) return true;
  // Kleine Test-/Integrationskataloge besitzen bewusst kein komplettes
  // Seitengeruest. Im echten Projekt (kein abweichendes contentDir) gehoeren
  // die sprachspezifischen Web-App-Manifeste dagegen zum Generierungsvertrag.
  return !opts.contentDir;
}

function catalogText(catalog, id) {
  const record = catalog.entries.find((item) => item.id === id);
  if (!record || typeof record.entry.text !== 'string' || !record.entry.text.trim()) {
    throw new ContentWorkflowError('Manifest-Text fehlt im Content-Katalog: ' + id + '.');
  }
  return record.entry.text;
}

function renderWebManifest(catalog) {
  const locale = assertSupportedLocale(catalog.locale || DEFAULT_LOCALE);
  const manifest = {
    name: catalogText(catalog, MANIFEST_COPY_IDS.name),
    short_name: catalogText(catalog, MANIFEST_COPY_IDS.shortName),
    description: catalogText(catalog, MANIFEST_COPY_IDS.description),
    lang: locale,
    id: './',
    // Die gespeicherte Sprachwahl ist die Quelle fuer den App-Start. Ein fest
    // sprachgebundener start_url wuerde eine spaeter gewaehlte Sprache beim
    // Oeffnen eines aelteren Homescreen-Icons wieder zuruecksetzen.
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#9A0941',
    theme_color: '#9A0941',
    icons: [
      { src: 'assets/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'assets/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'assets/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

function manifestTargets(catalogs, options) {
  if (!managesManifests(options)) return [];
  const targets = [];
  catalogs.forEach((catalog) => {
    const files = generatedArtifactFiles(Object.assign({}, options, { locale: catalog.locale }));
    const contents = renderWebManifest(catalog);
    targets.push({ file: files.manifestFile, contents });
    if (catalog.locale === DEFAULT_LOCALE) {
      targets.push({ file: files.legacyManifestFile, contents });
    }
  });
  return targets;
}

function validate(options) {
  const opts = options || {};
  const catalogs = loadCatalogs(opts, true);
  const results = catalogs.map((catalog) => {
    const summary = validateCatalog(catalog, {
      requireCurrentSource: true,
      requireTranslations: catalog.locale !== DEFAULT_LOCALE,
    });
    return Object.assign({}, summary, {
      sourceHash: computeSourceHash(catalog),
      version: computeSourceVersion(catalog),
      catalog,
    });
  });
  return results.length === 1 ? results[0] : { locales: results, entries: results[0].entries };
}

function buildGenerated(options) {
  const opts = options || {};
  const generatedFile = path.resolve(opts.generatedFile || DEFAULT_GENERATED_FILE);
  const locales = requestedLocales(opts, true);
  if (locales.length === 1) {
    const expected = expectedGenerated(Object.assign({}, opts, { locale: locales[0] }));
    atomicWriteFile(generatedFile, expected.contents);
    const manifests = manifestTargets([expected.catalog], opts);
    manifests.forEach((target) => atomicWriteFile(target.file, target.contents));
    return {
      generatedFile,
      entries: expected.catalog.entries.length,
      sourceHash: expected.bundle.sourceHash,
      version: expected.bundle.version,
      locales,
      manifestFiles: manifests.map((target) => target.file),
    };
  }
  const expected = expectedAllGenerated(opts);
  atomicWriteFile(generatedFile, expected.contents);
  const manifests = manifestTargets(expected.catalogs, opts);
  manifests.forEach((target) => atomicWriteFile(target.file, target.contents));
  return {
    generatedFile,
    entries: expected.catalogs[0].entries.length,
    sourceHash: expected.registry.sourceHash,
    version: expected.registry.version,
    locales,
    manifestFiles: manifests.map((target) => target.file),
  };
}

function checkGenerated(options) {
  const opts = options || {};
  const locales = requestedLocales(opts, true);
  const generatedFile = path.resolve(opts.generatedFile || DEFAULT_GENERATED_FILE);
  const checks = [];
  let entries;
  let sourceHash;
  let version;
  if (locales.length === 1) {
    const locale = locales[0];
    const artifactFiles = generatedArtifactFiles(Object.assign({}, opts, { locale }));
    const expected = expectedGenerated(Object.assign({}, opts, { locale }));
    checks.push(
      { file: generatedFile, expected: expected.contents, command: 'build --locale ' + locale },
      { file: artifactFiles.exportFile, expected: expected.csvContents, command: 'export --locale ' + locale },
      { file: artifactFiles.overviewFile, expected: expected.overviewContents, command: 'overview --locale ' + locale }
    );
    entries = expected.catalog.entries.length;
    sourceHash = expected.bundle.sourceHash;
    version = expected.bundle.version;
  } else {
    const expected = expectedAllGenerated(opts);
    checks.push({ file: generatedFile, expected: expected.contents, command: 'build' });
    expected.catalogs.forEach((catalog) => {
      const locale = catalog.locale;
      const files = generatedArtifactFiles(Object.assign({}, opts, { locale, exportFile: undefined, overviewFile: undefined }));
      checks.push({ file: files.exportFile, expected: exportCsvText(catalog), command: 'export --all' });
      checks.push({ file: files.localeOverviewFile, expected: renderReviewOverview(catalog), command: 'overview --all' });
      if (locale === DEFAULT_LOCALE) {
        checks.push({ file: files.overviewFile, expected: renderReviewOverview(catalog), command: 'overview --all' });
      }
    });
    entries = expected.catalogs[0].entries.length;
    sourceHash = expected.registry.sourceHash;
    version = expected.registry.version;
  }
  if (managesManifests(opts)) {
    const catalogs = locales.map((locale) => loadCatalog(Object.assign({}, opts, { locale })));
    manifestTargets(catalogs, opts).forEach((target) => {
      checks.push({ file: target.file, expected: target.contents, command: 'build' });
    });
  }
  checks.forEach((check) => {
    if (!fs.existsSync(check.file)) {
      throw new ContentWorkflowError(
        'Generiertes Artefakt fehlt: ' + check.file + '. Bitte "' + check.command + '" ausfuehren.'
      );
    }
    const actual = fs.readFileSync(check.file, 'utf8');
    if (actual !== check.expected) {
      throw new ContentWorkflowError(
        'Generiertes Artefakt ist veraltet: ' + check.file + '. Bitte "' + check.command + '" ausfuehren.'
      );
    }
  });
  return {
    generatedFile,
    entries,
    sourceHash,
    version,
    locales,
  };
}

function reviewersAsArray(reviewers) {
  if (Array.isArray(reviewers)) return reviewers.map(String);
  if (typeof reviewers === 'string') {
    return reviewers.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

function protectedElements(entry) {
  const placeholders = placeholderNames(entry.text).map((name) => '{{' + name + '}}');
  const terms = (entry.requiredTerms || []).slice();
  return placeholders.concat(terms).join(' | ');
}

function placeholderList(entry) {
  return placeholderNames(entry.text).map((name) => '{{' + name + '}}').join(' | ');
}

function requiredTermList(entry) {
  return (entry.requiredTerms || []).slice().join(' | ');
}

function reviewStatusLabel(status) {
  return REVIEW_STATUS_LABELS[status || ''];
}

function reviewStatusFromLabel(value, rowId) {
  const found = Object.keys(REVIEW_STATUS_LABELS)
    .find((status) => REVIEW_STATUS_LABELS[status] === value);
  if (found !== undefined) return found;
  throw new ContentWorkflowError(
    'CSV:' + rowId + ': unbekannter Freigabestatus "' + value + '". Erlaubt: ' +
    Object.values(REVIEW_STATUS_LABELS).join(', ') + '.'
  );
}

function textFunctionLabel(kind) {
  if (REVIEW_KIND_LABELS[kind]) return REVIEW_KIND_LABELS[kind];
  const words = String(kind || '').replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Text';
}

function reviewSectionLabel(section) {
  return REVIEW_SECTION_LABELS[section] || section;
}

function reviewDimensionLabel(dimension) {
  return REVIEW_DIMENSION_LABELS[dimension] || dimension;
}

function reviewContextLabel(record, facet) {
  let context = String(record.entry.context || '');
  if (record.domain === 'questionnaire') {
    const match = context.match(/^Frage ([a-z0-9_]+),\s*(.+)$/);
    if (match) {
      const question = match[1].replace(/_/g, ' ');
      const detail = match[2];
      let readable = 'Frage «' + question.charAt(0).toUpperCase() + question.slice(1) + '»';
      if (/^Antwortoption\b/.test(detail)) readable += ' · Antwortoption';
      else if (detail === 'help') readable += ' · Hilfetext';
      else if (detail === 'helpTitle') readable += ' · Titel des Hilfetexts';
      else if (detail === 'placeholder') readable += ' · Eingabehinweis';
      else if (detail === 'unit') readable += ' · Einheit';
      else if (detail === 'text') readable += ' · Fragetext';
      else readable += ' · ' + detail.replace(/_/g, ' ');
      return readable;
    }
  }
  if (record.domain === 'sources' && /^Quellenseite, statischer Inhalt:/.test(context)) {
    const parts = String(record.id).split('.').slice(1);
    const sectionLabels = {
      blood_pressure: 'Blutdruck',
      lipids: 'Blutfette',
      mental: 'Mentale Gesundheit',
      metabolic: 'Stoffwechsel',
      nutrition: 'Ernährung',
      physical: 'Körperliche Aktivität',
      scoring: 'Scoring',
      sleep: 'Schlaf',
      smoking: 'Rauchen',
      strength: 'Muskelkraft',
      waist: 'Taillenumfang',
      hero: 'Einstieg',
      footer: 'Seitenabschluss',
      notice: 'Hinweis',
      meta: 'Seitendaten',
      card: 'Quellenkarte',
      link: 'Externer Quellenlink',
    };
    const detailLabels = {
      title: 'Überschrift',
      reference: 'Quellenangabe',
      point: 'Fachlicher Punkt',
      link_label: 'Linkbeschriftung',
      research_date: 'Stand der Recherche',
      review_disclaimer: 'Prüfhinweis',
      back_to_check: 'Zurück-Navigation',
    };
    const section = sectionLabels[parts[0]] || 'Allgemeine Quellenseite';
    const detailToken = parts.slice(1).join('_') || parts[0];
    const detail = detailLabels[detailToken] ||
      (parts.includes('point') ? 'Fachlicher Punkt' :
        parts.some((part) => part.startsWith('link')) ? 'Linkbeschriftung' : 'Inhalt');
    return section + ' · ' + detail;
  }
  context = context.replace(
    /^shared_quiz_and_results: DIMENSIONS\.([a-z]+),\s*/,
    (_, dimension) => 'Gemeinsam in Fragebogen und Ergebnis · ' + reviewDimensionLabel(dimension) + ' · '
  );
  context = context.replace(
    /^Empfehlungskarte [a-z0-9_]+ in der Dimension ([a-z]+),\s*/,
    (_, dimension) => 'Empfehlungskarte · ' + reviewDimensionLabel(dimension) + ' · '
  );
  context = context.replace(
    /^Handlungsfeld [a-z0-9_]+ in der Dimension ([a-z]+),\s*/,
    (_, dimension) => 'Handlungsfeld · ' + reviewDimensionLabel(dimension) + ' · '
  );
  context = context.replace(
    /^Stärke [a-z0-9_]+ in der Dimension ([a-z]+),\s*/,
    (_, dimension) => 'Stärke · ' + reviewDimensionLabel(dimension) + ' · '
  );
  context = context.replace(/^Plan [a-z0-9_]+,\s*/, '4-Wochen-Plan · ');
  context = context.replace(/^4-Wochen-Plan [a-z0-9_]+,\s*/, '4-Wochen-Plan · ');
  context = context.replace(/^Dimensionsdetail [a-z0-9_]+,\s*/, 'Dimensionsdetail · ');
  context = context.replace(
    /^Hero-Zusammenfassung, kurzes Themenlabel für [a-z0-9_]+$/,
    'Ergebnis-Zusammenfassung · Themenlabel «' + facet.topic + '»'
  );
  context = context.replace(/^Sichtbares Label der Fachquelle [a-z0-9_]+$/, 'Sichtbares Label einer Fachquelle');
  context = context.replace(/^HELSANA_OFFERS\.[A-Za-z0-9_]+,\s*/, 'Helsana-Angebot · ');
  context = context.replace(
    /^Kompatibilitätsvertrag signalInsights\(\), Vertiefung zu [a-z0-9_]+ bei Abdeckung durch den Aktionsplan$/,
    'Zusatzhinweis bei bereits abgedecktem Aktionsschritt'
  );
  context = context.replace(
    /^Kardiovaskulärer Vorsorge-Check, Startschritt Variante /,
    'Kardiovaskulärer Vorsorge-Check · Startschritt · '
  );
  Object.keys(REVIEW_VARIANT_LABELS)
    .sort((a, b) => b.length - a.length)
    .forEach((token) => {
      context = context.replace(new RegExp('\\b' + token + '\\b', 'g'), REVIEW_VARIANT_LABELS[token]);
    });
  return context.replace(/\s+·\s+·\s+/g, ' · ').trim();
}

function idContainsAny(id, tokens) {
  return tokens.some((token) => id.includes(token));
}

/**
 * Redaktionelle Facetten werden bewusst aus stabilen IDs abgeleitet. Sie sind
 * reine Review-Metadaten und verändern weder Scoring noch Ausspielungslogik.
 */
function reviewFacetFor(record) {
  const id = String(record.id || '');

  if (record.domain === 'questionnaire') {
    return { area: 'Fragebogen', topic: reviewSectionLabel(record.entry.section) || 'Fragen & Antworten' };
  }
  if (record.domain === 'shell') {
    return { area: 'Globale Navigation', topic: 'Navigation, Sprache & Installation' };
  }
  if (record.domain === 'sources') {
    return { area: 'Quellen & Transparenz', topic: 'Fachquellen & Quellenverzeichnis' };
  }

  if (id.startsWith('service.coverage.')) {
    return { area: 'Helsana-Angebote & Versicherung', topic: 'Leistungs- und Deckungshinweise' };
  }
  if (id.startsWith('service.offer.')) {
    if (idContainsAny(id, ['kraft'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Krafttraining' };
    if (idContainsAny(id, ['bewegung'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Bewegung' };
    if (idContainsAny(id, ['ernaehrung', 'metabolisch'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Ernährung & Stoffwechsel' };
    if (idContainsAny(id, ['schlaf'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Schlaf' };
    if (idContainsAny(id, ['stress', 'mentale_hilfe'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Mentales Wohlbefinden' };
    if (idContainsAny(id, ['rauchstopp'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Rauchstopp' };
    if (idContainsAny(id, ['vorsorge', 'wissen_kardio', 'blutdruck'])) return { area: 'Helsana-Angebote & Versicherung', topic: 'Angebote: Vorsorge' };
    return { area: 'Helsana-Angebote & Versicherung', topic: 'Weitere Angebote' };
  }
  if (idContainsAny(id, [
    'ui.share_modal.privacy', 'ui.coach_handoff.consent', 'ui.coach_handoff.note',
    'ui.contact.availability_legal', 'ui.customer_context', 'coach.answer.coach_app',
  ])) {
    return { area: 'Helsana-Angebote & Versicherung', topic: 'Datenschutz & Einwilligung' };
  }
  if (idContainsAny(id, ['ui.urgent.', 'ui.medical_notice.', 'coach.answer.emergency'])) {
    return { area: 'Medizin & Sicherheit', topic: 'Medizinische Hinweise & Notfallrouting' };
  }
  if (idContainsAny(id, ['ui.chat.', 'ui.coach_handoff.', 'ui.contact.'])) {
    return { area: 'Digital Coach', topic: 'Coach-Dialog & Übergabe' };
  }

  if (idContainsAny(id, [
    'act_kardio', 'ei_bd_messen', 'ei_bluthochdruck', 'ei_familie', 'ei_familienwissen',
    'ei_vorsorge', 'lv_bd_messen', 'lv_blutdruck', 'lv_familienwissen', 'lv_kardio',
    'st_vorsorge', 'blutdruck_unbekannt', 'bluthochdruck', 'familie_hk', '.vorsorge.',
    'swissheart_', 'hero.topic.familienwissen', 'answer.medical_values',
  ])) {
    return { area: 'Einflussfaktoren', topic: 'Herz-Kreislauf & Vorsorge' };
  }
  if (idContainsAny(id, ['ei_rauchstopp', 'lv_rauchstopp', 'st_rauchfrei', 'st_rauchstopp', '.rauchen.', 'hero.topic.rauchen', 'stopsmoking'])) {
    return { area: 'Einflussfaktoren', topic: 'Rauchen & Rauchstopp' };
  }
  if (idContainsAny(id, ['ei_alkohol', 'lv_alkohol', 'st_alkohol', '.alkohol.', 'hero.topic.alkohol'])) {
    return { area: 'Einflussfaktoren', topic: 'Alkohol' };
  }
  if (idContainsAny(id, ['ei_sitzen', 'lv_sitzen', '.sitzen.', 'hero.topic.sitzzeit'])) {
    return { area: 'Einflussfaktoren', topic: 'Sitzverhalten' };
  }
  if (idContainsAny(id, ['ei_socialmedia', 'lv_socialmedia', '.socialmedia.', 'hero.topic.socialmedia'])) {
    return { area: 'Einflussfaktoren', topic: 'Digitale Gewohnheiten' };
  }
  if (idContainsAny(id, ['ei_stabilitaet', 'lv_sturz', '.stabilitaet.', 'hero.topic.stabilitaet', 'st_sicherheit'])) {
    return { area: 'Einflussfaktoren', topic: 'Alltagssicherheit & Sturzprävention' };
  }
  if (idContainsAny(id, ['koerperzusammensetzung', 'untergewicht', 'ui.metrics.', 'hero.topic.koerperzusammensetzung'])) {
    return { area: 'Einflussfaktoren', topic: 'Körperzusammensetzung & Stoffwechsel' };
  }
  if (id.includes('.ei_') || idContainsAny(id, ['dimension.einfluss', 'positive.einfluss', 'solid.einfluss'])) {
    return { area: 'Einflussfaktoren', topic: 'Weitere Einflussfaktoren' };
  }

  if (idContainsAny(id, ['er_protein', 'lv_protein', 'st_protein', '.protein.', 'hero.topic.protein', 'morton_protein'])) {
    return { area: 'Ernährung', topic: 'Protein & Muskelerhalt' };
  }
  if (idContainsAny(id, ['er_vielfalt', 'lv_pflanzen', 'st_pflanzen', 'hero.topic.pflanzenvielfalt'])) {
    return { area: 'Ernährung', topic: 'Pflanzenvielfalt' };
  }
  if (idContainsAny(id, ['er_verarbeitet', 'lv_verarbeitet', 'st_ernaehrung_clean', 'hero.topic.verarbeitet'])) {
    return { area: 'Ernährung', topic: 'Verarbeitete Lebensmittel' };
  }
  if (idContainsAny(id, ['er_getraenke', 'lv_zucker', 'hero.topic.zuckergetraenke'])) {
    return { area: 'Ernährung', topic: 'Getränke & Zucker' };
  }
  if (idContainsAny(id, ['er_omega3', 'lv_omega', 'hero.topic.omega3'])) {
    return { area: 'Ernährung', topic: 'Omega-3' };
  }
  if (idContainsAny(id, ['er_saettigung', 'lv_saettigung', 'hero.topic.saettigung'])) {
    return { area: 'Ernährung', topic: 'Sättigung & Essverhalten' };
  }
  if (id.includes('.er_') || idContainsAny(id, ['dimension.ernaehrung', 'positive.ernaehrung', 'solid.ernaehrung', 'signal.ernaehrung', 'answer.nutrition'])) {
    return { area: 'Ernährung', topic: 'Allgemeine Ernährung' };
  }

  if (idContainsAny(id, ['fi_kraft', 'lv_kraft', 'st_kraft', 'keine_kraft', 'liegestuetze', 'wandsitz', 'hero.topic.krafttraining', 'hero.topic.einkaufstaschen'])) {
    return { area: 'Körperliche Fitness', topic: 'Krafttraining & Muskulatur' };
  }
  if (idContainsAny(id, ['fi_beweglichkeit', 'lv_balance_fit', 'einbeinstand', 'hero.topic.beweglichkeit', '.balance.'])) {
    return { area: 'Körperliche Fitness', topic: 'Beweglichkeit & Gleichgewicht' };
  }
  if (idContainsAny(id, ['fi_ausdauer', 'fi_kondition', 'lv_ausdauer', 'hero.topic.ausdauer_', 'hero.topic.treppen'])) {
    return { area: 'Körperliche Fitness', topic: 'Ausdauer & Kondition' };
  }
  if (idContainsAny(id, ['fi_einstieg', 'lv_fitness_alltag', 'st_alltagsfit', 'st_bewegung', 'bewegungsmangel', 'bag_bewegung'])) {
    return { area: 'Körperliche Fitness', topic: 'Bewegung im Alltag & Einstieg' };
  }
  if (id.includes('.fi_') || idContainsAny(id, ['ui.fitness_tests.', 'recommendation.fitness_test.', 'dimension.fitness', 'positive.fitness', 'solid.fitness', 'answer.fitness'])) {
    return { area: 'Körperliche Fitness', topic: 'Allgemeine Fitness' };
  }

  if (idContainsAny(id, ['sl_dauer', 'lv_schlafdauer', 'hero.topic.schlafdauer'])) {
    return { area: 'Schlaf', topic: 'Schlafdauer' };
  }
  if (idContainsAny(id, ['sl_qualitaet', 'lv_schlafqualitaet', 'act_schlaf_abklaerung', 'lv_schlaf_abklaerung', 'hero.topic.schlafqualitaet', 'hero.topic.schlaf_auswirkung'])) {
    return { area: 'Schlaf', topic: 'Schlafqualität & Abklärung' };
  }
  if (idContainsAny(id, ['sl_rhythmus', 'lv_schlafrhythmus', 'act_bildschirm_abend', 'lv_bildschirm_abend', 'hero.topic.schlafrhythmus'])) {
    return { area: 'Schlaf', topic: 'Schlafrhythmus & Abendroutine' };
  }
  if (id.includes('.sl_') || idContainsAny(id, ['st_schlaf', 'st_erholsamer_schlaf', '.schlaf.', 'dimension.schlaf', 'positive.schlaf', 'solid.schlaf', 'answer.sleep'])) {
    return { area: 'Schlaf', topic: 'Allgemeiner Schlaf' };
  }

  if (idContainsAny(id, ['me_belastung', 'me_unterstuetzung', 'lv_stresskompetenz', 'lv_mental_support', '.belastung.', 'hohe_belastung', 'hero.topic.belastbarkeit', 'hero.topic.coping', 'answer.breathing', 'ui.breathing.'])) {
    return { area: 'Mentales Wohlbefinden', topic: 'Belastung & Stresskompetenz' };
  }
  if (idContainsAny(id, ['me_sozial', 'lv_verbundenheit', 'st_sozial', '.einsamkeit.', 'hero.topic.verbundenheit'])) {
    return { area: 'Mentales Wohlbefinden', topic: 'Soziale Verbundenheit' };
  }
  if (idContainsAny(id, ['me_selbstfuersorge', 'lv_selbstfuersorge', 'hero.topic.selbstfuersorge', 'hero.topic.positive_emotionen'])) {
    return { area: 'Mentales Wohlbefinden', topic: 'Selbstfürsorge & positive Emotionen' };
  }
  if (idContainsAny(id, ['me_sinn', 'st_sinn', 'hero.topic.sinnhaftigkeit', 'hero.topic.zukunft', 'hero.topic.selbstwirksamkeit'])) {
    return { area: 'Mentales Wohlbefinden', topic: 'Sinn & Selbstwirksamkeit' };
  }
  if (id.includes('.me_') || idContainsAny(id, ['st_resilienz', 'dimension.mental', 'positive.mental', 'solid.mental'])) {
    return { area: 'Mentales Wohlbefinden', topic: 'Allgemeines mentales Wohlbefinden' };
  }

  if (record.domain === 'services') {
    return { area: 'Helsana-Angebote & Versicherung', topic: 'Service- und Angebotskommunikation' };
  }
  if (record.domain === 'coach') {
    return { area: 'Digital Coach', topic: 'Coach-Dialog & Übergabe' };
  }
  if (id.startsWith('ui.')) {
    return { area: 'Übergreifende Ergebnisdarstellung', topic: 'Navigation, Ergebnis & Bedienung' };
  }
  if (record.domain === 'recommendations') {
    return { area: 'Übergreifende Ergebnisdarstellung', topic: 'Weitere Empfehlungen' };
  }
  return { area: 'Übergreifende Ergebnisdarstellung', topic: 'Navigation, Ergebnis & Bedienung' };
}

function reviewFamilyKey(id) {
  const recommendation = String(id).match(/^recommendation\.(?:catalog|plan|special)\.([^.]+)/);
  if (recommendation) return recommendation[1];
  const family = String(id).match(/^recommendation\.(?:lever|strength|signal|risk_signal)\.([^.]+)/);
  if (family) return family[1];
  const fitnessTest = String(id).match(/^recommendation\.fitness_test\.([^.]+)/);
  if (fitnessTest) return 'fitness_test_' + fitnessTest[1];
  const service = String(id).match(/^service\.(?:offer|coverage|dimension)\.([^.]+)/);
  if (service) return service[1];
  const parts = String(id).split('.');
  return parts.slice(0, Math.max(1, parts.length - 1)).join('.');
}

function reviewContentOrder(record) {
  const id = record.id;
  if (id.endsWith('.title') || record.entry.kind === 'title' || record.entry.kind === 'label') return 10;
  if (id.includes('.why') || ['explanation', 'insight', 'positive_feedback', 'solid_feedback'].includes(record.entry.kind)) return 20;
  if (id.includes('.step') || ['action', 'clarify', 'deepen'].includes(record.entry.kind)) return 30;
  if (record.entry.kind === 'benefit') return 40;
  if (id.includes('.this_week')) return 50;
  if (id.includes('.weeks_2_3')) return 60;
  if (id.includes('.week_4')) return 70;
  return 80;
}

function buildReviewRecords(catalog) {
  validateCatalog(catalog);
  const areaRank = new Map(REVIEW_AREA_ORDER.map((area, index) => [area, index]));
  return catalog.entries.map((record) => {
    const facet = reviewFacetFor(record);
    const section = reviewSectionLabel(record.entry.section);
    const context = reviewContextLabel(record, facet);
    return {
      record,
      id: record.id,
      entry: record.entry,
      domain: record.domain,
      area: facet.area,
      topic: facet.topic,
      section,
      context,
      textFunction: textFunctionLabel(record.entry.kind),
      family: reviewFamilyKey(record.id),
      contentOrder: reviewContentOrder(record),
    };
  }).sort((a, b) =>
    (areaRank.get(a.area) - areaRank.get(b.area)) ||
    a.topic.localeCompare(b.topic, 'de') ||
    a.family.localeCompare(b.family, 'de') ||
    (a.contentOrder - b.contentOrder) ||
    a.section.localeCompare(b.section, 'de') ||
    a.context.localeCompare(b.context, 'de') ||
    a.id.localeCompare(b.id, 'de')
  );
}

function isSpreadsheetFormula(value) {
  return /^[\t\r\n ]*[=+\-@]/.test(String(value));
}

function protectSpreadsheetCell(value) {
  const stringValue = String(value == null ? '' : value);
  return isSpreadsheetFormula(stringValue) ? "'" + stringValue : stringValue;
}

function unprotectSpreadsheetCell(value, column, rowNumber) {
  const stringValue = String(value == null ? '' : value);
  if (stringValue.startsWith("'") && isSpreadsheetFormula(stringValue.slice(1))) {
    return stringValue.slice(1);
  }
  if (isSpreadsheetFormula(stringValue)) {
    throw new ContentWorkflowError(
      'CSV-Zeile ' + rowNumber + ', Spalte "' + column + '": potenzielle Tabellenformel. ' +
      'Beginnen Sie den Zellinhalt mit einem Apostroph, wenn das Zeichen zum Text gehoert.'
    );
  }
  return stringValue;
}

function quoteCsvCell(value) {
  return '"' + protectSpreadsheetCell(value).replace(/"/g, '""') + '"';
}

function serializeCsv(rows, columns) {
  const headers = columns || CSV_COLUMNS;
  const records = [headers].concat(rows.map((row) => headers.map((column) => row[column] == null ? '' : row[column])));
  return '\ufeff' + records.map((record) => record.map(quoteCsvCell).join(';')).join('\r\n') + '\r\n';
}

/**
 * RFC-4180-Parser fuer Semikolon-CSV. Unterstuetzt eingebettete Zeilenumbrueche,
 * doppelte Anfuehrungszeichen und sowohl CRLF als auch LF als Satztrenner.
 */
function parseCsv(input) {
  let source = String(input == null ? '' : input);
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (!source) return [];

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let justClosedQuote = false;

  function pushField() {
    row.push(field);
    field = '';
    justClosedQuote = false;
  }

  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
        justClosedQuote = true;
      } else if (char === '\r' && next === '\n') {
        field += '\n';
        index++;
      } else {
        field += char;
      }
      continue;
    }

    if (justClosedQuote) {
      if (char === ';') {
        pushField();
      } else if (char === '\n') {
        pushRow();
      } else if (char === '\r') {
        if (next === '\n') index++;
        pushRow();
      } else {
        throw new ContentWorkflowError('Ungueltige CSV: Zeichen nach schliessendem Anfuehrungszeichen bei Position ' + index + '.');
      }
      continue;
    }

    if (char === '"') {
      if (field !== '') throw new ContentWorkflowError('Ungueltige CSV: Anfuehrungszeichen mitten in einem unquotierten Feld.');
      inQuotes = true;
    } else if (char === ';') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      if (next === '\n') index++;
      pushRow();
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new ContentWorkflowError('Ungueltige CSV: nicht geschlossenes Anfuehrungszeichen.');
  if (justClosedQuote || field !== '' || row.length) pushRow();

  while (rows.length && rows[rows.length - 1].every((cell) => cell === '')) rows.pop();
  return rows;
}

function csvRowsToObjects(parsedRows) {
  if (!parsedRows.length) throw new ContentWorkflowError('CSV ist leer.');
  const header = parsedRows[0];
  const duplicateColumns = header.filter((column, index) => header.indexOf(column) !== index);
  const matches = (columns) =>
    header.length === columns.length && columns.every((column) => header.includes(column));
  const isCurrentFormat = matches(CSV_COLUMNS);
  const isLocalizedFormat = matches(LOCALIZED_CSV_COLUMNS);
  const isLegacyFormat = matches(LEGACY_CSV_COLUMNS);
  if (!isCurrentFormat && !isLocalizedFormat && !isLegacyFormat || duplicateColumns.length) {
    const supportedColumns = [...new Set(CSV_COLUMNS.concat(LOCALIZED_CSV_COLUMNS))];
    const missingColumns = CSV_COLUMNS.filter((column) => !header.includes(column));
    const extraColumns = header.filter((column) => !supportedColumns.includes(column));
    const details = [];
    if (missingColumns.length) details.push('Fehlende Spalten: ' + missingColumns.join(', '));
    if (extraColumns.length) details.push('Unbekannte Spalten: ' + extraColumns.join(', '));
    if (duplicateColumns.length) details.push('Doppelte Spalten: ' + [...new Set(duplicateColumns)].join(', '));
    details.push(
      'Erwartet wird das deutsche Austauschformat ' + CSV_FORMAT_VERSION +
      ', das Uebersetzungsformat ' + LOCALIZED_CSV_FORMAT_VERSION +
      ' oder das unterstuetzte Legacy-Format 1.'
    );
    throw new ContentWorkflowError('CSV-Kopfzeile entspricht keinem unterstützten Format.', details);
  }

  return parsedRows.slice(1).map((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== header.length) {
      throw new ContentWorkflowError(
        'CSV-Zeile ' + rowNumber + ' hat ' + values.length + ' statt ' + header.length + ' Spalten.'
      );
    }
    const object = {};
    header.forEach((column, columnIndex) => {
      object[column] = unprotectSpreadsheetCell(values[columnIndex], column, rowNumber);
    });
    return object;
  });
}

function csvObjectsFromText(input) {
  return csvRowsToObjects(parseCsv(input));
}

function catalogToCsvRows(catalog) {
  validateCatalog(catalog);
  const sourceVersion = computeSourceVersion(catalog);
  const localized = catalog.locale !== DEFAULT_LOCALE;
  return buildReviewRecords(catalog).map((item) => {
    const row = {
      'Gesundheitsbereich': item.area,
      'Thema': item.topic,
      'Seitenelement': item.section,
      'Textfunktion': item.textFunction,
      'Kontext / Variante': item.context,
      'Aktueller Text': item.entry.text,
      'Neuer Text': '',
      'Review-Kommentar': item.entry.reviewComment || '',
      'Freigabe durch': reviewersAsArray(item.entry.reviewers).join(', '),
      'Freigabestatus': reviewStatusLabel(item.entry.reviewStatus),
      'Prüfhinweis': item.entry.comment || '',
      'Platzhalter': placeholderList(item.entry),
      'Geschützte Begriffe': requiredTermList(item.entry),
      'ID (technisch)': item.id,
      'Domain (technisch)': item.domain,
      'Austauschformat (technisch)': localized ? LOCALIZED_CSV_FORMAT_VERSION : CSV_FORMAT_VERSION,
      'Quellversion (technisch)': sourceVersion,
      'Zeilen-Hash (technisch)': computeRowHash(item.record),
    };
    if (localized) {
      row['Deutscher Ausgangstext'] = item.record.baseRecord.entry.text;
      row['Sprache (technisch)'] = catalog.locale;
    }
    return row;
  });
}

function exportCsvText(catalog) {
  return serializeCsv(
    catalogToCsvRows(catalog),
    catalog.locale === DEFAULT_LOCALE ? CSV_COLUMNS : LOCALIZED_CSV_COLUMNS
  );
}

function exportCsv(options) {
  const opts = options || {};
  const locale = assertSupportedLocale(opts.locale || DEFAULT_LOCALE);
  const outputFile = path.resolve(opts.outputFile || generatedArtifactFiles(Object.assign({}, opts, { locale })).exportFile);
  const catalog = loadCatalog(Object.assign({}, opts, { locale }));
  validateCatalog(catalog);
  const contents = exportCsvText(catalog);
  atomicWriteFile(outputFile, contents);
  return {
    outputFile,
    entries: catalog.entries.length,
    sourceHash: computeSourceHash(catalog),
    version: computeSourceVersion(catalog),
    locale,
  };
}

function exportCsvAll(options) {
  const opts = options || {};
  return SUPPORTED_LOCALES.map((locale) => exportCsv(Object.assign({}, opts, {
    locale,
    outputFile: undefined,
  })));
}

function markdownMeta(value) {
  return String(value == null ? '' : value)
    .replace(/\r?\n/g, ' ')
    .trim()
    // Kommentare und andere redaktionelle Metadaten können aus der CSV
    // stammen. HTML und Markdown-Steuerzeichen dürfen die Lesefassung weder
    // umstrukturieren noch in permissiven Renderern aktiven Inhalt erzeugen.
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|])/g, '\\$1');
}

function markdownPreview(value) {
  const tagToMarkdown = { '<b>': '**', '</b>': '**', '<i>': '_', '</i>': '_' };
  return String(value == null ? '' : value)
    .split(/(<\/?(?:b|i)>)/)
    .map((part) => {
      if (tagToMarkdown[part]) return tagToMarkdown[part];
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/([\\`*_\[\]()#+!|\-])/g, '\\$1');
    })
    .join('');
}

function markdownAnchor(value) {
  const slug = String(value == null ? '' : value)
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' und ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'abschnitt';
}

function markdownQuoteLine(value) {
  const line = String(value == null ? '' : value).replace(/[ \t]+$/g, '');
  return line ? '> ' + line : '>';
}

/**
 * Erzeugt eine lesefreundliche, nicht importierbare Review-Ansicht. Die CSV
 * bleibt bewusst das einzige Austauschformat für Änderungen.
 */
function renderReviewOverview(catalog) {
  validateCatalog(catalog);
  const localized = catalog.locale !== DEFAULT_LOCALE;
  const review = buildReviewReport(catalog);
  const records = buildReviewRecords(catalog);
  const areas = new Map();
  records.forEach((item) => {
    if (!areas.has(item.area)) areas.set(item.area, new Map());
    const topics = areas.get(item.area);
    if (!topics.has(item.topic)) topics.set(item.topic, []);
    topics.get(item.topic).push(item);
  });

  const lines = [
    '# Ergebnis-Texte – Review-Übersicht',
    '',
    '> Lesefassung für Marketing, Medizin und Recht. Änderungen werden ausschliesslich in der CSV-Spalte `Neuer Text` erfasst.',
    '',
    '## So verwenden Sie diese Übersicht',
    '',
    '1. Wählen Sie im Arbeitsindex einen Gesundheitsbereich und ein Thema.',
    '2. Prüfen Sie Kontext, aktuellen Text, Prüfhinweis und geschützte Elemente zusammen.',
    '3. Tragen Sie Änderungen in der gleichnamigen CSV unter `Neuer Text` ein; diese Markdown-Datei ist nur die Lesefassung.',
    '',
    '**Wichtig:** `Freigegeben` ist ein gemeinsamer Gesamtstatus. Er darf erst gesetzt werden, wenn alle unter `Freigabe durch` genannten Stellen zugestimmt haben.',
    '',
    ...(localized ? [
      '**Übersetzungsstatus:** Diese Fassung ist eine KI-gestützte Erstübersetzung. `Prüfung erforderlich` bleibt gesetzt, bis die Texte muttersprachlich sowie – je nach Inhalt – medizinisch und rechtlich freigegeben wurden. Die CSV-Spalte `Review-Kommentar` ist bewusst leer für die Rückmeldungen der prüfenden Stellen.',
      '',
    ] : []),
    '## Freigabestand',
    '',
    '- Sprache: `' + catalog.locale + '`',
    '- Quellversion: `' + computeSourceVersion(catalog) + '`',
    '- Gesamtbestand: **' + catalog.entries.length + ' Texte**',
    '- Freigegeben: **' + review.approved + '** · Offen: **' + review.open + '**',
    '',
    '| Status | Texte | Bedeutung |',
    '| --- | ---: | --- |',
    '| Nicht geprüft | ' + (review.byStatus['not-set'] || 0) + ' | Noch kein gemeinsamer Freigabestatus gesetzt |',
    '| Prüfung erforderlich | ' + (review.byStatus['needs-review'] || 0) + ' | Ausdrücklich erneut zu prüfen |',
    '| Freigegeben | ' + (review.byStatus.approved || 0) + ' | Alle zuständigen Stellen haben zugestimmt |',
    '',
    '| Freigabestelle | Zugeordnete Texte | Freigegeben | Offen |',
    '| --- | ---: | ---: | ---: |',
  ];

  review.byReviewer.forEach((item) => {
    lines.push('| ' + markdownMeta(item.reviewer) + ' | ' + item.total + ' | ' + item.approved + ' | ' + item.open + ' |');
  });
  lines.push('', '## Arbeitsindex', '', '| Gesundheitsbereich | Themen | Texte | Offen |', '| --- | ---: | ---: | ---: |');

  REVIEW_AREA_ORDER.filter((area) => areas.has(area)).forEach((area) => {
    const topics = areas.get(area);
    const areaRecords = [...topics.values()].flat();
    const open = areaRecords.filter((item) => item.entry.reviewStatus !== 'approved').length;
    lines.push('| [' + markdownMeta(area) + '](#bereich-' + markdownAnchor(area) + ') | ' +
      topics.size + ' | ' + areaRecords.length + ' | ' + open + ' |');
  });
  lines.push('');

  REVIEW_AREA_ORDER.filter((area) => areas.has(area)).forEach((area, areaIndex) => {
    const topics = areas.get(area);
    const areaRecords = [...topics.values()].flat();
    const areaAnchor = markdownAnchor(area);
    lines.push('<a id="bereich-' + areaAnchor + '"></a>', '');
    lines.push('## ' + (areaIndex + 1) + '. ' + markdownMeta(area) + ' (' + areaRecords.length + ' Texte)', '');
    lines.push('Themen in diesem Bereich:', '');
    topics.forEach((topicRecords, topic) => {
      const open = topicRecords.filter((item) => item.entry.reviewStatus !== 'approved').length;
      lines.push('- [' + markdownMeta(topic) + '](#thema-' + areaAnchor + '-' + markdownAnchor(topic) + '): ' +
        topicRecords.length + ' Texte, ' + open + ' offen');
    });
    lines.push('');

    topics.forEach((topicRecords, topic) => {
      lines.push('<a id="thema-' + areaAnchor + '-' + markdownAnchor(topic) + '"></a>', '');
      lines.push('### ' + markdownMeta(topic) + ' (' + topicRecords.length + ' Texte)', '');
      topicRecords.forEach((item) => {
        const entry = item.entry;
        lines.push('#### ' + markdownMeta(item.textFunction + ': ' + item.context), '');
        lines.push('- Seitenelement: ' + markdownMeta(item.section));
        lines.push('- Freigabe durch: ' + markdownMeta(reviewersAsArray(entry.reviewers).join(', ')));
        lines.push('- Freigabestatus: ' + markdownMeta(reviewStatusLabel(entry.reviewStatus)));
        lines.push('- Technische ID: `' + item.id + '`');
        const placeholders = placeholderList(entry);
        const requiredTerms = requiredTermList(entry);
        if (placeholders) lines.push('- Platzhalter: ' + markdownMeta(placeholders));
        if (requiredTerms) lines.push('- Geschützte Begriffe: ' + markdownMeta(requiredTerms));
        if (entry.comment) lines.push('- Prüfhinweis: ' + markdownMeta(entry.comment));
        if (entry.reviewComment) lines.push('- Review-Kommentar: ' + markdownMeta(entry.reviewComment));
        if (localized) {
          lines.push('', '**Deutscher Ausgangstext**', '');
          markdownPreview(item.record.baseRecord.entry.text)
            .split(/\r?\n/)
            .forEach((textLine) => lines.push(markdownQuoteLine(textLine)));
        }
        lines.push('', '**Aktueller Text**', '');
        markdownPreview(entry.text).split(/\r?\n/).forEach((textLine) => lines.push(markdownQuoteLine(textLine)));
        lines.push('');
      });
    });
  });
  return lines.join('\n') + '\n';
}

function exportOverview(options) {
  const opts = options || {};
  const locale = assertSupportedLocale(opts.locale || DEFAULT_LOCALE);
  const outputFile = path.resolve(opts.outputFile || generatedArtifactFiles(Object.assign({}, opts, { locale })).overviewFile);
  const catalog = loadCatalog(Object.assign({}, opts, { locale }));
  const contents = renderReviewOverview(catalog);
  atomicWriteFile(outputFile, contents);
  return {
    outputFile,
    entries: catalog.entries.length,
    sourceHash: computeSourceHash(catalog),
    version: computeSourceVersion(catalog),
    locale,
  };
}

function exportOverviewAll(options) {
  const opts = options || {};
  const results = [];
  SUPPORTED_LOCALES.forEach((locale) => {
    const files = generatedArtifactFiles(Object.assign({}, opts, {
      locale,
      outputFile: undefined,
      overviewFile: undefined,
    }));
    results.push(exportOverview(Object.assign({}, opts, {
      locale,
      outputFile: files.localeOverviewFile,
      overviewFile: undefined,
    })));
    if (locale === DEFAULT_LOCALE) {
      results.push(exportOverview(Object.assign({}, opts, {
        locale,
        outputFile: files.overviewFile,
        overviewFile: undefined,
      })));
    }
  });
  return results;
}

function buildReviewReport(catalog) {
  validateCatalog(catalog);
  const byStatus = {};
  ALLOWED_REVIEW_STATUSES.forEach((status) => { byStatus[status || 'not-set'] = 0; });
  const reviewerIndex = new Map(ALLOWED_REVIEWERS.map((reviewer) => [reviewer, {
    reviewer,
    total: 0,
    approved: 0,
    open: 0,
  }]));
  const openEntries = [];

  sortedRecords(catalog).forEach((record) => {
    const status = record.entry.reviewStatus || '';
    const statusKey = status || 'not-set';
    byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
    const approved = status === 'approved';
    const reviewers = reviewersAsArray(record.entry.reviewers);
    reviewers.forEach((reviewer) => {
      const summary = reviewerIndex.get(reviewer);
      if (!summary) return;
      summary.total++;
      if (approved) summary.approved++;
      else summary.open++;
    });
    if (!approved) {
      openEntries.push({
        id: record.id,
        status: statusKey,
        reviewers,
      });
    }
  });

  const total = catalog.entries.length;
  const approved = byStatus.approved || 0;
  return {
    locale: catalog.locale || DEFAULT_LOCALE,
    total,
    approved,
    open: total - approved,
    byStatus,
    byReviewer: ALLOWED_REVIEWERS.map((reviewer) => reviewerIndex.get(reviewer)),
    openEntries,
    version: computeSourceVersion(catalog),
  };
}

function reviewReport(options) {
  const opts = options || {};
  if (!opts.all) {
    const catalog = loadCatalog(opts);
    return buildReviewReport(catalog);
  }

  const locales = SUPPORTED_LOCALES.map((locale) => {
    const localeOptions = Object.assign({}, opts, { all: false, locale });
    return buildReviewReport(loadCatalog(localeOptions));
  });
  const byStatus = {};
  ALLOWED_REVIEW_STATUSES.forEach((status) => { byStatus[status || 'not-set'] = 0; });
  const byReviewer = ALLOWED_REVIEWERS.map((reviewer) => ({
    reviewer,
    total: 0,
    approved: 0,
    open: 0,
  }));
  const reviewerIndex = new Map(byReviewer.map((summary) => [summary.reviewer, summary]));
  const openEntries = [];

  locales.forEach((report) => {
    Object.keys(report.byStatus).forEach((status) => {
      byStatus[status] = (byStatus[status] || 0) + report.byStatus[status];
    });
    report.byReviewer.forEach((summary) => {
      const aggregate = reviewerIndex.get(summary.reviewer);
      aggregate.total += summary.total;
      aggregate.approved += summary.approved;
      aggregate.open += summary.open;
    });
    report.openEntries.forEach((entry) => {
      openEntries.push(Object.assign({ locale: report.locale }, entry));
    });
  });

  const total = locales.reduce((sum, report) => sum + report.total, 0);
  const approved = locales.reduce((sum, report) => sum + report.approved, 0);
  return {
    all: true,
    locales,
    total,
    approved,
    open: total - approved,
    byStatus,
    byReviewer,
    openEntries,
  };
}

function printReviewReport(report) {
  if (report.all && Array.isArray(report.locales)) {
    console.log('Review-Report alle Sprachen: ' + report.approved + '/' + report.total +
      ' Texte freigegeben; ' + report.open + ' offen.');
    report.locales.forEach((localeReport) => {
      console.log('  - ' + localeReport.locale + ': ' + localeReport.approved + '/' + localeReport.total +
        ' freigegeben; ' + localeReport.open + ' offen; Quellversion ' + localeReport.version);
    });
    console.log('Status gesamt: nicht gesetzt=' + (report.byStatus['not-set'] || 0) +
      ', needs-review=' + (report.byStatus['needs-review'] || 0) +
      ', approved=' + (report.byStatus.approved || 0));
    report.byReviewer.forEach((summary) => {
      console.log('  - ' + summary.reviewer + ': ' + summary.approved + '/' + summary.total +
        ' mit Gesamtstatus approved; ' + summary.open + ' offen');
    });
    if (report.open) {
      console.log('Offene IDs je Sprache: review-report --locale <de-CH|en-CH|fr-CH|it-CH>');
    }
    return;
  }

  console.log('Review-Report ' + report.locale + ': ' + report.approved + '/' + report.total +
    ' Texte freigegeben; ' + report.open + ' offen.');
  console.log('Quellversion: ' + report.version);
  console.log('Status: nicht gesetzt=' + (report.byStatus['not-set'] || 0) +
    ', needs-review=' + (report.byStatus['needs-review'] || 0) +
    ', approved=' + (report.byStatus.approved || 0));
  report.byReviewer.forEach((summary) => {
    console.log('  - ' + summary.reviewer + ': ' + summary.approved + '/' + summary.total +
      ' mit Gesamtstatus approved; ' + summary.open + ' offen');
  });
  const explicit = report.openEntries.filter((entry) => entry.status === 'needs-review');
  if (explicit.length) {
    console.log('Explizit zu pruefen:');
    explicit.forEach((entry) => console.log('  - ' + entry.id + ' [' + entry.reviewers.join(', ') + ']'));
  }
}

function reviewersNeedExpertApproval(reviewers) {
  return reviewersAsArray(reviewers).some((reviewer) => reviewer === 'Medizin' || reviewer === 'Recht');
}

function recordIndex(catalog) {
  const index = new Map();
  catalog.entries.forEach((record) => index.set(record.id, record));
  return index;
}

function cloneCatalog(catalog) {
  const files = catalog.files.map((file) => ({
    name: file.name,
    path: file.path,
    data: cloneJson(file.data),
    overlayData: file.overlayData ? cloneJson(file.overlayData) : undefined,
    baseFile: file.baseFile || null,
  }));
  const clone = makeCatalog(files, catalog.contentDir, {
    locale: catalog.locale,
    isTranslation: catalog.isTranslation,
    baseCatalog: catalog.baseCatalog,
    translationFiles: files,
    staleSourceIds: (catalog.staleSourceIds || []).slice(),
    missingTranslationIds: (catalog.missingTranslationIds || []).slice(),
  });
  if (clone.isTranslation) {
    const baseIndex = recordIndex(catalog.baseCatalog);
    const overlayIndex = new Map();
    files.forEach((file) => {
      (file.overlayData && file.overlayData.entries || []).forEach((entry) => overlayIndex.set(entry.id, entry));
    });
    clone.entries.forEach((record) => {
      record.baseRecord = baseIndex.get(record.id);
      record.translationEntry = overlayIndex.get(record.id);
    });
  }
  return clone;
}

function legacyImmutableCsvValues(record, sourceVersion) {
  return {
    'Quellversion': sourceVersion,
    'Base-Hash pro Zeile': computeRowHash(record),
    'ID': record.id,
    'Bereich': record.entry.section,
    'Ausspielung': record.entry.context,
    'Textart': record.entry.kind,
    'Prüfung durch': reviewersAsArray(record.entry.reviewers).join(', '),
    'Geschützte Elemente': protectedElements(record.entry),
    'Aktueller Text': record.entry.text,
  };
}

function immutableCsvValues(record, sourceVersion) {
  const facet = reviewFacetFor(record);
  const values = {
    'Gesundheitsbereich': facet.area,
    'Thema': facet.topic,
    'Seitenelement': reviewSectionLabel(record.entry.section),
    'Textfunktion': textFunctionLabel(record.entry.kind),
    'Kontext / Variante': reviewContextLabel(record, facet),
    'Aktueller Text': record.entry.text,
    'Freigabe durch': reviewersAsArray(record.entry.reviewers).join(', '),
    'Prüfhinweis': record.entry.comment || '',
    'Platzhalter': placeholderList(record.entry),
    'Geschützte Begriffe': requiredTermList(record.entry),
    'ID (technisch)': record.id,
    'Domain (technisch)': record.domain,
    'Austauschformat (technisch)': record.locale === DEFAULT_LOCALE
      ? CSV_FORMAT_VERSION
      : LOCALIZED_CSV_FORMAT_VERSION,
    'Quellversion (technisch)': sourceVersion,
    'Zeilen-Hash (technisch)': computeRowHash(record),
  };
  if (record.locale !== DEFAULT_LOCALE) {
    values['Deutscher Ausgangstext'] = record.baseRecord.entry.text;
    values['Sprache (technisch)'] = record.locale;
  }
  return values;
}

function isLegacyCsvRow(row) {
  return own(row, 'ID') && !own(row, 'ID (technisch)');
}

function isLocalizedCsvRow(row) {
  return own(row, 'Sprache (technisch)');
}

function csvRowId(row) {
  return isLegacyCsvRow(row) ? row.ID : row['ID (technisch)'];
}

function csvRowSourceVersion(row) {
  return isLegacyCsvRow(row) ? row.Quellversion : row['Quellversion (technisch)'];
}

function csvRowHash(row) {
  return isLegacyCsvRow(row) ? row['Base-Hash pro Zeile'] : row['Zeilen-Hash (technisch)'];
}

function assertExactImportIds(rows, catalog) {
  const seen = new Set();
  const duplicates = [];
  rows.forEach((row) => {
    const id = csvRowId(row);
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  });
  const expected = new Set(catalog.entries.map((record) => record.id));
  const missing = [...expected].filter((id) => !seen.has(id));
  const extra = [...seen].filter((id) => !expected.has(id));
  if (duplicates.length || missing.length || extra.length) {
    const details = [];
    if (duplicates.length) details.push('Doppelte IDs: ' + [...new Set(duplicates)].join(', '));
    if (missing.length) details.push('Fehlende IDs: ' + missing.join(', '));
    if (extra.length) details.push('Unbekannte IDs: ' + extra.join(', '));
    throw new ContentWorkflowError('CSV enthaelt nicht exakt den aktuellen Content-Katalog.', details);
  }
}

function validateReplacementText(newText, entry, id, structuralEntry) {
  const errors = [];
  validateTextAgainstEntry(newText, entry, 'CSV:' + id + ':Neuer Text', errors);

  // Multimenge vergleichen: Auch die Anzahl wiederholter Platzhalter ist Teil
  // des Vertrags. Die reine Namensmenge waere hier zu schwach.
  const before = placeholderOccurrences(entry.text);
  const after = placeholderOccurrences(newText);
  if (before.join('|') !== after.join('|')) {
    errors.push(
      'CSV:' + id + ': Platzhalter muessen unveraendert bleiben. Erwartet: ' +
      (before.length ? before.map((name) => '{{' + name + '}}').join(', ') : '(keine)') +
      '; gefunden: ' + (after.length ? after.map((name) => '{{' + name + '}}').join(', ') : '(keine)') + '.'
    );
  }
  if (structuralEntry) {
    const expectedTags = htmlTagOccurrences(structuralEntry.text);
    const actualTags = htmlTagOccurrences(newText);
    if (expectedTags.join('|') !== actualTags.join('|')) {
      errors.push('CSV:' + id + ': HTML-Tags muessen dem deutschen Ausgangstext entsprechen.');
    }
  }
  if (errors.length) throw new ContentWorkflowError('Neuer Text fuer "' + id + '" ist ungueltig.', errors);
}

function planImport(csvText, catalog, options) {
  const opts = options || {};
  validateCatalog(catalog);
  const rows = csvObjectsFromText(csvText);
  assertExactImportIds(rows, catalog);

  const formatValues = [...new Set(rows.map((row) =>
    isLegacyCsvRow(row) ? '1' : row['Austauschformat (technisch)']
  ))];
  if (formatValues.length !== 1 || !['1', CSV_FORMAT_VERSION, LOCALIZED_CSV_FORMAT_VERSION].includes(formatValues[0])) {
    throw new ContentWorkflowError(
      'CSV enthaelt mehrere oder unbekannte Austauschformat-Versionen. Erwartet: ' +
      CSV_FORMAT_VERSION + ', ' + LOCALIZED_CSV_FORMAT_VERSION + ' oder Legacy-Format 1.'
    );
  }
  const csvFormat = formatValues[0];
  const localizedRows = rows.filter(isLocalizedCsvRow);
  if (catalog.locale === DEFAULT_LOCALE && csvFormat === LOCALIZED_CSV_FORMAT_VERSION) {
    throw new ContentWorkflowError('Uebersetzungs-CSV kann nicht in den deutschen Katalog importiert werden.');
  }
  if (catalog.locale !== DEFAULT_LOCALE && csvFormat !== LOCALIZED_CSV_FORMAT_VERSION) {
    throw new ContentWorkflowError('Legacy- und DE-CSV-Formate duerfen nur in de-CH importiert werden.');
  }
  if (csvFormat === LOCALIZED_CSV_FORMAT_VERSION) {
    const rowLocales = [...new Set(localizedRows.map((row) => row['Sprache (technisch)']))];
    if (localizedRows.length !== rows.length || rowLocales.length !== 1 || rowLocales[0] !== catalog.locale) {
      throw new ContentWorkflowError(
        'CSV-Sprache ist gemischt oder passt nicht zum Zielkatalog ' + catalog.locale + '.'
      );
    }
  }

  const versions = [...new Set(rows.map(csvRowSourceVersion))];
  if (versions.length !== 1) {
    throw new ContentWorkflowError('CSV enthaelt mehrere oder keine Quellversionen.');
  }

  const currentVersion = computeSourceVersion(catalog);
  const importedVersion = versions[0];
  const stale = importedVersion !== currentVersion;
  if (stale && !opts.allowStale) {
    throw new ContentWorkflowError(
      'CSV basiert auf einer veralteten Quellversion (' + importedVersion + '). ' +
      'Exportieren Sie neu oder pruefen Sie bewusst mit --allow-stale zeilenweise weiter.'
    );
  }

  const currentIndex = recordIndex(catalog);
  const nextCatalog = cloneCatalog(catalog);
  const nextIndex = recordIndex(nextCatalog);
  const changes = [];
  const commentChanges = [];
  const statusChanges = [];
  const conflicts = [];
  const immutableEdits = [];

  rows.forEach((row) => {
    const id = csvRowId(row);
    const legacy = isLegacyCsvRow(row);
    const current = currentIndex.get(id);
    const next = nextIndex.get(id);
    const replacement = row['Neuer Text'];
    const hasTextChange = replacement !== '' && replacement !== current.entry.text;
    const translationWasMissing = !!(
      current.translationEntry && current.translationEntry.translationState === 'missing'
    );
    // Falls eine Bezeichnung sprachunabhängig wirklich identisch bleiben soll
    // (z. B. ein Markenname), bestätigt ein bewusst in "Neuer Text" kopierter
    // identischer Wert die Übersetzung. Ein bloss geänderter Freigabestatus darf
    // dagegen nie ein noch deutsches Skeleton unbemerkt als übersetzt markieren.
    const hasTranslationConfirmation = !!(
      translationWasMissing && replacement !== '' && replacement === current.entry.text
    );
    const hasTextUpdate = hasTextChange || hasTranslationConfirmation;
    const currentComment = current.entry.reviewComment || '';
    // In Format 1 enthielt die Spalte "Marketing-Kommentar" gleichzeitig den
    // bestehenden Prüfhinweis. Ein unveränderter Wert bleibt deshalb ein
    // Prüfhinweis; nur eine tatsächliche Abweichung wird als Review-Kommentar
    // übernommen. Der fachliche Ausgangshinweis wird nie überschrieben.
    const legacyComment = legacy ? row['Marketing-Kommentar'] : '';
    const importedComment = legacy
      ? (legacyComment === (current.entry.comment || '') ? currentComment : legacyComment)
      : row['Review-Kommentar'];
    const hasCommentChange = importedComment !== currentComment;
    const importedReviewStatus = legacy
      ? row['Review-Status']
      : reviewStatusFromLabel(row['Freigabestatus'], id);
    if (legacy && !ALLOWED_REVIEW_STATUSES.includes(importedReviewStatus)) {
      throw new ContentWorkflowError(
        'CSV:' + id + ': unbekannter Review-Status "' + importedReviewStatus + '".'
      );
    }
    const currentReviewStatus = current.entry.reviewStatus || '';
    const hasRequestedStatusChange = importedReviewStatus !== currentReviewStatus;
    const wantsChange = hasTextUpdate || hasCommentChange || hasRequestedStatusChange;
    const currentRowHash = computeRowHash(current);

    // Bei einer aktuellen Quellversion muss jede Zeile unverändert auf ihrer
    // ausgewiesenen Basis stehen, auch wenn keine Bearbeitung angefordert ist.
    // Nur ein bewusst zugelassener veralteter Export darf inzwischen geänderte,
    // unberührte Zeilen überspringen; bearbeitete Zeilen bleiben immer strikt.
    if (csvRowHash(row) !== currentRowHash && (!stale || wantsChange)) {
      conflicts.push(id);
      return;
    }

    // Bei gleicher Zeilenbasis duerfen die Review-Stellen ausschliesslich die
    // drei vorgesehenen Bearbeitungsspalten veraendern.
    if (csvRowHash(row) === currentRowHash) {
      const expectedValues = legacy
        ? legacyImmutableCsvValues(current, importedVersion)
        : immutableCsvValues(current, importedVersion);
      Object.keys(expectedValues).forEach((column) => {
        if (column === 'Quellversion' || column === 'Quellversion (technisch)') return;
        if (row[column] !== expectedValues[column]) immutableEdits.push(id + ' / ' + column);
      });
    }

    if (translationWasMissing && hasRequestedStatusChange && !hasTextUpdate) {
      throw new ContentWorkflowError(
        'CSV:' + id + ': eine fehlende Übersetzung kann nicht allein über den Freigabestatus bestätigt werden. ' +
        'Tragen Sie die Übersetzung unter "Neuer Text" ein; bei absichtlich identischem Text kopieren Sie ihn dort bewusst ein.'
      );
    }

    if (hasTextUpdate) {
      validateReplacementText(
        replacement,
        current.entry,
        id,
        current.baseRecord ? current.baseRecord.entry : null
      );
      next.entry.text = replacement;
      if (next.translationEntry) next.translationEntry.text = replacement;
      let reviewReset = false;
      if (reviewersNeedExpertApproval(next.entry.reviewers)) {
        next.entry.reviewStatus = 'needs-review';
        if (next.translationEntry) next.translationEntry.reviewStatus = 'needs-review';
        reviewReset = currentReviewStatus !== 'needs-review';
      } else {
        next.entry.reviewStatus = importedReviewStatus;
        if (next.translationEntry) next.translationEntry.reviewStatus = importedReviewStatus;
      }
      changes.push({
        id,
        oldText: current.entry.text,
        newText: replacement,
        translationConfirmed: hasTranslationConfirmation,
        reviewReset,
        previousReviewStatus: currentReviewStatus,
        nextReviewStatus: next.entry.reviewStatus || '',
      });
    } else if (hasRequestedStatusChange) {
      next.entry.reviewStatus = importedReviewStatus;
      if (next.translationEntry) next.translationEntry.reviewStatus = importedReviewStatus;
    }

    if (hasCommentChange) {
      next.entry.reviewComment = importedComment;
      if (next.translationEntry) next.translationEntry.reviewComment = importedComment;
      commentChanges.push({ id, oldComment: currentComment, newComment: importedComment });
    }

    if (next.translationEntry && hasTextUpdate) {
      next.translationEntry.translationState = 'translated';
      next.translationEntry.sourceContractHash = computeTranslationSourceContractHash(current.baseRecord);
      nextCatalog.staleSourceIds = nextCatalog.staleSourceIds.filter((staleId) => staleId !== id);
      nextCatalog.missingTranslationIds = nextCatalog.missingTranslationIds.filter((missingId) => missingId !== id);
    } else if (next.translationEntry && hasRequestedStatusChange) {
      // Bei einer bereits vorhandenen Übersetzung kann der Review eine nach
      // deutschem Quelldrift weiterhin passende Fassung ohne Wortänderung
      // bestätigen. Missing-Skelette werden oben ausdrücklich abgewiesen.
      next.translationEntry.sourceContractHash = computeTranslationSourceContractHash(current.baseRecord);
      nextCatalog.staleSourceIds = nextCatalog.staleSourceIds.filter((staleId) => staleId !== id);
    }

    const nextReviewStatus = next.entry.reviewStatus || '';
    if (nextReviewStatus !== currentReviewStatus) {
      statusChanges.push({ id, oldStatus: currentReviewStatus, newStatus: nextReviewStatus });
    }
  });

  if (immutableEdits.length) {
    throw new ContentWorkflowError(
      'Schreibgeschuetzte CSV-Spalten wurden veraendert.',
      immutableEdits.map((value) => value)
    );
  }
  if (conflicts.length) {
    throw new ContentWorkflowError(
      'Zeilenkonflikt: Die Basis dieser bearbeiteten Texte hat sich seit dem Export geaendert.',
      conflicts
    );
  }

  validateCatalog(nextCatalog);
  return {
    stale,
    csvFormat,
    importedVersion,
    currentVersion,
    changes,
    commentChanges,
    statusChanges,
    nextCatalog,
  };
}

function jsonFileContents(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function backupRootFor(options) {
  const opts = options || {};
  if (opts.backupRoot) return path.resolve(opts.backupRoot);
  const contentDir = path.resolve(opts.contentDir || DEFAULT_CONTENT_DIR);
  const root = path.dirname(path.dirname(contentDir));
  return path.join(root, 'exports', 'import-backups');
}

/** Sichert den vorherigen Katalogstand, ohne frühere Sicherungen zu überschreiben. */
function createImportBackup(plan, options) {
  const opts = options || {};
  const artifactFiles = generatedArtifactFiles(opts);
  const generatedFile = artifactFiles.generatedFile;
  const createdAt = opts.now instanceof Date ? opts.now : new Date();
  const stamp = createdAt.toISOString().replace(/[:.]/g, '-');
  const backupRoot = backupRootFor(opts);
  const backupLocaleRoot = path.join(backupRoot, plan.nextCatalog.locale || DEFAULT_LOCALE);
  let backupDir = path.join(backupLocaleRoot, stamp);
  let suffix = 1;
  while (fs.existsSync(backupDir)) backupDir = path.join(backupLocaleRoot, stamp + '-' + suffix++);
  fs.mkdirSync(backupDir, { recursive: true });

  const files = [];
  function saveFile(source, relativeTarget) {
    if (!fs.existsSync(source)) return;
    const target = path.join(backupDir, relativeTarget);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    files.push({ path: relativeTarget.split(path.sep).join('/'), sha256: fileHash(target) });
  }

  plan.nextCatalog.files.forEach((file) => {
    saveFile(file.path, plan.nextCatalog.locale === DEFAULT_LOCALE
      ? path.join('content', 'result-texts', file.name)
      : path.join('content', 'result-texts', 'locales', plan.nextCatalog.locale, file.name));
  });
  saveFile(generatedFile, path.join('js', path.basename(generatedFile)));
  saveFile(artifactFiles.exportFile, path.join('exports', path.basename(artifactFiles.exportFile)));
  saveFile(artifactFiles.overviewFile, path.join('exports', path.basename(artifactFiles.overviewFile)));
  if (managesManifests(opts)) {
    saveFile(artifactFiles.manifestFile, path.basename(artifactFiles.manifestFile));
    if ((plan.nextCatalog.locale || DEFAULT_LOCALE) === DEFAULT_LOCALE) {
      saveFile(artifactFiles.legacyManifestFile, path.basename(artifactFiles.legacyManifestFile));
    }
  }

  const manifest = {
    schemaVersion: 1,
    type: 'result-content-import-backup',
    createdAt: createdAt.toISOString(),
    inputFile: opts.inputFile ? path.basename(opts.inputFile) : null,
    locale: plan.nextCatalog.locale || DEFAULT_LOCALE,
    sourceVersion: plan.currentVersion,
    targetVersion: computeSourceVersion(plan.nextCatalog),
    changes: {
      texts: plan.changes.map((change) => change.id),
      comments: plan.commentChanges.map((change) => change.id),
      reviewStatuses: plan.statusChanges.map((change) => change.id),
      reviewResets: plan.changes.filter((change) => change.reviewReset).map((change) => change.id),
    },
    files,
  };
  const manifestFile = path.join(backupDir, 'manifest.json');
  atomicWriteFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  return { backupDir, manifestFile, manifest };
}

/**
 * Schreibt einen zusammengehörigen Mehrdateiensatz mit automatischem Rollback.
 * `atomicWriteFile()` schützt weiterhin jede einzelne Datei vor Teilinhalten;
 * dieser zweite Schutz stellt bei einem späteren Schreibfehler zusätzlich alle
 * bereits ersetzten Ziele auf ihren vorherigen Stand zurück.
 */
function transactionalWriteFiles(targets, options) {
  const opts = options || {};
  const writer = typeof opts.transactionWriter === 'function'
    ? opts.transactionWriter
    : atomicWriteFile;
  const originals = targets.map((target) => ({
    file: target.file,
    existed: fs.existsSync(target.file),
    contents: fs.existsSync(target.file) ? fs.readFileSync(target.file, 'utf8') : null,
  }));
  const attempted = [];

  try {
    targets.forEach((target, index) => {
      attempted.push(originals[index]);
      writer(target.file, target.contents, index);
    });
  } catch (writeError) {
    const rollbackErrors = [];
    attempted.reverse().forEach((original) => {
      try {
        if (original.existed) atomicWriteFile(original.file, original.contents);
        else if (fs.existsSync(original.file)) fs.unlinkSync(original.file);
      } catch (rollbackError) {
        rollbackErrors.push(original.file + ': ' + rollbackError.message);
      }
    });
    const details = ['Schreibfehler: ' + (writeError && writeError.message ? writeError.message : String(writeError))];
    if (rollbackErrors.length) {
      details.push('Rollback unvollständig: ' + rollbackErrors.join(' | '));
      throw new ContentWorkflowError(
        'Import fehlgeschlagen; der automatische Rollback war nicht vollständig. Importsicherung manuell wiederherstellen.',
        details
      );
    }
    throw new ContentWorkflowError(
      'Import fehlgeschlagen; der vorherige Mehrdateienstand wurde automatisch wiederhergestellt.',
      details
    );
  }
}

function persistImport(plan, options) {
  const opts = options || {};
  const locale = plan.nextCatalog.locale || DEFAULT_LOCALE;
  const artifactFiles = generatedArtifactFiles(Object.assign({}, opts, { locale }));
  const generatedFile = artifactFiles.generatedFile;
  const changedFiles = [];
  const writes = [];
  const hasChanges = !!(plan.changes.length || plan.commentChanges.length || plan.statusChanges.length);
  const backup = hasChanges ? createImportBackup(plan, Object.assign({}, opts, { generatedFile })) : null;

  plan.nextCatalog.files.forEach((file) => {
    const nextContents = jsonFileContents(file.overlayData || file.data);
    const currentContents = fs.existsSync(file.path) ? fs.readFileSync(file.path, 'utf8') : '';
    if (nextContents !== currentContents) {
      writes.push({ file: file.path, contents: nextContents });
      changedFiles.push(file.path);
    }
  });

  if (hasChanges) {
    const rebuildAll = !!opts.all || !opts.contentDir;
    if (rebuildAll) {
      const catalogs = SUPPORTED_LOCALES.map((catalogLocale) => catalogLocale === locale
        ? plan.nextCatalog
        : loadCatalog(Object.assign({}, opts, { locale: catalogLocale })));
      const registry = buildBundleRegistry(catalogs, { allowIncomplete: true });
      writes.push({ file: generatedFile, contents: renderGeneratedRegistry(registry) });
      catalogs.forEach((catalog) => {
        const files = generatedArtifactFiles(Object.assign({}, opts, {
          locale: catalog.locale,
          exportFile: undefined,
          overviewFile: undefined,
        }));
        writes.push({ file: files.exportFile, contents: exportCsvText(catalog) });
        writes.push({ file: files.localeOverviewFile, contents: renderReviewOverview(catalog) });
        if (catalog.locale === DEFAULT_LOCALE) {
          writes.push({ file: files.overviewFile, contents: renderReviewOverview(catalog) });
        }
      });
      writes.push(...manifestTargets(catalogs, opts));
    } else {
      const bundle = buildBundle(plan.nextCatalog);
      writes.push(
        { file: generatedFile, contents: renderGenerated(bundle) },
        { file: artifactFiles.exportFile, contents: exportCsvText(plan.nextCatalog) },
        { file: artifactFiles.overviewFile, contents: renderReviewOverview(plan.nextCatalog) }
      );
      writes.push(...manifestTargets([plan.nextCatalog], opts));
    }
  }
  transactionalWriteFiles(writes, opts);
  return {
    changedFiles,
    generatedFile,
    exportFile: artifactFiles.exportFile,
    overviewFile: artifactFiles.overviewFile,
    backupDir: backup ? backup.backupDir : null,
    backupManifestFile: backup ? backup.manifestFile : null,
  };
}

function importCsv(options) {
  const opts = options || {};
  if (!opts.inputFile) throw new ContentWorkflowError('Import benoetigt den Pfad zu einer CSV-Datei.');
  const inputFile = path.resolve(opts.inputFile);
  if (!fs.existsSync(inputFile)) throw new ContentWorkflowError('CSV-Datei fehlt: ' + inputFile);

  const csvText = fs.readFileSync(inputFile, 'utf8');
  const previewRows = csvObjectsFromText(csvText);
  const localized = previewRows.length && previewRows.every(isLocalizedCsvRow);
  const detectedLocales = localized
    ? [...new Set(previewRows.map((row) => row['Sprache (technisch)']))]
    : [DEFAULT_LOCALE];
  if (detectedLocales.length !== 1) {
    throw new ContentWorkflowError('CSV enthaelt mehrere oder keine Sprachen.');
  }
  const locale = assertSupportedLocale(detectedLocales[0]);
  if (opts.locale && opts.locale !== locale) {
    throw new ContentWorkflowError('CSV-Sprache ' + locale + ' passt nicht zu --locale ' + opts.locale + '.');
  }
  const catalog = loadCatalog(Object.assign({}, opts, { locale }));
  validateCatalog(catalog);
  const plan = planImport(csvText, catalog, { allowStale: !!opts.allowStale });
  const persisted = opts.dryRun
    ? { changedFiles: [], generatedFile: null }
    : persistImport(plan, Object.assign({}, opts, { locale }));
  return Object.assign({}, plan, persisted, {
    inputFile,
    locale,
    dryRun: !!opts.dryRun,
  });
}

/**
 * Erzeugt oder ergaenzt schlanke Uebersetzungs-Overlays deterministisch.
 * Bestehende Eintraege werden nie inhaltlich ueberschrieben. Neue Platzhalter
 * tragen translationState=missing und blockieren damit validate/build/check.
 */
function syncLocales(options) {
  const opts = options || {};
  const locales = opts.locale
    ? [assertSupportedLocale(opts.locale)]
    : SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
  if (locales.includes(DEFAULT_LOCALE)) {
    throw new ContentWorkflowError('sync-locales ist nur fuer Uebersetzungssprachen vorgesehen.');
  }
  const baseCatalog = loadBaseCatalog(opts);
  validateCatalog(baseCatalog);
  const results = [];

  locales.forEach((locale) => {
    const localeDir = path.join(baseCatalog.contentDir, 'locales', locale);
    let added = 0;
    let migrated = 0;
    const changedFiles = [];
    baseCatalog.files.forEach((baseFile) => {
      const filePath = path.join(localeDir, baseFile.name);
      let overlay = {
        schemaVersion: SCHEMA_VERSION,
        locale,
        domain: baseFile.data.domain,
        entries: [],
      };
      if (fs.existsSync(filePath)) {
        overlay = readJsonFile(filePath, path.join('locales', locale, baseFile.name));
        if (!isPlainObject(overlay) || overlay.locale !== locale || overlay.domain !== baseFile.data.domain ||
            !Array.isArray(overlay.entries)) {
          throw new ContentWorkflowError(filePath + ': bestehendes Overlay hat einen ungueltigen Datei-Vertrag.');
        }
      }
      const existing = new Map();
      overlay.entries.forEach((entry) => {
        if (entry && typeof entry.id === 'string') existing.set(entry.id, entry);
      });
      const baseIds = new Set(baseFile.data.entries.map((entry) => entry.id));
      const extra = [...existing.keys()].filter((id) => !baseIds.has(id));
      if (extra.length) {
        throw new ContentWorkflowError(
          filePath + ': unbekannte Overlay-IDs werden aus Sicherheitsgruenden nicht automatisch entfernt.',
          extra
        );
      }
      const nextEntries = baseFile.data.entries.map((baseEntry) => {
        const baseRecord = { id: baseEntry.id, domain: baseFile.data.domain, entry: baseEntry };
        if (existing.has(baseEntry.id)) {
          const current = existing.get(baseEntry.id);
          if (current.sourceContractHash === legacyTranslationSourceContractHash(baseRecord)) {
            migrated++;
            return Object.assign({}, current, {
              sourceContractHash: computeTranslationSourceContractHash(baseRecord),
            });
          }
          return current;
        }
        added++;
        return {
          id: baseEntry.id,
          text: baseEntry.text,
          requiredTerms: [],
          reviewStatus: 'needs-review',
          translationState: 'missing',
          reviewComment: '',
          sourceContractHash: computeTranslationSourceContractHash(baseRecord),
        };
      });
      const nextOverlay = {
        schemaVersion: SCHEMA_VERSION,
        locale,
        domain: baseFile.data.domain,
        entries: nextEntries,
      };
      const contents = jsonFileContents(nextOverlay);
      const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
      if (current !== contents) {
        atomicWriteFile(filePath, contents);
        changedFiles.push(filePath);
      }
    });
    results.push({ locale, added, migrated, changedFiles });
  });
  return results;
}

function usage() {
  return [
    'Result-Content-Workflow',
    '',
    'Befehle:',
    '  node scripts/result-content.js validate [--locale de-CH|en-CH|fr-CH|it-CH]',
    '  node scripts/result-content.js check',
    '  node scripts/result-content.js build',
    '  node scripts/result-content.js export [ausgabe.csv] [--locale ...|--all]',
    '  node scripts/result-content.js overview [ausgabe.md] [--locale ...|--all]',
    '  node scripts/result-content.js review-report [--locale ...|--all] [--fail-on-open]',
    '  node scripts/result-content.js import <review.csv> [--locale ...] [--dry-run] [--allow-stale]',
    '  node scripts/result-content.js sync-locales [--locale en-CH|fr-CH|it-CH]',
    '',
    'build/check sind absichtlich gemeinsame Vier-Sprachen-Gates.',
    'validate kann mit --locale gezielt nur eine Sprache pruefen.',
    'export/overview bleiben ohne Sprachoption rueckwaertskompatibel bei de-CH.',
    '',
    'Optionen fuer import:',
    '  --dry-run       Nur pruefen und Diff anzeigen; keine Dateien schreiben.',
    '  --allow-stale   Veraltete Quellversion zulassen; bearbeitete Zeilen werden',
    '                  weiterhin strikt ueber ihren Base-Hash geschuetzt.',
    '',
    'Optionen fuer review-report:',
    '  --all           Alle vier Sprachen zusammenfassen und gemeinsam gaten.',
    '  --fail-on-open  Exit-Code 1, solange mindestens ein Text nicht approved ist.',
  ].join('\n');
}

function parseLocaleFlags(args) {
  const rest = [];
  let locale = null;
  let all = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--locale') {
      if (locale || index + 1 >= args.length) {
        throw new ContentWorkflowError('--locale erwartet genau einen Sprachcode.');
      }
      locale = assertSupportedLocale(args[++index]);
    } else if (arg === '--all') {
      all = true;
    } else {
      rest.push(arg);
    }
  }
  if (locale && all) throw new ContentWorkflowError('--locale und --all koennen nicht kombiniert werden.');
  return { locale, all, rest };
}

function printError(error) {
  console.error('Fehler: ' + error.message);
  (error.details || []).forEach((detail) => console.error('  - ' + detail));
}

function printImportResult(result) {
  const mode = result.dryRun ? 'Dry Run' : 'Import';
  console.log(mode + ': ' + result.changes.length + ' Text-/Uebersetzungsaktualisierung(en), ' +
    result.commentChanges.length + ' Kommentaraenderung(en), ' +
    result.statusChanges.length + ' Statusaenderung(en).');
  if (result.stale) console.log('Hinweis: veralteter Export wurde zeilenweise per Base-Hash geprueft.');
  result.changes.forEach((change) => {
    console.log('  - ' + change.id +
      (change.translationConfirmed ? ' [identische Uebersetzung bestaetigt]' : '') +
      (change.reviewReset ? ' [fachliche Freigabe zurueckgesetzt]' : ''));
  });
  result.commentChanges
    .filter((change) => !result.changes.some((textChange) => textChange.id === change.id))
    .forEach((change) => console.log('  - ' + change.id + ' [Review-Kommentar]'));
  result.statusChanges
    .filter((change) => !result.changes.some((textChange) => textChange.id === change.id))
    .forEach((change) => console.log('  - ' + change.id + ' [Freigabestatus: ' + reviewStatusLabel(change.newStatus) + ']'));
  if (result.dryRun) console.log('Keine Dateien wurden geschrieben.');
  else if (!result.changes.length && !result.commentChanges.length && !result.statusChanges.length) console.log('No-op: keine Dateien wurden veraendert.');
  else {
    console.log('Kanonische JSON-Dateien, Runtime-Bundle, CSV, Review-Uebersicht und App-Manifest wurden aktualisiert.');
    if (result.backupDir) console.log('Sicherung des vorherigen Stands: ' + result.backupDir);
  }
}

function runCli(argv) {
  const args = (argv || process.argv.slice(2)).slice();
  const command = args.shift();
  if (!command || command === '-h' || command === '--help' || command === 'help') {
    console.log(usage());
    return 0;
  }

  if (command === 'validate') {
    const parsed = parseLocaleFlags(args);
    if (parsed.all || parsed.rest.length) throw new ContentWorkflowError('validate akzeptiert nur --locale.');
    const result = validate(parsed.locale ? { locale: parsed.locale } : { all: true });
    const summaries = result.locales || [result];
    summaries.forEach((summary) => {
      console.log('OK ' + summary.locale + ': ' + summary.entries + ' Texte in ' + summary.domains + ' Domain(s) sind valide.');
      console.log('Quellversion: ' + summary.version);
    });
    return 0;
  }

  if (command === 'check') {
    const parsed = parseLocaleFlags(args);
    if (parsed.locale || parsed.all || parsed.rest.length) throw new ContentWorkflowError('check akzeptiert keine Optionen und prueft immer alle vier Sprachen.');
    const result = checkGenerated({ all: true });
    console.log('OK: Runtime-Bundle, CSV, Review-Uebersicht und App-Manifeste sind aktuell (' +
      result.entries + ' Texte, ' + result.sourceHash + ').');
    return 0;
  }

  if (command === 'build') {
    const parsed = parseLocaleFlags(args);
    if (parsed.locale || parsed.all || parsed.rest.length) throw new ContentWorkflowError('build akzeptiert keine Optionen und erzeugt immer das gemeinsame Vier-Sprachen-Bundle.');
    const result = buildGenerated({ all: true });
    console.log('Erstellt: ' + result.generatedFile);
    (result.manifestFiles || []).forEach((file) => console.log('Erstellt: ' + file));
    console.log(result.entries + ' Texte, Quellversion ' + result.version);
    return 0;
  }

  if (command === 'export') {
    const parsed = parseLocaleFlags(args);
    const unknown = parsed.rest.filter((arg) => arg.startsWith('--'));
    const positional = parsed.rest.filter((arg) => !arg.startsWith('--'));
    if (unknown.length || positional.length > 1 || parsed.all && positional.length) {
      throw new ContentWorkflowError('export: ungueltige Optionen oder Ausgabedatei.');
    }
    if (parsed.all) {
      exportCsvAll({});
      console.log('Exportiert: ' + SUPPORTED_LOCALES.join(', '));
      return 0;
    }
    const result = exportCsv({ locale: parsed.locale || DEFAULT_LOCALE, outputFile: positional[0] });
    console.log('Exportiert: ' + result.outputFile);
    console.log(result.entries + ' Texte, Quellversion ' + result.version);
    return 0;
  }

  if (command === 'overview') {
    const parsed = parseLocaleFlags(args);
    const unknown = parsed.rest.filter((arg) => arg.startsWith('--'));
    const positional = parsed.rest.filter((arg) => !arg.startsWith('--'));
    if (unknown.length || positional.length > 1 || parsed.all && positional.length) {
      throw new ContentWorkflowError('overview: ungueltige Optionen oder Ausgabedatei.');
    }
    if (parsed.all) {
      exportOverviewAll({});
      console.log('Review-Uebersichten exportiert: ' + SUPPORTED_LOCALES.join(', '));
      return 0;
    }
    const result = exportOverview({ locale: parsed.locale || DEFAULT_LOCALE, outputFile: positional[0] });
    console.log('Review-Uebersicht exportiert: ' + result.outputFile);
    console.log(result.entries + ' Texte, Quellversion ' + result.version);
    return 0;
  }

  if (command === 'review-report') {
    const parsed = parseLocaleFlags(args);
    const unknownOptions = parsed.rest.filter((arg) => arg.startsWith('--') && arg !== '--fail-on-open');
    const positional = parsed.rest.filter((arg) => !arg.startsWith('--'));
    if (unknownOptions.length) throw new ContentWorkflowError('Unbekannte Option(en): ' + unknownOptions.join(', '));
    if (positional.length) throw new ContentWorkflowError('review-report erwartet keine Datei.\n\n' + usage());
    const result = reviewReport(parsed.all ? { all: true } : { locale: parsed.locale || DEFAULT_LOCALE });
    printReviewReport(result);
    return parsed.rest.includes('--fail-on-open') && result.open > 0 ? 1 : 0;
  }

  if (command === 'import') {
    const parsed = parseLocaleFlags(args);
    if (parsed.all) throw new ContentWorkflowError('import akzeptiert --all nicht.');
    const dryRun = parsed.rest.includes('--dry-run');
    const allowStale = parsed.rest.includes('--allow-stale');
    const unknownOptions = parsed.rest.filter((arg) => arg.startsWith('--') && !['--dry-run', '--allow-stale'].includes(arg));
    if (unknownOptions.length) throw new ContentWorkflowError('Unbekannte Option(en): ' + unknownOptions.join(', '));
    const positional = parsed.rest.filter((arg) => !arg.startsWith('--'));
    if (positional.length !== 1) throw new ContentWorkflowError('Import erwartet genau eine CSV-Datei.\n\n' + usage());
    const result = importCsv({ inputFile: positional[0], locale: parsed.locale || undefined, dryRun, allowStale });
    printImportResult(result);
    return 0;
  }

  if (command === 'sync-locales' || command === 'init-locales') {
    const parsed = parseLocaleFlags(args);
    if (parsed.all || parsed.rest.length) throw new ContentWorkflowError('sync-locales akzeptiert nur --locale.');
    const results = syncLocales(parsed.locale ? { locale: parsed.locale } : {});
    results.forEach((result) => console.log(
      result.locale + ': ' + result.added + ' Platzhalter ergaenzt, ' + result.migrated +
      ' Vertrags-Hash(es) migriert, ' + result.changedFiles.length + ' Datei(en) aktualisiert.'
    ));
    return 0;
  }

  throw new ContentWorkflowError('Unbekannter Befehl "' + command + '".\n\n' + usage());
}

module.exports = {
  PROJECT_ROOT,
  DEFAULT_CONTENT_DIR,
  DEFAULT_GENERATED_FILE,
  DEFAULT_EXPORT_FILE,
  DEFAULT_OVERVIEW_FILE,
  DEFAULT_BACKUP_ROOT,
  SCHEMA_VERSION,
  DEFAULT_LOCALE,
  LOCALE,
  SUPPORTED_LOCALES,
  MANIFEST_COPY_IDS,
  CSV_FORMAT_VERSION,
  LOCALIZED_CSV_FORMAT_VERSION,
  ALLOWED_REVIEWERS,
  ALLOWED_REVIEW_STATUSES,
  FIELD_LIMITS,
  CSV_COLUMNS,
  LOCALIZED_CSV_COLUMNS,
  LEGACY_CSV_COLUMNS,
  ContentWorkflowError,
  stableStringify,
  sha256,
  placeholderNames,
  htmlTagOccurrences,
  validateAllowedHtml,
  validate,
  validateCatalog,
  loadCatalog,
  loadBaseCatalog,
  loadCatalogs,
  computeTranslationSourceContractHash,
  computeSourceHash,
  computeSourceVersion,
  computeRowHash,
  buildBundle,
  buildBundleRegistry,
  renderGenerated,
  renderGeneratedRegistry,
  renderWebManifest,
  buildGenerated,
  checkGenerated,
  protectSpreadsheetCell,
  unprotectSpreadsheetCell,
  serializeCsv,
  parseCsv,
  csvRowsToObjects,
  csvObjectsFromText,
  buildReviewRecords,
  catalogToCsvRows,
  exportCsvText,
  exportCsv,
  exportCsvAll,
  renderReviewOverview,
  exportOverview,
  exportOverviewAll,
  buildReviewReport,
  reviewReport,
  planImport,
  createImportBackup,
  transactionalWriteFiles,
  persistImport,
  importCsv,
  syncLocales,
  check: checkGenerated,
  build: buildGenerated,
  export: exportCsv,
  import: importCsv,
  runCli,
};

if (require.main === module) {
  try {
    const exitCode = runCli(process.argv.slice(2));
    if (exitCode) process.exitCode = exitCode;
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
