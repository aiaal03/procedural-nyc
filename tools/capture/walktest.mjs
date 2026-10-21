// Drives the walking person headless and takes a picture after each step: node walktest.mjs <outDir>
import fs from 'node:fs';
import { launch } from './browser.mjs';
setTimeout(() => process.exit(2), 240000).unref();
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://localhost:5280/?area=midtown&preview=0', { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && document.getElementById('loader')?.classList.contains('done'), { timeout: 120000 });
await new Promise((r) => setTimeout(r, 4000));
const state = () => page.evaluate(() => { const w = window.__app.walker; return `pos ${w.pos.x.toFixed(1)},${w.pos.y.toFixed(1)},${w.pos.z.toFixed(1)} fly ${w.flying} ground ${w.onGround}`; });
const shot = async (name) => { await new Promise((r) => setTimeout(r, 300)); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name, await state(), await page.evaluate(() => window.__app.clockTime.label())); };
const hold = async (key, ms) => { await page.keyboard.down(key); await new Promise((r) => setTimeout(r, ms)); await page.keyboard.up(key); };
await shot('0-start');
await hold('KeyW', 2500); await shot('1-walked');
await page.keyboard.press('Space');
for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 120)); console.log('  jump', await state()); }
await shot('2-jump');
await new Promise((r) => setTimeout(r, 1200));
await page.keyboard.press('Space'); await new Promise((r) => setTimeout(r, 120)); await page.keyboard.press('Space');
await hold('Space', 3500); await shot('3-took-off');
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await new Promise((r) => setTimeout(r, 2500)); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await shot('4-flying');
await browser.close();
