// What if the Twin Towers still stood: 20 s in four shots over Lower Manhattan. World metres from City Hall Park:
// x east, y up, z south. North Tower (-437, 0, -182) 417 m, mast to 527 m · South Tower (-429, 0, -59) 415 m.
export const area = 'twintowers';
const ease = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const orbit = (c, deg, r, y) => [c[0] + Math.cos(deg * Math.PI / 180) * r, y, c[2] + Math.sin(deg * Math.PI / 180) * r];
const TWINS = [-433, 0, -120];

export const shots = [
  { // day: in over the Hudson towards the towers
    seconds: 5, hour: [14.8, 14.85], fov: 34,
    cam: (u) => { const e = ease(u); return { pos: lerp([-1900, 180, -60], [-1350, 230, -100], e), target: [TWINS[0], 250 + 20 * e, TWINS[2]] }; },
  },
  { // golden hour: round the pair from the harbour
    seconds: 5, hour: [17.45, 17.6], fov: 32, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(TWINS, 8 + 38 * e, 900, 330), target: [TWINS[0], 260, TWINS[2]] }; },
  },
  { // dusk: the skyline from the East River, the Brooklyn Bridge below
    seconds: 5, hour: [17.85, 17.95], fov: 24, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: lerp([1250, 90, 520], [1150, 110, 420], e), target: lerp([-380, 210, -90], [-400, 230, -110], e) }; },
  },
  { // night: the towers lit, from the north over Tribeca
    seconds: 5, hour: [21.5, 21.55], fov: 34, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(TWINS, 196 + 26 * e, 820 - 80 * e, 360), target: [TWINS[0], 270, TWINS[2]] }; },
  },
];
