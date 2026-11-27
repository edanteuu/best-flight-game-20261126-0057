// The aircraft itself, built in real 3D: a single-prop island airlift plane made
// from primitives — fuselage, wings, tail, spinning propeller, navigation lights
// and fixed gear — painted in the chosen livery. No image files: every part is
// geometry and material, so the plane always matches the game's style and the
// dossier never carries borrowed art. v3: wing struts, a spinner cone, a landing
// light with a visible beam for dusk, glowing wingtip sprites and a registration
// decal on the fuselage.
//
// Local space: nose points +z, wingspan along x, up is +y. The renderer orients
// the group with rotation order YXZ: yaw = heading, pitch = -pitch, roll = -roll.

import * as THREE from 'three';

function std(color, metalness, roughness, extra) {
  return new THREE.MeshStandardMaterial({
    color, metalness: metalness ?? 0.35, roughness: roughness ?? 0.45, ...(extra || {}),
  });
}

/** A soft round glow sprite texture, drawn once on a canvas. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** The registration decal: white "NUSA 01" lettering on a transparent tile. */
function registrationTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(20, 30, 40, 0.88)';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('NUSA 01', 128, 46);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build the plane for `livery` ({ body, accent, trim } colours).
 * Returns the group; its userData holds the animated parts:
 * propeller (spins), navLeft/navRight/strobe (blink), landingLight (dusk) and gear.
 */
export function buildAircraft(livery) {
  const group = new THREE.Group();
  const body = std(livery.body, 0.4, 0.4);
  const accent = std(livery.accent, 0.3, 0.5);
  const trim = std(livery.trim, 0.5, 0.35);
  const dark = std(0x1c2733, 0.7, 0.3);
  const glass = std(0x0d2436, 0.9, 0.12);
  const tyre = std(0x141414, 0.1, 0.9);

  // Fuselage: a rounded body, nose forward. Cylinder along z + a nose cap.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.75, 7.6, 20), body);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.2);
  fuselage.castShadow = true;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 14), body);
  nose.scale.set(1, 0.92, 1.15);
  nose.position.set(0, 0, 4.0);
  nose.castShadow = true;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.28, 2.6, 14), body);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.25, -4.6);
  tailCone.castShadow = true;
  group.add(tailCone);
  // Belly stripe in the accent colour.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 6.4), accent);
  stripe.position.set(0, -0.62, 0.4);
  group.add(stripe);

  // Registration decal on both flanks, just behind the cabin.
  const regTex = registrationTexture();
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.65),
      new THREE.MeshBasicMaterial({ map: regTex, transparent: true, depthWrite: false }),
    );
    decal.position.set(side * 0.98, 0.05, -1.2);
    decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
  }
  // Cargo door outline on the starboard flank.
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.1, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.6, metalness: 0.4 }),
  );
  door.position.set(0.97, -0.1, 1.9);
  group.add(door);

  // Cabin windows: a dark glass band across the fuselage sides + windshield.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.6), glass);
  cabin.position.set(0, 0.42, 1.6);
  group.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.3), glass);
  windshield.position.set(0, 0.5, 3.1);
  windshield.rotation.x = -0.5;
  group.add(windshield);

  // Main wings: two halves with a slight dihedral, accent wingtips, and struts.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 2.3), body);
    wing.position.set(side * 3.9, 0.22, 0.6);
    wing.rotation.z = side * 0.07;
    wing.castShadow = true;
    group.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 2.3), accent);
    tip.position.set(side * 6.9, 0.46, 0.6);
    tip.rotation.z = side * 0.07;
    group.add(tip);
    // Wing strut from the lower fuselage out to the wing.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), dark);
    strut.position.set(side * 2.6, -0.55, 0.9);
    strut.rotation.z = side * 0.9;
    group.add(strut);
  }

  // Tailplane and tall fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 1.5), body);
  tailplane.position.set(0, 0.35, -4.9);
  tailplane.castShadow = true;
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.4, 1.9), accent);
  fin.position.set(0, 1.35, -4.9);
  fin.castShadow = true;
  group.add(fin);
  const finTrim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.5, 1.1), trim);
  finTrim.position.set(0, 1.15, -4.9);
  group.add(finTrim);

  // Propeller: spinner cone, hub, two blades and a translucent blur disc.
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, 5.05);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 12), accent);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.set(0, 0, 0.35);
  propeller.add(spinner);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), accent);
  propeller.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.1), dark);
    blade.rotation.z = a;
    propeller.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xd2e1ee, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  propeller.add(disc);
  group.add(propeller);

  // Landing light: a real spotlight under the left wing + a visible beam cone.
  const landingLight = new THREE.SpotLight(0xfff2c0, 0, 260, 0.32, 0.5, 1.1);
  landingLight.position.set(-2.4, -0.4, 1.4);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(-2.4, -26, 120);
  group.add(beamTarget);
  landingLight.target = beamTarget;
  group.add(landingLight);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.rotation.x = Math.PI / 2 + 0.22;
  beam.position.set(-2.4, -3.4, 30);
  group.add(beam);

  // Fixed landing gear: two mains and a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), dark);
    leg.position.set(side * 1.15, -0.95, 1.2);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.15, -1.5, 1.2);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10), tyre);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.75, -4.6);
  group.add(tailWheel);

  // Navigation lights: green left, red right, white strobe on the tail,
  // each with a soft glow sprite so they read from a distance at dusk.
  const glowTex = glowTexture();
  function navGlow(color, x, y, z, scale) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale, 1);
    group.add(sp);
    return sp;
  }
  const navLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a3d1e, emissive: 0x37ff7a, emissiveIntensity: 1.6 }),
  );
  navLeft.position.set(-7.45, 0.28, 0.6);
  group.add(navLeft);
  navGlow(0x37ff7a, -7.45, 0.28, 0.6, 1.6);
  const navRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d0a0a, emissive: 0xff5252, emissiveIntensity: 1.6 }),
  );
  navRight.position.set(7.45, 0.28, 0.6);
  group.add(navRight);
  navGlow(0xff5252, 7.45, 0.28, 0.6, 1.6);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0 }),
  );
  strobe.position.set(0, 2.6, -4.9);
  group.add(strobe);

  group.userData = { propeller, navLeft, navRight, strobe, landingLight, beam, body, accent, trim };
  return group;
}

/** Recolour an existing plane group with a new livery (Hangar). */
export function applyLivery(group, livery) {
  const { body, accent, trim } = group.userData;
  body.color.set(livery.body);
  accent.color.set(livery.accent);
  trim.color.set(livery.trim);
}

/**
 * Animate the plane's moving parts: propeller spin, the blinking strobe and
 * the landing light, which burns at dusk and on the ground roll.
 */
export function updateAircraft(group, plane, time, dusk = false) {
  const { propeller, strobe, landingLight, beam } = group.userData;
  propeller.rotation.z = time * (6 + plane.throttle * 26);
  const blink = Math.sin(time * 6) > 0;
  strobe.material.emissiveIntensity = blink ? 4 : 0;
  const lightOn = dusk || !plane.airborne;
  landingLight.intensity = lightOn ? 900 : 0;
  beam.material.opacity = lightOn ? (dusk ? 0.14 : 0.05) : 0;
}
