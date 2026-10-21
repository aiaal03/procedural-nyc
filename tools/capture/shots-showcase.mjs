// The app, shown off: 20 s in eight shots — on foot in Times Square, a jump, take-off, a run down Seventh Avenue,
// round the Empire State's spire, golden hour to night, and a dive back into the square. World metres from Bryant
// Park: x east, y up, z south. Times Square's axis (-168, -290) to (-37, -650), One Times Square (-171, 0, -299);
// Seventh Avenue runs through (-472, 0, 198) and (70, 0, -780); the Empire State (-130, 0, 553), spire 443 m.
export const area = 'midtown';
const ease = (u) => u * u * (3 - 2 * u), easeIn = (u) => u * u * u, easeOut = (u) => 1 - (1 - u) ** 3;
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const orbit = (c, deg, r, y) => [c[0] + Math.cos(deg * Math.PI / 180) * r, y, c[2] + Math.sin(deg * Math.PI / 180) * r];
const S = [-0.375, 0.927];                         // Times Square, looking south towards One Times Square
const N = [0.342, -0.940];                         // and up it, north towards Duffy Square
const P0 = [-92, -497];                            // a run down the plaza
const at = (d, y, side = 15) =>  // (side 15: on the sidewalk, out of the traffic)
   [P0[0] + S[0] * d + S[1] * side, y, P0[1] + S[1] * d - S[0] * side];
const SEVENTH = (t, y) => [-472 + 542 * t, y, 198 - 978 * t];  // t: 0 at 34th Street .. 1 at 50th
const ESB = [-130, 0, 553];
const bob = (u, steps) => Math.abs(Math.sin(u * Math.PI * steps)) * 0.08;
const GOLD = 17.55;

export const shots = [
  { id: 'run', seconds: 2.5, hour: [GOLD, GOLD], fov: 62, mirror: true, ssr: false,
    cam: (u) => ({ pos: at(10 + 22 * u, 1.65 + bob(u, 9)), target: at(40 + 22 * u, 4 + 6 * u) }) },
  { id: 'look-round', seconds: 1.5, hour: [GOLD, GOLD], fov: 66, ssr: false,
    // hanging over the middle of the square, turning from east to north and looking up the walls of screens
    cam: (u) => { const e = ease(u), a = -0.9 + 1.25 * e, c = [-110, 0, -450]; return { pos: [c[0], 8 + 3 * e, c[2]], target: [c[0] + (N[0] * Math.cos(a) - N[1] * Math.sin(a)) * 30, 8 + 22 * e, c[2] + (N[1] * Math.cos(a) + N[0] * Math.sin(a)) * 30] }; } },
  { id: 'jump', seconds: 1.5, hour: [GOLD, GOLD], fov: 64, ssr: false,
    // back on the sidewalk, the other way: north, towards Duffy Square
    cam: (u) => { const y = 1.65 + 1.3 * 4 * u * (1 - u); return { pos: at(34 - 7 * u, y), target: at(4 - 7 * u, y + 3) }; } },
  { id: 'take-off', seconds: 2.5, hour: [GOLD, GOLD + 0.02], ssr: false,
    cam: (u) => { const e = easeIn(u), y = 2 + 170 * e; return { pos: at(26 - 30 * u, y, 15 - 9 * u), target: at(-18 - 40 * u, y + 30 - 50 * u), fov: 62 + 22 * u }; } },
  { id: 'seventh', seconds: 3, hour: [GOLD + 0.02, GOLD + 0.04], ssr: false,
    cam: (u) => { const t = 0.47 - 0.42 * u; return { pos: SEVENTH(t, 120 - 25 * u), target: SEVENTH(t - 0.25, 60), fov: 80 - 10 * u }; } },
  { id: 'spire', seconds: 3, hour: [GOLD + 0.04, GOLD + 0.08], clouds: false, ssr: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 200 - 130 * e, 130 - 20 * e, 360 - 30 * e), target: [ESB[0], 345 + 30 * e, ESB[2]], fov: 52 }; } },
  { id: 'timelapse', seconds: 3, hour: [GOLD + 0.1, 20.7], clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit([0, 0, 0], 95 + 35 * e, 1500 - 200 * e, 520 - 60 * e), target: [-60, 120, 80], fov: 40 }; } },
  { id: 'dive', seconds: 3, hour: [21.2, 21.2], fov: 60, clouds: false, ssr: false,
    cam: (u) => { const e = easeOut(u); return { pos: lerp([-20, 330, -760], [-95, 26, -520], e), target: lerp([-130, 40, -420], [-165, 34, -320], e) }; } },
];
