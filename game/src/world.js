// The archipelago: the fixed world Nusa Airlift flies over. Islands, the volcano,
// the runway strip, the glowing target rings and the clouds are all laid out here
// from a seeded random, so the same seed always builds the same islands — the
// screenshots and every mission fly the same map. No drawing lives here, only data.

import { COURSE_LENGTH, RUNWAY } from './config.js';
import { range } from './random.js';

/** A landmass: a sand beach ring, green interior and, on the big one, a volcano peak. */
export function makeIsland(x, z, radius, peak, name) {
  return { x, z, radius, peak, name, kind: peak > 0 ? 'volcano' : 'island' };
}

/** A glowing ring the pilot must fly through, in order. */
export function makeRing(x, y, z, radius, label) {
  return { x, y, z, radius, label, passed: false, flash: 0 };
}

/** A puffy cloud drifting over the sea. */
export function makeCloud(x, y, z, size) {
  return { x, y, z, size };
}

export function createWorld(random) {
  // The main island sits astride the course with the runway on its flat north shore;
  // the volcano rises behind it so the approach is unmistakable from miles out.
  const islands = [
    makeIsland(0, 10250, 1150, 420, 'Nusa Besar'),
    makeIsland(-2600, 4300, 780, 0, 'Pulau Hijau'),
    makeIsland(2900, 6100, 640, 0, 'Pulau Karang'),
    makeIsland(-3400, 8400, 520, 0, 'Pulau Angin'),
    makeIsland(3600, 2400, 560, 0, 'Pulau Pasir'),
    makeIsland(-1500, 1500, 420, 0, 'Pulau Kecil'),
    makeIsland(5200, 9500, 700, 0, 'Pulau Timur'),
    makeIsland(-5200, 1800, 600, 0, 'Pulau Barat'),
  ];

  // Distant silhouettes on the horizon, beyond the flyable course.
  const farIslands = [
    { x: -8000, z: 14000, radius: 1500, peak: 300 },
    { x: 7000, z: 15000, radius: 1200, peak: 0 },
    { x: 12000, z: 6000, radius: 1400, peak: 200 },
    { x: -11000, z: 7000, radius: 1300, peak: 0 },
    { x: 0, z: 17500, radius: 2000, peak: 500 },
  ];

  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push(makeCloud(
      range(random, -6000, 6000),
      range(random, 260, 560),
      range(random, 300, COURSE_LENGTH + 2000),
      range(random, 90, 260),
    ));
  }

  const state = {
    islands,
    farIslands,
    clouds,
    rings: [],
    ringIndex: 0,
    ringsTotal: 0,
  };

  /** Lay the mission's rings along the course. Each ring: where it hangs and how wide. */
  function layRings(specs) {
    state.rings = specs.map((spec, i) => makeRing(spec.x, spec.y, spec.z, spec.r, `R${i + 1}`));
    state.ringIndex = 0;
    state.ringsTotal = state.rings.length;
  }

  /** The ring the pilot is aiming at now, or null when the course is done. */
  function nextRing() {
    return state.ringIndex < state.rings.length ? state.rings[state.ringIndex] : null;
  }

  /** Ground height under (x, z): the volcano peak, island hills, else sea level 0.
   * The runway strip is flat ground, so a touchdown there reads as a landing
   * and anywhere else reads as a crash into terrain or water. */
  function groundHeight(x, z) {
    // The runway strip is flat ground.
    if (Math.abs(x - RUNWAY.x) < RUNWAY.width / 2 + 30
      && z > RUNWAY.zStart - 60 && z < RUNWAY.zStart + RUNWAY.length + 60) return 2;
    let height = 0;
    for (const island of islands) {
      const dx = x - island.x;
      const dz = z - island.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < island.radius) {
        const falloff = 1 - d / island.radius;
        const hill = 26 * falloff + (island.peak > 0 ? island.peak * falloff * falloff : 0);
        if (hill > height) height = hill;
      }
    }
    return height;
  }

  /** True when (x, z) is over dry land rather than open sea. */
  function isLand(x, z) {
    for (const island of islands) {
      const dx = x - island.x;
      const dz = z - island.z;
      if (Math.sqrt(dx * dx + dz * dz) < island.radius * 0.96) return true;
    }
    return false;
  }

  /** True when the aircraft is over the runway strip (for a legal touchdown). */
  function overRunway(x, z) {
    return Math.abs(x - RUNWAY.x) < RUNWAY.width / 2
      && z >= RUNWAY.zStart && z <= RUNWAY.zStart + RUNWAY.length;
  }

  return { state, layRings, nextRing, groundHeight, isLand, overRunway };
}
