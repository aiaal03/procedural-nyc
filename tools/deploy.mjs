// Builds the site and publishes it to GitHub Pages: the contents of dist/ become the one commit of the
// gh-pages branch of `origin` (force-pushed, so the branch never grows with old copies of the tiles).
// The compiled cities (public/tiles, public/ortho, public/textures) are not in the repository: whatever has
// been fetched and compiled on this machine is what gets published.
// Usage: npm run deploy
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..'), DIST = path.join(ROOT, 'dist');
const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' });
const read = (cmd, cwd = ROOT) => execSync(cmd, { cwd }).toString().trim();

const areas = path.join(ROOT, 'public/tiles/areas.json');
if (!fs.existsSync(areas)) throw new Error('no compiled city in public/tiles: run "npm run fetch" and "npm run compile" first');
const remote = read('git remote get-url origin'), head = read('git rev-parse --short HEAD');

run('npx vite build');
fs.writeFileSync(path.join(DIST, '.nojekyll'), ''); // (serve the files as they are)
// Imagery that may not be republished stays out: Esri's photos of the land round the New York areas are fetched for
// one's own use, so the published backdrop keeps its terrain without them (and its credit line goes too).
for (const dir of fs.existsSync(path.join(DIST, 'tiles')) ? fs.readdirSync(path.join(DIST, 'tiles')) : []) {
  const file = path.join(DIST, 'tiles', dir, 'manifest.json');
  if (!fs.existsSync(file)) continue;
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!manifest.attribution?.some((a) => /Esri/.test(a))) continue;
  manifest.attribution = manifest.attribution.filter((a) => !/Esri/.test(a));
  fs.writeFileSync(file, JSON.stringify(manifest, null, 1));
  fs.rmSync(path.join(DIST, 'ortho', dir, 'backdrop'), { recursive: true, force: true });
}
// (an area that shares another's photos has them as a link in public/ortho: Pages serves files, not links)
for (const dir of fs.existsSync(path.join(DIST, 'ortho')) ? fs.readdirSync(path.join(DIST, 'ortho')) : []) {
  const p = path.join(DIST, 'ortho', dir);
  if (!fs.lstatSync(p).isSymbolicLink()) continue;
  const target = fs.realpathSync(p);
  fs.rmSync(p);
  fs.cpSync(target, p, { recursive: true, filter: (f) => !f.includes(`${path.sep}backdrop`) });
}

fs.rmSync(path.join(DIST, '.git'), { recursive: true, force: true });
run('git init -q -b gh-pages', DIST);
run('git -c core.autocrlf=false add -A', DIST); // (the files exactly as built)
run(`git -c core.autocrlf=false -c user.name="${read('git config user.name')}" -c user.email="${read('git config user.email')}" commit -q -m "Deploy ${head}"`, DIST);
run(`git push -f "${remote}" gh-pages`, DIST);
fs.rmSync(path.join(DIST, '.git'), { recursive: true, force: true });

const pages = remote.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
console.log(`\ndeployed ${head}${pages ? `: https://${pages[1]}.github.io/${pages[2]}/ (a minute or two until it is live)` : ''}`);
