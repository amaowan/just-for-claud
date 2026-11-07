// Static scenery, drawn once per layout: sky, sea, dock, mountains, mine, road.
// All shapes use CSS classes so theme.css controls colours (light and dark).

import type { GameData } from '../../sim/data.ts';
import type { SceneLayout } from './layout.ts';
import { PANEL } from './layout.ts';
import { s } from './svg.ts';

export function defs(): SVGDefsElement {
  return s('defs', {},
    s('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', class: 'sky-top' }), s('stop', { offset: '1', class: 'sky-bottom' })),
    s('linearGradient', { id: 'sea', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', class: 'sea-top' }), s('stop', { offset: '1', class: 'sea-bottom' })),
    s('radialGradient', { id: 'halo' },
      s('stop', { offset: '0', class: 'halo-in' }), s('stop', { offset: '1', class: 'halo-out' })),
    // Soft, slightly ragged edges for watercolour washes.
    s('filter', { id: 'wash', x: '-5%', y: '-5%', width: '110%', height: '110%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.035, numOctaves: 2, seed: 3, result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 6 }),
      s('feGaussianBlur', { stdDeviation: 0.6 })),
    s('filter', { id: 'glow', x: '-60%', y: '-60%', width: '220%', height: '220%' },
      s('feGaussianBlur', { stdDeviation: 4, result: 'b' }),
      s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))),
  );
}

function wave(y: number, amp: number, len: number, w: number): string {
  let d = `M-40 ${y}`;
  for (let x = -40; x < w + 40; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
  return d;
}

function coast(): SVGGElement {
  const w = PANEL.w;
  return s('g', { class: 'scene coast' },
    s('rect', { class: 'sky', x: 0, y: 0, width: w, height: PANEL.h, rx: 18 }),
    s('circle', { class: 'sun', cx: 372, cy: 110, r: 26 }),
    // Floating sky lake (天湖)
    s('g', { class: 'sky-lake', transform: 'translate(330 60)' },
      s('ellipse', { class: 'cloud', rx: 52, ry: 14, cy: 4 }),
      s('ellipse', { class: 'lake', rx: 34, ry: 7 })),
    // Distant hill on the left (where 山 names would sit)
    s('path', { class: 'hill far', filter: 'url(#wash)', d: 'M-10 230 Q40 150 96 168 Q150 140 210 230 Z' }),
    s('path', { class: 'shore', filter: 'url(#wash)', d: `M0 360 Q120 340 220 372 T${w} 360 L${w} ${PANEL.h} L0 ${PANEL.h} Z` }),
    s('path', { class: 'sea', filter: 'url(#wash)', d: `M0 410 Q110 396 220 412 T${w} 406 L${w} ${PANEL.h - 0} L0 ${PANEL.h} Z` }),
    s('g', { class: 'waves' },
      s('path', { class: 'wave w1', d: wave(430, 5, 60, w) }),
      s('path', { class: 'wave w2', d: wave(452, 4, 48, w) }),
      s('path', { class: 'wave w3', d: wave(476, 3, 40, w) })),
    // Dock (码头) reaching into the sea on the right
    s('g', { class: 'dock' },
      s('rect', { class: 'plank', x: 330, y: 392, width: 96, height: 9, rx: 2 }),
      ...[340, 368, 396, 420].map((x) => s('line', { class: 'post', x1: x, y1: 400, x2: x, y2: 430 })),
      s('path', { class: 'boat', d: 'M300 438 q26 14 56 0 l-6 -8 h-44 z' }),
      s('line', { class: 'mast', x1: 326, y1: 430, x2: 326, y2: 402 }),
      s('path', { class: 'sail', d: 'M327 404 l18 22 h-18 z' })),
    // A couple of fishing huts with paper-lantern eaves
    s('g', { class: 'huts' },
      s('path', { class: 'hut', d: 'M40 372 l22 -18 22 18 v20 h-44 z' }),
      s('path', { class: 'hut', d: 'M92 378 l18 -15 18 15 v16 h-36 z' })),
  );
}

function mine(): SVGGElement {
  const w = PANEL.w;
  return s('g', { class: 'scene mine' },
    s('rect', { class: 'sky', x: 0, y: 0, width: w, height: PANEL.h, rx: 18 }),
    s('g', { class: 'sky-lake', transform: 'translate(360 54)' },
      s('ellipse', { class: 'cloud', rx: 48, ry: 13, cy: 4 }),
      s('ellipse', { class: 'lake', rx: 30, ry: 6 })),
    s('path', { class: 'mount far', filter: 'url(#wash)', d: 'M-10 250 L70 150 L120 190 L170 120 L220 60 L280 140 L330 110 L400 180 L450 160 L450 260 Z' }),
    s('path', { class: 'mount near', filter: 'url(#wash)', d: 'M-10 300 Q80 200 150 240 Q220 190 300 240 Q380 200 450 260 L450 330 L-10 330 Z' }),
    s('path', { class: 'snowcap', d: 'M205 76 L220 60 L236 82 L226 78 L220 86 L212 78 Z' }),
    s('path', { class: 'ground', filter: 'url(#wash)', d: `M0 330 Q140 312 260 336 T${w} 328 L${w} ${PANEL.h} L0 ${PANEL.h} Z` }),
    // Mine entrance (矿洞) with timber frame and rails
    s('g', { class: 'minecave' },
      s('path', { class: 'cave', d: 'M342 330 v-34 a26 26 0 0 1 52 0 v34 z' }),
      s('path', { class: 'timber', d: 'M338 330 v-36 a30 30 0 0 1 60 0 v36' }),
      s('path', { class: 'rail', d: 'M352 330 L330 420 M384 330 L404 420 M346 350 h44 M340 372 h54 M335 396 h64' }),
      s('rect', { class: 'cart', x: 352, y: 352, width: 30, height: 14, rx: 3 })),
    s('g', { class: 'pines' },
      ...[[40, 420], [66, 446], [100, 428], [300, 452]].map(([x, y]) => s('path', { class: 'pine', d: `M${x} ${y} l12 -30 l12 30 z` }))),
  );
}

function road(L: SceneLayout): SVGGElement {
  const d = L.road.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const mid = L.road[Math.floor(L.road.length / 2)];
  return s('g', { class: 'road-layer' },
    s('path', { class: 'road', d }),
    s('path', { class: 'road-dash', d }),
    s('path', { class: 'tree', d: `M${mid.x - 30} ${mid.y - 18} l9 -24 l9 24 z` }),
    s('path', { class: 'tree', d: `M${mid.x + 18} ${mid.y + 26} l8 -20 l8 20 z` }));
}

export function drawBackdrop(L: SceneLayout, data: GameData): SVGGElement {
  const g = s('g', { class: 'backdrop' });
  for (const v of data.villageIds) {
    const r = L.panels[v];
    const scene = v === 'mine' ? mine() : coast();
    const panel = s('g', { transform: `translate(${r.x} ${r.y})`, class: `panel panel-${v}` },
      s('clipPath', { id: `clip-${v}` }, s('rect', { x: 0, y: 0, width: r.w, height: r.h, rx: 18 })),
      s('g', { 'clip-path': `url(#clip-${v})` }, scene),
      s('rect', { class: 'panel-frame', x: 1, y: 1, width: r.w - 2, height: r.h - 2, rx: 18 }),
      s('g', { class: 'village-title', transform: 'translate(18 50)' },
        s('text', { class: 'village-name' }, data.villages[v].name)));
    g.append(panel);
  }
  // The road is drawn over the panels so it visibly leaves each village from its market.
  g.append(road(L));
  return g;
}
