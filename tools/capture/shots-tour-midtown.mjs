// New York tour, the Midtown shots (cut together with shots-tour-twintowers.mjs by tools/capture/tour.sh).
// World metres from Bryant Park: x east, y up, z south. Empire State (-130, 0, 553) · Times Square (-171, 0, -299)
// Hudson Yards (-1450, 0, -50) · Chrysler (775, 0, 221) and One Vanderbilt (503, 0, 64)
// Billionaires' Row: Central Park Tower (302, 0, -1436), One57 (466, 0, -1335), 432 Park (1060, 0, -911)
export const area = 'midtown';
const ease = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const orbit = (c, deg, r, y) => [c[0] + Math.cos(deg * Math.PI / 180) * r, y, c[2] + Math.sin(deg * Math.PI / 180) * r];
const ESB = [-130, 0, 553];
const S = 4.5;

export const shots = [
  { id: 'esb-day', seconds: S, hour: [14.6, 14.65], fov: 36,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 55 + 18 * e, 640 - 200 * e, 240 + 50 * e), target: [ESB[0], 250 + 30 * e, ESB[2]] }; } },
  { id: 'hudson-yards', seconds: S, hour: [15.0, 15.05], fov: 30,
    cam: (u) => { const e = ease(u); return { pos: lerp([-2350, 170, 260], [-2200, 200, 120], e), target: [-1430, 190, -60] }; } },
  { id: 'billionaires', seconds: S, hour: [15.6, 15.65], fov: 30,
    cam: (u) => { const e = ease(u); return { pos: lerp([620, 300, -250], [580, 330, -420], e), target: lerp([480, 260, -1250], [470, 280, -1280], e) }; } },
  { id: 'chrysler-golden', seconds: S, hour: [17.4, 17.5], fov: 30, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit([640, 0, 140], 75 + 30 * e, 850, 260), target: [640, 210, 140] }; } },
  { id: 'esb-golden', seconds: S, hour: [17.55, 17.65], fov: 30, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 250 + 30 * e, 620, 330 - 20 * e), target: [ESB[0], 290, ESB[2]] }; } },
  { id: 'times-square', seconds: S, hour: [21.4, 21.45], fov: 44,
    cam: (u) => { const e = ease(u); return { pos: lerp([-30, 180, -730], [-55, 150, -640], e), target: lerp([-150, 20, -360], [-165, 25, -320], e) }; } },
  { id: 'esb-night', seconds: S, hour: [21.6, 21.65], fov: 32, clouds: false,
    cam: (u) => { const e = ease(u); return { pos: orbit(ESB, 120 + 25 * e, 400 - 60 * e, 330), target: [ESB[0], 290 + 15 * e, ESB[2]] }; } },
];
