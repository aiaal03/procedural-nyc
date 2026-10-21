// Billboards and LED screens (sign styles 3-5, placed by tools/pipeline/signs.mjs, placeAdsNyc). The artwork is
// a set of advertisements for invented brands (public/ads: wide_00..15.jpg at 16:9, tall_00..07.jpg at 9:16, made
// with an image model), packed into two atlases. A screen plays its family of posters in turn, each pushed in by
// the next, seen through an LED grid close up; a billboard is lit by floodlights at night. No real brand is used.
import * as THREE from 'three';
import { shared } from './materials.js';

export const WIDE = 16, TALL = 8;
const WC = 4, WR = 4, WW = 1024, WH = 576;  // the wide atlas: 4 x 4 cells
const TC = 4, TR = 2, TW = 576, TH = 1024;  // the tall atlas: 4 x 2 cells

function atlas(cols, rows, w, h, files) {
  const c = document.createElement('canvas');
  c.width = cols * w; c.height = rows * h;
  const g = c.getContext('2d');
  g.fillStyle = '#101218'; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  files.forEach((f, i) => {
    const img = new Image();
    img.onload = () => { g.drawImage(img, (i % cols) * w, Math.floor(i / cols) * h, w, h); t.needsUpdate = true; };
    img.src = f;
  });
  return t;
}

export class Ads {
  constructor() {
    const pad = (i) => String(i).padStart(2, '0');
    const wide = atlas(WC, WR, WW, WH, Array.from({ length: WIDE }, (_, i) => `ads/wide_${pad(i)}.jpg`));
    const tall = atlas(TC, TR, TW, TH, Array.from({ length: TALL }, (_, i) => `ads/tall_${pad(i)}.jpg`));
    // uv: position within the board (0-1); aAd: x poster index, y 0 board / 1 screen, z seed
    this.material = new THREE.MeshStandardMaterial({ map: wide, roughness: 0.45 });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uLampOn = { value: 0 }; shader.uniforms.uLampMap = shared.uLampMap; // (no lamp light here; the sampler still needs its texture)
      shader.uniforms.uNight = shared.uNight;
      shader.uniforms.uTime = shared.uTime;
      shader.uniforms.uTall = { value: tall };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aAd;\nvarying vec3 vAd;\nvarying vec2 vBoard;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAd = aAd;\nvBoard = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
          uniform float uNight, uTime;
          uniform sampler2D uTall;
          varying vec3 vAd;
          varying vec2 vBoard;
          vec3 gAd;
          vec3 poster(float index, vec2 at) {
            float i = floor(index + 0.5); // the index is interpolated: round it
            at = clamp(at, 0.002, 0.998);
            if (i < ${WIDE}.0) {
              vec2 cell = vec2(mod(i, ${WC}.0), ${WR - 1}.0 - floor(i / ${WC}.0));
              return texture2D(map, (cell + at) / vec2(${WC}.0, ${WR}.0)).rgb;
            }
            i -= ${WIDE}.0;
            vec2 cell = vec2(mod(i, ${TC}.0), ${TR - 1}.0 - floor(i / ${TC}.0));
            return texture2D(uTall, (cell + at) / vec2(${TC}.0, ${TR}.0)).rgb;
          }`)
        .replace('#include <map_fragment>', `
          if (vAd.y > 0.5) {
            // a screen: the next poster of its family pushes in every eight seconds or so; LED pixels close up
            float base = vAd.x < ${WIDE}.0 - 0.5 ? 0.0 : ${WIDE}.0, count = vAd.x < ${WIDE}.0 - 0.5 ? ${WIDE}.0 : ${TALL}.0;
            float t = uTime * 0.12 + vAd.z * 7.0, slide = smoothstep(0.9, 1.0, fract(t));
            float now = base + mod(vAd.x - base + floor(t), count), next = base + mod(now - base + 1.0, count);
            gAd = vBoard.x > 1.0 - slide ? poster(next, vec2(vBoard.x - 1.0 + slide, vBoard.y)) : poster(now, vec2(vBoard.x + slide, vBoard.y));
            vec2 led = fract(vBoard * vec2(384.0, 216.0));
            float fine = max(fwidth(vBoard.x * 384.0), fwidth(vBoard.y * 216.0));
            gAd *= mix(0.8 + 0.3 * step(0.18, led.x) * step(0.18, led.y), 1.0, smoothstep(0.25, 0.9, fine));
          } else gAd = poster(vAd.x, vBoard);
          diffuseColor.rgb *= gAd;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // screens glow day and night (brighter in the dark); a printed board under its floodlights at night
          totalEmissiveRadiance += gAd * (vAd.y > 0.5 ? 0.9 + 0.7 * uNight : 0.55 * uNight);`);
    };
    this.material.customProgramCacheKey = () => 'ads-nyc-1';
    this.frame = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
  }

  // ads: signs of style 3 (billboard on a wall), 4 (screen on a wall), 5 (billboard on a frame on the roof),
  // 6 (vertical banner on a wall).
  build(ads) {
    const pos = [], uv = [], ad = [], frame = [];
    for (const s of ads) {
      const rx = s.nz, rz = -s.nx, out = s.style === 4 ? 0.12 : 0.3; // reader's right; boards stand a little off the wall (screens close to it)
      const P = (side, up, off = out) => [s.x + rx * side * s.w / 2 + s.nx * off, s.y + (up - 0.5) * s.h, s.z + rz * side * s.w / 2 + s.nz * off];
      const corners = [P(-1, 0), P(1, 0), P(1, 1), P(-1, 0), P(1, 1), P(-1, 1)];
      for (const c of corners) pos.push(...c);
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      const seed = (Math.abs(s.x * 0.37 + s.z * 0.91) % 1);
      for (let i = 0; i < 6; i++) ad.push(s.color, s.style === 4 ? 1 : 0, seed);
      // a dark casing behind the board, and legs under a rooftop one
      const back = [P(-1.03, -0.03, out - 0.08), P(1.03, -0.03, out - 0.08), P(1.03, 1.03, out - 0.08), P(-1.03, 1.03, out - 0.08)];
      frame.push(...back[0], ...back[1], ...back[2], ...back[0], ...back[2], ...back[3]);
      if (s.style === 5) for (const side of [-0.8, 0, 0.8]) {
        const a = P(side - 0.03, 0, out - 0.1), b = P(side + 0.03, 0, out - 0.1), legs = 1.6;
        frame.push(a[0], a[1] - legs, a[2], b[0], b[1] - legs, b[2], ...b, a[0], a[1] - legs, a[2], ...b, ...a);
      }
    }
    const group = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aAd', new THREE.Float32BufferAttribute(ad, 3));
    geo.computeVertexNormals();
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(frame, 3));
    fgeo.computeVertexNormals();
    group.add(new THREE.Mesh(fgeo, this.frame), new THREE.Mesh(geo, this.material));
    return group;
  }
}
