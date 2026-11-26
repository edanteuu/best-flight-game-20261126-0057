// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between screens: title, briefing, play,
// paused, landed, complete and crash. Scores live in memory only — no storage,
// no cookies — so every visit starts fresh.
//
// ?seed=N fixes the archipelago. ?shot=start|play|rings|land (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MISSION_1, ACTION_MISSION_2, ACTION_MISSION_3,
  ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import {
  EVENT_CRASHED, EVENT_FUEL_EMPTY, EVENT_HARD_LANDING, EVENT_LANDED,
  EVENT_RING, createPlane, resetPlane, stepFlight,
} from './physics.js';
import { MISSIONS, landingScore, ringScore } from './missions.js';
import { createAudio } from './audio.js';
import { drawAircraft } from './aircraft.js';
import { drawScene, SCREEN_COMPLETE, SCREEN_CRASH, SCREEN_LAND, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';
import { FONT, PALETTE, SHOT_TIME, VIEW } from './config.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const world = createWorld(createRandom(seed));
const plane = createPlane();
const audio = createAudio();
let mission = MISSIONS[0];
let best = 0;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function announce(message) {
  status.textContent = message;
}

/** Buttons the current screen offers; { x, y, w, h, label, action }. */
let buttons = [];

function drawButton(x, y, w, h, text, accent) {
  ctx.fillStyle = accent ? 'rgba(255, 180, 0, 0.92)' : 'rgba(10, 30, 50, 0.78)';
  ctx.strokeStyle = accent ? '#ffdf6b' : 'rgba(120, 220, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent ? '#1a1200' : PALETTE.hudText;
  ctx.font = 'bold 19px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h / 2 + 7);
  ctx.textAlign = 'left';
  buttons.push({ x, y, w, h, label: text });
}

function drawTitleOverlay(time) {
  ctx.fillStyle = 'rgba(6, 20, 38, 0.3)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px ' + FONT;
  ctx.shadowColor = 'rgba(0, 40, 80, 0.9)';
  ctx.shadowBlur = 18;
  ctx.fillText('NUSA AIRLIFT', 640, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillText('Island courier flights over the volcano archipelago', 640, 188);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '17px ' + FONT;
  ctx.fillText('Fly the rings, mind your fuel, and put her down on runway 36.', 640, 220);
  ctx.textAlign = 'left';
  buttons = [];
  const names = ['1 · RING RUN', '2 · ISLAND HOP', '3 · STORM LANDING'];
  names.forEach((name, i) => {
    drawButton(640 - 300 + i * 210, 258, 190, 52, name, false);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '15px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('Arrows / WASD — pitch & bank   ·   W / S — throttle   ·   Space — flaps', 640, 348);
  ctx.fillText('Mouse drag steers too   ·   P pause   ·   R restart   ·   M sound', 640, 372);
  ctx.fillText('Click a mission above, or press 1, 2 or 3 to fly.', 640, 402);
  ctx.textAlign = 'left';
  if (best > 0) {
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = 'bold 17px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`Best score this visit: ${best}`, 640, 440);
    ctx.textAlign = 'left';
  }
}

function drawBriefingOverlay() {
  ctx.fillStyle = 'rgba(6, 20, 38, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText(mission.name.toUpperCase(), 640, 170);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 21px ' + FONT;
  ctx.fillText(mission.tagline, 640, 208);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '18px ' + FONT;
  ctx.fillText(mission.goal, 640, 252);
  ctx.font = '16px ' + FONT;
  ctx.fillText(`Fuel on board: ${mission.fuel}%   ·   Rings: ${mission.rings.length}   ·   Wind: ${mission.wind === 0 ? 'calm' : mission.wind < 10 ? 'breeze' : 'gusting'}` , 640, 286);
  ctx.fillText('Take off with full throttle, climb gently, and bank — never yank — through the rings.', 640, 330);
  ctx.fillText('Line up on the runway centreline, slow below 120 kt, and flare for a gentle touchdown.', 640, 356);
  ctx.textAlign = 'left';
  buttons = [];
  drawButton(490, 400, 300, 56, 'TAKE OFF  →', true);
}

function drawEndOverlay(title, lines, accent) {
  ctx.fillStyle = 'rgba(6, 20, 38, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffffff';
  ctx.font = 'bold 46px ' + FONT;
  ctx.fillText(title, 640, 210);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '19px ' + FONT;
  lines.forEach((line, i) => ctx.fillText(line, 640, 258 + i * 32));
  ctx.textAlign = 'left';
  buttons = [];
  drawButton(430, 420, 180, 54, 'FLY AGAIN (R)', true);
  drawButton(640, 420, 210, 54, 'CHANGE MISSION', false);
}

function runShot(name) {
  world.layRings(mission.rings);
  const scene = stageShot(name, world, plane, mission);
  // Paint twice, synchronously: a headless screenshot must not depend on the
  // compositor scheduling a frame, so the shot is settled before we say so.
  function paint() {
    buttons = [];
    drawScene(ctx, plane, world, SHOT_TIME);
    drawAircraft(ctx, 640, 545, plane.roll, 0.92, SHOT_TIME, plane.throttle, plane.stalled);
    drawHud(ctx, plane, world, mission, scene.score, scene.elapsed, scene.best, false);
    if (scene.screen === SCREEN_TITLE) drawTitleOverlay(SHOT_TIME);
    if (scene.screen === SCREEN_LAND) {
      ctx.fillStyle = 'rgba(6, 20, 38, 0.35)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px ' + FONT;
      ctx.fillText('FINAL APPROACH — RUNWAY 36', 640, 150);
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.font = 'bold 19px ' + FONT;
      ctx.fillText('All rings flown · flaps down · 100 kt · on the centreline', 640, 184);
      ctx.textAlign = 'left';
    }
  }
  paint();
  paint();
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let score = 0;
  let elapsed = 0;
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let endLines = [];
  let endTitle = '';
  let endAccent = '#ffffff';
  let windPhase = 0;

  world.layRings(mission.rings);
  resetPlane(plane, mission.fuel);
  // The title screen flies a gentle cruise over the islands behind the menu.
  plane.y = 300;
  plane.z = 6800;
  plane.x = -300;
  plane.speed = 140;
  plane.throttle = 0.7;
  plane.airborne = true;

  function startMission(nextMission) {
    mission = nextMission;
    world.layRings(mission.rings);
    resetPlane(plane, mission.fuel);
    score = 0;
    elapsed = 0;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.click();
    announce(`${mission.name}. ${mission.goal}`);
  }

  function showTitle() {
    screen = SCREEN_TITLE;
    world.layRings(MISSIONS[0].rings);
    resetPlane(plane, MISSIONS[0].fuel);
    plane.y = 300;
    plane.z = 6800;
    plane.x = -300;
    plane.speed = 140;
    plane.throttle = 0.7;
    plane.airborne = true;
    announce('Nusa Airlift. Choose a mission.');
  }

  function finishFlight(title, lines, accent) {
    endTitle = title;
    endLines = lines;
    endAccent = accent;
    if (score > best) best = score;
    screen = title === 'MISSION COMPLETE' ? SCREEN_COMPLETE : SCREEN_CRASH;
    announce(`${title}. Score ${score}. Best ${best}.`);
  }

  function windNow() {
    windPhase += STEP;
    const gust = mission.wind * (0.6 + 0.4 * Math.sin(windPhase * 0.7) * Math.sin(windPhase * 0.23));
    return { x: gust * 0.514, z: -gust * 0.2 };
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (click) {
      audio.ensure();
      for (const b of buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          audio.click();
          if (screen === SCREEN_TITLE) {
            if (b.label.includes('RING RUN')) startMission(MISSIONS[0]);
            else if (b.label.includes('ISLAND HOP')) startMission(MISSIONS[1]);
            else if (b.label.includes('STORM')) startMission(MISSIONS[2]);
          } else if (screen === 'briefing') startMission(mission);
          else if (screen === SCREEN_COMPLETE || screen === SCREEN_CRASH) {
            if (b.label.includes('FLY AGAIN')) startMission(mission);
            else showTitle();
          }
          return;
        }
      }
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_MISSION_1) startMission(MISSIONS[0]);
      else if (actions & ACTION_MISSION_2) startMission(MISSIONS[1]);
      else if (actions & ACTION_MISSION_3) startMission(MISSIONS[2]);
      else if (actions & ACTION_CONFIRM) {
        screen = 'briefing';
        audio.ensure();
        audio.click();
      }
      return;
    }
    if (screen === 'briefing') {
      if (actions & ACTION_CONFIRM) startMission(mission);
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) startMission(mission);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Flying.');
      } else if (actions & ACTION_RESTART) startMission(mission);
      return;
    }
    if (screen === SCREEN_COMPLETE || screen === SCREEN_CRASH) {
      if (actions & ACTION_RESTART) startMission(mission);
      else if (actions & ACTION_CONFIRM) showTitle();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Gentle autopilot cruise behind the title: keep the islands moving.
      plane.z += 26 * STEP;
      if (plane.z > 9200) { plane.z = 6800; plane.x = -300; }
      plane.roll = -8 + Math.sin(time * 0.4) * 4;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    elapsed += STEP;
    time += STEP;
    const steer = {
      roll: input.roll(),
      pitch: input.pitch(),
      throttle: input.throttle(),
    };
    const events = stepFlight(plane, steer, STEP, world, windNow());
    audio.update(plane.throttle, plane.speed, plane.airborne);
    if (events & EVENT_RING) {
      const gained = ringScore(mission, plane.speed);
      score += gained;
      audio.ringChime();
      announce(`Ring ${world.state.ringIndex} of ${world.state.ringsTotal}. Plus ${gained}.`);
    }
    if (events & EVENT_FUEL_EMPTY) announce('Fuel empty. Gliding — find the runway.');
    if (events & EVENT_LANDED) {
      const gained = landingScore(mission, -plane.verticalSpeed, false);
      score += gained;
      audio.touchdown(false);
      finishFlight('MISSION COMPLETE', [
        `${mission.name} — all rings flown, wheels down on runway 36.`,
        `Landing bonus +${gained}   ·   Time ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`,
        `Score ${score}   ·   Best this visit ${Math.max(best, score)}`,
      ], PALETTE.hudGreen);
    }
    if (events & EVENT_HARD_LANDING) {
      const gained = landingScore(mission, -plane.verticalSpeed, true);
      score += gained;
      audio.touchdown(true);
      finishFlight('MISSION COMPLETE', [
        `${mission.name} — down on the runway, but hard. The mechanics will want a word.`,
        `Hard-landing bonus +${gained}   ·   Time ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`,
        `Score ${score}   ·   Best this visit ${Math.max(best, score)}`,
      ], PALETTE.hudAmber);
    }
    if (events & EVENT_CRASHED) {
      audio.crash();
      const where = world.overRunway(plane.x, plane.z) ? 'on the runway' : (world.isLand(plane.x, plane.z) ? 'in the jungle' : 'in the sea');
      finishFlight('CRASHED', [
        `Down ${where} — too low, too fast, or off the centreline.`,
        `Rings flown ${world.state.ringIndex} of ${world.state.ringsTotal}   ·   Score ${score}`,
        'Press R to fly again.',
      ], PALETTE.hudRed);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      if (screen === 'briefing') time += 1 / 60;
    }
    time += 1 / 120;
    buttons = [];
    drawScene(ctx, plane, world, time);
    drawAircraft(ctx, 640, 545, plane.roll, 0.92, time, plane.throttle, plane.stalled);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, plane, world, mission, score, elapsed, best, audio.isMuted());
    }
    if (screen === SCREEN_TITLE) {
      drawHud(ctx, plane, world, mission, 0, 0, best, audio.isMuted());
      drawTitleOverlay(time);
    }
    if (screen === 'briefing') {
      drawHud(ctx, plane, world, mission, 0, 0, best, audio.isMuted());
      drawBriefingOverlay();
    }
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(6, 20, 38, 0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px ' + FONT;
      ctx.fillText('PAUSED', 640, 300);
      ctx.font = '18px ' + FONT;
      ctx.fillText('P or Space to keep flying   ·   R to restart the mission', 640, 340);
      ctx.textAlign = 'left';
    }
    if (screen === SCREEN_COMPLETE || screen === SCREEN_CRASH) {
      drawHud(ctx, plane, world, mission, score, elapsed, best, audio.isMuted());
      drawEndOverlay(endTitle, endLines, endAccent);
    }
  }

  // Flaps on Space while flying: a held Space slows the plane for landing.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && screen === SCREEN_PLAY) plane.flaps = true;
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') plane.flaps = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nusa Airlift. Choose a mission to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
