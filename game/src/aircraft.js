// The aircraft itself: a stylised single-prop island airlift plane, drawn in canvas
// vector art from behind and slightly above — the chase view the pilot flies from.
// It banks with the roll, its navigation lights blink, and its propeller blurs with
// the throttle. No image files: every line here is drawn, so it always matches the
// game's one flat, sunny style.

import { PALETTE } from './config.js';

/**
 * Draw the plane centred at (cx, cy) on `ctx`, banked by `rollDeg` degrees
 * (positive = right wing down) and scaled by `scale`. `time` drives the prop
 * blur and the blinking nav lights; `throttle` sets the prop blur.
 */
export function drawAircraft(ctx, cx, cy, rollDeg, scale, time, throttle, stalled) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rollDeg * Math.PI) / 180);
  ctx.scale(scale, scale);

  const red = PALETTE.planeRed;
  const white = PALETTE.planeWhite;
  const blue = PALETTE.planeBlue;

  // Soft shadow on the sea below the aircraft, so it reads as flying, not pasted.
  ctx.save();
  ctx.translate(0, 96);
  ctx.scale(1, 0.28);
  ctx.fillStyle = 'rgba(0, 20, 40, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 150, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Main wings: long, slightly tapered, red tips.
  ctx.fillStyle = white;
  ctx.strokeStyle = 'rgba(20, 40, 70, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-168, 6);
  ctx.quadraticCurveTo(-120, -16, -28, -8);
  ctx.lineTo(28, -8);
  ctx.quadraticCurveTo(120, -16, 168, 6);
  ctx.quadraticCurveTo(120, 16, 30, 12);
  ctx.lineTo(-30, 12);
  ctx.quadraticCurveTo(-120, 16, -168, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Red wingtips.
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-168, 6);
  ctx.quadraticCurveTo(-150, -8, -128, -10);
  ctx.lineTo(-128, 12);
  ctx.quadraticCurveTo(-150, 14, -168, 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(168, 6);
  ctx.quadraticCurveTo(150, -8, 128, -10);
  ctx.lineTo(128, 12);
  ctx.quadraticCurveTo(150, 14, 168, 6);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a short, rounded body seen from behind — the tail is nearest the
  // viewer (bottom of the shape) and the nose points away (top), so the body
  // reads foreshortened, not like a top-down plan view.
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.moveTo(-34, -44);
  ctx.quadraticCurveTo(0, -60, 34, -44);
  ctx.quadraticCurveTo(42, -6, 30, 46);
  ctx.quadraticCurveTo(0, 58, -30, 46);
  ctx.quadraticCurveTo(-42, -6, -34, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-36, -22);
  ctx.quadraticCurveTo(0, -32, 36, -22);
  ctx.lineTo(34, -8);
  ctx.quadraticCurveTo(0, -18, -34, -8);
  ctx.closePath();
  ctx.fill();
  // "NUSA AIRLIFT" on the tail cone, sized to fit the fuselage width.
  ctx.fillStyle = blue;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NUSA AIRLIFT', 0, 34);

  // Cabin windows: three lit panes across the rear fuselage.
  ctx.fillStyle = '#bfe8ff';
  ctx.strokeStyle = 'rgba(20, 40, 70, 0.6)';
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.roundRect(i * 17 - 7, -42, 14, 11, 4);
    ctx.fill();
    ctx.stroke();
  }

  // Tailplane and tall fin, nearest the viewer at the tail.
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.moveTo(-64, -42);
  ctx.lineTo(64, -42);
  ctx.lineTo(52, -30);
  ctx.lineTo(-52, -30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-13, -46);
  ctx.lineTo(0, -92);
  ctx.lineTo(13, -46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = blue;
  ctx.beginPath();
  ctx.moveTo(-6, -50);
  ctx.lineTo(0, -82);
  ctx.lineTo(6, -50);
  ctx.closePath();
  ctx.fill();

  // Propeller: at the nose, far from the viewer, it reads as a thin blurred
  // disc seen edge-on, not a bubble over the fuselage.
  const blur = 0.16 + throttle * 0.35;
  ctx.fillStyle = `rgba(210, 225, 238, ${blur})`;
  ctx.beginPath();
  ctx.ellipse(0, -52, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const bladeAngle = time * (6 + throttle * 26);
  ctx.strokeStyle = 'rgba(40, 50, 60, 0.65)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let b = 0; b < 2; b += 1) {
    const a = bladeAngle + b * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(Math.cos(a) * 32, -52 + Math.sin(a) * 7);
    ctx.stroke();
  }
  // Spinner.
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.arc(0, -52, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 40, 70, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Navigation lights: green left, red right, blinking white strobe on the tail.
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = blink ? '#37ff7a' : 'rgba(55, 255, 122, 0.35)';
  ctx.beginPath();
  ctx.arc(-168, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blink ? '#ff5252' : 'rgba(255, 82, 82, 0.35)';
  ctx.beginPath();
  ctx.arc(168, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -92, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stall warning: the wings shudder — a small jitter the pilot can see and feel.
  if (stalled) {
    ctx.strokeStyle = 'rgba(255, 93, 93, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, -84);
    ctx.lineTo(40, -84);
    ctx.stroke();
  }

  ctx.restore();
}
