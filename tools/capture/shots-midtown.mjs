// Midtown film, 20 s in three shots. World metres from Bryant Park: x east, y up, z south.
//   Empire State (-98, 0, 562) roof 380 m · Times Square (-84, 0, -500) · Chrysler (758, 0, 209) · Hudson x < -1700
export const area = 'midtown';
const ease = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const ESB = [-98, 300, 562];

export const shots = [
  { // day: in from over the Hudson towards the towers
    seconds: 6.5, hour: [14.6, 14.9],
    cam: (u) => { const e = ease(u); return { pos: lerp([-2600, 520, 1500], [-1250, 360, 980], e), target: lerp([-150, 160, 300], [-60, 220, 420], e) }; },
  },
  { // sunset: round the Empire State as the windows come on
    seconds: 6.5, hour: [17.35, 17.95],
    cam: (u) => {
      const a = (200 + 75 * ease(u)) * Math.PI / 180, r = 560 - 60 * u;
      return { pos: [ESB[0] + Math.cos(a) * r, 400 - 40 * u, ESB[2] + Math.sin(a) * r], target: [ESB[0], 290 + 20 * u, ESB[2]] };
    },
  },
  { // night: up Seventh Avenue (the grid runs 29° east of north) into Times Square, the screens and the traffic
    seconds: 7, hour: [21.5, 21.6],
    cam: (u) => {
      const e = ease(u), dir = [Math.sin(29 * Math.PI / 180), -Math.cos(29 * Math.PI / 180)], along = (d, y) => [-84 + dir[0] * d, y, -500 + dir[1] * d];
      return { pos: along(-780 + 440 * e, 250 - 50 * e), target: along(-80 + 360 * e, 20) };
    },
  },
];
