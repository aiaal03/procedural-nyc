// Renders a camera film of the running dev server frame by frame, on a virtual clock (every frame exactly 1/fps
// of a second, however long it takes to draw), into PNG frames: node film.mjs <shots.mjs> <outDir> [WxH] [fps]
// shots.mjs exports `shots`: [{ seconds, area?, hour: [from, to], cam: (u) => ({ pos: [x, y, z], target: [x, y, z] }) }]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const [shotsFile, outDir, size = '1920x1080', fpsArg = '30'] = process.argv.slice(2);
const { shots, area = 'midtown', base = 'http://localhost:5280/' } = await import(pathToFileURL(path.resolve(shotsFile)).href);
const [W, H] = size.split('x').map(Number), FPS = Number(fpsArg);
fs.mkdirSync(outDir, { recursive: true });

const browser = await launch([`--window-size=${W},${H}`]);
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', (e) => console.log('pageerror', e.message));
// A clock and a frame loop the film drives: until __film.manual is set they run as usual.
await page.evaluateOnNewDocument(() => {
  const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window);
  const film = window.__film = { manual: false, now: 0, queue: [] };
  performance.now = () => (film.manual ? film.now : realNow());
  window.requestAnimationFrame = (cb) => { if (film.manual) { film.queue.push(cb); return 0; } return realRaf(cb); };
  film.step = (dt) => { film.now += dt * 1000; const q = film.queue; film.queue = []; for (const cb of q) cb(film.now); };
  const css = document.createElement('style');
  css.textContent = '#hud,#mode,#github,#credits,.lil-gui,#histogram,#walk,#walk-hint{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
});
await page.goto(`${base}?area=${area}&time=${shots[0].hour[0]}&preview=0&walk=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && document.getElementById('loader')?.classList.contains('done'), { timeout: 300000 });
// the whole city, loaded before the first frame
await page.evaluate(() => { const a = window.__app; a.streamer.radius = 1e5; a.controls.enableDamping = false; a.clockTime.live = false; });
for (let i = 0; i < 120; i++) {
  const s = await page.evaluate(() => [window.__app.streamer.stats.loaded, window.__app.streamer.pending]);
  process.stdout.write(`\rwarming: ${s[0]} tiles, ${s[1]} pending   `);
  if (s[1] === 0 && i > 5) break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log();
const startNow = await page.evaluate(() => { window.__film.now = performance.now(); window.__film.manual = true; return window.__film.now; });

let n = 0;
for (const [si, shot] of shots.entries()) {
  const frames = Math.round(shot.seconds * FPS);
  // STILLS=1: only the first, middle and last frame of every shot, to check the framing
  const keep = (k) => !process.env.STILLS || k === 0 || k === frames - 1 || k === Math.floor(frames / 2);
  await page.evaluate((on, mirror, ssr) => { window.__app.atmosphere.cloudsOn = on; window.__app.waterMirror.enabled = mirror; window.__app.atmosphere.reflectionPass.enabled = ssr; }, shot.clouds ?? true, shot.mirror ?? true, shot.ssr ?? true);
  // settle the new shot: a few frames at its first position (the environment map, the lamps and the shadows follow)
  for (let k = -12; k < frames; k++) {
    const u = Math.max(0, k) / Math.max(1, frames - 1);
    const { pos, target, fov: camFov } = shot.cam(u), hour = shot.hour[0] + (shot.hour[1] - shot.hour[0]) * u;
    await page.evaluate((pos, target, hour, dt, fov) => {
      const a = window.__app;
      if (a.camera.fov !== fov) { a.camera.fov = fov; a.camera.updateProjectionMatrix(); }
      a.clockTime.live = false; a.clockTime.hour = hour;
      a.controls.target.set(...target); a.camera.position.set(...pos);
      window.__film.step(dt);
      a.camera.position.set(...pos); a.camera.lookAt(...target);
    }, pos, target, hour, 1 / FPS, camFov ?? shot.fov ?? 55);
    if (k < 0 || !keep(k)) continue;
    const file = path.join(outDir, `f_${String(n).padStart(5, '0')}.png`);
    if (!fs.existsSync(file)) await page.screenshot({ path: file }); // (a crashed run is started again: what is done is kept)
    n++;
    if (n % 30 === 0) process.stdout.write(`\rshot ${si + 1}/${shots.length}: frame ${n}   `);
  }
}
console.log(`\n${n} frames -> ${outDir}`);
await browser.close();
