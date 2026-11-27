// The painter, in real 3D: sky, sun, sea, islands, volcano, runway, rings and
// clouds, rendered with Three.js (vendored under game/vendor/). One scene is built
// from the seeded world and re-posed every frame: the camera sits behind and above
// the plane and looks along its heading, so the pilot always sees the same chase
// view — terrain ahead, aircraft in frame below — or, in cockpit mode, the view
// from the pilot's seat over a lit instrument panel.
//
// v3: a finer terrain mesh with a procedural speckle texture, instanced jungle
// and palms, a real airfield (tower, hangar, parked plane, PAPI lights), a
// glowing lava crater, an animated ocean bump, rain and lightning for the squall
// missions, a light pillar marking the next ring, and cockpit instruments that
// actually move with the plane.
//
// Everything here is deterministic in `time`: the same time paints the same frame,
// which is what makes the screenshot poses repeatable.

import * as THREE from 'three';
import { BEACH, PALETTE, RUNWAY, VIEW } from './config.js';
import { applyLivery, buildAircraft, updateAircraft } from './aircraft.js';
import { buildVegetation } from './vegetation.js';
import { createWeather } from './weather.js';

/** Screen names the loop and the screenshot stager share. */
export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LAND = 'land';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_CRASH = 'crash';

const DEG = Math.PI / 180;

/** A soft round sprite texture, drawn once on a canvas (particles, smoke). */
function softTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/** The runway surface: asphalt, edge lines, dashed centreline, threshold bars. */
function runwayTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#454b54';
  g.fillRect(0, 0, 256, 1024);
  // Asphalt speckle.
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 1024, 2, 2);
  }
  // Edge lines.
  g.fillStyle = '#f5f5f0';
  g.fillRect(14, 0, 6, 1024);
  g.fillRect(236, 0, 6, 1024);
  // Dashed centreline.
  for (let y = 40; y < 1024; y += 96) g.fillRect(124, y, 8, 52);
  // Threshold bars at both ends.
  for (const y0 of [24, 1024 - 60]) {
    for (let i = 0; i < 6; i += 1) g.fillRect(28 + i * 38, y0, 22, 36);
  }
  // Runway number 36 near the near threshold.
  g.fillStyle = '#f5f5f0';
  g.font = 'bold 92px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('36', 128, 190);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The beach strip: sand with tyre tracks and white edge lines. */
function beachTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#dcc78e';
  g.fillRect(0, 0, 128, 512);
  g.fillStyle = 'rgba(120, 95, 50, 0.55)';
  g.fillRect(44, 0, 10, 512);
  g.fillRect(74, 0, 10, 512);
  g.fillStyle = '#f5f5f0';
  g.fillRect(6, 0, 4, 512);
  g.fillRect(118, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The terrain's detail texture: a near-white speckle that breaks up the flat
 * vertex colours at low altitude, so grass reads as grass instead of paint.
 * Multiplied by the biome vertex colours, so it never changes the palette.
 */
function terrainTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ee';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i += 1) {
    const v = Math.random();
    g.fillStyle = v < 0.5
      ? `rgba(70, 110, 60, ${0.05 + Math.random() * 0.12})`
      : `rgba(120, 110, 80, ${0.05 + Math.random() * 0.10})`;
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  for (let i = 0; i < 260; i += 1) {
    g.fillStyle = `rgba(60, 90, 55, ${0.08 + Math.random() * 0.1})`;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = 4;
  return tex;
}

/** A grey noise canvas for the ocean's animated bump map. */
function oceanBumpTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i += 1) {
    const v = 96 + Math.floor(Math.random() * 64);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 9, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  return tex;
}

/**
 * The cockpit instrument panel. Returns { tex, redraw(plane) }: the static
 * frame and compass strip are painted once, and redraw repaints the three dials
 * from the live flight state — the attitude ball rolls and pitches with the
 * plane, the altimeter needle follows altitude, the airspeed needle follows speed.
 */
function createPanel() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 300;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  function dial(cx, cy, r, draw) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#16222e';
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    draw(cx, cy, r);
    g.restore();
    g.strokeStyle = '#7ee7ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  function drawStatic() {
    g.fillStyle = '#1a2531';
    g.fillRect(0, 0, 1024, 300);
    g.strokeStyle = 'rgba(120, 220, 255, 0.5)';
    g.lineWidth = 3;
    g.strokeRect(6, 6, 1012, 288);
    g.fillStyle = '#eafcff';
    g.font = 'bold 24px monospace';
    g.textAlign = 'center';
    g.fillText('N   030   060   E   120   150   S', 512, 44);
  }
  function redraw(plane) {
    drawStatic();
    const alt = Math.max(0, plane.y);
    const speed = Math.max(0, plane.speed);
    // Attitude ball: blue sky over brown earth, rolling and pitching live.
    dial(170, 150, 105, (cx, cy, r) => {
      g.save();
      g.translate(cx, cy);
      g.rotate((-plane.roll * Math.PI) / 180);
      g.translate(0, plane.pitch * 1.1);
      g.fillStyle = '#3f8fd2';
      g.fillRect(-r - 2, -r * 3, r * 2 + 4, r * 3);
      g.fillStyle = '#7a5a34';
      g.fillRect(-r - 2, 0, r * 2 + 4, r * 3);
      g.strokeStyle = '#fff';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-r, 0);
      g.lineTo(r, 0);
      g.stroke();
      g.restore();
      g.strokeStyle = '#ffb400';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(cx - r - 4, cy);
      g.lineTo(cx - 24, cy);
      g.moveTo(cx + 24, cy);
      g.lineTo(cx + r + 4, cy);
      g.stroke();
    });
    // Altimeter: needle climbs with altitude, 1000 m per full turn.
    dial(512, 150, 105, (cx, cy, r) => {
      g.strokeStyle = '#eafcff';
      g.fillStyle = '#eafcff';
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        g.lineWidth = i % 3 === 0 ? 4 : 2;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
        g.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
        g.stroke();
      }
      const a = -Math.PI / 2 + ((alt % 1000) / 1000) * Math.PI * 2;
      g.strokeStyle = '#ffb400';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
      g.stroke();
      g.font = 'bold 26px monospace';
      g.textAlign = 'center';
      g.fillText(String(Math.round(alt)), cx, cy + 52);
    });
    // Airspeed: needle sweeps 0–210 kt across a 270-degree dial.
    dial(854, 150, 105, (cx, cy, r) => {
      g.strokeStyle = '#eafcff';
      g.fillStyle = '#eafcff';
      for (let i = 0; i < 10; i += 1) {
        const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
        g.lineWidth = i % 5 === 0 ? 4 : 2;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
        g.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
        g.stroke();
      }
      const a = Math.PI * 0.75 + (Math.min(210, speed) / 210) * Math.PI * 1.5;
      g.strokeStyle = '#5dff8f';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
      g.stroke();
      g.font = 'bold 26px monospace';
      g.textAlign = 'center';
      g.fillText(String(Math.round(speed)), cx, cy + 52);
    });
    tex.needsUpdate = true;
  }
  drawStatic();
  return { tex, redraw };
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Terrain colour by height: sand, grass, jungle, rock, dark volcanic rock. */
export function terrainColor(h, out) {
  const sand = [0.85, 0.76, 0.51];
  const grass = [0.36, 0.63, 0.31];
  const jungle = [0.18, 0.49, 0.23];
  const rock = [0.42, 0.29, 0.23];
  const dark = [0.26, 0.19, 0.16];
  let a;
  let b;
  let t;
  if (h < 3) { a = sand; b = grass; t = smooth(1.5, 3, h); }
  else if (h < 14) { a = grass; b = jungle; t = smooth(8, 14, h); }
  else if (h < 90) { a = jungle; b = rock; t = smooth(55, 90, h); }
  else if (h < 220) { a = rock; b = dark; t = smooth(130, 220, h); }
  else { a = dark; b = dark; t = 0; }
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
}`;

const SKY_FRAG = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizonColor, topColor, smoothstep(0.0, 0.55, h));
  if (h < 0.0) col = horizonColor * 0.92;
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 350.0) * 1.4 + pow(s, 24.0) * 0.30);
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Build the renderer on `canvas` for `world`. Returns the renderer object:
 * setMission(mission), setLivery(livery), ringBurst(ring),
 * renderFrame(plane, world, mission, time, cameraMode, dt).
 */
export function createRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, preserveDrawingBuffer: true,
  });
  renderer.setSize(VIEW.width, VIEW.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbfd9ea, 0.00028);
  const camera = new THREE.PerspectiveCamera(55, VIEW.width / VIEW.height, 0.5, 60000);
  scene.add(camera);

  // --- Lights ---------------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -420;
  sun.shadow.camera.right = 420;
  sun.shadow.camera.top = 420;
  sun.shadow.camera.bottom = -420;
  sun.shadow.camera.near = 200;
  sun.shadow.camera.far = 9000;
  sun.shadow.bias = -0.0006;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x3a5f3a, 0.9);
  scene.add(hemi);

  // --- Sky dome, sun disc, sun glow sprite, stars ------------------------------
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x2f6fb8) },
    horizonColor: { value: new THREE.Color(0xcfe8f5) },
    sunDir: { value: new THREE.Vector3(0.45, 0.38, 0.8).normalize() },
    sunColor: { value: new THREE.Color(0xfff3c4) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(28000, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, fog: false, depthWrite: false,
    }),
  );
  scene.add(sky);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTexture(), color: 0xfff3c4, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
  }));
  sunGlow.position.copy(skyUniforms.sunDir.value).multiplyScalar(25500);
  sunGlow.scale.set(2000, 2000, 1);
  scene.add(sunGlow);

  const starGeo = new THREE.BufferGeometry();
  {
    const pts = [];
    for (let i = 0; i < 700; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.48 + 0.03;
      const r = 26000;
      pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
  }));
  scene.add(stars);

  // --- Terrain heightfield (finer grid + speckle texture in v3) ------------------
  {
    const x0 = -7500;
    const x1 = 7500;
    const z0 = -1500;
    const z1 = 12500;
    const step = 70;
    const nx = Math.round((x1 - x0) / step) + 1;
    const nz = Math.round((z1 - z0) / step) + 1;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx - 1, nz - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = [0, 0, 0];
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i) + (x0 + x1) / 2;
      const z = pos.getZ(i) + (z0 + z1) / 2;
      const h = world.groundHeight(x, z);
      // The heightfield spans the sea too: drop the seabed below the ocean's
      // waves (ocean sits at y=-0.4, waves up to +0.7) so the water — not a
      // flat sand sheet — is what the pilot sees over the sea.
      pos.setY(i, h <= 0 ? -5 : h);
      terrainColor(h, col);
      colors[i * 3] = col[0];
      colors[i * 3 + 1] = col[1];
      colors[i * 3 + 2] = col[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: terrainTexture(), vertexColors: true, roughness: 0.95, metalness: 0 }),
    );
    terrain.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    terrain.receiveShadow = true;
    scene.add(terrain);
  }

  // The jungle and the palms, instanced from the seeded world.
  const veg = buildVegetation(scene, world, world.state.seed);

  // Distant silhouettes beyond the flyable course.
  for (const island of world.state.farIslands) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(island.radius, Math.max(60, island.peak || 120), 10),
      new THREE.MeshStandardMaterial({ color: 0x5d87a8, roughness: 1, transparent: true, opacity: 0.75 }),
    );
    cone.position.set(island.x, (island.peak || 120) / 2 - 10, island.z);
    scene.add(cone);
  }

  // --- Volcano lava: a glowing dome on the crater's ridge, and a warm light -----
  // The approach corridor cuts a valley through the crater itself, so the lava
  // sits on the ridge beside it (x 480, where the mesh actually rises) as a dome
  // embedded in the slope — never floating, always grounded.
  const craterRidgeH = world.groundHeight(480, 10250);
  const lava = new THREE.Mesh(
    new THREE.ConeGeometry(95, 75, 12),
    new THREE.MeshStandardMaterial({
      color: 0x3d0f02, emissive: 0xff6a1a, emissiveIntensity: 2.0, roughness: 0.5,
    }),
  );
  lava.position.set(480, craterRidgeH - 12, 10250);
  scene.add(lava);
  const lavaLight = new THREE.PointLight(0xff6a1a, 900, 1600, 1.6);
  lavaLight.position.set(480, craterRidgeH + 70, 10250);
  scene.add(lavaLight);

  // --- Ocean (animated bump in v3) ----------------------------------------------
  const oceanGeo = new THREE.PlaneGeometry(42000, 42000, 64, 64);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanBase = oceanGeo.attributes.position.array.slice();
  const oceanBump = oceanBumpTexture();
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshPhongMaterial({
      color: 0x0d5f8f, specular: 0x335577, shininess: 100,
      bumpMap: oceanBump, bumpScale: 0.7,
      transparent: true, opacity: 0.96,
    }),
  );
  ocean.position.set(0, -0.4, 6000);
  scene.add(ocean);

  // Foam rings where the sea meets each island, breathing with the swell.
  const foamMeshes = [];
  for (const island of world.state.islands) {
    const foam = new THREE.Mesh(
      new THREE.RingGeometry(island.radius * 0.98, island.radius * 1.1, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(island.x, 0.3, island.z);
    scene.add(foam);
    foamMeshes.push(foam);
  }

  // --- Runway 36 ---------------------------------------------------------------
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(72, RUNWAY.length + 60),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9, metalness: 0 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(RUNWAY.x, 2.3, RUNWAY.zStart + (RUNWAY.length + 60) / 2 - 30);
  runway.receiveShadow = true;
  scene.add(runway);

  // PAPI lights beside the threshold: two red, two white means on the glidepath.
  for (let i = 0; i < 4; i += 1) {
    const papi = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x111111, emissive: i < 2 ? 0xff2a2a : 0xffffff, emissiveIntensity: 1.4,
      }),
    );
    papi.position.set(34 + i * 5, 3, RUNWAY.zStart + 150);
    scene.add(papi);
  }

  // Runway edge lights + approach lights (brighter at dusk).
  const runwayLights = [];
  function edgeLight(x, y, z) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0.7 }),
    );
    m.position.set(x, y, z);
    scene.add(m);
    runwayLights.push(m);
    return m;
  }
  for (let z = RUNWAY.zStart + 40; z <= RUNWAY.zStart + RUNWAY.length - 40; z += 90) {
    edgeLight(RUNWAY.x - 40, 3.2, z);
    edgeLight(RUNWAY.x + 40, 3.2, z);
  }
  for (let z = RUNWAY.zStart - 500; z < RUNWAY.zStart - 40; z += 110) {
    edgeLight(RUNWAY.x - 14, 3.2, z);
    edgeLight(RUNWAY.x + 14, 3.2, z);
  }

  // --- The airfield: control tower, hangar, parked plane, fuel drums -------------
  const tower = new THREE.Group();
  {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 6, 42, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.towerWhite, roughness: 0.8 }),
    );
    shaft.position.y = 21;
    shaft.castShadow = true;
    tower.add(shaft);
    const cab = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 7, 7, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.towerGlass, roughness: 0.2, metalness: 0.6 }),
    );
    cab.position.y = 45;
    tower.add(cab);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(9.5, 9.5, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.planeRed, roughness: 0.7 }),
    );
    roof.position.y = 49;
    tower.add(roof);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.4 }),
    );
    antenna.position.y = 54;
    tower.add(antenna);
  }
  tower.position.set(95, 2, 10450);
  scene.add(tower);
  const hangar = new THREE.Group();
  {
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(52, 15, 34),
      new THREE.MeshStandardMaterial({ color: PALETTE.hangar, roughness: 0.85 }),
    );
    walls.position.y = 7.5;
    walls.castShadow = true;
    hangar.add(walls);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(17, 17, 52, 12, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.7, metalness: 0.3 }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 15;
    hangar.add(roof);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(40, 11, 1),
      new THREE.MeshStandardMaterial({ color: 0x2c3844, roughness: 0.6, metalness: 0.5 }),
    );
    door.position.set(0, 5.5, 17.2);
    hangar.add(door);
  }
  hangar.position.set(-110, 2, 10520);
  scene.add(hangar);
  // A sister ship parked by the hangar, in the ocean livery.
  const parked = buildAircraft({ body: '#eef4f8', accent: '#1e5fa8', trim: '#d43d2a' });
  parked.position.set(-58, 2, 10360);
  parked.rotation.y = 0.6;
  scene.add(parked);
  for (let i = 0; i < 3; i += 1) {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 4.2, 10),
      new THREE.MeshStandardMaterial({ color: i === 1 ? 0x3a6b8a : 0x8a5a2a, roughness: 0.85 }),
    );
    drum.position.set(-70 + i * 7, 4.1, 10440);
    drum.castShadow = true;
    scene.add(drum);
  }

  // --- Beach strip on Pulau Pasir ----------------------------------------------
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(BEACH.width + 8, BEACH.length + 40),
    new THREE.MeshStandardMaterial({ map: beachTexture(), roughness: 1, metalness: 0 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(BEACH.x, 2.3, BEACH.zStart + BEACH.length / 2);
  beach.receiveShadow = true;
  scene.add(beach);
  // Windsock at the beach strip.
  const windsock = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 14, 8),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, metalness: 0.5 }),
  );
  pole.position.y = 7;
  windsock.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, emissive: 0x903a00, emissiveIntensity: 0.4 }),
  );
  sock.rotation.z = Math.PI / 2 - 0.25;
  sock.position.set(3, 13.4, 0);
  windsock.add(sock);
  windsock.position.set(BEACH.x - 30, 2, BEACH.zStart + 30);
  scene.add(windsock);
  // Supply crate waiting at the beach.
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(6, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6b3a, roughness: 0.9 }),
  );
  crate.position.set(BEACH.x + 24, 5, BEACH.zStart + 120);
  crate.rotation.y = 0.4;
  crate.castShadow = true;
  scene.add(crate);

  // --- Clouds -------------------------------------------------------------------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.88 });
  const clouds = [];
  for (const c of world.state.clouds) {
    const group = new THREE.Group();
    const puffs = 4 + Math.floor((c.size % 3));
    for (let i = 0; i < puffs; i += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), cloudMat);
      const off = (i - puffs / 2) * c.size * 0.55;
      s.position.set(off, (i % 2) * c.size * 0.12, (i % 3 - 1) * c.size * 0.25);
      s.scale.set(c.size * 0.62, c.size * 0.2, c.size * 0.4);
      group.add(s);
    }
    group.position.set(c.x, c.y, c.z);
    group.userData.baseX = c.x;
    scene.add(group);
    clouds.push(group);
  }

  // --- Volcano smoke --------------------------------------------------------------
  const smokeTex = softTexture();
  const smokeSprites = [];
  for (let i = 0; i < 36; i += 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, color: 0xdcdcdc, transparent: true, opacity: 0.4, depthWrite: false,
    }));
    sp.userData.phase = i / 36;
    scene.add(sp);
    smokeSprites.push(sp);
  }

  // --- Storm weather (rain + lightning, only on the squall missions) --------------
  const weather = createWeather(scene);

  // --- Rings ----------------------------------------------------------------------
  let ringMeshes = [];
  // A pillar of light over the next ring, so the pilot can find it from miles out.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 240, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffb400, transparent: true, opacity: 0.1,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beacon.visible = false;
  scene.add(beacon);
  function buildRings(mission) {
    for (const m of ringMeshes) scene.remove(m.group);
    ringMeshes = [];
    for (const ring of mission.rings) {
      const group = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(ring.r, 1.8, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0xffb400 }),
      );
      group.add(torus);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(ring.r * 1.12, 3.4, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.16, depthWrite: false }),
      );
      group.add(halo);
      group.position.set(ring.x, ring.y, ring.z);
      scene.add(group);
      ringMeshes.push({ group, torus, halo, ring });
    }
  }

  // --- Particles (engine smoke, spray, dust, ring bursts) ---------------------------
  const P_COUNT = 240;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_COUNT * 3);
  const pCol = new Float32Array(P_COUNT * 3);
  for (let i = 0; i < P_COUNT; i += 1) pPos[i * 3 + 1] = -9999;
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 7, map: softTexture(), transparent: true, opacity: 0.75,
    vertexColors: true, depthWrite: false, sizeAttenuation: true,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const pool = [];
  for (let i = 0; i < P_COUNT; i += 1) {
    pool.push({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
  }
  let poolNext = 0;
  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = pool[poolNext];
    poolNext = (poolNext + 1) % P_COUNT;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.maxLife = life;
    p.r = r; p.g = g; p.b = b;
  }

  // --- The plane -------------------------------------------------------------------
  let planeGroup = buildAircraft({ body: PALETTE.planeWhite, accent: PALETTE.planeRed, trim: PALETTE.planeBlue });
  scene.add(planeGroup);

  // --- Cockpit dashboard (child of the camera, only seen in cockpit mode) ------------
  const panel = createPanel();
  const dash = new THREE.Group();
  {
    const panelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.05, 0.14),
      new THREE.MeshStandardMaterial({ map: panel.tex, roughness: 0.6, metalness: 0.2, emissive: 0xffffff, emissiveMap: panel.tex, emissiveIntensity: 0.9 }),
    );
    panelMesh.position.set(0, -0.62, -1.7);
    dash.add(panelMesh);
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.14, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2e353d, roughness: 0.9 }),
    );
    shield.position.set(0, -0.02, -1.55);
    shield.rotation.x = 0.35;
    dash.add(shield);
    const noseCone = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f6f8, metalness: 0.4, roughness: 0.4 }),
    );
    noseCone.scale.set(1.1, 0.55, 1.6);
    noseCone.position.set(0, -0.72, -2.4);
    dash.add(noseCone);
    // The yoke: a small wheel on a column, between the pilot and the panel.
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a4552, roughness: 0.5, metalness: 0.6 }),
    );
    column.position.set(0, -0.62, -1.35);
    column.rotation.x = 0.5;
    dash.add(column);
    const yoke = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.03, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x3a4552, roughness: 0.5, metalness: 0.6 }),
    );
    yoke.position.set(0, -0.68, -1.25);
    yoke.rotation.x = 0.5;
    dash.add(yoke);
  }
  dash.visible = false;
  camera.add(dash);
  // A small warm light inside the cockpit so the shield, yoke and column
  // read as lit hardware instead of black shapes. It is a child of the camera
  // with a short range, so it never touches the outside scene.
  const cockpitLight = new THREE.PointLight(0xffd9a0, 3, 4, 1.5);
  cockpitLight.position.set(0, 0.35, -0.4);
  camera.add(cockpitLight);

  // --- Per-mission look ---------------------------------------------------------------
  let dusk = false;
  let hemiBase = 0.9;
  function applyLook(mission) {
    dusk = !!mission.dusk;
    const fogDensity = mission.fog ?? (dusk ? 0.0004 : 0.00028);
    scene.fog.density = fogDensity;
    if (dusk) {
      skyUniforms.topColor.value.set(0x2a2a55);
      skyUniforms.horizonColor.value.set(0xff8a4d);
      skyUniforms.sunDir.value.set(0.62, 0.1, 0.72).normalize();
      skyUniforms.sunColor.value.set(0xffb36b);
      sun.color.set(0xff9a4d);
      sun.intensity = 1.15;
      hemiBase = 0.45;
      hemi.intensity = hemiBase;
      renderer.toneMappingExposure = 1.0;
      stars.material.opacity = 0.85;
      for (const l of runwayLights) l.material.emissiveIntensity = 3.2;
    } else {
      skyUniforms.topColor.value.set(0x2f6fb8);
      skyUniforms.horizonColor.value.set(0xcfe8f5);
      skyUniforms.sunDir.value.set(0.45, 0.38, 0.8).normalize();
      skyUniforms.sunColor.value.set(0xfff3c4);
      sun.color.set(0xfff2d0);
      sun.intensity = 2.4;
      hemiBase = 0.9;
      hemi.intensity = hemiBase;
      renderer.toneMappingExposure = 1.06;
      stars.material.opacity = 0;
      for (const l of runwayLights) l.material.emissiveIntensity = 0.7;
    }
    scene.fog.color.set(dusk ? 0x8a6a72 : 0xbfd9ea);
    sunGlow.position.copy(skyUniforms.sunDir.value).multiplyScalar(25500);
    sunGlow.material.color.set(dusk ? 0xffb36b : 0xfff3c4);
    sunGlow.material.opacity = dusk ? 0.9 : 0.55;
    weather.setStorm(!!mission.rain);
  }

  // --- Camera state ---------------------------------------------------------------------
  const camPos = new THREE.Vector3(-300, 316, 6748);
  const camLook = new THREE.Vector3(0, 200, 7000);
  let fovNow = 55;

  function frameCamera(plane, mission, time, cameraMode, dt) {
    const heading = plane.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const snap = dt >= 0.5 ? 1 : 1 - Math.exp(-dt * 7);
    if (cameraMode === 'cockpit') {
      const px = plane.x + fx * 2.6;
      const py = plane.y + 1.1;
      const pz = plane.z + fz * 2.6;
      camPos.lerp(new THREE.Vector3(px, py, pz), snap);
      const look = new THREE.Vector3(
        plane.x + Math.sin(heading) * 400,
        plane.y + Math.sin(plane.pitch * DEG) * 400,
        plane.z + Math.cos(heading) * 400,
      );
      camLook.lerp(look, snap);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.fov = 62;
      camera.updateProjectionMatrix();
      return;
    }
    // Chase view: behind and above the plane, looking ahead of it.
    const back = 52;
    const tx = plane.x - fx * back;
    const ty = plane.y + 16;
    const tz = plane.z - fz * back;
    camPos.lerp(new THREE.Vector3(tx, ty, tz), snap);
    const look = new THREE.Vector3(
      plane.x + fx * 260,
      plane.y + Math.sin(plane.pitch * DEG) * 120 - 6,
      plane.z + fz * 260,
    );
    camLook.lerp(look, snap);
    const shake = mission.wind >= 10 ? 1.4 : 0;
    camera.position.set(
      camPos.x + Math.sin(time * 13.1) * shake,
      camPos.y + Math.sin(time * 17.7) * shake * 0.6,
      camPos.z + Math.cos(time * 11.3) * shake,
    );
    camera.lookAt(camLook);
    const fovTarget = 55 + (plane.speed / 210) * 13;
    if (Math.abs(fovTarget - fovNow) > 0.1) {
      fovNow += (fovTarget - fovNow) * snap;
      camera.fov = fovNow;
      camera.updateProjectionMatrix();
    }
  }

  function updateOcean(time) {
    const pos = oceanGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = oceanBase[i * 3];
      const z = oceanBase[i * 3 + 2];
      pos.setY(i, 0.55 * Math.sin(x * 0.08 + time * 1.1)
        + 0.35 * Math.sin(z * 0.11 - time * 0.8)
        + 0.2 * Math.sin((x + z) * 0.05 + time * 0.5));
    }
    pos.needsUpdate = true;
    oceanGeo.computeVertexNormals();
    oceanBump.offset.set(time * 0.006, time * 0.004);
  }

  function updateParticles(dt) {
    for (let i = 0; i < P_COUNT; i += 1) {
      const p = pool[i];
      if (p.life <= 0) {
        pPos[i * 3 + 1] = -9999;
        continue;
      }
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += 0.4 * dt;
      const fade = Math.max(0, p.life / p.maxLife);
      pPos[i * 3] = p.x;
      pPos[i * 3 + 1] = p.y;
      pPos[i * 3 + 2] = p.z;
      pCol[i * 3] = p.r * fade;
      pCol[i * 3 + 1] = p.g * fade;
      pCol[i * 3 + 2] = p.b * fade;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  let lastSmoke = 0;
  function updatePlane(plane, world, time, dt, cameraMode) {
    planeGroup.visible = cameraMode !== 'cockpit';
    planeGroup.position.set(plane.x, plane.y, plane.z);
    planeGroup.rotation.order = 'YXZ';
    planeGroup.rotation.set(-plane.pitch * DEG, plane.heading, -plane.roll * DEG);
    updateAircraft(planeGroup, plane, time, dusk);
    // Exhaust smoke while flying with power; spray when skimming the sea; dust
    // on the ground roll. All from the same particle pool.
    if (plane.airborne && plane.throttle > 0.25 && time - lastSmoke > 0.05) {
      lastSmoke = time;
      const fx = Math.sin(plane.heading);
      const fz = Math.cos(plane.heading);
      spawn(
        plane.x - fx * 5, plane.y + 0.4, plane.z - fz * 5,
        -fx * 6 + (Math.random() - 0.5) * 2, 0.6, -fz * 6 + (Math.random() - 0.5) * 2,
        1.1, 0.75, 0.75, 0.75,
      );
    }
    if (plane.airborne && plane.y < 14 && !world.isLand(plane.x, plane.z) && time - lastSmoke > 0.09) {
      lastSmoke = time;
      spawn(
        plane.x, 1.5, plane.z,
        (Math.random() - 0.5) * 4, 2.5, (Math.random() - 0.5) * 4,
        0.9, 0.95, 0.98, 1,
      );
    }
    if (!plane.airborne && plane.speed > 25 && time - lastSmoke > 0.07) {
      lastSmoke = time;
      spawn(
        plane.x, 2, plane.z - 4,
        (Math.random() - 0.5) * 3, 1.2, (Math.random() - 0.5) * 3,
        0.8, 0.85, 0.75, 0.6,
      );
    }
  }

  function setMission(mission) {
    buildRings(mission);
    applyLook(mission);
    for (const p of pool) p.life = 0;
  }

  function ringBurst(ring) {
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2;
      spawn(
        ring.x + Math.cos(a) * ring.r, ring.y + Math.sin(a) * ring.r, ring.z,
        Math.cos(a) * 30, Math.sin(a) * 30, (Math.random() - 0.5) * 10,
        0.8, 0.45, 1, 0.55,
      );
    }
  }

  function renderFrame(plane, world, mission, time, cameraMode, dt) {
    const step = dt ?? 1 / 60;
    updateOcean(time);
    for (const cloud of clouds) {
      cloud.position.x = cloud.userData.baseX + time * 4;
    }
    for (let i = 0; i < foamMeshes.length; i += 1) {
      foamMeshes[i].material.opacity = 0.28 + Math.sin(time * 0.8 + i * 1.7) * 0.08;
    }
    for (const sp of smokeSprites) {
      const cycle = (time * 0.045 + sp.userData.phase) % 1;
      sp.position.set(
        0 + cycle * 130 + Math.sin(cycle * 9) * 18,
        430 + cycle * 260,
        10250 - cycle * 60,
      );
      sp.material.opacity = (1 - cycle) * 0.42;
      const s = 26 + cycle * 70;
      sp.scale.set(s, s, 1);
    }
    // The lava glows and breathes: its light pulses slowly with the crater.
    lava.material.emissiveIntensity = 2.0 + Math.sin(time * 1.3) * 0.5;
    lavaLight.intensity = 800 + Math.sin(time * 1.3) * 220;
    // Rain and lightning on the squall missions; a flash lifts the whole scene.
    const flash = weather.update(step, time, plane);
    hemi.intensity = hemiBase * (1 + flash * 1.6);
    // Rings: next one pulses, passed ones turn green; the beacon marks the next.
    const next = world.nextRing();
    for (const m of ringMeshes) {
      const passed = m.ring.passed;
      m.torus.material.color.set(passed ? 0x5dff8f : 0xffb400);
      m.halo.material.color.set(passed ? 0x5dff8f : 0xffb400);
      const pulse = m.ring === next ? 1 + Math.sin(time * 4) * 0.05 : 1;
      m.group.scale.set(pulse, pulse, 1);
    }
    if (next) {
      beacon.visible = true;
      beacon.position.set(next.x, next.y + 120, next.z);
      beacon.material.opacity = 0.045 + Math.sin(time * 3) * 0.015;
    } else {
      beacon.visible = false;
    }
    updatePlane(plane, world, time, step, cameraMode);
    updateParticles(step);
    // Sun and its shadow follow the plane.
    const sd = skyUniforms.sunDir.value;
    sun.position.set(plane.x + sd.x * 3000, plane.y + sd.y * 3000 + 400, plane.z + sd.z * 3000);
    sun.target.position.set(plane.x, plane.y, plane.z);
    sun.target.updateMatrixWorld();
    frameCamera(plane, mission, time, cameraMode, step);
    dash.visible = cameraMode === 'cockpit';
    if (cameraMode === 'cockpit') panel.redraw(plane);
    renderer.render(scene, camera);
  }

  return {
    setMission,
    setLivery(livery) { applyLivery(planeGroup, livery); },
    ringBurst,
    renderFrame,
    /** v3 internals, exposed for the tests: vegetation counts and terrain colours. */
    vegetation: veg,
  };
}
