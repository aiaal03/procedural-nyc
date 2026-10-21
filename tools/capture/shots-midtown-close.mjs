// Midtown film, close: 20 s in four shots, each on one subject with a long lens. World metres from Bryant Park:
// x east, y up, z south. Empire State (-130, 0, 553) spire 443 m · One Times Square (-171, 0, -299) · Broadway runs
// up through (-47, 0, -650). Avenues run 29° east of north.
export const area = 'midtown';
const ease = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const orbit = (c, deg, r, y) => [c[0] + Math.cos(deg * Math.PI / 180) * r, y, c[2] + Math.sin(deg * Math.PI / 180) * r];
const ESB = [-130, 0, 553];

export const shots = [
  { // day: in on the Empire State from the south-east
    seconds: 5, hour: [15.2, 15.25], fov: 36,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 55 + 18 * e, 640 - 200 * e, 240 + 50 * e), target: [ESB[0], 250 + 30 * e, ESB[2]] }; },
  },
  { // golden hour: the tower lit orange, round from the north
    seconds: 5, hour: [17.5, 17.62], fov: 30, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 250 + 30 * e, 620, 330 - 20 * e), target: [ESB[0], 290, ESB[2]] }; },
  },
  { // night: down Broadway into Times Square, the screens and the traffic
    seconds: 5, hour: [21.4, 21.45], fov: 44,
    cam: (u) => { const e = ease(u); return { pos: lerp([-30, 180, -730], [-55, 150, -640], e), target: lerp([-150, 20, -360], [-165, 25, -320], e) }; },
  },
  { // night: the Empire State lit, the city behind
    seconds: 5, hour: [21.6, 21.65], fov: 32, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 120 + 25 * e, 400 - 60 * e, 330), target: [ESB[0], 290 + 15 * e, ESB[2]] }; },
  },
];
