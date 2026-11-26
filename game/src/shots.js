// The screenshot scenes behind ?shot=start|play|rings|land. Each one stages a real
// flight state — the same plane, world and renderer the game uses — and paints it
// twice, then sets window.__shotReady so a screenshot tool knows the frame is
// settled. The same seed always gives the same frame.

import { SCREEN_LAND, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { resetPlane } from './physics.js';

/** Put the plane at a posed flight state: position, attitude, speed, throttle. */
function posePlane(plane, pose) {
  plane.x = pose.x;
  plane.y = pose.y;
  plane.z = pose.z;
  plane.heading = pose.heading;
  plane.pitch = pose.pitch;
  plane.roll = pose.roll;
  plane.speed = pose.speed;
  plane.throttle = pose.throttle;
  plane.fuel = pose.fuel;
  plane.airborne = true;
  plane.stalled = false;
  plane.verticalSpeed = pose.vs || 0;
}

/**
 * Stage `name` on the live world and return { screen, score, elapsed, best }.
 * start: title over the archipelago, plane cruising past the volcano.
 * play: mid-flight, banked toward the next ring, volcano ahead.
 * rings: a second play angle — low over the sea, ring dead ahead.
 * land: final approach, runway filling the view, gear down in spirit.
 */
export function stageShot(name, world, plane, mission) {
  world.state.rings.forEach((r) => {
    r.passed = false;
    r.flash = 0;
  });
  world.state.ringIndex = 0;

  if (name === 'play') {
    world.state.rings[0].passed = true;
    world.state.rings[1].passed = true;
    world.state.ringIndex = 2;
    posePlane(plane, { x: -260, y: 205, z: 2950, heading: 0.1, pitch: 1, roll: -18, speed: 148, throttle: 0.78, fuel: 82, vs: 1 });
    return { screen: SCREEN_PLAY, score: 320, elapsed: 74, best: 1240 };
  }
  if (name === 'rings') {
    world.state.rings[0].passed = true;
    world.state.ringIndex = 1;
    posePlane(plane, { x: -260, y: 160, z: 1450, heading: 0.1, pitch: 0, roll: 12, speed: 162, throttle: 0.85, fuel: 88, vs: 0 });
    return { screen: SCREEN_PLAY, score: 170, elapsed: 38, best: 1240 };
  }
  if (name === 'land') {
    world.state.rings.forEach((r) => { r.passed = true; });
    world.state.ringIndex = world.state.ringsTotal;
    // Just past the last ring, 450 m short of the threshold: the runway strip
    // fills the centre of the frame and the volcano rises behind it.
    posePlane(plane, { x: 0, y: 85, z: 9350, heading: 0, pitch: -4, roll: 0, speed: 100, throttle: 0.3, fuel: 34, vs: -3.0 });
    return { screen: SCREEN_LAND, score: 1180, elapsed: 238, best: 1240 };
  }
  // start (and anything unknown): title over the islands, plane in level cruise
  // with the volcano island filling the view ahead.
  resetPlane(plane, mission.fuel);
  posePlane(plane, { x: -300, y: 300, z: 6800, heading: 0.04, pitch: 0, roll: -8, speed: 140, throttle: 0.7, fuel: 91, vs: 0 });
  return { screen: SCREEN_TITLE, score: 0, elapsed: 0, best: 1240 };
}
