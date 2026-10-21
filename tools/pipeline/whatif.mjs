// "What if the Twin Towers still stood": the World Trade Center as it was built (1973), on its superblock in the
// Lower Manhattan area. Everything that stands on the site today goes (One, 3 and 4 World Trade Center, the Oculus,
// the memorial and its pools, Greenwich and Fulton Streets through the site); the old complex comes back: the
// two towers on the footprints the pools now mark, the Marriott (3 WTC) and the low 4, 5 and 6 WTC round the plaza.
// World metres of the downtown area (origin City Hall Park): x east, z south.
import { MATERIAL } from '../../src/shared/tileformat.js';

// The superblock, from the street lines: Vesey/West, Vesey/Church, Liberty/Church, Liberty/West.
const A = [-482, -355], B = [-179, -173], C = [-309, 93], D = [-541, -56];
const U = [0.858, 0.515], V = [-0.515, 0.858]; // along Vesey Street, and across it towards Liberty Street
const at = (u, v) => [A[0] + U[0] * u + V[0] * v, A[1] + U[1] * u + V[1] * v];
const rect = (u0, v0, u1, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];

const inQuad = (x, z, q) => {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, zi] = q[i], [xj, zj] = q[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; }
  return c;
};
// the block itself, and the same drawn in by `inset` metres (the streets round it stay)
const shrink = (q, d) => { const cx = q.reduce((s, p) => s + p[0], 0) / 4, cz = q.reduce((s, p) => s + p[1], 0) / 4; return q.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x - ((x - cx) / l) * d, z - ((z - cz) / l) * d]; }); };
export const SITE = [A, B, C, D];
export const onSite = (x, z, inset = 0) => inQuad(x, z, inset ? shrink(SITE, inset) : SITE);

// The towers: 63.4 m square (208 ft), centred on the memorial pools, which are set on their footprints.
const tower = (c, h) => { const s = 63.4 / 2; return [[c[0] + (-U[0] - V[0]) * s, c[1] + (-U[1] - V[1]) * s], [c[0] + (U[0] - V[0]) * s, c[1] + (U[1] - V[1]) * s], [c[0] + (U[0] + V[0]) * s, c[1] + (U[1] + V[1]) * s], [c[0] + (-U[0] + V[0]) * s, c[1] + (-U[1] + V[1]) * s]]; };
const square = (c, s) => tower(c, 0).map(([x, z]) => [c[0] + ((x - c[0]) * s) / 63.4, c[1] + ((z - c[1]) * s) / 63.4]);
const NORTH = [-437, -182], SOUTH = [-429, -59];
const SILVER = (0x80000000 | 0xb9bdc2 | (MATERIAL.METAL << 24)) >>> 0;
const STONE = (0x80000000 | 0x8f8a84) >>> 0;

// [{ ring (world x, z), height, minHeight, storeys, usage, hint }]
export const WTC = [
  { ring: tower(NORTH), height: 417, storeys: 110, usage: 401, hint: SILVER },              // 1 WTC, the North Tower
  { ring: square([NORTH[0], NORTH[1]], 14), minHeight: 417, height: 12, usage: 454, hint: SILVER }, // the antenna's base
  { ring: square([NORTH[0], NORTH[1]], 3.2), minHeight: 429, height: 98, usage: 454, hint: SILVER }, // the mast, to 527 m
  { ring: tower(SOUTH), height: 415, storeys: 110, usage: 401, hint: SILVER },              // 2 WTC, the South Tower
  { ring: rect(92, 196, 160, 258), height: 73, storeys: 22, usage: 403, hint: STONE },      // 3 WTC, the Marriott
  { ring: rect(262, 200, 362, 282), height: 36, storeys: 9, usage: 401, hint: STONE },      // 4 WTC
  { ring: rect(250, 10, 342, 92), height: 36, storeys: 9, usage: 401, hint: STONE },        // 5 WTC
  { ring: rect(18, 12, 108, 86), height: 31, storeys: 8, usage: 431, hint: STONE },         // 6 WTC, the custom house
];
// The Austin J. Tobin Plaza: the whole block paved, drawn in from the kerbs.
export const PLAZA = shrink(SITE, 10);
