# Integration in die Helsana-Systemlandschaft

Stand: Juli 2026 · Zielgruppe: Helsana IT / Integration Engineering

Der Health Navigator ist eine statische Client-Anwendung ohne Build. Diese
Integrationsschicht ergänzt einen minimalen eingeloggten Kundenkontext; sie verändert
weder Scoring noch Empfehlungen. Authentifizierung, Sessions, echte Produktcodes und
Secrets bleiben vollständig ausserhalb der Anwendung.

## 1. Architektur und Datenschutzgrenze

```text
Helsana-Plattform / BFF
  └─ authentifiziert, minimiert und mappt echte Produkte
       ↓ CustomerContext v1 über Host-Adapter
js/integration.js
  ├─ validiert, begrenzt, normalisiert und friert ein
  ├─ hält Kontext nur im Seitenspeicher
  └─ liefert optionale, unverbindliche Coverage-Hinweise
       ↓ öffentliche HelsanaIntegration-API
js/app.js
  └─ rendert freigegebenen Chip/Hinweise; Gesundheitslogik bleibt unverändert
```

Der Kontext wird nicht in `localStorage`, `sessionStorage`, Cookie, URL oder Custom-
Event geschrieben. Das Event `helsana:customer-context` enthält nur die technische
Herkunft (`none`, `mock`, `live`). Gesundheitsantworten werden nie an den Adapter
übergeben. Alle Same-Origin-Skripte könnten jedoch auf globale Objekte und lokalen
Storage zugreifen; deshalb ist ein isolierter, kontrollierter Origin ohne unkontrollierte
Drittanbieter-Skripte eine Go-live-Voraussetzung.

## 2. Betriebsmodi und Bootstrap-Reihenfolge

Vor `js/config.js` setzt der Host die validierte Laufzeitkonfiguration:

```html
<script>
  window.HealthNavigatorConfig = {
    integrationMode: 'live',
    demoProfilesEnabled: false,
    coverageHintsEnabled: false,
    adapterTimeoutMs: 4000
  };
</script>
```

| Modus | Standardadapter | `?kunde=…` | Coverage-Default | Zweck |
| --- | --- | --- | --- | --- |
| `mock` | Demo | optional | an | Lokale Demo und Tests |
| `live` | anonym, sofern kein Host-Adapter | immer ignoriert | aus | Produktive Portal-Integration |
| `anonymous` | anonym | immer ignoriert | aus | Statische Nutzung ohne Kundenkontext |

Produktion muss `live` oder `anonymous` explizit setzen. Ein URL-Parameter kann im
Live-Modus niemals ein Demo-Profil aktivieren und wird nicht an den Live-Adapter
weitergereicht. `anonymous` ist eine harte Datenschutzgrenze: Bootstrap-Kontext und
-Adapter werden ignoriert, `setAdapter()` liefert `false`, `setContext()` bleibt
anonym und `init()` ruft keinen Live-/Mock-Adapter auf.

### Empfohlener One-shot-Bootstrap

Wenn der Adapter im `live`- oder `mock`-Modus vor dem automatischen Initialisieren
feststeht, setzt der Host nach `js/config.js`, aber vor `js/integration.js`, einmalig:

```html
<script>
  window.HealthNavigatorBootstrap = {
    customerAdapter: hostCustomerAdapter
  };
</script>
```

Alternativ kann ein bereits minimierter Rohkontext als `customerContext` bereitgestellt
werden. Dieser gewinnt vor dem Auto-Request. Im `anonymous`-Modus werden beide
Bootstrap-Felder ohne Zugriff auf ihre Inhalte verworfen. Das Bootstrap-Objekt wird
nach dem Lesen entfernt, damit kein Rohkontext liegenbleibt. Bei strikter CSP gehören
Konfiguration und Bootstrap in eine externe freigegebene Datei oder ein Script mit
Nonce.

Ohne Bootstrap initialisiert `integration.js` genau einmal den modusabhängigen Adapter.
Eine spätere Registrierung ist möglich:

```js
window.HelsanaIntegration.setAdapter(hostCustomerAdapter);
await window.HelsanaIntegration.init();
```

`setAdapter()` bricht einen laufenden Lauf ab, entwertet dessen Antwort und startet
bewusst nicht selbst neu. Dadurch bestimmt der Host den Refresh-Zeitpunkt.

## 3. CustomerContext v1

Der Adapter darf ausschliesslich den fachlich notwendigen Minimalvertrag liefern:

```json
{
  "contractVersion": 1,
  "isAuthenticated": true,
  "displayName": "Vorname N.",
  "products": [
    {
      "id": "technischer-stabiler-schluessel",
      "category": "SUPP_PREVENTION",
      "label": "Neutrale Produktbezeichnung"
    }
  ],
  "source": "live"
}
```

Vertrag und Normalisierung:

- `contractVersion` muss numerisch `1` sein. Ein fehlendes Feld wird nur zur
  Rückwärtskompatibilität als Version 1 behandelt; andere Typen/Versionen fallen
  anonym zurück.
- Nur `isAuthenticated === true` erzeugt einen authentifizierten Kontext.
- `displayName` ist optional, wird normalisiert, von Steuer-/Bidi-Zeichen bereinigt
  und auf 80 Unicode-Codepoints begrenzt.
- Maximal 100 rohe Produkte werden betrachtet, höchstens 20 gültige übernommen.
- ID und Label werden begrenzt; IDs werden dedupliziert. Fehlerhafte Getter, Proxies,
  Einträge und unbekannte Felder führen nicht zu einem App-Absturz.
- Erlaubte Kategorien: `BASIC`, `SUPP_AMBULANT`, `SUPP_HOSPITAL`,
  `SUPP_PREVENTION`. Unbekannte Kategorien werden verworfen.
- Rückgabeobjekt, Produktarray und Produkte sind eingefroren. Änderungen erfolgen
  nur über die API.

Nicht liefern: Tokens, Secrets, AHV-/Kundennummer, Policen, Deckungsdetails,
Leistungsabrechnungen, Schäden, Diagnosen, Gesundheitsantworten oder andere nicht
benötigte Personendaten. Das BFF begrenzt die Response zusätzlich serverseitig und
mappt echte Produktcodes auf die neutralen Kategorien.

## 4. Adaptervertrag, Timeout und Fehler

```js
const hostCustomerAdapter = {
  async getCustomerContext(profileId, options) {
    // Im Live-Modus ist profileId immer null.
    // options.signal ist ein optionales AbortSignal.
    return minimalerCustomerContextOderNull;
  }
};
```

Der zweite Parameter ist rückwärtskompatibel optional. Netzwerkadapter sollen das
`AbortSignal` an ihre Request-API weitergeben. Timeout, neuer `init()`-Lauf,
Adapterwechsel, direkter Login oder Logout brechen den aktiven Lauf ab und entwerten
alte Antworten. Fehler, Rejection, ungültige Daten oder Timeout führen ohne sichtbaren
App-Fehler in den anonymen Zustand.

`HelsanaIntegration.ready` ist ein Getter auf die jeweils aktuelle Initialisierungs-
Promise, nicht nur auf den ersten Seitenstart. `init()` ist wiederholbar und gibt den
resultierenden normalisierten Kontext zurück.

## 5. Öffentliche API

`window.HelsanaIntegration` ist eingefroren und stellt bereit:

| Mitglied | Vertrag |
| --- | --- |
| `init(profileId?)` | Kontext laden; Profilwert wirkt nur im Mock-Modus. |
| `ready` | Promise des aktuellsten Initialisierungslaufs. |
| `getContext()` | Aktuellen eingefrorenen Kontext lesen. |
| `setContext(raw)` | Login/Kontextwechsel sofort normalisieren und setzen; im `anonymous`-Modus stets anonym. |
| `clearContext()` | Logout; laufenden Request abbrechen und anonymisieren. |
| `setAdapter(adapter)` | Gültigen Adapter setzen, alten Lauf entwerten; im `anonymous`-Modus immer `false`. |
| `hasCategory(category, ctx?)` | Neutrale Kategorie prüfen. |
| `coverageHintFor(offerKey, ctx?)` | Freigegebenen Hinweis oder `null` liefern. |
| `normalizeCustomerContext(raw)` | Vertrag für Hosttests validieren. |
| `PRODUCT_CATEGORIES` | Eingefrorene erlaubte Kategorien. |
| `DEMO_PROFILES` | Eingefrorene Daten; nur Mock/Test. |
| `INTEGRATION_CONFIG` | Eingefrorene wirksame Integrationseinstellungen. |

### Login, Logout und Kontextwechsel

```js
window.HelsanaIntegration.setContext(minimalerCustomerContext);
window.HelsanaIntegration.clearContext();
```

Im `live`-/`mock`-Modus wirken beide Kontextoperationen synchron, entwerten laufende
Adapterantworten und lösen das datenarme Kontext-Event aus. Im `anonymous`-Modus kann
`setContext()` keinen eingeloggten Zustand herstellen. Die Ergebnisseite aktualisiert
nur Kontextchip und Coverage-Zeilen; geöffnete Details, Chat, Atemübung und Fokus
bleiben erhalten.

## 6. Coverage ist keine Deckungsprüfung

`COVERAGE_HINTS` ordnet Angebotsschlüssel neutralen Produktkategorien zu. Diese Logik
hat keinen Einfluss auf Scores, Risiken, Priorisierung oder Gesundheitspläne.

```text
Produktkategorie vorhanden
≠ Leistung gedeckt
≠ Kostenübernahme bestätigt
≠ medizinisch geeignet
```

Im Live- und anonymen Modus sind Hinweise standardmässig deaktiviert. Erst nach
Produkt-, Marketing- und Legal-Freigabe setzt die Zielumgebung explizit
`coverageHintsEnabled: true`. Unbekannte Angebote, anonyme Kontexte und nicht passende
Kategorien liefern immer `null`. Da das aktuelle Kundenchip-Wording dieselbe
produktbezogene Einordnung ankündigt, bleibt auch dieser Chip bis zur Aktivierung
der freigegebenen Coverage-Hinweise verborgen.

## 7. Security- und Deployment-Anforderungen

- Ausschliesslich HTTPS; Authentifizierung über Plattform/BFF und angemessen
  eingeschränkte `HttpOnly`-/`Secure`-Session-Cookies, niemals Client-Secrets.
- CSP mit konkreten `script-src`, `style-src`, `img-src`, `connect-src` und
  `frame-ancestors`; `frame-ancestors` muss als HTTP-Header ausgeliefert werden.
- Zusätzlich `X-Content-Type-Options: nosniff`, strikte Referrer-Policy,
  minimale Permissions-Policy, HSTS und bewusste Cache-Policy.
- Nur freigegebene Ziel-Origins und ein lokales freigegebenes Logo. Angebots- und
  Quellen-URLs werden clientseitig auf absolute HTTPS-Ziele geprüft; diese Prüfung
  ersetzt keine Link-/Content-Freigabe.
- Keine Analytics-/Tag-Skripte, die Storage, DOM, globale APIs oder Formulare erfassen.
- Kein offener `postMessage`-Kanal. Falls später ein iframe-Kanal nötig wird: feste
  Origin-Allowlist, enges Schema, keine Health-Payloads in Events.

## 8. Testprofile und Integrationsabnahme

Im Mock-Modus stehen `grund`, `zusatz-praevention` und `zusatz-komplett` über den
Parameter `kunde` zur Verfügung. Der Kontext wird nicht gespeichert; lokale
Fragebogenantworten dagegen schon.

Automatisiert:

```bash
node tests/integration.test.js
node tests/robustness.test.js
```

Vor Integration abhaken:

- [ ] Zielmodus ist `live`; Demo-Profile sind deaktiviert.
- [ ] Adapter ist vor Auto-Init gebootstrapt oder wird danach bewusst gesetzt und
  mit `init()` gestartet.
- [ ] Anonym, Login, Logout, Re-Login, Kontextwechsel und mehrfaches `init()` getestet.
- [ ] Timeout, Rejection, Abort und verspätete Antwort getestet.
- [ ] CustomerContext v1 mit falschen Typen, unbekannten Kategorien, 20+-Produkten,
  langen Texten und Steuerzeichen getestet.
- [ ] Serverseitiges Produktmapping und Response-Limit bestätigt.
- [ ] Coverage standardmässig aus; Texte/Zuordnungen separat freigegeben.
- [ ] Keine Kunden- oder Gesundheitsdaten in Storage, URL, Logs, Events oder
  Telemetrie beobachtet.
- [ ] Ziel-CSP, Header, Origin-Isolation, Cache-Verhalten und Browsermatrix abgenommen.
