// The eight sorties of Nusa Airlift, plus Free Flight. Same archipelago, same
// plane — different decisions. Each mission names its goal, its rings, its fuel
// load and its weather, and scores the flight: rings are worth points, a smooth
// landing is worth more, and the clock is always running.
//
// Special fields a mission may carry:
//   dusk — fly at sunset: low sun, lit runway, navigation lights on.
//   fog — how thick the haze is (0 = clear day, higher = murkier).
//   timeLimit — seconds to finish all rings and land, or the sortie fails.
//   startAirborne — { x, y, z, speed } pose the plane starts in, already flying.
//   pickup — two-phase rescue: land on the beach strip first, then fly home
//     to runway 36. The first touchdown is a pickup, not the end.

import { RUNWAY } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    name: 'Ring Run',
    tagline: 'Thread all eight rings, then put her down on Nusa Besar.',
    goal: 'Fly through 8 rings, then land on the runway.',
    fuel: 100,
    wind: 0,
    ringPoints: 150,
    landingPoints: 500,
    rings: [
      { x: 0, y: 170, z: 900, r: 42 },
      { x: -420, y: 210, z: 2100, r: 42 },
      { x: 380, y: 160, z: 3300, r: 40 },
      { x: -900, y: 240, z: 4600, r: 42 },
      { x: 700, y: 190, z: 5800, r: 40 },
      { x: -300, y: 220, z: 7000, r: 42 },
      { x: 900, y: 170, z: 8200, r: 40 },
      { x: 0, y: 130, z: 9200, r: 44 },
    ],
  },
  {
    id: 2,
    name: 'Island Hop',
    tagline: 'Five far-flung rings on a three-quarter tank. Fly lean or swim.',
    goal: 'Five wide rings on 70% fuel — mind the throttle, then land.',
    fuel: 70,
    wind: 4,
    ringPoints: 220,
    landingPoints: 600,
    rings: [
      { x: -2400, y: 200, z: 2600, r: 46 },
      { x: 2600, y: 180, z: 4200, r: 46 },
      { x: -3000, y: 230, z: 6600, r: 46 },
      { x: 2800, y: 200, z: 8000, r: 46 },
      { x: 0, y: 140, z: 9300, r: 46 },
    ],
  },
  {
    id: 3,
    name: 'Storm Landing',
    tagline: 'A squall is rolling in off the volcano. Three rings, then down — fast.',
    goal: 'Three rings in gusting wind, then land before the storm closes in.',
    fuel: 85,
    wind: 14,
    ringPoints: 200,
    landingPoints: 700,
    timeBonus: true,
    rings: [
      { x: -600, y: 190, z: 1800, r: 44 },
      { x: 500, y: 220, z: 4200, r: 44 },
      { x: 0, y: 150, z: 7600, r: 44 },
    ],
  },
  {
    id: 4,
    name: 'Cargo Chain',
    tagline: 'Six drops, six islands, one tank. The mail never waits.',
    goal: 'Fly the chain of 6 rings across the islands, then land.',
    fuel: 85,
    wind: 6,
    ringPoints: 180,
    landingPoints: 650,
    rings: [
      { x: -1500, y: 190, z: 1500, r: 44 },
      { x: 3600, y: 190, z: 2400, r: 44 },
      { x: -2600, y: 210, z: 4300, r: 44 },
      { x: 2900, y: 180, z: 6100, r: 44 },
      { x: -3400, y: 220, z: 8400, r: 44 },
      { x: 0, y: 140, z: 9300, r: 44 },
    ],
  },
  {
    id: 5,
    name: 'Rescue Pickup',
    tagline: 'A hiker is stranded on Pulau Pasir. Land on the beach, pick them up, fly home.',
    goal: 'Fly 3 rings, land on the Pulau Pasir beach strip, then return to runway 36.',
    fuel: 90,
    wind: 5,
    ringPoints: 200,
    landingPoints: 800,
    pickup: true,
    pickupPoints: 400,
    rings: [
      { x: 1200, y: 180, z: 1200, r: 44 },
      { x: 2600, y: 200, z: 1900, r: 44 },
      { x: 3600, y: 150, z: 2050, r: 46 },
    ],
  },
  {
    id: 6,
    name: 'Night Flight',
    tagline: 'Dusk over the archipelago. Fly by the runway lights and your instruments.',
    goal: 'Four rings at dusk, then a night landing on the lit runway.',
    fuel: 90,
    wind: 3,
    dusk: true,
    ringPoints: 220,
    landingPoints: 800,
    rings: [
      { x: -500, y: 200, z: 2000, r: 44 },
      { x: 600, y: 180, z: 4200, r: 44 },
      { x: -700, y: 220, z: 6400, r: 44 },
      { x: 0, y: 150, z: 8800, r: 44 },
    ],
  },
  {
    id: 7,
    name: 'Time Trial',
    tagline: 'Six rings, three minutes. The clock is the only enemy.',
    goal: 'Six rings and a landing in under 180 seconds.',
    fuel: 100,
    wind: 2,
    timeLimit: 180,
    ringPoints: 200,
    landingPoints: 700,
    rings: [
      { x: 0, y: 170, z: 1200, r: 42 },
      { x: -700, y: 200, z: 2800, r: 42 },
      { x: 500, y: 180, z: 4200, r: 42 },
      { x: -600, y: 220, z: 5600, r: 42 },
      { x: 800, y: 190, z: 7000, r: 42 },
      { x: 0, y: 140, z: 8600, r: 44 },
    ],
  },
  {
    id: 8,
    name: 'Storm Crossing',
    tagline: 'Fly straight through the squall line. Low cloud, hard gusts, no shortcuts.',
    goal: 'Four rings through heavy weather, then land in the murk.',
    fuel: 95,
    wind: 18,
    fog: 0.0011,
    ringPoints: 240,
    landingPoints: 750,
    rings: [
      { x: -800, y: 210, z: 2400, r: 46 },
      { x: 700, y: 230, z: 4600, r: 46 },
      { x: -500, y: 200, z: 6600, r: 46 },
      { x: 0, y: 160, z: 8800, r: 46 },
    ],
  },
];

/** Free Flight: no rings, no clock — fly anywhere, land on any strip to finish. */
export const FREE_FLIGHT = {
  id: 0,
  name: 'Free Flight',
  tagline: 'No rings, no clock. Just you, the plane, and the islands.',
  goal: 'Fly anywhere — land on any strip to finish.',
  fuel: 100,
  wind: 2,
  ringPoints: 0,
  landingPoints: 300,
  rings: [],
};

/** The runway approach fix: where the final approach starts, for the HUD arrow. */
export const FINAL_FIX = { x: RUNWAY.x, y: 110, z: RUNWAY.zStart - 1400 };

/** A mission's par time in seconds, for the Storm Landing time bonus. */
export const PAR_TIME = { 1: 300, 2: 420, 3: 240, 4: 360, 5: 420, 6: 360, 7: 180, 8: 360 };

/** Points for a ring, with a small speed bonus for flying it clean and fast. */
export function ringScore(mission, speedKnots) {
  return mission.ringPoints + Math.max(0, Math.round((speedKnots - 90) / 4));
}

/** Landing points: full marks for a gentle touchdown, less for a hard one. */
export function landingScore(mission, sinkMs, hard) {
  if (hard) return Math.round(mission.landingPoints * 0.45);
  const gentle = Math.max(0, 1 - sinkMs / 7);
  return Math.round(mission.landingPoints * (0.7 + 0.3 * gentle));
}
