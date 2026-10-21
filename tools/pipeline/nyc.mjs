// New York sources, read into the shapes the compiler takes from PLATEAU.
//   osm_buildings.json  OSM buildings and building parts (Overpass `out geom`): outlines, heights, setbacks, use
//   nyc_buildings.json  NYC Building Footprints (NYC Open Data): every building with its roof height, which fills
//                       the heights OSM lacks and the buildings OSM lacks
//   nyc_roadbed.json, nyc_sidewalk.json  NYC Planimetric Database: the carriageway and the sidewalks, kerb to kerb
// Rings are [[lon, lat], ...]; polygons [outer, ...holes].
import fs from 'node:fs';
import { MATERIAL } from '../../src/shared/tileformat.js';

const FT = 0.3048;
const STOREY = 3.6; // metres a floor, where only the number of floors is known (New York's are tall)

// ---------------------------------------------------------------- geometry in degrees (small areas: planar is enough)
const ringArea = (r) => { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const polyArea = (p) => Math.abs(ringArea(p[0])) - p.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (x, y, p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h));
// a point well inside the polygon (the centroid, or failing that the middle of a horizontal chord through it)
function innerPoint(p) {
  const r = p[0];
  let sx = 0, sy = 0, sa = 0;
  for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n], c = a[0] * b[1] - b[0] * a[1]; sx += (a[0] + b[0]) * c; sy += (a[1] + b[1]) * c; sa += c; }
  const c = sa ? [sx / (3 * sa), sy / (3 * sa)] : r[0];
  if (inPoly(c[0], c[1], p)) return c;
  const xs = [];
  for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; if ((a[1] > c[1]) !== (b[1] > c[1])) xs.push(a[0] + ((c[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])); }
  xs.sort((a, b) => a - b);
  return xs.length >= 2 ? [(xs[0] + xs[1]) / 2, c[1]] : c;
}
const bboxOf = (p) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };

// A grid over polygons for point lookups.
class Grid {
  constructor(cell = 0.0008) { this.cell = cell; this.map = new Map(); }
  add(item, [x0, y0, x1, y1]) {
    for (let i = Math.floor(x0 / this.cell); i <= Math.floor(x1 / this.cell); i++)
      for (let j = Math.floor(y0 / this.cell); j <= Math.floor(y1 / this.cell); j++) {
        const k = i + ':' + j;
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(item);
      }
  }
  at(x, y) { return this.map.get(Math.floor(x / this.cell) + ':' + Math.floor(y / this.cell)) ?? []; }
}

// ---------------------------------------------------------------- OSM
const num = (v) => { if (v == null) return null; const m = /^\s*(-?[\d.]+)\s*(m|ft|')?/.exec(String(v)); if (!m) return null; const n = Number(m[1]); return Number.isFinite(n) ? (m[2] === 'ft' || m[2] === "'" ? n * FT : n) : null; };

// Member ways of a multipolygon joined into closed rings.
function joinRings(lines) {
  const rings = [], open = lines.map((l) => [...l]);
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  while (open.length) {
    let ring = open.shift();
    for (let grown = true; grown && !same(ring[0], ring.at(-1));) {
      grown = false;
      for (let i = 0; i < open.length; i++) {
        const l = open[i];
        if (same(ring.at(-1), l[0])) ring = ring.concat(l.slice(1));
        else if (same(ring.at(-1), l.at(-1))) ring = ring.concat(l.slice(0, -1).reverse());
        else if (same(ring[0], l.at(-1))) ring = l.concat(ring.slice(1));
        else if (same(ring[0], l[0])) ring = l.slice(1).reverse().concat(ring);
        else continue;
        open.splice(i, 1); grown = true; break;
      }
    }
    if (ring.length >= 4 && same(ring[0], ring.at(-1))) rings.push(ring);
  }
  return rings;
}

// An OSM element as polygons [[outer, ...holes]], or [].
function osmPolygons(e) {
  const pt = (g) => [g.lon, g.lat];
  if (e.type === 'way') return e.geometry?.length >= 4 ? [[e.geometry.map(pt)]] : [];
  if (e.type !== 'relation') return [];
  const lines = (role) => (e.members ?? []).filter((m) => m.type === 'way' && m.geometry && (m.role || 'outer') === role).map((m) => m.geometry.map(pt));
  const outers = joinRings(lines('outer')), inners = joinRings(lines('inner'));
  return outers.map((o) => [o, ...inners.filter((h) => inRing(h[0][0], h[0][1], o))]);
}

// OSM building / building:use -> PLATEAU usage code (src/world/meshing.js picks the facade from it).
const USAGE = {
  office: 401, commercial: 402, retail: 402, supermarket: 402, kiosk: 402, hotel: 403,
  house: 411, detached: 411, semidetached_house: 411, terrace: 411,
  apartments: 412, residential: 412, dormitory: 412,
  school: 421, college: 421, university: 421, hospital: 421, church: 421, cathedral: 421, chapel: 421, synagogue: 421, mosque: 421,
  temple: 421, religious: 421, museum: 421, theatre: 421, library: 421, civic: 431, public: 431, government: 431, fire_station: 431,
  train_station: 422, transportation: 422, warehouse: 422, garage: 422, garages: 422, parking: 422, industrial: 441, service: 454,
};
const COLOURS = { white: 0xf2f2f0, black: 0x1c1c1e, grey: 0x9a9a9a, gray: 0x9a9a9a, gainsboro: 0xdcdcdc, yellow: 0xe6cf5a, brown: 0x7a5236, beige: 0xe6dcc0, red: 0xa83232, blue: 0x3a5f95, green: 0x4f7d4f, orange: 0xd98a3a, pink: 0xe6a8b8, silver: 0xc0c0c0, cream: 0xf3ead2, tan: 0xc8b08a, darkgray: 0x5a5a5a, darkgrey: 0x5a5a5a, lightgray: 0xc8c8c8, lightgrey: 0xc8c8c8 };
const MATERIALS = { concrete: MATERIAL.CONCRETE, cement: MATERIAL.CONCRETE, stone: MATERIAL.CONCRETE, limestone: MATERIAL.CONCRETE, sandstone: MATERIAL.CONCRETE, glass: MATERIAL.GLASS, 'concrete/glass': MATERIAL.GLASS, mirror: MATERIAL.GLASS,
  metal: MATERIAL.METAL, steel: MATERIAL.METAL, metal_plates: MATERIAL.METAL, brick: MATERIAL.BRICK, tiles: MATERIAL.TILE, plaster: MATERIAL.PLASTER };
function hintOf(t) {
  const colour = (t['building:colour'] ?? '').split(';')[0].trim().toLowerCase(), material = MATERIALS[t['building:material']] ?? 0;
  const rgb = /^#?[0-9a-f]{6}$/.test(colour) ? Number.parseInt(colour.replace('#', ''), 16) : /^#[0-9a-f]{3}$/.test(colour) ? Number.parseInt(colour.slice(1).split('').map((c) => c + c).join(''), 16) : COLOURS[colour];
  return ((rgb != null ? 0x80000000 | rgb : 0) | (material << 24)) >>> 0;
}

// Buildings: [{ id, usage, storeys, height, minHeight, hint, name, polygons (lon/lat) }]; minHeight > 0 lifts a part
// off the ground (a setback standing on the floors below).
export function readNycBuildings(osmFile, nycFile) {
  const elements = JSON.parse(fs.readFileSync(osmFile, 'utf8')).elements;
  const nyc = JSON.parse(fs.readFileSync(nycFile, 'utf8'));
  const stats = { osmBuildings: 0, withParts: 0, parts: 0, orphanParts: 0, nycOnly: 0, heightFromNyc: 0, heightGuessed: 0 };

  // NYC footprints with their roof height (feet above the ground)
  const fp = [], fpGrid = new Grid();
  for (const r of nyc) {
    if (r.feature_code && !/^2100|^5100|^5110/.test(r.feature_code)) continue; // buildings and garages, not tanks, towers...
    const polys = (r.the_geom?.coordinates ?? []).map((p) => p.map((ring) => ring.map(([x, y]) => [x, y])));
    if (!polys.length) continue;
    const h = Number(r.height_roof) * FT;
    const f = { polys, height: h > 0.5 ? h : null, used: false, bin: r.bin };
    fp.push(f);
    for (const p of polys) fpGrid.add(f, bboxOf(p));
  }
  const footprintAt = (x, y) => fpGrid.at(x, y).find((f) => f.polys.some((p) => inPoly(x, y, p)));

  const buildings = [], parts = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    if (t['building:part'] && t['building:part'] !== 'no') parts.push({ e, t, polys: osmPolygons(e) });
    else if (t.building && !['roof', 'no', 'construction', 'canopy', 'carport', 'ruins', 'bridge'].includes(t.building)) buildings.push({ e, t, polys: osmPolygons(e) });
  }
  // parts are assigned to the building their inner point lies in
  const bGrid = new Grid();
  buildings.forEach((b) => { b.parts = []; b.area = b.polys.reduce((s, p) => s + polyArea(p), 0); for (const p of b.polys) bGrid.add(b, bboxOf(p)); });
  for (const p of parts) {
    if (!p.polys.length) continue;
    const [x, y] = innerPoint(p.polys[0]);
    const owner = bGrid.at(x, y).filter((b) => b.polys.some((q) => inPoly(x, y, q))).sort((a, b) => a.area - b.area)[0];
    if (owner) owner.parts.push(p); else { p.orphan = true; stats.orphanParts++; }
  }

  const out = [];
  const heightOf = (t, poly, fallback) => {
    let h = num(t.height);
    if (h == null && t['building:levels'] != null) h = (num(t['building:levels']) + (num(t['roof:levels']) ?? 0)) * STOREY;
    if (h == null && poly) {
      const [x, y] = innerPoint(poly), f = footprintAt(x, y);
      if (f?.height) { h = f.height; stats.heightFromNyc++; }
    }
    if (h == null) { h = fallback; stats.heightGuessed++; }
    return h;
  };
  const usageOf = (t, parent = {}) => {
    const use = USAGE[t['building:use']] ?? USAGE[t.building] ?? USAGE[parent['building:use']] ?? USAGE[parent.building];
    return use ?? 461;
  };
  const emit = (id, t, polys, parentTags = {}, fallback = 12) => {
    if (!polys.length) return;
    const top = heightOf(t, polys[0], fallback);
    let min = num(t.min_height);
    if (min == null && t['building:min_level'] != null) min = num(t['building:min_level']) * STOREY;
    min = Math.max(0, min ?? 0);
    if (!(top - min > 0.5)) return;
    const levels = num(t['building:levels']), minLevel = num(t['building:min_level']) ?? 0;
    let usage = usageOf(t, parentTags);
    if (usage === 461 && top > 45) usage = 401; // an unnamed tower in Manhattan is offices more often than not
    out.push({ id, usage, storeys: levels ? Math.max(1, Math.round(levels - minLevel)) : 0, height: top - min, minHeight: min,
      hint: hintOf(t) || hintOf(parentTags), name: t.name ?? parentTags.name ?? null, polygons: polys });
  };

  for (const b of buildings) {
    stats.osmBuildings++;
    // mark the NYC footprints this building covers, so they are not added a second time
    for (const p of b.polys) { const [x, y] = innerPoint(p); const f = footprintAt(x, y); if (f) f.used = true; }
    // parts covering most of the outline replace it; a building with a few parts keeps its outline under them
    const partArea = b.parts.reduce((s, p) => s + p.polys.reduce((t, q) => t + polyArea(q), 0), 0);
    if (b.parts.length && partArea > 0.6 * b.area) {
      stats.withParts++;
      const baseTop = heightOf(b.t, b.polys[0], 12);
      for (const p of b.parts) { emit(`${p.e.type}/${p.e.id}`, p.t, p.polys, b.t, baseTop); stats.parts++; }
      continue;
    }
    emit(`${b.e.type}/${b.e.id}`, b.t, b.polys);
    for (const p of b.parts) if ((num(p.t.min_height) ?? 0) > 0 || num(p.t.height) > heightOf(b.t, b.polys[0], 12)) { emit(`${p.e.type}/${p.e.id}`, p.t, p.polys, b.t); stats.parts++; }
  }
  for (const p of parts) if (p.orphan) emit(`${p.e.type}/${p.e.id}`, p.t, p.polys);
  // NYC footprints OSM does not have: inner point in no OSM building
  for (const f of fp) {
    if (f.used || !f.height) continue;
    const [x, y] = innerPoint(f.polys[0]);
    if (bGrid.at(x, y).some((b) => b.polys.some((q) => inPoly(x, y, q)))) continue;
    out.push({ id: `nyc/${f.bin}`, usage: f.height > 45 ? 401 : 461, storeys: 0, height: f.height, minHeight: 0, hint: 0, name: null, polygons: f.polys });
    stats.nycOnly++;
  }
  return { buildings: out, stats };
}

// Planimetric roadbed and sidewalk polygons: [{ kind: 'roadbed' | 'sidewalk', polygons }]
export function readNycStreets(roadbedFile, sidewalkFile) {
  const read = (file, kind) => JSON.parse(fs.readFileSync(file, 'utf8')).flatMap((r) => (r.the_geom?.coordinates?.length ? [{ kind, polygons: r.the_geom.coordinates }] : []));
  return [...read(roadbedFile, 'roadbed'), ...read(sidewalkFile, 'sidewalk')];
}
