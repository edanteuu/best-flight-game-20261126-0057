// Nusa Airlift — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical canvas; the renderer scales it to the
// window, so no rule below depends on the screen size. Distances are metres,
// altitudes are metres, speeds are knots, headings are degrees (0 = north).

export const VIEW = { width: 1280, height: 720, horizonY: 340, focal: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLANE = {
  cruiseSpeed: 145, // knots at full throttle, level flight
  minSpeed: 55, // below this the wing stalls and the nose drops
  maxSpeed: 210,
  climbRate: 9, // m/s at full power, level pitch
  turnRate: 26, // degrees of heading per second at full bank
  maxBank: 55, // degrees of roll
  maxPitch: 22, // degrees up / down
  fuelBurn: 0.55, // percent of tank per second at full throttle
  glideSink: 4.5, // m/s sink with no power
};

export const RUNWAY = {
  x: 0, // centreline, metres east of the course line
  zStart: 9800, // threshold, metres along the course
  length: 900,
  width: 46,
  heading: 0,
};

/** The beach airstrip on Pulau Pasir — the rescue pickup point. */
export const BEACH = {
  x: 3600,
  zStart: 2200,
  length: 400,
  width: 36,
  heading: 0,
  name: 'Pulau Pasir',
};

/** Paint schemes for the plane (Hangar). Each: body, accent, trim. */
export const LIVERIES = [
  { id: 'nusa', name: 'NUSA RED', body: '#f4f6f8', accent: '#d43d2a', trim: '#1e5fa8' },
  { id: 'ocean', name: 'OCEAN BLUE', body: '#eef4f8', accent: '#1e5fa8', trim: '#d43d2a' },
  { id: 'sunset', name: 'SUNSET GOLD', body: '#fdf6e3', accent: '#e8a100', trim: '#7a3b12' },
];

export const COURSE_LENGTH = 11200;

export const PALETTE = {
  skyTop: '#2f6fb8',
  skyMid: '#7fb2e0',
  skyLow: '#cfe8f5',
  sun: '#fff3c4',
  seaDeep: '#0e4d7a',
  seaShallow: '#2fa3a0',
  sand: '#e8d29a',
  grass: '#4d9e4f',
  jungle: '#2e7d3a',
  volcanoRock: '#6b4a3a',
  volcanoSmoke: '#d8d8d8',
  runway: '#3c4148',
  runwayMark: '#f5f5f0',
  ring: '#ffb400',
  ringGlow: '#ffdf6b',
  hudPanel: 'rgba(8, 24, 40, 0.72)',
  hudEdge: 'rgba(120, 220, 255, 0.85)',
  hudText: '#eafcff',
  hudAmber: '#ffb400',
  hudGreen: '#5dff8f',
  hudRed: '#ff5d5d',
  planeRed: '#d43d2a',
  planeWhite: '#f4f6f8',
  planeBlue: '#1e5fa8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"SF Mono", "Cascadia Mono", Consolas, monospace';

/** The fixed moment (seconds) the screenshot scenes are painted at. */
export const SHOT_TIME = 4.2;
