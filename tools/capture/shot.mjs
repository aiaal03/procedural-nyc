// Headless screenshot of the running dev server: node shot.mjs <url> <out.png> [waitSeconds] [WxH]
import { launch } from './browser.mjs';
setTimeout(() => { console.log('timeout'); process.exit(2); }, 150000).unref();
const [url, out, wait = '25', size = '1600x900'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await launch([`--window-size=${w},${h}`]);
const page = await browser.newPage();
await page.setViewport({ width: w, height: h });
page.on('console', (m) => { if (['error', 'warning', 'warn'].includes(m.type()) && !/GL_INVALID|deprecated|PCFSoft/.test(m.text())) console.log('console', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, Number(wait) * 1000));
console.log(await page.evaluate(() => document.getElementById('hud')?.innerText.split('\n').slice(0, 4).join(' | ')));
await page.screenshot({ path: out });
await browser.close();
