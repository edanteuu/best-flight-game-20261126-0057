// The painter: sky, sun, sea, islands, volcano, runway, rings and clouds, all in
// one flat sunny style, projected from the world with a small pseudo-3D camera.
// The camera sits behind and above the plane and looks along its heading, so the
// pilot always sees the same chase view: terrain ahead, aircraft in frame below.

import { PALETTE, RUNWAY, VIEW } from './config.js';

/** Screen names the loop and the screenshot stager share. */
export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LAND = 'land';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_CRASH = 'crash';

const DEG = Math.PI / 180;

/**
 * Project a world point (x, y, z) to screen space from the camera.
 * Returns null when the point is behind the camera. `scale` is pixels per metre.
 */
export function projectPoint(wx, wy, wz, cam) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  const sin = Math.sin(cam.heading);
  const cos = Math.cos(cam.heading);
  const rx = dx * cos - dz * sin; // right of the flight path
  const rz = dx * sin + dz * cos; // ahead of the camera
  if (rz < 8) return null;
  const scale = VIEW.focal / rz;
  return {
    x: VIEW.width / 2 + rx * scale,
    y: cam.horizonY - (wy - cam.y) * scale,
    scale,
    depth: rz,
  };
}

/** Camera pose: behind the plane, above it, looking along its heading. */
export function cameraFor(plane) {
  const back = 52;
  return {
    x: plane.x - Math.sin(plane.heading) * back,
    y: plane.y + 16,
    z: plane.z - Math.cos(plane.heading) * back,
    heading: plane.heading,
    horizonY: VIEW.horizonY - plane.pitch * 2.2,
  };
}

function skyGradient(ctx, horizonY) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, horizonY + 40);
}

function drawSun(ctx, time) {
  const sx = 1020 + Math.sin(time * 0.02) * 8;
  const sy = 108;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 120);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 230, 150, 0.45)');
  glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, Math.PI * 2);
  ctx.fill();
}

function drawSea(ctx, horizonY, plane, time) {
  const g = ctx.createLinearGradient(0, horizonY, 0, VIEW.height);
  g.addColorStop(0, PALETTE.seaShallow);
  g.addColorStop(0.25, '#1a7fa8');
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY, VIEW.width, VIEW.height - horizonY);
  // Sun glitter: a sparse sparkling lane under the sun.
  ctx.save();
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 14; i += 1) {
    const y = horizonY + 14 + ((i * 67 + Math.floor(time * 30)) % 280);
    const w = 24 + ((i * 31) % 60);
    const x = 1020 + Math.sin(i * 2.3 + time * 0.4) * (40 + (y - horizonY) * 0.4) - w / 2;
    ctx.fillStyle = 'rgba(255, 250, 210, 0.45)';
    ctx.fillRect(x, y, w, 2);
  }
  ctx.restore();
}

function drawFarIslands(ctx, cam, world) {
  for (const island of world.state.farIslands) {
    const p = projectPoint(island.x, 0, island.z, cam);
    if (!p) continue;
    const w = island.radius * p.scale * 2;
    if (w < 4) continue;
    ctx.fillStyle = 'rgba(70, 130, 170, 0.55)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w / 2, Math.max(4, w * 0.06), 0, Math.PI, 0);
    ctx.fill();
    if (island.peak > 0) {
      const peak = projectPoint(island.x, island.peak, island.z, cam);
      if (peak) {
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.28, p.y);
        ctx.lineTo(peak.x, peak.y);
        ctx.lineTo(p.x + w * 0.28, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawIsland(ctx, cam, island, time) {
  const base = projectPoint(island.x, 0, island.z, cam);
  if (!base || base.depth > 16000) return;
  const r = island.radius * base.scale;
  if (r < 3) return;
  const squash = 0.42;
  // Sand beach ring.
  ctx.fillStyle = PALETTE.sand;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, r, r * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  // Green interior.
  ctx.fillStyle = island.kind === 'volcano' ? PALETTE.jungle : PALETTE.grass;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, r * 0.86, r * squash * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  // Palm-speckle: darker green dots for jungle texture.
  ctx.fillStyle = 'rgba(20, 90, 40, 0.5)';
  for (let i = 0; i < 9; i += 1) {
    const a = i * 2.4 + island.x * 0.01;
    const rr = r * 0.55 * ((i * 37 % 10) / 10);
    ctx.beginPath();
    ctx.arc(base.x + Math.cos(a) * rr, base.y + Math.sin(a) * rr * squash * 0.7, Math.max(2, r * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
  // The volcano cone and its drifting smoke. The cone is narrower than the
  // island so the beaches and the runway stay visible around its foot.
  if (island.peak > 0) {
    const peak = projectPoint(island.x, island.peak, island.z, cam);
    if (peak) {
      const coneW = r * 0.62;
      ctx.fillStyle = PALETTE.volcanoRock;
      ctx.beginPath();
      ctx.moveTo(base.x - coneW, base.y);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(base.x + coneW, base.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 220, 0.85)';
      ctx.beginPath();
      ctx.moveTo(peak.x - coneW * 0.16, peak.y + (base.y - peak.y) * 0.16);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(peak.x + coneW * 0.16, peak.y + (base.y - peak.y) * 0.16);
      ctx.closePath();
      ctx.fill();
      // Smoke puffs drifting off the crater, small and light so they never
      // smudge the sky or hide the runway.
      for (let i = 0; i < 4; i += 1) {
        const drift = ((time * 12 + i * 26) % 90);
        const sp = projectPoint(island.x + drift * 1.2, island.peak + 26 + i * 22 + drift * 0.4, island.z - drift * 0.5, cam);
        if (sp) {
          ctx.fillStyle = `rgba(220, 220, 220, ${0.4 - i * 0.08})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, (6 + i * 4) * sp.scale * 6 + 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Island name, readable at a glance.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(island.name.toUpperCase(), base.x, base.y + r * squash + 20);
    }
  }
}

function drawRunway(ctx, cam) {
  const z0 = RUNWAY.zStart;
  const z1 = RUNWAY.zStart + RUNWAY.length;
  // Drawn a little wider than the physics strip so it reads as a runway from
  // a mile out: pale asphalt, bright edges and a dashed centreline.
  const half = 36;
  const corners = [
    projectPoint(RUNWAY.x - half, 2, z0, cam),
    projectPoint(RUNWAY.x + half, 2, z0, cam),
    projectPoint(RUNWAY.x + half, 2, z1, cam),
    projectPoint(RUNWAY.x - half, 2, z1, cam),
  ];
  if (corners.some((c) => c === null)) return;
  ctx.fillStyle = '#4d545e';
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Bright edge lines.
  ctx.strokeStyle = '#f5f5f0';
  ctx.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    const a = projectPoint(RUNWAY.x + side * (half - 3), 2.4, z0, cam);
    const b = projectPoint(RUNWAY.x + side * (half - 3), 2.4, z1, cam);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  // Dashed centreline, one dash per 120 m of runway.
  ctx.strokeStyle = PALETTE.runwayMark;
  ctx.lineWidth = 3;
  for (let z = z0 + 60; z < z1 - 40; z += 120) {
    const a = projectPoint(RUNWAY.x, 2.4, z, cam);
    const b = projectPoint(RUNWAY.x, 2.4, z + 60, cam);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  // Threshold bars at both ends.
  ctx.fillStyle = PALETTE.runwayMark;
  for (const z of [z0 + 24, z1 - 24]) {
    const a = projectPoint(RUNWAY.x - half + 4, 2.4, z, cam);
    const b = projectPoint(RUNWAY.x + half - 4, 2.4, z, cam);
    if (a && b) ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), 4);
  }
  // Approach lights: a short dotted line leading to the threshold.
  ctx.fillStyle = '#ffffff';
  for (let z = z0 - 500; z < z0 - 40; z += 110) {
    const a = projectPoint(RUNWAY.x - 14, 2.4, z, cam);
    const b = projectPoint(RUNWAY.x + 14, 2.4, z, cam);
    if (a) { ctx.beginPath(); ctx.arc(a.x, a.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    if (b) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // Runway label on approach, placed at the near end so it never sits on the volcano.
  const label = projectPoint(RUNWAY.x, 30, z0 + 120, cam);
  if (label && label.depth < 4000) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RUNWAY 36 · NUSA BESAR', label.x, label.y);
  }
}

function drawRing(ctx, cam, ring, isNext, time) {
  const p = projectPoint(ring.x, ring.y, ring.z, cam);
  if (!p) return;
  const rx = ring.radius * p.scale;
  const ry = rx * 0.92;
  if (rx < 4) return;
  const pulse = 1 + Math.sin(time * 4) * 0.06;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(pulse, pulse);
  ctx.lineWidth = isNext ? 7 : 4;
  ctx.strokeStyle = ring.passed ? 'rgba(93, 255, 143, 0.9)' : PALETTE.ringGlow;
  ctx.shadowColor = ring.passed ? '#5dff8f' : PALETTE.ring;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = ring.passed ? '#5dff8f' : PALETTE.ring;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (isNext) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(13, rx * 0.28)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ring.label, 0, -ry - 12);
    // Distance to the next ring, in metres.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`${Math.round(p.depth)} m`, 0, ry + 22);
  }
  ctx.restore();
}

function drawCloud(ctx, cam, cloud, time) {
  const p = projectPoint(cloud.x, cloud.y, cloud.z, cam);
  if (!p) return;
  const s = cloud.size * p.scale * 0.9;
  if (s < 3) return;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x - s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 215, 235, 0.5)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + s * 0.16, s * 0.9, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Paint the whole world for one frame: sky, sun, far islands, sea, near islands,
 * runway, rings (far to near) and clouds. `plane` is the aircraft state.
 */
export function drawScene(ctx, plane, world, time) {
  const cam = cameraFor(plane);
  const horizonY = cam.horizonY;
  skyGradient(ctx, horizonY);
  drawSun(ctx, time);
  drawFarIslands(ctx, cam, world);
  drawSea(ctx, horizonY, plane, time);
  const sorted = world.state.islands.slice().sort((a, b) => b.z - a.z);
  for (const island of sorted) drawIsland(ctx, cam, island, time);
  drawRunway(ctx, cam);
  const rings = world.state.rings.slice().sort((a, b) => b.z - a.z);
  for (const ring of rings) {
    drawRing(ctx, cam, ring, ring === world.nextRing(), time);
  }
  const clouds = world.state.clouds.slice().sort((a, b) => b.z - a.z);
  for (const cloud of clouds) drawCloud(ctx, cam, cloud, time);
  return cam;
}
