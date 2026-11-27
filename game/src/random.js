// Deterministic randomness for Nusa Airlift: one seeded generator builds the
// whole archipelago, so the same seed always flies the same map — the screenshots
// and every mission share it. The noise helpers below are the same idea for the
// terrain: smooth, repeatable bumps that make hills look grown rather than drawn.

/** A small mulberry32 generator: fast, deterministic, good enough for a map. */
export function createRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max) from the generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Fisher-Yates shuffle of a copy, driven by the seeded random. */
export function shuffled(random, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/** A deterministic pick from a list, for seeded variety (cloud shapes, etc.). */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/**
 * A deterministic 2D value-noise hash: the same (seed, x, y) cell always gives
 * the same pseudo-random value in [0, 1). Integer cells, no tables to carry.
 */
export function hashNoise(seed, x, y) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smoothstep interpolation between a and b. */
export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Smooth value noise at (x, y) in world units: bilinear interpolation of the
 * hashed cell corners, so neighbouring points blend instead of stepping.
 * `cell` is the size of one noise cell in the same units as x and y.
 */
export function valueNoise(seed, x, y, cell) {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = smoothstep(0, 1, fx);
  const sy = smoothstep(0, 1, fy);
  const v00 = hashNoise(seed, x0, y0);
  const v10 = hashNoise(seed, x0 + 1, y0);
  const v01 = hashNoise(seed, x0, y0 + 1);
  const v11 = hashNoise(seed, x0 + 1, y0 + 1);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

/**
 * Two octaves of value noise, centred on 0: gentle rolling detail over the
 * broad island shapes, the same every run for the same seed.
 */
export function fbmNoise(seed, x, y) {
  const fine = valueNoise(seed, x, y, 260) - 0.5;
  const coarse = valueNoise(seed + 101, x, y, 700) - 0.5;
  return fine * 0.65 + coarse * 0.35;
}
