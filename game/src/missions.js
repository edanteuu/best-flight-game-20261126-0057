// The three sorties of Nusa Airlift. Same archipelago, same plane — different
// decisions. Each mission names its goal, its rings, its fuel load and its weather,
// and scores the flight: rings are worth points, a smooth landing is worth more,
// and the clock is always running.

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
];

/** The runway approach fix: where the final approach starts, for the HUD arrow. */
export const FINAL_FIX = { x: RUNWAY.x, y: 110, z: RUNWAY.zStart - 1400 };

/** A mission's par time in seconds, for the Storm Landing time bonus. */
export const PAR_TIME = { 1: 300, 2: 420, 3: 240 };

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
