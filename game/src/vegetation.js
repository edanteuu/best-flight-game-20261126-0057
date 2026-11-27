// The green on the islands: jungle trees inland, palms on the beaches, all
// placed from the seeded random so the same seed grows the same forest. Trees
// are two InstancedMeshes (trunks + canopies) so a whole jungle costs two draw
// calls, and the placement is a pure function — placeTrees — so the layout can
// be checked without a renderer. Nothing grows on the strips or in the cleared
// approach valleys, so the runway stays flyable.

import * as THREE from 'three';
import { BEACH, PALETTE, RUNWAY } from './config.js';
import { createRandom, range } from './random.js';

const TREE_COUNT = 560;
const PALM_COUNT = 90;

/** True when (x, z) must stay clear: a strip or its approach valley. */
export function isClearZone(x, z) {
  if (Math.abs(x - RUNWAY.x) < 480 && z > RUNWAY.zStart - 1600 && z < RUNWAY.zStart + RUNWAY.length + 60) return true;
  if (Math.abs(x - BEACH.x) < 340 && z > BEACH.zStart - 760 && z < BEACH.zStart + BEACH.length + 40) return true;
  return false;
}

/**
 * Lay out tree and palm spots from the world: trees where the ground is green
 * (4–70 m up, well inside an island), palms on the sandy ring near the shore.
 * Returns { trees, palms } of { x, y, z, scale, rot } — deterministic per seed.
 */
export function placeTrees(world, seed) {
  const random = createRandom((seed * 7919 + 77) >>> 0);
  const trees = [];
  const palms = [];
  let guard = 0;
  while (trees.length < TREE_COUNT && guard < TREE_COUNT * 40) {
    guard += 1;
    const x = range(random, -6800, 6800);
    const z = range(random, -1200, 12400);
    if (isClearZone(x, z)) continue;
    const h = world.groundHeight(x, z);
    if (h < 4 || h > 70) continue;
    if (!world.isLand(x, z)) continue;
    trees.push({ x, y: h, z, scale: range(random, 0.8, 1.6), rot: random() * Math.PI * 2 });
  }
  guard = 0;
  while (palms.length < PALM_COUNT && guard < PALM_COUNT * 40) {
    guard += 1;
    const island = world.state.islands[Math.floor(random() * world.state.islands.length)];
    const a = random() * Math.PI * 2;
    const r = island.radius * (0.82 + random() * 0.12);
    const x = island.x + Math.cos(a) * r;
    const z = island.z + Math.sin(a) * r;
    if (isClearZone(x, z)) continue;
    const h = world.groundHeight(x, z);
    if (h < 1 || h > 5) continue;
    palms.push({ x, y: h, z, scale: range(random, 0.9, 1.5), rot: random() * Math.PI * 2 });
  }
  return { trees, palms };
}

/**
 * Build the instanced jungle + palms and add them to `scene`.
 * Returns { group, trees: n, palms: n } for the dossier and the tests.
 */
export function buildVegetation(scene, world, seed) {
  const { trees, palms } = placeTrees(world, seed);
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // Jungle trees: a trunk cylinder and a two-cone canopy, one InstancedMesh each.
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.treeTrunk, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, trees.length));
  const canopyGeo = new THREE.ConeGeometry(4.2, 11, 7);
  const canopyMat = new THREE.MeshStandardMaterial({ color: PALETTE.treeLeaf, roughness: 1 });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, Math.max(1, trees.length));
  trees.forEach((t, i) => {
    dummy.position.set(t.x, t.y + 3.5 * t.scale, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.setScalar(t.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(t.x, t.y + (7 + 5.5) * t.scale, t.z);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.33 + (i % 5) * 0.012, 0.5, 0.32 + (i % 3) * 0.05);
    canopies.setColorAt(i, col);
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  group.add(trunks);
  group.add(canopies);

  // Palms: a leaning trunk and a flattened frond cone, one InstancedMesh each.
  const palmTrunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 11, 6);
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 1 });
  const palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, Math.max(1, palms.length));
  const frondGeo = new THREE.ConeGeometry(5.2, 3.4, 8);
  const frondMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 1 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, Math.max(1, palms.length));
  palms.forEach((p, i) => {
    const lean = 0.16;
    dummy.position.set(p.x, p.y + 5.5 * p.scale, p.z);
    dummy.rotation.set(lean, p.rot, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x + Math.sin(lean) * 5.5 * p.scale, p.y + 11.4 * p.scale, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(p.scale, p.scale * 0.55, p.scale);
    dummy.updateMatrix();
    fronds.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.35, 0.55, 0.34 + (i % 3) * 0.04);
    fronds.setColorAt(i, col);
  });
  palmTrunks.castShadow = true;
  group.add(palmTrunks);
  group.add(fronds);

  scene.add(group);
  return { group, trees: trees.length, palms: palms.length };
}
