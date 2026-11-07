// Where everything sits in the world scene. Pure geometry, no DOM.
// Landscape: 渔村 | 小路 | 矿村 side by side. Portrait (phones): stacked vertically.

import type { GameData } from '../../sim/data.ts';

export type Orientation = 'landscape' | 'portrait';
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export const PANEL = { w: 440, h: 500 };
const ROAD_GAP = 120;

export interface SceneLayout {
  orientation: Orientation;
  width: number;
  height: number;
  panels: Record<string, Rect>;
  /** Absolute positions of every resident. */
  nodes: Record<string, Point>;
  /** Where the merchant stands in each village. */
  market: Record<string, Point>;
  /** Polyline of the road from the first village's market to the second's. */
  road: Point[];
  /** Where the traveller (player) appears when telling someone in this village. */
  traveller: Record<string, Point>;
  /** Label anchors for place names, per village and place noun. */
  anchors: Record<string, Record<string, Point>>;
  /** Where a newborn god's silhouette appears in each village. */
  peak: Record<string, Point>;
  /** The string the lanterns hang from. */
  lanterns: Record<string, { x1: number; x2: number; y: number }>;
}

/** Village-local anchor positions (panel coordinates). */
const LOCAL = {
  coast: {
    anchors: { sea: { x: 300, y: 462 }, skyLake: { x: 330, y: 58 }, mountain: { x: 96, y: 150 } },
    peak: { x: 330, y: 150 },
    // Between the village title and the sky lake.
    lanterns: { x1: 168, x2: 268, y: 14 },
  },
  mine: {
    anchors: { mountain: { x: 220, y: 118 }, skyLake: { x: 360, y: 52 }, sea: { x: 372, y: 470 } },
    peak: { x: 220, y: 66 },
    // Right of the mountain god's halo, left of the sky lake.
    lanterns: { x1: 262, x2: 318, y: 14 },
  },
} as const;

function add(p: Point, o: Rect): Point {
  return { x: p.x + o.x, y: p.y + o.y };
}

/** Residents sit on an ellipse around the village square, first one at the top. */
export function residentLocal(i: number, n: number): Point {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: 220 + 150 * Math.cos(a), y: 288 + 92 * Math.sin(a) };
}

export function computeLayout(data: GameData, orientation: Orientation): SceneLayout {
  const [first, second] = data.villageIds;
  const panels: Record<string, Rect> = {};
  let width: number;
  let height: number;
  let marketLocal: Record<string, Point>;
  if (orientation === 'landscape') {
    width = PANEL.w * 2 + ROAD_GAP;
    height = PANEL.h;
    panels[first] = { x: 0, y: 0, ...PANEL };
    panels[second] = { x: PANEL.w + ROAD_GAP, y: 0, ...PANEL };
    marketLocal = { [first]: { x: 410, y: 330 }, [second]: { x: 30, y: 330 } };
  } else {
    width = PANEL.w;
    height = PANEL.h * 2 + ROAD_GAP;
    panels[first] = { x: 0, y: 0, ...PANEL };
    panels[second] = { x: 0, y: PANEL.h + ROAD_GAP, ...PANEL };
    marketLocal = { [first]: { x: 400, y: 440 }, [second]: { x: 400, y: 60 } };
  }

  const nodes: Record<string, Point> = {};
  const anchors: Record<string, Record<string, Point>> = {};
  const peak: Record<string, Point> = {};
  const lanterns: SceneLayout['lanterns'] = {};
  const traveller: Record<string, Point> = {};
  const market: Record<string, Point> = {};
  for (const v of data.villageIds) {
    const rect = panels[v];
    const residents = data.residents[v];
    residents.forEach((id, i) => { nodes[id] = add(residentLocal(i, residents.length), rect); });
    const local = LOCAL[v as keyof typeof LOCAL] ?? LOCAL.coast;
    anchors[v] = {};
    for (const [place, p] of Object.entries(local.anchors)) anchors[v][place] = add(p, rect);
    peak[v] = add(local.peak, rect);
    lanterns[v] = { x1: rect.x + local.lanterns.x1, x2: rect.x + local.lanterns.x2, y: rect.y + local.lanterns.y };
    traveller[v] = add({ x: 36, y: 210 }, rect);
    market[v] = add(marketLocal[v], rect);
  }

  const a = market[first];
  const b = market[second];
  const road: Point[] = orientation === 'landscape'
    ? [a, { x: a.x + 40, y: a.y + 40 }, { x: (a.x + b.x) / 2, y: a.y + 10 }, { x: b.x - 40, y: b.y + 40 }, b]
    : [a, { x: a.x - 30, y: a.y + 70 }, { x: a.x - 90, y: (a.y + b.y) / 2 }, { x: b.x - 30, y: b.y - 70 }, b];

  return { orientation, width, height, panels, nodes, market, road, traveller, anchors, peak, lanterns };
}

/** Point at fraction t (0..1) along a polyline, by length. */
export function along(points: Point[], t: number): Point {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segs.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(1, target / segs[i]) : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f };
    }
    target -= segs[i];
  }
  return points[points.length - 1];
}
