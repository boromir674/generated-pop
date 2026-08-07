import * as THREE from 'three';
import { buildTextures } from './textures.js';
import { buildRoom } from './room-builder.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { LEVELS } from './level.js';
import { TILE_W, TILE_H, PLAYER_MAX_HP, CAMERA_SMOOTHING, CAMERA_LOOKAHEAD } from './constants.js';

// ─── DOM references ───────────────────────────────────────────────────────────
const container    = document.getElementById('canvas-container');
const overlay      = document.getElementById('overlay');
const startBtn     = document.getElementById('start-btn');
const healthWrap   = document.getElementById('health-bar-wrap');
const timerEl      = document.getElementById('timer-val');
const floorEl      = document.getElementById('floor-val');
const msgBox       = document.getElementById('message-box');

// ─── Three.js setup ───────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const GAME_W = 1280;
const GAME_H = 768;

const camera = new THREE.OrthographicCamera(0, GAME_W, 0, -GAME_H, -100, 100);
camera.position.z = 10;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090507);

// ambient light for overall visibility
const ambientLight = new THREE.AmbientLight(0x35293a, 1.3);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x7f95c8, 0.25);
moonLight.position.set(300, 180, 50);
scene.add(moonLight);

// ─── Resize handler ───────────────────────────────────────────────────────────
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = GAME_W / GAME_H;
  let rw = w, rh = h;
  if (w / h > aspect) { rw = h * aspect; } else { rh = w / aspect; }
  renderer.setSize(rw, rh);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.left = `${(w - rw) / 2}px`;
  renderer.domElement.style.top  = `${(h - rh) / 2}px`;
}
resize();
window.addEventListener('resize', resize);

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

function getInput() {
  return {
    left:   keys['ArrowLeft']  || keys['KeyA'],
    right:  keys['ArrowRight'] || keys['KeyD'],
    up:     keys['ArrowUp']    || keys['KeyW'],
    down:   keys['ArrowDown']  || keys['KeyS'],
    jump:   keys['Space'],
    attack: keys['KeyF'] || keys['KeyJ'],
    block:  keys['ShiftLeft'] || keys['ShiftRight'],
    draw:   false, // toggled via key press event below
  };
}

let drawToggle = false;
window.addEventListener('keydown', e => {
  if (e.code === 'KeyQ') { drawToggle = true; }
});

// ─── Game state ───────────────────────────────────────────────────────────────
let textures, particles, audio;
let player, enemies, roomGroup, colliders, hazards, pickups, torchMeshes;
let roomIndex = 0;
let timeRemaining = 3600; // seconds
let gameRunning = false;
let msgTimer = 0;
let cameraState = { x: 0, y: 0 };
let screenShake = 0;
let landBounce = 0;
let deathHandled = false;

// ─── HUD helpers ─────────────────────────────────────────────────────────────
function rebuildHealthPips(hp, maxHp) {
  healthWrap.innerHTML = '';
  for (let i = 0; i < maxHp; i++) {
    const pip = document.createElement('div');
    pip.className = 'health-pip' + (i < hp ? ' full' : '');
    healthWrap.appendChild(pip);
  }
}

function showMessage(text, duration = 3) {
  msgBox.textContent = text;
  msgBox.classList.add('show');
  msgTimer = duration;
}

// ─── Load room ────────────────────────────────────────────────────────────────
function loadRoom(index) {
  // remove old room
  if (roomGroup) scene.remove(roomGroup);
  if (enemies)   enemies.forEach(e => { scene.remove(e.mesh); scene.remove(e._hpBar?.group); });

  const roomData = LEVELS[index];

  // build room geometry
  const built = buildRoom(roomData, textures);
  roomGroup  = built.group;
  colliders  = built.colliders;
  hazards    = built.hazards;
  pickups    = built.pickups;
  torchMeshes = built.torchMeshes;
  scene.add(roomGroup);

  // spawn enemies
  enemies = (roomData.enemies || []).map(e => {
    const wx = e.col * TILE_W + TILE_W / 2;
    const wy = -(e.row * TILE_H);  // world y (top of tile row)
    const en = new Enemy(scene, wx, wy, e.hp);
    return en;
  });

  // position player
  if (!player) {
    player = new Player(scene);
  }
  player.x = roomData.startCol * TILE_W + TILE_W / 2;
  player.y = -(roomData.startRow * TILE_H);
  player.vx = 0; player.vy = 0;
  player.onGround = false;
  cameraState = {
    x: Math.max(0, Math.min(roomData.tiles[0].length * TILE_W - GAME_W, player.x - GAME_W / 2)),
    y: Math.max(0, Math.min(roomData.tiles.length * TILE_H - GAME_H, -player.y - GAME_H / 2 + 64)),
  };

  floorEl.textContent = index + 1;
  rebuildHealthPips(player.hp, PLAYER_MAX_HP);
}

// ─── Camera follow ────────────────────────────────────────────────────────────
function updateCamera() {
  const roomData = LEVELS[roomIndex];
  const roomW = roomData.tiles[0].length * TILE_W;
  const roomH = roomData.tiles.length * TILE_H;

  // clamp camera so it never shows outside room
  const lookAhead = (player.vx || 0) * CAMERA_LOOKAHEAD / 10;
  let cx = player.x - GAME_W / 2 + lookAhead;
  let cy = -player.y - GAME_H / 2 + 64;

  cx = Math.max(0, Math.min(roomW - GAME_W, cx));
  cy = Math.max(0, Math.min(roomH - GAME_H, cy));

  cameraState.x += (cx - cameraState.x) * CAMERA_SMOOTHING;
  cameraState.y += (cy - cameraState.y) * (CAMERA_SMOOTHING * 0.9);

  const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
  const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake + landBounce : landBounce;

  camera.left   =  cameraState.x + shakeX;
  camera.right  =  cameraState.x + GAME_W + shakeX;
  camera.top    = -(cameraState.y + shakeY);
  camera.bottom = -(cameraState.y + GAME_H + shakeY);
  camera.updateProjectionMatrix();

  screenShake = Math.max(0, screenShake * 0.84 - 0.15);
  landBounce *= 0.8;
}

// ─── Update loose tiles ───────────────────────────────────────────────────────
function updateLooseTiles(dt) {
  for (const col of colliders) {
    if (col.type !== 'loose' || !col.falling) continue;
    col.vy = (col.vy || 0) - 20 * dt;
    col.y += col.vy * dt * 60;
    if (col.mesh) col.mesh.position.y += col.vy * dt * 60;
    if (col.y < -2000) col.alive = false;
  }
}

// ─── Torch animation ─────────────────────────────────────────────────────────
let torchTime = 0;
function updateTorches(dt) {
  torchTime += dt;
  for (const t of torchMeshes) {
    const flicker = Math.sin(torchTime * 12 + t.phase) * 0.15 + Math.sin(torchTime * 7.3 + t.phase) * 0.08;
    t.light.intensity = 1.8 + flicker;
    t.glow.material.opacity = 0.42 + flicker * 0.25;
    t.glow.scale.setScalar(1 + flicker * 0.08);
    // slight position wobble
    t.light.position.x = t.base.x + Math.sin(torchTime * 8 + t.phase) * 2;
    t.light.position.y = t.base.y + 8;
    // emit embers occasionally
    if (Math.random() < dt * 4) {
      particles.emit(t.base.x, t.base.y + 4, 'ember', 1);
    }
  }
}

// ─── Check room transitions ───────────────────────────────────────────────────
function checkTransitions() {
  const roomData = LEVELS[roomIndex];
  const roomW = roomData.tiles[0].length * TILE_W;

  if (player.x > roomW + 20 && roomData.exits.right >= 0) {
    roomIndex = roomData.exits.right;
    loadRoom(roomIndex);
    player.x = TILE_W;
    showMessage('Floor ' + (roomIndex + 1));
  } else if (player.x < -20 && roomData.exits.left >= 0) {
    roomIndex = roomData.exits.left;
    loadRoom(roomIndex);
    player.x = (LEVELS[roomIndex].tiles[0].length - 1) * TILE_W;
    showMessage('Floor ' + (roomIndex + 1));
  }

  // Victory: player reaches room 2 and touches the door area
  if (roomIndex === 2 && player.x > 19 * TILE_W - 30) {
    showMessage('🏆 FREEDOM! You have escaped the dungeon!', 8);
    audio.playVictory();
    gameRunning = false;
    setTimeout(() => showEndScreen('You have been freed!'), 3500);
  }
}

// ─── Check hazards ────────────────────────────────────────────────────────────
function checkHazards() {
  for (const h of hazards) {
    const px = player.x - player.hw, py = player.y;
    if (px < h.x + h.w && px + player.hw * 2 > h.x &&
        py < h.y + h.h && py + player.hh * 2 > h.y) {
      player.takeDamage(3);
      particles.emit(player.x, player.y + 30, 'blood', 14);
      audio.playHit();
    }
  }
}

// ─── Check pickups ────────────────────────────────────────────────────────────
function checkPickups() {
  for (const pk of pickups) {
    if (!pk.alive || pk.type !== 'potion') continue;
    const dx = Math.abs(player.x - pk.col * TILE_W - TILE_W / 2);
    const dy = Math.abs(player.y - (-(pk.row * TILE_H)));
    if (dx < 30 && dy < 60) {
      pk.alive = false;
      pk.mesh.visible = false;
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 1);
      rebuildHealthPips(player.hp, PLAYER_MAX_HP);
      audio.playDrinkPotion();
      particles.emit(player.x, player.y + 40, 'dust', 12);
      showMessage('♥ Health restored!', 2);
    }
  }
}

// ─── Game over / win ──────────────────────────────────────────────────────────
function showEndScreen(msg) {
  overlay.querySelector('h1').textContent = msg;
  overlay.querySelector('.subtitle').textContent = '— Press Begin to restart —';
  overlay.classList.remove('hidden');
}

// ─── Main game loop ───────────────────────────────────────────────────────────
let lastTime = 0;
function gameLoop(timestamp) {
  if (!gameRunning) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // ── Timer ─────────────────────────────────────────────────────────────────
  timeRemaining -= dt;
  if (timeRemaining <= 0) {
    timeRemaining = 0;
    showMessage('⏰ Time has run out!', 3);
    gameRunning = false;
    setTimeout(() => showEndScreen('GAME OVER'), 3000);
  }
  const mins = Math.floor(timeRemaining / 60);
  const secs = Math.floor(timeRemaining % 60);
  timerEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  timerEl.classList.toggle('urgent', timeRemaining < 60);

  // ── Draw sword toggle ─────────────────────────────────────────────────────
  if (drawToggle) {
    player.swordDrawn = !player.swordDrawn;
    drawToggle = false;
  }

  const input = getInput();

  // ── Player update ─────────────────────────────────────────────────────────
  player.update(dt, input, colliders, enemies);

  // Landing dust + sound
  if (player.justLanded) {
    const impact = Math.max(0, player.landingImpact - 8);
    particles.emit(player.x, player.y + 2, 'dust', impact > 6 ? 16 : 10, { direction: -Math.PI / 2, spread: Math.PI * 0.75 });
    audio.playLand();
    landBounce = -Math.min(10, player.landingImpact * 0.35);
    screenShake = Math.max(screenShake, Math.min(10, player.landingImpact * 0.3));
  }
  // Jump sound
  if (player.justJumped) {
    audio.playJump();
  }
  if (player.attackJustTriggered) {
    const dir = player.facingRight ? 0 : Math.PI;
    particles.emit(player.x + (player.facingRight ? 38 : -38), player.y + 44, 'slash', 12, { direction: dir, spread: 0.5 });
    particles.emit(player.x + (player.facingRight ? 46 : -46), player.y + 44, 'spark', 5, { direction: dir, spread: 0.55 });
    audio.playSwordClash();
    screenShake = Math.max(screenShake, 4.5);
  }
  if (player.justTookDamage) {
    screenShake = Math.max(screenShake, 8);
  }

  // ── Enemies ───────────────────────────────────────────────────────────────
  for (const e of enemies) {
    const prevHp = e.hp;
    e.update(dt, colliders, player);
    if (e.hp < prevHp) {
      particles.emit(e.x, e.y + 40, 'blood', 10);
      audio.playHit();
      // spark on block
      if (e.state === 'block') particles.emit(e.x, e.y + 50, 'spark', 6);
    }
  }

  // ── Hazards / pickups ─────────────────────────────────────────────────────
  if (player.alive) {
    checkHazards();
    checkPickups();
  }

  // ── Loose tiles ───────────────────────────────────────────────────────────
  updateLooseTiles(dt);

  // ── Torches ───────────────────────────────────────────────────────────────
  updateTorches(dt);

  // ── Particles ─────────────────────────────────────────────────────────────
  particles.update(dt);

  // ── Room transitions ──────────────────────────────────────────────────────
  if (player.alive) checkTransitions();

  // ── Camera ────────────────────────────────────────────────────────────────
  updateCamera();

  // ── HP HUD ────────────────────────────────────────────────────────────────
  rebuildHealthPips(player.hp, PLAYER_MAX_HP);

  // ── Message box ───────────────────────────────────────────────────────────
  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0) msgBox.classList.remove('show');
  }

  // ── Player death ─────────────────────────────────────────────────────────
  if (!player.alive) {
    if (deathHandled) {
      renderer.render(scene, camera);
      requestAnimationFrame(gameLoop);
      return;
    }
    deathHandled = true;
    audio.playDie();
    gameRunning = false;
    setTimeout(() => showEndScreen('YOU HAVE DIED'), 2500);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

// ─── Start ────────────────────────────────────────────────────────────────────
function startGame() {
  overlay.classList.add('hidden');

  // build textures once
  if (!textures) textures = buildTextures();

  // audio
  if (!audio) { audio = new AudioManager(); audio.init(); }

  // particles
  if (!particles) particles = new ParticleSystem(scene);

  // reset state
  roomIndex     = 0;
  timeRemaining = 3600;
  drawToggle    = false;
  deathHandled  = false;

  // reset player if exists
  if (player) { player.hp = PLAYER_MAX_HP; player.alive = true; }

  loadRoom(roomIndex);
  rebuildHealthPips(PLAYER_MAX_HP, PLAYER_MAX_HP);
  showMessage('⚔ Draw sword with Q · Attack with F', 5);

  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', startGame);

// Initial render (title screen background)
renderer.render(scene, camera);
