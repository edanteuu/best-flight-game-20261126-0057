// Storm weather for Nusa Airlift: driving rain and the occasional lightning
// flash over the squall missions. The rain is one Points cloud that follows the
// plane — drops recycle above the camera — so a storm costs one draw call. The
// lightning is a timer that returns a flash value; the renderer turns that into
// light, so the flash and the sky stay in sync. Clear-day missions never see it.

import * as THREE from 'three';
import { PALETTE } from './config.js';

const RAIN_COUNT = 900;
const BOX = { x: 260, y: 190, z: 260 };

/** A short vertical streak texture, drawn once on a canvas. */
function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, 'rgba(188,216,255,0)');
  grad.addColorStop(0.5, 'rgba(188,216,255,0.85)');
  grad.addColorStop(1, 'rgba(188,216,255,0)');
  g.fillStyle = grad;
  g.fillRect(3, 0, 2, 32);
  return new THREE.CanvasTexture(c);
}

/**
 * Build the weather system on `scene`. Returns:
 * setStorm(on) — show or hide the squall; update(dt, time, anchor) — move the
 * rain around `anchor` (the plane) and return the lightning flash level 0..1.
 */
export function createWeather(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(RAIN_COUNT * 3);
  const drops = [];
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    drops.push({
      x: (Math.random() - 0.5) * BOX.x,
      y: Math.random() * BOX.y,
      z: (Math.random() - 0.5) * BOX.z,
      speed: 150 + Math.random() * 70,
    });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3.2, map: streakTexture(), color: PALETTE.rain,
    transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true,
  }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  let storm = false;
  let nextFlash = 6 + Math.random() * 8;
  let flash = 0;
  let flashTime = 0;

  function setStorm(on) {
    storm = !!on;
    rain.visible = storm;
    if (!storm) flash = 0;
  }

  /** Advance the rain and the lightning clock. `anchor` is the plane's position. */
  function update(dt, time, anchor) {
    if (!storm) return 0;
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const d = drops[i];
      d.y -= d.speed * dt;
      d.x += 14 * dt; // the squall drives the rain sideways
      if (d.y < -20) {
        d.y = BOX.y - 10 + Math.random() * 20;
        d.x = (Math.random() - 0.5) * BOX.x;
        d.z = (Math.random() - 0.5) * BOX.z;
      }
      pos[i * 3] = anchor.x + d.x;
      pos[i * 3 + 1] = anchor.y + d.y - BOX.y / 2;
      pos[i * 3 + 2] = anchor.z + d.z;
    }
    geo.attributes.position.needsUpdate = true;
    // Lightning: a double pulse every few seconds, then dark again.
    nextFlash -= dt;
    if (nextFlash <= 0) {
      flash = 1;
      flashTime = 0;
      nextFlash = 5 + Math.random() * 9;
    }
    if (flash > 0) {
      flashTime += dt;
      // Two quick pulses inside one strike: bright, dip, bright, gone.
      const t = flashTime;
      flash = t < 0.07 ? 1 : t < 0.14 ? 0.25 : t < 0.21 ? 0.85 : t < 0.3 ? 0 : 0;
      if (flashTime > 0.3) flash = 0;
    }
    return flash;
  }

  return { setStorm, update };
}
