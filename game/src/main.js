// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between screens: title, briefing, play,
// paused, landed, complete and crash. Scores live in memory only — no storage,
// no cookies — so every visit starts fresh.
//
// The 3D scene paints on the #game canvas (WebGL, Three.js); the HUD and the menu
// overlays paint on the #hud canvas (2D) stacked above it.
//
// ?seed=N fixes the archipelago. ?shot=start|play|rings|land (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { FONT, LIVERIES, PALETTE, RUNWAY, SHOT_TIME, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_COCKPIT, ACTION_CONFIRM, ACTION_FREE_FLIGHT,
  ACTION_MISSION_1, ACTION_MISSION_2, ACTION_MISSION_3, ACTION_MISSION_4,
  ACTION_MISSION_5, ACTION_MISSION_6, ACTION_MISSION_7, ACTION_MISSION_8,
  ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import {
  EVENT_CRASHED, EVENT_FUEL_EMPTY, EVENT_HARD_LANDING, EVENT_LANDED,
  EVENT_RING, createPlane, resetPlane, stepFlight,
} from './physics.js';
import { FREE_FLIGHT, MISSIONS, landingScore, ringScore } from './missions.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_CRASH, SCREEN_LAND, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const hudCtx = hudCanvas.getContext('2d');
const world = createWorld(createRandom(seed));
const plane = createPlane();
const audio = createAudio();
const renderer3d = createRenderer(canvas, world);
let mission = MISSIONS[0];
let best = 0;
let cameraMode = 'chase';
let liveryIndex = 0;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  for (const c of [canvas, hudCanvas]) {
    c.width = VIEW.width;
    c.height = VIEW.height;
    c.style.width = `${Math.floor(VIEW.width * scale)}px`;
    c.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function announce(message) {
  status.textContent = message;
}

/** Buttons the current screen offers; { x, y, w, h, label, action }. */
let buttons = [];

function drawButton(x, y, w, h, text, accent) {
  hudCtx.fillStyle = accent ? 'rgba(255, 180, 0, 0.92)' : 'rgba(10, 30, 50, 0.78)';
  hudCtx.strokeStyle = accent ? '#ffdf6b' : 'rgba(120, 220, 255, 0.85)';
  hudCtx.lineWidth = 2;
  hudCtx.beginPath();
  hudCtx.roundRect(x, y, w, h, 10);
  hudCtx.fill();
  hudCtx.stroke();
  hudCtx.fillStyle = accent ? '#1a1200' : PALETTE.hudText;
  hudCtx.font = 'bold 19px ' + FONT;
  hudCtx.textAlign = 'center';
  hudCtx.fillText(text, x + w / 2, y + h / 2 + 7);
  hudCtx.textAlign = 'left';
  buttons.push({ x, y, w, h, label: text });
}

function drawTitleOverlay(time) {
  hudCtx.fillStyle = 'rgba(6, 20, 38, 0.3)';
  hudCtx.fillRect(0, 0, VIEW.width, VIEW.height);
  hudCtx.textAlign = 'center';
  hudCtx.fillStyle = '#ffffff';
  hudCtx.font = 'bold 64px ' + FONT;
  hudCtx.shadowColor = 'rgba(0, 40, 80, 0.9)';
  hudCtx.shadowBlur = 18;
  hudCtx.fillText('NUSA AIRLIFT', 640, 132);
  hudCtx.shadowBlur = 0;
  hudCtx.fillStyle = PALETTE.hudAmber;
  hudCtx.font = 'bold 22px ' + FONT;
  hudCtx.fillText('Island courier flights over the volcano archipelago — now in real 3D', 640, 170);
  hudCtx.fillStyle = 'rgba(255,255,255,0.92)';
  hudCtx.font = '17px ' + FONT;
  hudCtx.fillText('Fly the rings, mind your fuel, and put her down on runway 36.', 640, 200);
  hudCtx.textAlign = 'left';
  buttons = [];
  // Campaign: eight missions in two rows.
  hudCtx.fillStyle = 'rgba(255,255,255,0.85)';
  hudCtx.font = 'bold 15px ' + FONT;
  hudCtx.fillText('CAMPAIGN', 40, 238);
  MISSIONS.forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawButton(40 + col * 305, 250 + row * 64, 290, 52, `${i + 1} · ${m.name.toUpperCase()}`, false);
  });
  // Free flight + hangar row.
  drawButton(40, 396, 290, 52, '9 · FREE FLIGHT', false);
  hudCtx.fillStyle = 'rgba(255,255,255,0.85)';
  hudCtx.font = 'bold 15px ' + FONT;
  hudCtx.fillText('HANGAR — PAINT', 360, 388);
  LIVERIES.forEach((livery, i) => {
    drawButton(360 + i * 190, 396, 175, 52, livery.name, i === liveryIndex);
  });
  hudCtx.fillStyle = 'rgba(255,255,255,0.9)';
  hudCtx.font = '15px ' + FONT;
  hudCtx.textAlign = 'center';
  hudCtx.fillText('Arrows / WASD — pitch & bank   ·   W / S — throttle   ·   Space — flaps   ·   C — cockpit view', 640, 492);
  hudCtx.fillText('Mouse drag steers too   ·   P pause   ·   R restart   ·   M sound', 640, 516);
  hudCtx.fillText('Click a mission above, or press 1–9 to fly.', 640, 546);
  hudCtx.textAlign = 'left';
  if (best > 0) {
    hudCtx.fillStyle = PALETTE.hudAmber;
    hudCtx.font = 'bold 17px ' + FONT;
    hudCtx.textAlign = 'center';
    hudCtx.fillText(`Best score this visit: ${best}`, 640, 584);
    hudCtx.textAlign = 'left';
  }
}

function drawBriefingOverlay() {
  hudCtx.fillStyle = 'rgba(6, 20, 38, 0.55)';
  hudCtx.fillRect(0, 0, VIEW.width, VIEW.height);
  hudCtx.textAlign = 'center';
  hudCtx.fillStyle = '#ffffff';
  hudCtx.font = 'bold 44px ' + FONT;
  hudCtx.fillText(mission.name.toUpperCase(), 640, 170);
  hudCtx.fillStyle = PALETTE.hudAmber;
  hudCtx.font = 'bold 21px ' + FONT;
  hudCtx.fillText(mission.tagline, 640, 208);
  hudCtx.fillStyle = 'rgba(255,255,255,0.95)';
  hudCtx.font = '18px ' + FONT;
  hudCtx.fillText(mission.goal, 640, 252);
  hudCtx.font = '16px ' + FONT;
  hudCtx.fillText(`Fuel on board: ${mission.fuel}%   ·   Rings: ${mission.rings.length}   ·   Wind: ${mission.wind === 0 ? 'calm' : mission.wind < 10 ? 'breeze' : 'gusting'}`, 640, 286);
  if (mission.dusk) hudCtx.fillText('Dusk flight — follow the runway lights and your instruments.', 640, 316);
  else if (mission.timeLimit) hudCtx.fillText(`Beat the clock: ${mission.timeLimit} seconds for rings and landing.`, 640, 316);
  else if (mission.pickup) hudCtx.fillText('Land on the Pulau Pasir beach strip first, then fly home to runway 36.', 640, 316);
  else hudCtx.fillText('Take off with full throttle, climb gently, and bank — never yank — through the rings.', 640, 316);
  hudCtx.fillText('Line up on the runway centreline, slow below 120 kt, and flare for a gentle touchdown.', 640, 346);
  hudCtx.textAlign = 'left';
  buttons = [];
  drawButton(490, 400, 300, 56, 'TAKE OFF  →', true);
}

function drawEndOverlay(title, lines, accent) {
  hudCtx.fillStyle = 'rgba(6, 20, 38, 0.55)';
  hudCtx.fillRect(0, 0, VIEW.width, VIEW.height);
  hudCtx.textAlign = 'center';
  hudCtx.fillStyle = accent || '#ffffff';
  hudCtx.font = 'bold 46px ' + FONT;
  hudCtx.fillText(title, 640, 210);
  hudCtx.fillStyle = 'rgba(255,255,255,0.95)';
  hudCtx.font = '19px ' + FONT;
  lines.forEach((line, i) => hudCtx.fillText(line, 640, 258 + i * 32));
  hudCtx.textAlign = 'left';
  buttons = [];
  drawButton(430, 420, 180, 54, 'FLY AGAIN (R)', true);
  drawButton(640, 420, 210, 54, 'CHANGE MISSION', false);
}

function runShot(name) {
  world.layRings(mission.rings);
  renderer3d.setMission(mission);
  const scene = stageShot(name, world, plane, mission);
  // Paint twice, synchronously: a headless screenshot must not depend on the
  // compositor scheduling a frame, so the shot is settled before we say so.
  function paint() {
    buttons = [];
    hudCtx.clearRect(0, 0, VIEW.width, VIEW.height);
    renderer3d.renderFrame(plane, world, mission, SHOT_TIME, 'chase', 1);
    // No flight HUD on the title shot: the menu carries the information.
    if (scene.screen !== SCREEN_TITLE) {
      drawHud(hudCtx, plane, world, mission, scene.score, scene.elapsed, scene.best, false);
    }
    if (scene.screen === SCREEN_TITLE) drawTitleOverlay(SHOT_TIME);
    if (scene.screen === SCREEN_LAND) {
      hudCtx.fillStyle = 'rgba(6, 20, 38, 0.35)';
      hudCtx.fillRect(0, 0, VIEW.width, VIEW.height);
      hudCtx.textAlign = 'center';
      hudCtx.fillStyle = '#ffffff';
      hudCtx.font = 'bold 40px ' + FONT;
      hudCtx.fillText('FINAL APPROACH — RUNWAY 36', 640, 150);
      hudCtx.fillStyle = PALETTE.hudAmber;
      hudCtx.font = 'bold 19px ' + FONT;
      hudCtx.fillText('All rings flown · flaps down · 100 kt · on the centreline', 640, 184);
      hudCtx.textAlign = 'left';
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
  let missionPhase = 1; // Rescue Pickup: 1 = fly to the beach, 2 = fly home.
  let pickupBannerUntil = 0;

  world.layRings(mission.rings);
  renderer3d.setMission(mission);
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
    missionPhase = 1;
    pickupBannerUntil = 0;
    world.layRings(mission.rings);
    renderer3d.setMission(mission);
    resetPlane(plane, mission.fuel);
    if (mission.startAirborne) {
      plane.x = mission.startAirborne.x;
      plane.y = mission.startAirborne.y;
      plane.z = mission.startAirborne.z;
      plane.speed = mission.startAirborne.speed;
      plane.throttle = 0.6;
      plane.airborne = true;
    }
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
    mission = MISSIONS[0];
    missionPhase = 1;
    world.layRings(MISSIONS[0].rings);
    renderer3d.setMission(MISSIONS[0]);
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

  function missionByKey(actions) {
    if (actions & ACTION_MISSION_1) return MISSIONS[0];
    if (actions & ACTION_MISSION_2) return MISSIONS[1];
    if (actions & ACTION_MISSION_3) return MISSIONS[2];
    if (actions & ACTION_MISSION_4) return MISSIONS[3];
    if (actions & ACTION_MISSION_5) return MISSIONS[4];
    if (actions & ACTION_MISSION_6) return MISSIONS[5];
    if (actions & ACTION_MISSION_7) return MISSIONS[6];
    if (actions & ACTION_MISSION_8) return MISSIONS[7];
    if (actions & ACTION_FREE_FLIGHT) return FREE_FLIGHT;
    return null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_COCKPIT) {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
      announce(cameraMode === 'cockpit' ? 'Cockpit view.' : 'Chase view.');
    }
    if (click) {
      audio.ensure();
      for (const b of buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          audio.click();
          if (screen === SCREEN_TITLE) {
            const picked = MISSIONS.find((m) => b.label.includes(m.name.toUpperCase()))
              || (b.label.includes('FREE FLIGHT') ? FREE_FLIGHT : null);
            if (picked) { startMission(picked); return; }
            const livery = LIVERIES.find((l) => b.label.includes(l.name));
            if (livery) {
              liveryIndex = LIVERIES.indexOf(livery);
              renderer3d.setLivery(livery);
              announce(`Paint: ${livery.name}.`);
              return;
            }
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
      const picked = missionByKey(actions);
      if (picked) startMission(picked);
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
    // Turbulence in heavy weather: the gusts shove the controls around.
    let jitterRoll = 0;
    let jitterPitch = 0;
    if (mission.wind >= 10) {
      const k = 0.14 * (mission.wind / 18);
      jitterRoll = (Math.sin(time * 7.3) + Math.sin(time * 13.1) * 0.6) * k;
      jitterPitch = Math.sin(time * 9.7) * k * 0.5;
    }
    const steer = {
      roll: input.roll() + jitterRoll,
      pitch: input.pitch() + jitterPitch,
      throttle: input.throttle(),
    };
    const events = stepFlight(plane, steer, STEP, world, windNow());
    audio.update(plane.throttle, plane.speed, plane.airborne);
    if (events & EVENT_RING) {
      const passed = world.state.rings[world.state.ringIndex - 1];
      if (passed) renderer3d.ringBurst(passed);
      const gained = ringScore(mission, plane.speed);
      score += gained;
      audio.ringChime();
      announce(`Ring ${world.state.ringIndex} of ${world.state.ringsTotal}. Plus ${gained}.`);
    }
    if (events & EVENT_FUEL_EMPTY) announce('Fuel empty. Gliding — find the runway.');
    if (mission.timeLimit && elapsed > mission.timeLimit) {
      finishFlight('OUT OF TIME', [
        `${mission.name} — the clock beat you to the runway.`,
        `Rings flown ${world.state.ringIndex} of ${world.state.ringsTotal}   ·   Score ${score}`,
        'Press R to fly again.',
      ], PALETTE.hudRed);
      return;
    }
    if (events & EVENT_LANDED || events & EVENT_HARD_LANDING) {
      const hard = !!(events & EVENT_HARD_LANDING);
      // Rescue Pickup, phase 1: a beach touchdown is a pickup, not the end.
      if (mission.pickup && missionPhase === 1) {
        if (plane.landedStrip === 'beach') {
          missionPhase = 2;
          score += mission.pickupPoints;
          pickupBannerUntil = elapsed + 5;
          audio.ringChime();
          announce(`Pickup complete — plus ${mission.pickupPoints}. Fly home to runway 36.`);
          return;
        }
        finishFlight('MISSION INCOMPLETE', [
          `${mission.name} — you landed on runway 36, but the hiker is still waiting on Pulau Pasir.`,
          `Rings flown ${world.state.ringIndex} of ${world.state.ringsTotal}   ·   Score ${score}`,
          'Press R to fly again.',
        ], PALETTE.hudAmber);
        return;
      }
      const gained = landingScore(mission, -plane.verticalSpeed, hard);
      score += gained;
      audio.touchdown(hard);
      finishFlight('MISSION COMPLETE', [
        `${mission.name} — ${mission.pickup && missionPhase === 2 ? 'passenger safe, wheels down on runway 36.' : 'all rings flown, wheels down on runway 36.'}`,
        `Landing bonus +${gained}   ·   Time ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`,
        `Score ${score}   ·   Best this visit ${Math.max(best, score)}`,
      ], hard ? PALETTE.hudAmber : PALETTE.hudGreen);
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
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
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
    hudCtx.clearRect(0, 0, VIEW.width, VIEW.height);
    renderer3d.renderFrame(plane, world, mission, time, cameraMode, frameDt);
    // The HUD objective changes during the rescue's second phase.
    let objective = null;
    if (mission.pickup && missionPhase === 1 && world.state.ringIndex === world.state.ringsTotal) {
      objective = 'Land on the Pulau Pasir beach strip — 1.2 km east';
    } else if (mission.pickup && missionPhase === 2) {
      objective = `Passenger aboard — land on runway 36, ${Math.max(0, Math.round(RUNWAY.zStart - plane.z))} m ahead`;
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(hudCtx, plane, world, mission, score, elapsed, best, audio.isMuted(), objective, cameraMode === 'cockpit');
    }
    if (screen === SCREEN_TITLE) {
      // No flight HUD on the title screen: the menu buttons carry the
      // information, and the HUD panels would overlap them.
      drawTitleOverlay(time);
    }
    if (screen === 'briefing') {
      drawBriefingOverlay();
    }
    if (screen === SCREEN_PAUSED) {
      hudCtx.fillStyle = 'rgba(6, 20, 38, 0.55)';
      hudCtx.fillRect(0, 0, VIEW.width, VIEW.height);
      hudCtx.textAlign = 'center';
      hudCtx.fillStyle = '#ffffff';
      hudCtx.font = 'bold 44px ' + FONT;
      hudCtx.fillText('PAUSED', 640, 300);
      hudCtx.font = '18px ' + FONT;
      hudCtx.fillText('P or Space to keep flying   ·   R to restart the mission   ·   C cockpit view', 640, 340);
      hudCtx.textAlign = 'left';
    }
    if (screen === SCREEN_COMPLETE || screen === SCREEN_CRASH) {
      drawHud(hudCtx, plane, world, mission, score, elapsed, best, audio.isMuted(), null, cameraMode === 'cockpit');
      drawEndOverlay(endTitle, endLines, endAccent);
    }
    if (pickupBannerUntil > 0 && elapsed < pickupBannerUntil && screen === SCREEN_PLAY) {
      hudCtx.fillStyle = PALETTE.hudGreen;
      hudCtx.font = 'bold 22px ' + FONT;
      hudCtx.textAlign = 'center';
      hudCtx.shadowColor = PALETTE.hudGreen;
      hudCtx.shadowBlur = 12;
      hudCtx.fillText('PICKUP COMPLETE — FLY HOME TO RUNWAY 36', 640, 160);
      hudCtx.shadowBlur = 0;
      hudCtx.textAlign = 'left';
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

  // Debug handle for automated smoke tests (not part of the game UI).
  window.__nusa = {
    plane, world,
    mission: () => mission,
    screen: () => screen,
    score: () => score,
    cameraMode: () => cameraMode,
  };

  announce('Nusa Airlift. Choose a mission to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
