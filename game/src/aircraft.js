// The aircraft itself, built in real 3D: a single-prop island airlift plane made
// from primitives — fuselage, wings, tail, spinning propeller, navigation lights
// and fixed gear — painted in the chosen livery. No image files: every part is
// geometry and material, so the plane always matches the game's style and the
// dossier never carries borrowed art.
//
// Local space: nose points +z, wingspan along x, up is +y. The renderer orients
// the group with rotation order YXZ: yaw = heading, pitch = -pitch, roll = -roll.

import * as THREE from 'three';

function std(color, metalness, roughness, extra) {
  return new THREE.MeshStandardMaterial({
    color, metalness: metalness ?? 0.35, roughness: roughness ?? 0.45, ...(extra || {}),
  });
}

/**
 * Build the plane for `livery` ({ body, accent, trim } colours).
 * Returns the group; its userData holds the animated parts:
 * propeller (spins), navLeft/navRight/strobe (blink), gear.
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

  // Cabin windows: a dark glass band across the fuselage sides + windshield.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.6), glass);
  cabin.position.set(0, 0.42, 1.6);
  group.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.3), glass);
  windshield.position.set(0, 0.5, 3.1);
  windshield.rotation.x = -0.5;
  group.add(windshield);

  // Main wings: two halves with a slight dihedral, accent wingtips.
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

  // Propeller: hub + two blades + a translucent blur disc, spinning around z.
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, 5.05);
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

  // Navigation lights: green left, red right, white strobe on the tail.
  const navLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a3d1e, emissive: 0x37ff7a, emissiveIntensity: 1.6 }),
  );
  navLeft.position.set(-7.45, 0.28, 0.6);
  group.add(navLeft);
  const navRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d0a0a, emissive: 0xff5252, emissiveIntensity: 1.6 }),
  );
  navRight.position.set(7.45, 0.28, 0.6);
  group.add(navRight);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0 }),
  );
  strobe.position.set(0, 2.6, -4.9);
  group.add(strobe);

  group.userData = { propeller, navLeft, navRight, strobe, body, accent, trim };
  return group;
}

/** Recolour an existing plane group with a new livery (Hangar). */
export function applyLivery(group, livery) {
  const { body, accent, trim } = group.userData;
  body.color.set(livery.body);
  accent.color.set(livery.accent);
  trim.color.set(livery.trim);
}

/** Animate the plane's moving parts: propeller spin and the blinking strobe. */
export function updateAircraft(group, plane, time) {
  const { propeller, strobe } = group.userData;
  propeller.rotation.z = time * (6 + plane.throttle * 26);
  const blink = Math.sin(time * 6) > 0;
  strobe.material.emissiveIntensity = blink ? 4 : 0;
}
