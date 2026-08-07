import * as THREE from 'three';
import { TILE_W, TILE_H, GRAVITY, MAX_FALL_SPEED, STATE } from './constants.js';

const FRAME_TIME = 1 / 8;

export class Enemy {
  constructor(scene, x, y, hp = 3) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hp = hp; this.maxHp = hp;
    this.alive = true;
    this.facingRight = false;
    this.onGround = false;

    this.state = STATE.SWORD_IDLE;
    this._animTime = 0;
    this._frame = 0;
    this._actionTimer = 0;
    this._attackCooldown = 0;
    this._aggroRange = TILE_W * 8;

    this._frames = buildEnemyFrames();

    const geo = new THREE.PlaneGeometry(TILE_W, TILE_H * 2);
    this._mat = new THREE.MeshBasicMaterial({
      map: this._frames[STATE.SWORD_IDLE][0],
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this._mat);
    this.mesh.position.z = 0.4;
    scene.add(this.mesh);

    // health bar
    this._hpBar = buildHpBar(scene);
  }

  get hw() { return 14; }
  get hh() { return 32; }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.state = STATE.DIE;
    this.mesh.visible = false;
    this._hpBar.group.visible = false;
  }

  update(dt, colliders, player) {
    if (!this.alive) return;

    this._attackCooldown = Math.max(0, this._attackCooldown - dt);

    const dx = player.x - this.x;
    const dist = Math.abs(dx);

    // ── Facing ───────────────────────────────────────────────────────────────
    if (dist < this._aggroRange) {
      this.facingRight = dx > 0;
    }

    // ── State / AI ───────────────────────────────────────────────────────────
    this._actionTimer -= dt;
    if (this._actionTimer <= 0) {
      this._chooseAction(dx, dist, player);
    }

    // ── Physics ──────────────────────────────────────────────────────────────
    this.vy += GRAVITY * dt;
    if (this.vy < MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    this._moveAndCollide(dt, colliders);

    // ── Attack player ────────────────────────────────────────────────────────
    if (this.state === STATE.ATTACK && this._attackCooldown === 0) {
      const adx = player.x - this.x;
      const ady = player.y - this.y;
      if (Math.abs(adx) < 55 && Math.abs(ady) < 60) {
        player.takeDamage(1);
        this._attackCooldown = 1.2;
      }
    }

    // ── Animation ────────────────────────────────────────────────────────────
    this._updateAnimation(dt);
    this.mesh.position.set(this.x, this.y + this.hh, 0.4);
    this.mesh.scale.x = this.facingRight ? 1 : -1;

    // HP bar
    this._updateHpBar();
  }

  _chooseAction(dx, dist, player) {
    if (dist > this._aggroRange) {
      // idle patrol
      this.vx = 0;
      this.state = STATE.SWORD_IDLE;
      this._actionTimer = 1.5;
      return;
    }
    const atMeleeRange = dist < 55;
    if (atMeleeRange) {
      // attack or block
      if (Math.random() < 0.6) {
        this.state = STATE.ATTACK;
        this.vx = 0;
      } else {
        this.state = STATE.BLOCK;
        this.vx = 0;
      }
      this._actionTimer = 0.5;
    } else {
      // advance
      this.state = STATE.SWORD_IDLE;
      this.vx = (dx > 0 ? 1 : -1) * 3.5;
      this._actionTimer = 0.4;
    }
  }

  _moveAndCollide(dt, colliders) {
    this.x += this.vx * dt * 60;
    for (const col of colliders) {
      if (col.falling) continue;
      if (this._overlapsAABB(col)) {
        if (this.vx > 0) this.x = col.x - this.hw;
        else if (this.vx < 0) this.x = col.x + col.w + this.hw;
        this.vx = 0;
      }
    }
    this.onGround = false;
    this.y += this.vy * dt * 60;
    for (const col of colliders) {
      if (col.falling) continue;
      if (this._overlapsAABB(col)) {
        if (this.vy < 0) { this.y = col.y + col.h; this.onGround = true; }
        else              { this.y = col.y - this.hh * 2; }
        this.vy = 0;
      }
    }
  }

  _overlapsAABB(col) {
    const px = this.x - this.hw, py = this.y;
    return px < col.x + col.w && px + this.hw*2 > col.x &&
           py < col.y + col.h && py + this.hh*2 > col.y;
  }

  _updateAnimation(dt) {
    const frames = this._frames[this.state] || this._frames[STATE.SWORD_IDLE];
    this._animTime += dt;
    if (this._animTime >= FRAME_TIME) {
      this._animTime = 0;
      this._frame = (this._frame + 1) % frames.length;
    }
    this._mat.map = frames[this._frame];
    this._mat.needsUpdate = true;
  }

  _updateHpBar() {
    const frac = this.hp / this.maxHp;
    this._hpBar.fill.scale.x = frac;
    this._hpBar.fill.position.x = this.x - (1 - frac) * 20;
    this._hpBar.group.position.set(this.x, this.y + this.hh * 2 + 10, 0.8);
  }
}

function buildHpBar(scene) {
  const group = new THREE.Group();
  const bgGeo = new THREE.PlaneGeometry(42, 6);
  const bg = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({ color: 0x330000 }));
  group.add(bg);

  const fillGeo = new THREE.PlaneGeometry(40, 4);
  const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xcc2222 }));
  fill.position.z = 0.1;
  group.add(fill);

  scene.add(group);
  return { group, fill };
}

// ─── Enemy sprite frames ───────────────────────────────────────────────────────
const W = 64, H = 128;

function makeCtx() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  return [c, g];
}

function toTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

// Enemy is a guard in dark armour
const ARMOR  = '#2a3040';
const HELMET = '#202830';
const VISOR  = '#101820';
const BLADE  = '#dde8ff';
const GUARD_BOOT = '#181820';

function drawEnemyHead(g, cx, cy) {
  g.fillStyle = HELMET;
  g.beginPath(); g.arc(cx, cy - 8, 10, Math.PI, 0); g.fill();
  g.fillRect(cx - 10, cy - 8, 20, 16);
  // visor slit
  g.fillStyle = VISOR;
  g.fillRect(cx - 7, cy - 6, 14, 4);
  // plume
  g.fillStyle = '#cc2222';
  g.beginPath(); g.ellipse(cx, cy - 18, 5, 10, 0, 0, Math.PI * 2); g.fill();
}

function drawEnemyBody(g, cx, cy) {
  g.fillStyle = ARMOR;
  g.fillRect(cx - 11, cy, 22, 26);
  // breast plate highlight
  g.strokeStyle = 'rgba(100,130,180,0.3)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx - 9, cy + 2); g.lineTo(cx, cy + 12); g.lineTo(cx + 9, cy + 2); g.stroke();
}

function drawEnemyLegs(g, cx, cy, la = 0, ra = 0) {
  g.save(); g.translate(cx - 5, cy); g.rotate(la);
  g.fillStyle = ARMOR; g.fillRect(-5, 0, 9, 26);
  g.fillStyle = GUARD_BOOT; g.fillRect(-5, 22, 9, 10);
  g.restore();
  g.save(); g.translate(cx + 5, cy); g.rotate(ra);
  g.fillStyle = ARMOR; g.fillRect(-4, 0, 9, 26);
  g.fillStyle = GUARD_BOOT; g.fillRect(-4, 22, 9, 10);
  g.restore();
}

function drawEnemyArm(g, bx, by, angle, right = false) {
  g.save(); g.translate(bx, by); g.rotate(angle);
  g.fillStyle = ARMOR; g.fillRect(right ? 0 : -8, 0, 8, 20);
  g.restore();
}

function drawEnemySword(g, cx, cy, extended = false) {
  const sx = cx + (extended ? 28 : 20);
  // blade
  g.fillStyle = BLADE;
  g.save(); g.translate(sx, cy); g.rotate(extended ? -0.2 : 0);
  g.fillRect(0, -2, 36, 5);
  g.restore();
  // guard
  g.fillStyle = '#c8a050'; g.fillRect(sx - 2, cy - 6, 4, 14);
}

function buildEnemyFrames() {
  const out = {};

  // SWORD_IDLE
  out[STATE.SWORD_IDLE] = [0, 1].map(f => {
    const [c, g] = makeCtx();
    const cx = 32, by = 18;
    drawEnemyHead(g, cx, by);
    drawEnemyBody(g, cx, by + 24);
    drawEnemyArm(g, cx - 17, by + 26, f === 0 ? 0.2 : 0.1);
    drawEnemyArm(g, cx + 9, by + 26, f === 0 ? -0.7 : -0.6, true);
    drawEnemySword(g, cx, by + 36);
    drawEnemyLegs(g, cx, by + 50);
    return toTex(c);
  });

  // ATTACK
  out[STATE.ATTACK] = [0, 1].map(f => {
    const [c, g] = makeCtx();
    const cx = 28, by = 18;
    drawEnemyHead(g, cx - 2, by);
    drawEnemyBody(g, cx, by + 24);
    drawEnemyArm(g, cx - 18, by + 26, 0.5);
    drawEnemyArm(g, cx + 8, by + 24, f === 0 ? -1.2 : -1.0, true);
    drawEnemySword(g, cx, by + 34, true);
    drawEnemyLegs(g, cx, by + 50, 0.15, -0.1);
    return toTex(c);
  });

  // BLOCK
  out[STATE.BLOCK] = [(() => {
    const [c, g] = makeCtx();
    const cx = 32, by = 20;
    drawEnemyHead(g, cx, by);
    drawEnemyBody(g, cx, by + 24);
    drawEnemyArm(g, cx + 6, by + 22, 0, true); // arm forward / shield pose
    drawEnemyArm(g, cx - 18, by + 26, 0.2);
    drawEnemySword(g, cx - 4, by + 32);
    drawEnemyLegs(g, cx, by + 50, -0.1, 0.1);
    return toTex(c);
  })()];

  // HURT & DIE use player-like stubs
  out[STATE.HURT] = out[STATE.SWORD_IDLE];
  out[STATE.DIE]  = out[STATE.SWORD_IDLE];

  return out;
}
