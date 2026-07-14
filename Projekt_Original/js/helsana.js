/*
 * helsana.js
 * ---------------------------------------------------------------------------
 * Zentrale Sammelstelle für Helsana Angebote, Services und Ratgeberinhalte.
 *
 * >> SO WERDEN ECHTE LINKS HINTERLEGT <<
 * Pro Eintrag `href` durch die freigegebene Helsana-URL ersetzen. Label,
 * Platzhalter und Fit-Texte werden im zentralen Content-Katalog gepflegt.
 * Jede fehlende oder nicht sichere absolute HTTPS-URL bleibt in der Oberfläche
 * ein nicht klickbarer Platzhalter.
 *
 * Die Verlinkung soll hilfreich und situationsbezogen wirken – nicht werblich.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

const urlSafety = window.HealthUrlSafety;
if (!urlSafety || typeof urlSafety.safeHttps !== 'function') {
  throw new Error('HelsanaOffers: js/url-safety.js ist nicht initialisiert.');
}

const HELSANA_OFFERS = {
  bewegung: {
    label: window.ResultCopy.get('service.offer.bewegung.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.bewegung.placeholder'),
    fit: window.ResultCopy.get('service.offer.bewegung.fit'),
  },
  kraft: {
    label: window.ResultCopy.get('service.offer.kraft.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.kraft.placeholder'),
    fit: window.ResultCopy.get('service.offer.kraft.fit'),
  },
  plus: {
    label: window.ResultCopy.get('service.offer.plus.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.plus.placeholder'),
    fit: window.ResultCopy.get('service.offer.plus.fit'),
  },
  ernaehrung: {
    label: window.ResultCopy.get('service.offer.ernaehrung.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.ernaehrung.placeholder'),
    fit: window.ResultCopy.get('service.offer.ernaehrung.fit'),
  },
  metabolisch: {
    label: window.ResultCopy.get('service.offer.metabolisch.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.metabolisch.placeholder'),
    fit: window.ResultCopy.get('service.offer.metabolisch.fit'),
  },
  schlaf: {
    label: window.ResultCopy.get('service.offer.schlaf.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.schlaf.placeholder'),
    fit: window.ResultCopy.get('service.offer.schlaf.fit'),
  },
  stress: {
    label: window.ResultCopy.get('service.offer.stress.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.stress.placeholder'),
    fit: window.ResultCopy.get('service.offer.stress.fit'),
  },
  mentaleHilfe: {
    label: window.ResultCopy.get('service.offer.mentale_hilfe.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.mentale_hilfe.placeholder'),
    fit: window.ResultCopy.get('service.offer.mentale_hilfe.fit'),
  },
  vorsorge: {
    label: window.ResultCopy.get('service.offer.vorsorge.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.vorsorge.placeholder'),
    fit: window.ResultCopy.get('service.offer.vorsorge.fit'),
  },
  blutdruck: {
    label: window.ResultCopy.get('service.offer.blutdruck.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.blutdruck.placeholder'),
    fit: window.ResultCopy.get('service.offer.blutdruck.fit'),
  },
  wissen_kardio: {
    label: window.ResultCopy.get('service.offer.wissen_kardio.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.wissen_kardio.placeholder'),
    fit: window.ResultCopy.get('service.offer.wissen_kardio.fit'),
  },
  rauchstopp: {
    label: window.ResultCopy.get('service.offer.rauchstopp.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.rauchstopp.placeholder'),
    fit: window.ResultCopy.get('service.offer.rauchstopp.fit'),
  },
  wissen_rauchstopp: {
    label: window.ResultCopy.get('service.offer.wissen_rauchstopp.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.wissen_rauchstopp.placeholder'),
    fit: window.ResultCopy.get('service.offer.wissen_rauchstopp.fit'),
  },
  wissen_bewegung: {
    label: window.ResultCopy.get('service.offer.wissen_bewegung.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.wissen_bewegung.placeholder'),
    fit: window.ResultCopy.get('service.offer.wissen_bewegung.fit'),
  },
  plusEntdecken: {
    label: window.ResultCopy.get('service.offer.plus_entdecken.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.plus_entdecken.placeholder'),
    fit: '',
  },
  feedback: {
    label: window.ResultCopy.get('service.offer.feedback.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.feedback.placeholder'),
    fit: '',
  },
  coachApp: {
    label: window.ResultCopy.get('service.offer.coach_app.label'),
    href: '#',
    placeholder: window.ResultCopy.get('service.offer.coach_app.placeholder'),
    fit: '',
  },
};

Object.keys(HELSANA_OFFERS).forEach((key) => Object.freeze(HELSANA_OFFERS[key]));
Object.freeze(HELSANA_OFFERS);

if (typeof window !== 'undefined') {
  window.HELSANA_OFFERS = HELSANA_OFFERS;
}
})();
