// The flight model: one small prop plane, flown by the numbers. Throttle sets the
// target speed, pitch trades speed for altitude, bank turns the heading, and a
// stall drops the nose when the wing runs out of speed. Fuel burns with throttle;
// with an empty tank the engine quits and the sortie becomes a glide. This file
// knows nothing about drawing or keys — it only moves the aircraft one step.

import { PLANE, RUNWAY } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_FUEL_EMPTY = 8;
export const EVENT_HARD_LANDING = 16;
export const EVENT_STALL = 32;

const KNOTS_TO_MS = 0.514444;
const DEG = Math.PI / 180;

export function createPlane() {
  return {
    x: 0, y: 60, z: -600, // parked short of the course start, on the water's edge
    heading: 0, pitch: 0, roll: 0,
    speed: 0, // knots
    throttle: 0.55,
    fuel: 100, // percent of tank
    damage: 0, // percent; 100 ends the flight
    verticalSpeed: 0, // m/s, for the landing judgement
    stalled: false,
    airborne: false,
    flaps: false,
    landedStrip: null, // 'runway' | 'beach' | null — which strip the last touchdown used
  };
}

/**
 * Advance the plane one fixed step. `steer` is { roll, pitch, throttle } each in
 * [-1, 1] (throttle: -1 down, 1 up). `world` supplies nextRing/groundHeight/overRunway.
 * Returns EVENT_* flags for the caller to score and announce.
 */
export function stepFlight(plane, steer, dt, world, wind) {
  let events = EVENT_NONE;

  // --- Throttle and fuel -------------------------------------------------
  plane.throttle = Math.max(0, Math.min(1, plane.throttle + steer.throttle * dt * 0.55));
  const hadFuel = plane.fuel > 0;
  if (plane.throttle > 0 && plane.airborne) {
    plane.fuel = Math.max(0, plane.fuel - PLANE.fuelBurn * (0.25 + plane.throttle) * dt);
  }
  if (hadFuel && plane.fuel <= 0) events |= EVENT_FUEL_EMPTY;
  const powered = plane.fuel > 0;

  // --- Speed: throttle pulls toward its target, drag and pitch trade off --
  // A climb costs speed and a descent gives it back, so the pilot who climbs
  // too steeply at low power will find the stall waiting at the top.
  const targetSpeed = powered ? 40 + plane.throttle * (PLANE.cruiseSpeed - 40) : 0;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * 0.55);
  plane.speed -= Math.sin(plane.pitch * DEG) * 22 * dt; // climbing costs speed
  if (plane.flaps) plane.speed -= 14 * dt;
  plane.speed = Math.max(0, Math.min(PLANE.maxSpeed, plane.speed));

  // --- Stall: too slow and the nose drops, whatever the pilot commands ----
  plane.stalled = plane.airborne && plane.speed < PLANE.minSpeed;
  if (plane.stalled) events |= EVENT_STALL;

  // --- Attitude: bank toward the roll input, pitch toward the pitch input --
  const targetRoll = plane.stalled ? 0 : steer.roll * PLANE.maxBank;
  plane.roll += (targetRoll - plane.roll) * Math.min(1, dt * 3.2);
  const targetPitch = plane.stalled ? -14 : steer.pitch * PLANE.maxPitch;
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 2.4);

  // --- Heading follows the bank; a banked turn is how this plane turns ----
  const turn = -plane.roll * DEG * (PLANE.turnRate / PLANE.maxBank) * (0.4 + 0.6 * (plane.speed / PLANE.cruiseSpeed));
  plane.heading += turn * dt;
  if (plane.heading > Math.PI) plane.heading -= 2 * Math.PI;
  if (plane.heading < -Math.PI) plane.heading += 2 * Math.PI;

  // --- Position -----------------------------------------------------------
  const speedMs = plane.speed * KNOTS_TO_MS;
  const windX = wind ? wind.x : 0;
  const windZ = wind ? wind.z : 0;
  plane.x += (Math.sin(plane.heading) * speedMs + windX) * dt;
  plane.z += (Math.cos(plane.heading) * speedMs + windZ) * dt;

  let climb = Math.sin(plane.pitch * DEG) * speedMs;
  if (!powered) climb = -PLANE.glideSink;
  if (plane.stalled) climb = Math.min(climb, -6);
  if (!plane.airborne && plane.speed < 62) climb = 0; // still on the ground roll
  plane.verticalSpeed = climb;
  plane.y += climb * dt;

  // --- Takeoff -------------------------------------------------------------
  if (!plane.airborne && plane.speed > 62 && plane.pitch > 2) plane.airborne = true;

  // --- Rings ---------------------------------------------------------------
  const ring = world.nextRing();
  if (ring) {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ring.radius + 14) {
      ring.passed = true;
      ring.flash = 1;
      world.state.ringIndex += 1;
      events |= EVENT_RING;
    }
  }
  for (const r of world.state.rings) if (r.flash > 0) r.flash = Math.max(0, r.flash - dt * 1.5);

  // --- Ground contact -------------------------------------------------------
  const ground = world.groundHeight(plane.x, plane.z);
  if (plane.y <= ground + 1.5 && plane.airborne) {
    const strip = world.landingStrip(plane.x, plane.z);
    const sink = -plane.verticalSpeed;
    const aligned = Math.abs(plane.heading) < 0.22 && Math.abs(plane.roll) < 18;
    if (strip && sink < 7 && plane.speed < 120 && aligned) {
      plane.y = ground + 1.5;
      plane.airborne = false;
      plane.speed = Math.max(0, plane.speed - 26 * dt);
      plane.landedStrip = strip;
      if (sink > 4.5) events |= EVENT_HARD_LANDING;
      else events |= EVENT_LANDED;
    } else {
      // Water, jungle or a strip hit too hard or too fast: the flight is over.
      plane.y = ground + 1.5;
      plane.damage = 100;
      events |= EVENT_CRASHED;
    }
  }
  if (plane.y < 0) plane.y = 0;

  // Keep the pilot inside the archipelago: the sea is wide, the map is not.
  plane.x = Math.max(-7000, Math.min(7000, plane.x));
  return events;
}

/** Restart pose: short of the course start, facing north, engine idling. */
export function resetPlane(plane, fuel) {
  plane.x = 0;
  plane.y = 60;
  plane.z = -600;
  plane.heading = 0;
  plane.pitch = 0;
  plane.roll = 0;
  plane.speed = 0;
  plane.throttle = 0.55;
  plane.fuel = fuel;
  plane.damage = 0;
  plane.verticalSpeed = 0;
  plane.stalled = false;
  plane.airborne = false;
  plane.flaps = false;
  plane.landedStrip = null;
}
