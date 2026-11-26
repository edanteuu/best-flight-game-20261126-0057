// The instruments: every number the pilot needs, lit like a real panel — glowing
// digits on dark glass, a compass tape, an artificial horizon, throttle and fuel
// gauges, and the mission readout. The HUD is drawn over the chase view every frame.

import { FONT, FONT_MONO, PALETTE, RUNWAY } from './config.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.strokeStyle = PALETTE.hudEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, color) {
  ctx.fillStyle = color || 'rgba(180, 230, 255, 0.85)';
  ctx.font = 'bold 11px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function bigValue(ctx, text, x, y, color) {
  ctx.fillStyle = color || PALETTE.hudText;
  ctx.font = 'bold 26px ' + FONT_MONO;
  ctx.textAlign = 'left';
  ctx.shadowColor = color || '#7ee7ff';
  ctx.shadowBlur = 8;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function compassLetter(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** The heading tape across the top: ticks every 15 degrees, N/E/S/W labelled.
 * Ticks are placed from absolute headings, so a heading between two marks still
 * shows every tick and label — the tape never goes blank. */
export function drawCompassTape(ctx, headingDeg) {
  const cx = 640;
  ctx.save();
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(cx - 210, 8, 420, 34, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudEdge;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - 210, 8, 420, 34);
  ctx.clip();
  const start = Math.floor((headingDeg - 90) / 15) * 15;
  for (let degAbs = start; degAbs <= headingDeg + 90; degAbs += 15) {
    const deg = ((degAbs % 360) + 360) % 360;
    const x = cx + (degAbs - headingDeg) * 2.1;
    const major = deg % 45 === 0;
    // Letters and numbers sit at the top of the tape, ticks hang below them.
    if (major) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = 'bold 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(deg % 90 === 0 ? compassLetter(deg) : String(deg), x, 22);
    }
    ctx.strokeStyle = major ? PALETTE.hudText : 'rgba(180,230,255,0.6)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 26);
    ctx.lineTo(x, major ? 38 : 33);
    ctx.stroke();
  }
  ctx.restore();
  // Centre caret and digital heading.
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 42);
  ctx.lineTo(cx + 7, 42);
  ctx.lineTo(cx, 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px ' + FONT_MONO;
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(3, '0')}°`, cx, 66);
}

/** Artificial horizon: a little ball showing pitch and bank, glowing when level. */
export function drawAttitude(ctx, pitchDeg, rollDeg, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((-rollDeg * Math.PI) / 180);
  ctx.translate(0, pitchDeg * 1.1);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r - 2, -r * 3, r * 2 + 4, r * 3);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r - 2, 0, r * 2 + 4, r * 3);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.hudEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r - 2, y);
  ctx.lineTo(x - 8, y);
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x + r + 2, y);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function gauge(ctx, x, y, w, h, fraction, color, labelText) {
  panel(ctx, x, y, w, h);
  label(ctx, labelText, x + 10, y + 16);
  const bw = w - 20;
  const bh = 12;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 24, bw, bh, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 24, Math.max(4, bw * Math.max(0, Math.min(1, fraction))), bh, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * Draw the full HUD. `plane` is the aircraft, `world` the archipelago state,
 * `mission` the active sortie, `score`, `elapsed` seconds and `best` score.
 */
export function drawHud(ctx, plane, world, mission, score, elapsed, best, muted) {
  const headingDeg = (plane.heading * 180) / Math.PI;
  const altM = Math.max(0, Math.round(plane.y));
  const altFt = Math.round(plane.y * 3.28084);
  const speed = Math.round(plane.speed);

  // Top-left: altitude and airspeed, the two numbers that matter most.
  panel(ctx, 16, 12, 218, 96);
  label(ctx, 'ALTITUDE', 28, 30);
  bigValue(ctx, `${altM} m`, 28, 58);
  ctx.fillStyle = 'rgba(180,230,255,0.8)';
  ctx.font = '13px ' + FONT_MONO;
  ctx.textAlign = 'left';
  ctx.fillText(`${altFt} ft`, 150, 56);
  label(ctx, 'AIRSPEED', 28, 82);
  bigValue(ctx, `${speed} kt`, 28, 104, speed < 60 ? PALETTE.hudRed : PALETTE.hudText);
  ctx.fillStyle = 'rgba(180,230,255,0.8)';
  ctx.font = '13px ' + FONT_MONO;
  ctx.fillText(plane.stalled ? 'STALL!' : plane.flaps ? 'FLAPS' : 'CLEAN', 150, 102);

  drawCompassTape(ctx, headingDeg);

  // Top-right: score, timer, rings.
  panel(ctx, 1046, 12, 218, 96);
  label(ctx, 'SCORE', 1058, 30);
  bigValue(ctx, String(score), 1058, 58, PALETTE.hudAmber);
  label(ctx, 'TIME', 1058, 82);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px ' + FONT_MONO;
  ctx.textAlign = 'left';
  ctx.fillText(`${mm}:${ss}`, 1058, 104);
  ctx.fillStyle = 'rgba(180,230,255,0.8)';
  ctx.font = '13px ' + FONT_MONO;
  ctx.textAlign = 'right';
  ctx.fillText(`BEST ${best}`, 1252, 104);
  ctx.textAlign = 'left';

  // Rings progress, centred under the compass.
  const done = world.state.ringIndex;
  const total = world.state.ringsTotal;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(
    total > 0 ? `RINGS  ${done} / ${total}` : 'FLY TO THE RUNWAY',
    640, 88,
  );
  for (let i = 0; i < total; i += 1) {
    ctx.fillStyle = i < done ? PALETTE.hudGreen : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(640 + (i - (total - 1) / 2) * 26, 106, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = 'left';

  // Bottom-left: attitude ball + throttle + fuel.
  panel(ctx, 16, 560, 218, 144);
  drawAttitude(ctx, plane.pitch, plane.roll, 76, 632, 42);
  label(ctx, 'PITCH ' + (plane.pitch >= 0 ? '+' : '') + Math.round(plane.pitch) + '°', 132, 606);
  label(ctx, 'BANK ' + (plane.roll >= 0 ? '+' : '') + Math.round(plane.roll) + '°', 132, 628);
  label(ctx, 'HDG ' + String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(3, '0') + '°', 132, 650);
  label(ctx, 'V/S ' + (plane.verticalSpeed >= 0 ? '+' : '') + plane.verticalSpeed.toFixed(1) + ' m/s', 132, 672);
  gauge(ctx, 16, 470, 150, 58, plane.throttle, '#5db9ff', 'THROTTLE');
  gauge(
    ctx, 16, 392, 150, 58, plane.fuel / 100,
    plane.fuel < 20 ? PALETTE.hudRed : plane.fuel < 45 ? PALETTE.hudAmber : PALETTE.hudGreen,
    'FUEL ' + Math.round(plane.fuel) + '%',
  );

  // Bottom-right: mission card and next objective.
  panel(ctx, 986, 560, 278, 144);
  label(ctx, 'MISSION', 998, 578);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 17px ' + FONT;
  ctx.fillText(mission.name.toUpperCase(), 998, 600);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px ' + FONT;
  const ring = world.nextRing();
  const ringDz = ring ? ring.z - plane.z : 0;
  const objective = ring
    ? `Next: ring ${ring.label} — ${Math.abs(Math.round(ringDz))} m ${ringDz >= 0 ? 'ahead' : 'behind'}`
    : `Land on runway 36 — ${Math.max(0, Math.round(RUNWAY.zStart - plane.z))} m ahead`;
  ctx.fillText(objective, 998, 624);
  ctx.fillStyle = 'rgba(180,230,255,0.85)';
  ctx.fillText(mission.goal, 998, 646, 254);
  ctx.fillText(muted ? 'M — sound off' : 'M — sound on', 998, 668);
  ctx.fillText('Arrows/WASD fly · W/S throttle', 998, 688);

  // Low-fuel and stall warnings, centred where the pilot cannot miss them.
  if (plane.fuel < 20 && plane.fuel > 0) {
    ctx.fillStyle = plane.fuel < 10 ? PALETTE.hudRed : PALETTE.hudAmber;
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText('LOW FUEL — FLY LEAN, LAND SOON', 640, 160);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }
  if (plane.fuel <= 0) {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.shadowColor = PALETTE.hudRed;
    ctx.shadowBlur = 12;
    ctx.fillText('FUEL EMPTY — GLIDING', 640, 160);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }
  if (plane.stalled) {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, ADD POWER', 640, 190);
    ctx.textAlign = 'left';
  }
}
