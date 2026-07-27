/*
 * radar.js
 * ---------------------------------------------------------------------------
 * Eigenes, abhängigkeitsfreies Spinnennetz-/Radardiagramm als SVG.
 * Zeigt die bewerteten Dimensionen mit ihrem jeweiligen Score (0–100).
 * Die Eckpunkte sind nach Statusfarbe eingefärbt; Achsenbeschriftungen sind
 * anklickbar (data-dim) und führen zur jeweiligen Detailansicht.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  let activeCleanup = null;

  function destroy() {
    if (!activeCleanup) return;
    try { activeCleanup(); } catch (e) {}
    activeCleanup = null;
  }

  function polar(cx, cy, r, angleDeg) {
    const a = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function el(name, attrs, children) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (children) children.forEach((c) => node.appendChild(c));
    return node;
  }

  function wrapLabel(text) {
    if (text.length <= 13) return [text];
    const words = text.split(' ');
    if (words.length === 1) return [text];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }

  /**
   * renderRadar(container, dimensions, scores, statusFn)
   *  - container: DOM-Element
   *  - dimensions: Array aus { id, short }
   *  - scores: { dimId: number }
   *  - statusFn: score -> { color }
   */
  function renderRadar(container, dimensions, scores, statusFn) {
    destroy();
    const W = 490, H = 398;
    const cx = W / 2, cy = 197, R = 132;
    const LINE_H = 18; // Zeilenhöhe der Achsenbeschriftung (passend zu den grösseren Fonts)
    const n = dimensions.length;
    const rings = [0.25, 0.5, 0.75, 1];

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      class: 'radar-svg',
      // Das Diagramm enthält fokussierbare Dimensions-Schaltflächen. `group`
      // bewahrt deren Semantik; Nachfahren eines `img` würden präsentational.
      role: 'group',
      'aria-label': window.ResultCopy.get('ui.radar.aria_label'),
    });

    const gGrid = el('g', { class: 'radar-grid' });

    // konzentrische Ringe (als Polygone)
    rings.forEach((f) => {
      let pts = '';
      for (let i = 0; i < n; i++) {
        const p = polar(cx, cy, R * f, (360 / n) * i);
        pts += `${p.x.toFixed(1)},${p.y.toFixed(1)} `;
      }
      gGrid.appendChild(el('polygon', {
        points: pts.trim(),
        fill: f === 1 ? 'rgba(154,9,65,0.03)' : 'none',
        stroke: 'rgba(60,40,80,0.12)',
        'stroke-width': 1,
      }));
    });

    // Achsen
    for (let i = 0; i < n; i++) {
      const p = polar(cx, cy, R, (360 / n) * i);
      gGrid.appendChild(el('line', {
        x1: cx, y1: cy, x2: p.x.toFixed(1), y2: p.y.toFixed(1),
        stroke: 'rgba(60,40,80,0.14)', 'stroke-width': 1,
      }));
    }
    svg.appendChild(gGrid);

    // Datenpolygon
    let dataPts = '';
    const vertices = [];
    for (let i = 0; i < n; i++) {
      const dim = dimensions[i];
      const v = Math.max(0, Math.min(100, scores[dim.id] ?? 0));
      const p = polar(cx, cy, R * (v / 100), (360 / n) * i);
      dataPts += `${p.x.toFixed(1)},${p.y.toFixed(1)} `;
      vertices.push({ p, v, dim });
    }

    svg.appendChild(el('polygon', {
      points: dataPts.trim(),
      fill: 'rgba(154,9,65,0.18)',
      stroke: 'rgba(123,45,142,0.85)',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      class: 'radar-area',
    }));

    // Eckpunkte (nach Status eingefärbt)
    vertices.forEach(({ p, v }) => {
      const color = statusFn(v).color;
      svg.appendChild(el('circle', {
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 5,
        fill: '#fff', stroke: color, 'stroke-width': 3, class: 'radar-dot',
      }));
    });

    // Achsenbeschriftungen
    // Für jedes Textelement werden Layout-Metadaten gemerkt, damit Schriftgrösse
    // UND Zeilenabstand nach dem Rendern gemeinsam in echten Pixeln berechnet
    // werden können (siehe applyPixelFontSizes unten).
    const textEls = [];
    for (let i = 0; i < n; i++) {
      const dim = dimensions[i];
      const lp = polar(cx, cy, R + 26, (360 / n) * i);
      let anchor = 'middle';
      if (lp.x < cx - 8) anchor = 'end';
      else if (lp.x > cx + 8) anchor = 'start';
      const pos = lp.y < cy - 30 ? 'top' : (lp.y > cy + 30 ? 'bottom' : 'side');

      const lines = wrapLabel(dim.short);
      const g = el('g', { class: 'radar-label', 'data-dim': dim.id, tabindex: '0', role: 'button',
        'aria-label': window.ResultCopy.format('ui.radar.dimension_detail_aria', { dimensionShort: dim.short }) });
      const baseDy = pos === 'top' ? -4 : (pos === 'bottom' ? 12 : 5);
      lines.forEach((ln, idx) => {
        const t = el('text', {
          x: lp.x.toFixed(1),
          y: (lp.y + baseDy + idx * LINE_H).toFixed(1), // statischer Fallback
          'text-anchor': anchor,
          class: 'radar-label-text',
        }, [document.createTextNode(ln)]);
        g.appendChild(t);
        textEls.push({ el: t, kind: 'label', anchorY: lp.y, row: idx, rows: lines.length, pos });
      });
      // Score-Wert darunter
      const scoreEl = el('text', {
        x: lp.x.toFixed(1),
        y: (lp.y + baseDy + lines.length * LINE_H).toFixed(1), // statischer Fallback
        'text-anchor': anchor,
        class: 'radar-label-score',
      }, [document.createTextNode(String(scores[dim.id] ?? 0))]);
      g.appendChild(scoreEl);
      textEls.push({ el: scoreEl, kind: 'score', anchorY: lp.y, row: lines.length, rows: lines.length, pos });
      svg.appendChild(g);
    }

    container.innerHTML = '';
    container.appendChild(svg);

    /*
     * Schrift & Zeilenabstand in ECHTEN Bildschirm-Pixeln statt SVG-User-Units.
     * Das SVG wird per viewBox auf die tatsächliche Containerbreite skaliert –
     * feste Werte in User-Units würden auf schmalen (Mobile-)Containern also
     * automatisch mitschrumpfen. Deshalb wird nach dem Einfügen ins DOM die
     * reale Renderbreite gemessen und daraus Schriftgrösse UND vertikaler
     * Abstand zwischen Kategorie-Label und Score-Zahl umgerechnet, sodass beide
     * auf jedem Bildschirm gleich gross und sauber getrennt erscheinen.
     */
    function applyPixelFontSizes() {
      const renderedWidth = svg.getBoundingClientRect().width;
      if (!renderedWidth) return; // Element (noch) nicht sichtbar/gelayoutet

      // Zielgrössen in echten Pixeln; auf sehr schmalen Screens leicht reduziert,
      // damit die seitlichen Labels nicht über den Bildschirmrand hinausragen.
      const LABEL_PX = renderedWidth < 420 ? 18 : 21;
      const SCORE_PX = renderedWidth < 420 ? 15.5 : 18;

      // Untergrenze verhindert, dass die Schrift in User-Units so gross wird,
      // dass sich Labels bei Extrembreiten gegenseitig überlappen.
      const scale = Math.max(renderedWidth / W, 0.55);
      const labelU = LABEL_PX / scale;  // Label-Grösse in User-Units
      const scoreU = SCORE_PX / scale;  // Score-Grösse in User-Units
      const lineH = labelU * 1.25;      // Baseline-Abstand Label → Score (skaliert mit)

      textEls.forEach(({ el: t, kind, anchorY, row, rows, pos }) => {
        t.style.fontSize = (kind === 'label' ? labelU : scoreU).toFixed(2) + 'px';
        // Vertikales Block-Layout relativ zum Ankerpunkt der Achse:
        let firstBaseline;
        if (pos === 'top') {
          // Block endet knapp unterhalb des Ankers (wächst nach oben ins Freie).
          firstBaseline = anchorY + 0.3 * labelU - rows * lineH;
        } else if (pos === 'bottom') {
          // Block beginnt unterhalb des Ankers (wächst nach unten ins Freie).
          firstBaseline = anchorY + 0.85 * labelU;
        } else {
          // Seitlich: Block optisch um den Anker zentrieren.
          firstBaseline = anchorY - (rows * lineH - 0.75 * labelU + 0.15 * scoreU) / 2;
        }
        t.setAttribute('y', (firstBaseline + row * lineH).toFixed(1));
      });
    }
    applyPixelFontSizes();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(applyPixelFontSizes);
      ro.observe(svg);
      activeCleanup = () => ro.disconnect();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', applyPixelFontSizes);
      activeCleanup = () => window.removeEventListener('resize', applyPixelFontSizes);
    }

    return svg;
  }

  window.Radar = Object.freeze({ renderRadar, destroy });
})();
