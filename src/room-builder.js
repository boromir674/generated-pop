import * as THREE from 'three';
import { TILE, TILE_W, TILE_H } from './constants.js';

/**
 * Builds the Three.js mesh scene for a level room.
 * Returns { group, colliders, hazards, pickups, torchMeshes }
 */
export function buildRoom(roomData, textures) {
  const group = new THREE.Group();
  const colliders = [];   // {x, y, w, h} AABB in world space, type:'solid'|'loose'
  const hazards   = [];   // {x, y, w, h} spikes
  const pickups   = [];   // { mesh, col, row, type }
  const torchMeshes = []; // animated torch meshes

  const tiles = roomData.tiles;
  const ROWS  = tiles.length;
  const COLS  = tiles[0].length;

  // ── background ─────────────────────────────────────────────────────────────
  const bgGeo = new THREE.PlaneGeometry(COLS * TILE_W, ROWS * TILE_H);
  bgGeo.translate((COLS * TILE_W) / 2, -(ROWS * TILE_H) / 2, -2);
  const bgMat = new THREE.MeshBasicMaterial({ map: textures.bg, depthWrite: false });
  group.add(new THREE.Mesh(bgGeo, bgMat));

  // ── tiles ──────────────────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = tiles[r][c];
      if (t === TILE.EMPTY) continue;

      const wx = c * TILE_W;
      const wy = -(r * TILE_H);

      if (t === TILE.SOLID) {
        addSolidTile(group, c, r, wx, wy, textures, colliders);
      } else if (t === TILE.SPIKES) {
        addSpikeTile(group, wx, wy, textures, hazards);
      } else if (t === TILE.LOOSE) {
        addLooseTile(group, c, r, wx, wy, textures, colliders, pickups);
      } else if (t === TILE.DOOR) {
        addDoor(group, wx, wy, textures);
      } else if (t === TILE.GATE) {
        addGate(group, wx, wy, textures);
      }
    }
  }

  // ── torches ────────────────────────────────────────────────────────────────
  for (const { col, row: r } of (roomData.torches || [])) {
    const wx = col * TILE_W + TILE_W / 2 - 8;
    const wy = -(r * TILE_H) + TILE_H / 2 + 4;
    addTorch(group, wx, wy, textures, torchMeshes);
  }

  // ── potions ────────────────────────────────────────────────────────────────
  for (const { col, row: r } of (roomData.potions || [])) {
    const wx = col * TILE_W + TILE_W / 2;
    const wy = -(r * TILE_H) + 8; // sit on floor
    const geo = new THREE.PlaneGeometry(16, 24);
    const mat = new THREE.MeshBasicMaterial({ map: textures.potion, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wx, wy + 12, 0.1);
    group.add(mesh);
    pickups.push({ mesh, col, row: r, type: 'potion', alive: true });
  }

  return { group, colliders, hazards, pickups, torchMeshes };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function addSolidTile(group, c, r, wx, wy, textures, colliders) {
  // choose top-face texture vs wall texture based on neighbours
  const tileGeo = new THREE.PlaneGeometry(TILE_W, TILE_H);
  const mat = new THREE.MeshBasicMaterial({ map: textures.stone });
  const mesh = new THREE.Mesh(tileGeo, mat);
  mesh.position.set(wx + TILE_W / 2, wy - TILE_H / 2, 0);
  group.add(mesh);

  // top edge highlight (floor surface)
  const edgeGeo = new THREE.PlaneGeometry(TILE_W, 8);
  const edgeMat = new THREE.MeshBasicMaterial({ map: textures.floor });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.set(wx + TILE_W / 2, wy - 4, 0.05);
  group.add(edge);

  colliders.push({ x: wx, y: wy - TILE_H, w: TILE_W, h: TILE_H, type: 'solid' });
}

function addSpikeTile(group, wx, wy, textures, hazards) {
  const geo = new THREE.PlaneGeometry(TILE_W, 32);
  const mat = new THREE.MeshBasicMaterial({ map: textures.spikes, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wx + TILE_W / 2, wy - 16, 0.05);
  group.add(mesh);
  hazards.push({ x: wx + 4, y: wy - 32, w: TILE_W - 8, h: 30 });
}

function addLooseTile(group, c, r, wx, wy, textures, colliders, pickups) {
  const geo = new THREE.PlaneGeometry(TILE_W, TILE_H);
  const mat = new THREE.MeshBasicMaterial({ map: textures.loose });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wx + TILE_W / 2, wy - TILE_H / 2, 0.02);
  group.add(mesh);

  const collider = { x: wx, y: wy - TILE_H, w: TILE_W, h: TILE_H, type: 'loose', mesh, timer: 0, falling: false, vy: 0 };
  colliders.push(collider);
  pickups.push({ mesh, col: c, row: r, type: 'loose_tile', collider, alive: true });
}

function addDoor(group, wx, wy, textures) {
  const geo = new THREE.PlaneGeometry(TILE_W, TILE_H * 2);
  const mat = new THREE.MeshBasicMaterial({ map: textures.door, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wx + TILE_W / 2, wy - TILE_H, 0.1);
  group.add(mesh);
}

function addGate(group, wx, wy, textures) {
  const geo = new THREE.PlaneGeometry(TILE_W, TILE_H * 2);
  const mat = new THREE.MeshBasicMaterial({ map: textures.gate, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wx + TILE_W / 2, wy - TILE_H, 0.1);
  group.add(mesh);
}

function addTorch(group, wx, wy, textures, torchMeshes) {
  const geo = new THREE.PlaneGeometry(16, 32);
  const mat = new THREE.MeshBasicMaterial({ map: textures.torch, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wx, wy, 0.3);
  group.add(mesh);

  // point light for warm glow
  const light = new THREE.PointLight(0xff8833, 1.8, TILE_W * 5);
  light.position.set(wx, wy + 8, 10);
  group.add(light);

  torchMeshes.push({ mesh, light, base: { x: wx, y: wy }, phase: Math.random() * Math.PI * 2 });
}
