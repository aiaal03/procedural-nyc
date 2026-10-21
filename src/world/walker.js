// Walking the city: through the eyes of a person on the street (first person). WASD to walk (Shift: run), the
// mouse to look round (the pointer is locked to the picture), Space to jump; Space twice in quick succession to take
// off and fly (then Space rises, C sinks, Shift is fast), twice again to drop out of the air. The person stands on
// the ground and on roofs, and walks into the walls of buildings rather than through them: the footprints of the
// tiles round about are read from the same tile files the city is built from.
import * as THREE from 'three';
import { decodeTile } from '../shared/tileformat.js';
import { TILE, tileKey } from '../shared/geo.js';

const GRAVITY = 24, JUMP = 7.8, WALK = 4.2, RUN = 10, FLY = 28, FLY_FAST = 110;
const RADIUS = 0.45, HEIGHT = 1.8, STEP = 0.6; // body; how high a kerb or a step can be walked up
const EYE = 1.65;                                 // eyes above the feet
const DOUBLE_TAP = 0.32;                          // seconds between the two presses that make a take-off

const insideRing = (x, z, r) => {
  let c = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

// The footprints of the buildings round the person: [{ rings, box: [x0, z0, x1, z1], bottom, top }] per tile.
class Footprints {
  constructor(base, manifest) { this.base = base; this.manifest = manifest; this.tiles = new Map(); this.files = new Map(manifest.tiles.map((t) => [tileKey(t.x, t.z), t.file])); }
  // loads the 3 x 3 tiles round (x, z)
  near(x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    for (let i = tx - 1; i <= tx + 1; i++) for (let j = tz - 1; j <= tz + 1; j++) {
      const k = tileKey(i, j);
      if (this.tiles.has(k) || !this.files.has(k)) continue;
      this.tiles.set(k, []);
      fetch(`${this.base}/${this.files.get(k)}`).then((r) => r.arrayBuffer()).then((buf) => {
        const list = [];
        for (const b of decodeTile(buf).buildings) for (const rings of b.polygons) {
          const o = rings[0];
          let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
          for (let n = 0; n < o.length; n += 2) { x0 = Math.min(x0, o[n]); x1 = Math.max(x1, o[n]); z0 = Math.min(z0, o[n + 1]); z1 = Math.max(z1, o[n + 1]); }
          list.push({ rings, box: [x0, z0, x1, z1], bottom: b.base, top: b.base + b.height });
        }
        this.tiles.set(k, list);
      }).catch(() => {});
    }
  }
  // every building whose footprint (grown by `pad`) holds (x, z)
  *at(x, z, pad = 0) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    for (let i = tx - 1; i <= tx + 1; i++) for (let j = tz - 1; j <= tz + 1; j++) for (const b of this.tiles.get(tileKey(i, j)) ?? []) {
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - pad || x > x1 + pad || z < z0 - pad || z > z1 + pad) continue;
      const hit = (px, pz) => insideRing(px, pz, b.rings[0]) && !b.rings.slice(1).some((h) => insideRing(px, pz, h));
      if (hit(x, z) || (pad > 0 && (hit(x + pad, z) || hit(x - pad, z) || hit(x, z + pad) || hit(x, z - pad)))) yield b;
    }
  }
}

export class Walker {
  // ground(x, z): the terrain under a point; base: the area's tile directory.
  constructor(scene, camera, dom, manifest, base, ground) {
    this.camera = camera; this.dom = dom; this.ground = ground;
    this.prints = new Footprints(base, manifest);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.flying = false; this.onGround = false; this.phase = 0; this.bob = 0;
    this.active = false; this.keys = new Set(); this.lastSpace = -1; this.clock = 0;
    addEventListener('keydown', (e) => {
      if (!this.active || e.target?.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.space();
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    dom.addEventListener('click', () => { if (this.active && document.pointerLockElement !== dom) dom.requestPointerLock?.(); });
    addEventListener('mousemove', (e) => {
      if (!this.active || document.pointerLockElement !== dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.45, 1.45);
    });
  }

  // Puts the person on the street at (x, z), facing `yaw` (radians, 0: north).
  start(x, z, yaw = 0) {
    this.pos.set(x, this.support(x, z, 1e4), z);
    this.vel.set(0, 0, 0); this.yaw = yaw; this.flying = false;
    this.prints.near(x, z);
  }

  set enabled(on) {
    this.active = on;
    if (!on && document.pointerLockElement === this.dom) document.exitPointerLock();
    this.keys.clear();
  }

  // Space: a jump, or — the second press within DOUBLE_TAP — take-off (or, flying, a fall back to earth).
  space() {
    const now = this.clock;
    if (now - this.lastSpace < DOUBLE_TAP) {
      this.flying = !this.flying; this.vel.y = this.flying ? 4 : 0; this.lastSpace = -1;
      return;
    }
    this.lastSpace = now;
    if (!this.flying && this.onGround) { this.vel.y = JUMP; this.onGround = false; }
  }

  // What the feet can stand on at (x, z) for a person whose feet are at `y`: the ground, or the highest roof
  // not above the feet by more than a step.
  support(x, z, y) {
    let h = this.ground(x, z);
    for (const b of this.prints.at(x, z)) if (b.top <= y + STEP && b.top > h) h = b.top;
    return h;
  }
  // A wall in the way: a building the body (feet at y) would stand in.
  blocked(x, z, y) {
    for (const b of this.prints.at(x, z, RADIUS)) if (b.top > y + STEP && b.bottom < y + HEIGHT) return true;
    return false;
  }

  update(dt) {
    this.clock += dt;
    const k = this.keys, fast = k.has('ShiftLeft') || k.has('ShiftRight');
    this.prints.near(this.pos.x, this.pos.z);
    // the wish: forward is where the camera looks (yaw 0: north, which is -z)
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) { mx += fx; mz += fz; }
    if (k.has('KeyS') || k.has('ArrowDown')) { mx -= fx; mz -= fz; }
    if (k.has('KeyA') || k.has('ArrowLeft')) { mx += fz; mz -= fx; }
    if (k.has('KeyD') || k.has('ArrowRight')) { mx -= fz; mz += fx; }
    const len = Math.hypot(mx, mz), moving = len > 0;
    if (moving) { mx /= len; mz /= len; }
    const speed = this.flying ? (fast ? FLY_FAST : FLY) : fast ? RUN : WALK;
    // a little inertia: quick to start and to stop on foot, smoother in the air
    const grip = this.flying ? 3 : this.onGround ? 14 : 3;
    this.vel.x += (mx * speed - this.vel.x) * Math.min(1, grip * dt);
    this.vel.z += (mz * speed - this.vel.z) * Math.min(1, grip * dt);
    if (this.flying) {
      const up = (k.has('Space') ? 1 : 0) - (k.has('KeyC') || k.has('ControlLeft') ? 1 : 0);
      this.vel.y += (up * (fast ? 60 : 16) - this.vel.y) * Math.min(1, 4 * dt);
    } else this.vel.y -= GRAVITY * dt;

    // move, sliding along walls: x and z each on their own
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (!this.blocked(nx, this.pos.z, this.pos.y)) this.pos.x = nx; else this.vel.x = 0;
    if (!this.blocked(this.pos.x, nz, this.pos.y)) this.pos.z = nz; else this.vel.z = 0;
    this.pos.y += this.vel.y * dt;
    const floor = this.support(this.pos.x, this.pos.z, this.pos.y - this.vel.y * dt);
    this.onGround = false;
    if (this.pos.y <= floor) {
      this.pos.y = floor; this.vel.y = Math.max(0, this.vel.y); this.onGround = !this.flying || this.vel.y <= 0;
    } else if (!this.flying && floor > this.pos.y - STEP && this.vel.y <= 0 && this.pos.y - floor < 0.05) this.onGround = true;
    // (out of the air onto the ground: on foot again)
    if (this.flying && this.onGround && k.has('KeyC')) this.flying = false;

    this.look(dt, moving);
  }

  // The camera at the eyes, looking where the mouse turned it; a little bob in the step when walking.
  look(dt, moving) {
    const h = Math.hypot(this.vel.x, this.vel.z), walking = this.onGround && moving && !this.flying;
    this.phase += dt * (walking ? h * 1.9 : 0);
    this.bob += ((walking ? Math.min(1, h / RUN) : 0) - this.bob) * Math.min(1, 8 * dt);
    const cp = Math.cos(this.pitch);
    this.camera.position.set(this.pos.x, this.pos.y + EYE + Math.abs(Math.sin(this.phase)) * 0.06 * this.bob, this.pos.z);
    this.camera.lookAt(this.pos.x - Math.sin(this.yaw) * cp, this.camera.position.y + Math.sin(this.pitch), this.pos.z - Math.cos(this.yaw) * cp);
  }
}
