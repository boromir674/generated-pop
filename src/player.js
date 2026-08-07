import * as THREE from 'three';
import {
  TILE_W,
  TILE_H,
  GRAVITY,
  MAX_FALL_SPEED,
  PLAYER_SPEED,
  JUMP_VELOCITY,
  PLAYER_MAX_HP,
  PLAYER_ACCEL,
  PLAYER_DECEL,
  COYOTE_TIME,
  JUMP_BUFFER_TIME,
  STATE,
} from './constants.js';

const FRAME_TIME = 1 / 12; // animation fps

/**
 * Builds a sprite-style player character using canvas-drawn frames.
 * Returns { mesh, update(dt, input, colliders), state, ... }
 */
export class Player {
  constructor(scene) {
    this.maxHp = PLAYER_MAX_HP;
    this.hp    = PLAYER_MAX_HP;
    this.alive = true;
    this.swordDrawn = false;

    // physics
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.onGround   = false;
    this.facingRight = true;
    this.state = STATE.IDLE;
    this.invincible = 0; // seconds of invincibility after being hit
    this.coyoteTime = 0;
    this.jumpBuffer = 0;
    this.attackFlash = 0;
    this.attackJustTriggered = false;
    this.justLanded = false;
    this.justTookDamage = false;
    this.landingImpact = 0;
    this.jumpHeld = false;

    // animation
    this._animTime = 0;
    this._frame    = 0;

    // build sprite textures
    this._frames = buildPlayerFrames();

    // mesh: a simple plane that we swap textures on
    const geo = new THREE.PlaneGeometry(TILE_W, TILE_H * 2);
    this._mat = new THREE.MeshBasicMaterial({
      map: this._frames[STATE.IDLE][0],
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this._mat);
    this.mesh.position.z = 0.5;
    scene.add(this.mesh);

    // hit-flash overlay
    const flashGeo = new THREE.PlaneGeometry(TILE_W, TILE_H * 2);
    this._flashMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, depthWrite: false });
    this._flashMesh = new THREE.Mesh(flashGeo, this._flashMat);
    this._flashMesh.position.z = 0.6;
    scene.add(this._flashMesh);

    // sword mesh (only visible when drawn)
    this.sword = buildSwordMesh(scene);
  }

  // AABB half-extents
  get hw() { return 16; }
  get hh() { return 32; }

  /** Call every frame. input = { left, right, up, down, jump, attack, block } */
  update(dt, input, colliders, enemies) {
    if (!this.alive) { this._updateDeath(dt); return; }

    this.invincible = Math.max(0, this.invincible - dt);
    this.attackFlash = Math.max(0, this.attackFlash - dt);
    this.attackJustTriggered = false;
    this.justLanded = false;
    this.justTookDamage = false;
    const previousVy = this.vy;
    const wasGrounded = this.onGround;

    const prevState = this.state;

    // ── Input → velocity ─────────────────────────────────────────────────────
    if (this.state !== STATE.HURT) {
      if (input.left)  {
        this.vx = Math.max(this.vx - PLAYER_ACCEL, -PLAYER_SPEED);
        this.facingRight = false;
      } else if (input.right) {
        this.vx = Math.min(this.vx + PLAYER_ACCEL, PLAYER_SPEED);
        this.facingRight = true;
      } else {
        this.vx *= PLAYER_DECEL;
        if (Math.abs(this.vx) < 0.2) this.vx = 0;
      }
    }

    const jumpPressed = input.jump || input.up;
    this.jumpBuffer = jumpPressed ? JUMP_BUFFER_TIME : Math.max(0, this.jumpBuffer - dt);
    this.coyoteTime = this.onGround ? COYOTE_TIME : Math.max(0, this.coyoteTime - dt);

    if (this.jumpBuffer > 0 && this.coyoteTime > 0 && this.state !== STATE.HURT) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
      this.coyoteTime = 0;
      this.jumpBuffer = 0;
    }

    // Gravity
    const gravityScale = !this.onGround && !jumpPressed && this.vy > 0 ? 1.45 : 1;
    this.vy += GRAVITY * gravityScale * dt;
    if (this.vy < MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // ── Move + collide ────────────────────────────────────────────────────────
    this._moveAndCollide(dt, colliders);
    this.jumpHeld = jumpPressed;
    if (!wasGrounded && this.onGround) {
      this.justLanded = true;
      this.landingImpact = Math.max(0, Math.abs(previousVy));
    }

    // ── Sword / combat ────────────────────────────────────────────────────────
    if (input.attack && this.swordDrawn) {
      this._attack(enemies);
    }
    if (input.draw) this.swordDrawn = !this.swordDrawn;

    // ── State machine ─────────────────────────────────────────────────────────
    this._updateState(input);

    // ── Animation ────────────────────────────────────────────────────────────
    this._updateAnimation(dt);

    // ── Sword position ────────────────────────────────────────────────────────
    this._updateSword();

    // ── Flash ─────────────────────────────────────────────────────────────────
    if (this.invincible > 0) {
      this._flashMat.opacity = Math.sin(this.invincible * 30) * 0.4 + 0.2;
    } else {
      this._flashMat.opacity = 0;
    }
    this._flashMesh.position.set(this.x, this.y + this.hh, 0.6);

    // Sync mesh
    this.mesh.position.set(this.x, this.y + this.hh, 0.5);
    this.mesh.scale.x = this.facingRight ? 1 : -1;
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invincible = 1.2;
    this.state = STATE.HURT;
    this.vy = 6; this.vx = this.facingRight ? -4 : 4;
    this.justTookDamage = true;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.state = STATE.DIE;
    this.vx = 0;
  }

  _updateDeath(dt) {
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    this.mesh.position.set(this.x, this.y + this.hh, 0.5);
    this._flashMesh.position.set(this.x, this.y + this.hh, 0.6);
    this._mat.opacity = Math.max(0, this._mat.opacity - dt * 0.5);
  }

  _moveAndCollide(dt, colliders) {
    // Horizontal
    this.x += this.vx * dt * 60;
    for (const col of colliders) {
      if (col.alive === false && col.type !== 'solid') continue;
      if (col.falling) continue;
      if (this._overlapsAABB(col)) {
        if (this.vx > 0) this.x = col.x - this.hw;
        else if (this.vx < 0) this.x = col.x + col.w + this.hw;
        this.vx = 0;
      }
    }

    // Vertical
    this.onGround = false;
    this.y += this.vy * dt * 60;
    for (const col of colliders) {
      if (col.falling) continue;
      if (col.alive === false && col.type !== 'solid') continue;
      if (this._overlapsAABB(col)) {
        if (this.vy < 0) {
          // landing
          this.y = col.y + col.h;
          this.onGround = true;
          // trigger loose tile
          if (col.type === 'loose' && !col.falling) {
            col.timer = col.timer || 0;
            col.timer += 0.5;
            if (col.timer > 0.8) col.falling = true;
          }
        } else {
          this.y = col.y - this.hh * 2;
        }
        this.vy = 0;
      }
    }
  }

  _overlapsAABB(col) {
    const px = this.x - this.hw, py = this.y;
    const pw = this.hw * 2,      ph = this.hh * 2;
    return px < col.x + col.w && px + pw > col.x &&
           py < col.y + col.h && py + ph > col.y;
  }

  _updateState(input) {
    if (this.state === STATE.HURT) {
      if (this.invincible < 0.8) this.state = STATE.IDLE;
      return;
    }
    if (this.swordDrawn) {
      if (input.attack) this.state = STATE.ATTACK;
      else this.state = STATE.SWORD_IDLE;
    } else if (!this.onGround) {
      this.state = this.vy > 0 ? STATE.JUMP : STATE.FALL;
    } else if (Math.abs(this.vx) > 0.5) {
      this.state = STATE.RUN;
    } else {
      this.state = STATE.IDLE;
    }
  }

  _attack(enemies) {
    if (this._attackCooldown > 0) return;
    this._attackCooldown = 0.5;
    this.attackFlash = 0.22;
    this.attackJustTriggered = true;
    const dir = this.facingRight ? 1 : -1;
    const sx = this.x + dir * 40;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - sx, dy = e.y - this.y;
      if (Math.abs(dx) < 38 && Math.abs(dy) < 50) {
        e.takeDamage(1);
      }
    }
  }

  _updateAnimation(dt) {
    if (this._attackCooldown !== undefined) {
      this._attackCooldown = Math.max(0, this._attackCooldown - dt);
    }
    const frames = this._frames[this.state] || this._frames[STATE.IDLE];
    this._animTime += dt;
    if (this._animTime >= FRAME_TIME) {
      this._animTime = 0;
      this._frame = (this._frame + 1) % frames.length;
    }
    this._mat.map = frames[this._frame];
    this._mat.needsUpdate = true;
  }

  _updateSword() {
    if (!this.swordDrawn) { this.sword.visible = false; return; }
    this.sword.visible = true;
    const dir = this.facingRight ? 1 : -1;
    const swing = this.attackFlash > 0 ? this.attackFlash / 0.22 : 0;
    const ox = this.state === STATE.ATTACK ? 44 + (1 - swing) * 18 : 32;
    const oy = this.state === STATE.ATTACK ? 36 + (1 - swing) * 10 : 40;
    this.sword.position.set(this.x + dir * ox, this.y + oy, 0.55);
    this.sword.scale.x = dir;
    const angle = this.state === STATE.ATTACK ? -0.15 - (1 - swing) * 0.85 : 0;
    this.sword.rotation.z = angle * dir;
    this.sword.children[0].material.color.setHex(this.attackFlash > 0 ? 0xf7f1c8 : 0xdde8ff);
  }
}

// ─── Frame drawing ────────────────────────────────────────────────────────────

function buildPlayerFrames() {
  const out = {};
  out[STATE.IDLE]       = [drawIdle(false), drawIdle(true)];
  out[STATE.RUN]        = [0,1,2,3].map(i => drawRun(i));
  out[STATE.JUMP]       = [drawJump()];
  out[STATE.FALL]       = [drawFall()];
  out[STATE.CROUCH]     = [drawCrouch()];
  out[STATE.SWORD_IDLE] = [drawSwordIdle()];
  out[STATE.ATTACK]     = [drawAttack(), drawAttack2()];
  out[STATE.BLOCK]      = [drawBlock()];
  out[STATE.HURT]       = [drawHurt()];
  out[STATE.DIE]        = [drawDie()];
  out[STATE.HANG]       = [drawHang()];
  return out;
}

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

// skin / cloth colours
const SKIN   = '#e8b878';
const SHIRT  = '#c87820';
const PANTS  = '#d4a020';
const BOOT   = '#5a3010';
const HAIR   = '#1a0a02';
const BELT   = '#8a5010';
const SHADOW = 'rgba(0,0,0,0.4)';

function drawHead(g, cx, cy, flip = false) {
  // hair
  g.fillStyle = HAIR;
  g.beginPath(); g.arc(cx, cy - 14, 11, Math.PI, 0); g.fill();
  // face
  g.fillStyle = SKIN;
  g.beginPath(); g.ellipse(cx, cy - 6, 9, 12, 0, 0, Math.PI * 2); g.fill();
  // sideburns / beard shadow
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(cx - 9, cy - 10, 4, 8);
  g.fillRect(cx + 5, cy - 10, 4, 8);
  // eyes
  g.fillStyle = '#2a1a08';
  g.fillRect(flip ? cx - 6 : cx + 2, cy - 9, 3, 2);
  // mouth
  g.fillStyle = '#a06040';
  g.fillRect(cx - 3, cy - 2, 6, 2);
}

function drawBody(g, cx, cy) {
  g.fillStyle = SHIRT;
  g.fillRect(cx - 10, cy, 20, 24);
  // belt
  g.fillStyle = BELT;
  g.fillRect(cx - 11, cy + 22, 22, 4);
  // shading
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(cx + 5, cy + 2, 5, 20);
}

function drawLegs(g, cx, cy, lAngle = 0, rAngle = 0) {
  const lx = cx - 5, rx = cx + 5;
  // left leg
  g.save(); g.translate(lx, cy); g.rotate(lAngle);
  g.fillStyle = PANTS;
  g.fillRect(-5, 0, 9, 26);
  // boot
  g.fillStyle = BOOT;
  g.fillRect(-5, 22, 9, 10);
  g.restore();

  // right leg
  g.save(); g.translate(rx, cy); g.rotate(rAngle);
  g.fillStyle = PANTS;
  g.fillRect(-4, 0, 9, 26);
  g.fillStyle = BOOT;
  g.fillRect(-4, 22, 9, 10);
  g.restore();
}

function drawArm(g, bx, by, angle, right = false) {
  g.save();
  g.translate(bx, by);
  g.rotate(angle);
  g.fillStyle = SHIRT;
  g.fillRect(right ? 0 : -8, 0, 8, 20);
  // hand
  g.fillStyle = SKIN;
  g.beginPath(); g.arc(right ? 4 : -4, 20, 5, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawIdle(blink) {
  const [c, g] = makeCtx();
  const cx = 32, by = 20;
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, 116, 14, 5, 0, 0, Math.PI*2); g.fill();
  drawHead(g, cx, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 17, by + 28, 0.2);
  drawArm(g, cx + 9, by + 28, -0.2, true);
  drawLegs(g, cx, by + 50);
  if (blink) { g.fillStyle = SKIN; g.fillRect(cx + 2, by - 9, 3, 2); } // blink
  return toTex(c);
}

function drawRun(frame) {
  const [c, g] = makeCtx();
  const cx = 32, by = 16;
  const angles = [[0.3, -0.3], [0.1, -0.1], [-0.3, 0.3], [-0.1, 0.1]];
  const [la, ra] = angles[frame];
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx + frame*2-4, 116, 12, 4, 0, 0, Math.PI*2); g.fill();
  drawHead(g, cx + (frame < 2 ? 2 : -2), by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 17, by + 28, la * 0.5);
  drawArm(g, cx + 9, by + 28, -la * 0.5, true);
  drawLegs(g, cx, by + 50, la, ra);
  return toTex(c);
}

function drawJump() {
  const [c, g] = makeCtx();
  const cx = 32, by = 8;
  drawHead(g, cx, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 18, by + 26, -0.8);
  drawArm(g, cx + 9, by + 26, 0.8, true);
  drawLegs(g, cx, by + 50, -0.3, 0.3);
  return toTex(c);
}

function drawFall() {
  const [c, g] = makeCtx();
  const cx = 32, by = 12;
  drawHead(g, cx, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 18, by + 26, 0.6);
  drawArm(g, cx + 9, by + 26, -0.6, true);
  drawLegs(g, cx, by + 50, 0.2, -0.2);
  return toTex(c);
}

function drawCrouch() {
  const [c, g] = makeCtx();
  const cx = 32, by = 40;
  drawHead(g, cx, by);
  drawBody(g, cx, by + 22);
  drawArm(g, cx - 16, by + 24, 0.4);
  drawArm(g, cx + 9, by + 24, -0.4, true);
  // crouched legs
  g.fillStyle = PANTS; g.fillRect(cx - 14, by + 46, 10, 16);
  g.fillStyle = BOOT;  g.fillRect(cx - 22, by + 56, 20, 10);
  g.fillStyle = PANTS; g.fillRect(cx + 4,  by + 46, 10, 16);
  g.fillStyle = BOOT;  g.fillRect(cx + 4,  by + 56, 20, 10);
  return toTex(c);
}

function drawSwordIdle() {
  const [c, g] = makeCtx();
  const cx = 32, by = 20;
  drawHead(g, cx - 2, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 17, by + 28, -0.3);
  drawArm(g, cx + 9, by + 28, -0.8, true); // raised sword arm
  drawLegs(g, cx, by + 50, -0.1, 0.15);
  return toTex(c);
}

function drawAttack() {
  const [c, g] = makeCtx();
  const cx = 28, by = 22;
  drawHead(g, cx - 2, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 18, by + 28, 0.4);
  drawArm(g, cx + 8, by + 26, -1.1, true); // extended attack
  drawLegs(g, cx, by + 50, 0.2, -0.1);
  return toTex(c);
}

function drawAttack2() {
  const [c, g] = makeCtx();
  const cx = 30, by = 20;
  drawHead(g, cx - 1, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 18, by + 28, 0.3);
  drawArm(g, cx + 9, by + 24, -0.9, true);
  drawLegs(g, cx, by + 50, 0.15, -0.05);
  return toTex(c);
}

function drawBlock() {
  const [c, g] = makeCtx();
  const cx = 32, by = 22;
  drawHead(g, cx, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx + 6, by + 24, -0.1, true); // arm forward
  drawArm(g, cx - 18, by + 28, 0.1);
  drawLegs(g, cx, by + 50, -0.1, 0.1);
  return toTex(c);
}

function drawHurt() {
  const [c, g] = makeCtx();
  const cx = 32, by = 20;
  drawHead(g, cx + 4, by);
  drawBody(g, cx, by + 26);
  drawArm(g, cx - 18, by + 28, 0.8);
  drawArm(g, cx + 9, by + 28, 0.6, true);
  drawLegs(g, cx, by + 50, 0.1, -0.2);
  // pain tint
  g.fillStyle = 'rgba(255,0,0,0.15)';
  g.fillRect(16, 8, 32, 110);
  return toTex(c);
}

function drawDie() {
  const [c, g] = makeCtx();
  const cx = 32, by = 70;
  // lying down
  g.save(); g.translate(32, 80); g.rotate(-Math.PI / 2);
  drawHead(g, 0, -10);
  g.restore();
  g.fillStyle = SHIRT; g.fillRect(8, 75, 48, 18);
  g.fillStyle = PANTS; g.fillRect(8, 90, 48, 16);
  g.fillStyle = BOOT;  g.fillRect(54, 90, 10, 16);
  return toTex(c);
}

function drawHang() {
  const [c, g] = makeCtx();
  const cx = 32, by = 10;
  drawHead(g, cx, by + 4);
  drawBody(g, cx, by + 30);
  // arms up gripping
  drawArm(g, cx - 18, by + 28, -1.2);
  drawArm(g, cx + 9, by + 28, 1.2, true);
  // dangling legs
  drawLegs(g, cx, by + 54, 0.3, -0.3);
  return toTex(c);
}

// ─── Sword mesh ───────────────────────────────────────────────────────────────
function buildSwordMesh(scene) {
  const g = new THREE.Group();

  // blade
  const bladeGeo = new THREE.PlaneGeometry(6, 44);
  bladeGeo.translate(3, 0, 0);
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0xdde8ff });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 0, 0);
  g.add(blade);

  // edge highlight
  const hiliteGeo = new THREE.PlaneGeometry(1, 44);
  hiliteGeo.translate(5.5, 0, 0);
  const hiliteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  g.add(new THREE.Mesh(hiliteGeo, hiliteMat));

  // guard
  const guardGeo = new THREE.PlaneGeometry(14, 4);
  guardGeo.translate(3, 22, 0);
  const guardMat = new THREE.MeshBasicMaterial({ color: 0xc8a050 });
  g.add(new THREE.Mesh(guardGeo, guardMat));

  // handle
  const handleGeo = new THREE.PlaneGeometry(5, 16);
  handleGeo.translate(3, 30, 0);
  const handleMat = new THREE.MeshBasicMaterial({ color: 0x5a3010 });
  g.add(new THREE.Mesh(handleGeo, handleMat));

  g.visible = false;
  scene.add(g);
  return g;
}
