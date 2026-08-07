import * as THREE from 'three';

/**
 * Particle system for:
 *  - sword sparks
 *  - dust puffs on landing
 *  - blood particles on hit
 *  - torch embers
 */
export class ParticleSystem {
  constructor(scene) {
    this._particles = [];

    // single shared geometry + material, updated each frame
    const MAX = 512;
    this._positions = new Float32Array(MAX * 3);
    this._colors    = new Float32Array(MAX * 3);
    this._sizes     = new Float32Array(MAX);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(this._colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(this._sizes, 1));

    this._geo = geo;

    const mat = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    this._points = new THREE.Points(geo, mat);
    this._points.renderOrder = 10;
    scene.add(this._points);
    this._maxParticles = MAX;
  }

  emit(x, y, type, count = 8, options = {}) {
    const dir = options.direction ?? 0;
    const spread = options.spread ?? Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = dir + (Math.random() - 0.5) * spread;
      const speed = Math.random() * 3 + 0.5;
      let r, g, b, life, size, grav;

      switch (type) {
        case 'spark':
          r = 1.0; g = 0.9; b = 0.3;
          life = 0.3 + Math.random() * 0.2;
          size = 4 + Math.random() * 3;
          grav = -8;
          break;
        case 'blood':
          r = 0.8; g = 0.05; b = 0.05;
          life = 0.5 + Math.random() * 0.3;
          size = 5 + Math.random() * 4;
          grav = -15;
          break;
        case 'dust':
          r = 0.7; g = 0.6; b = 0.45;
          life = 0.4 + Math.random() * 0.2;
          size = 6 + Math.random() * 6;
          grav = 2;
          break;
        case 'ember':
          r = 1.0; g = 0.5 + Math.random() * 0.3; b = 0.0;
          life = 0.6 + Math.random() * 0.4;
          size = 2 + Math.random() * 2;
          grav = 5;
          break;
        case 'slash':
          r = 1.0; g = 0.92; b = 0.6;
          life = 0.18 + Math.random() * 0.08;
          size = 8 + Math.random() * 8;
          grav = -2;
          break;
        default:
          r = 1; g = 1; b = 1; life = 0.5; size = 4; grav = 0;
      }

      if (this._particles.length >= this._maxParticles) break;

      this._particles.push({
        x, y, z: 0.9,
        vx: Math.cos(angle) * speed * (type === 'slash' ? 1.7 : 1),
        vy: Math.abs(Math.sin(angle)) * speed * (type === 'dust' ? -1 : type === 'slash' ? 0.4 : 1),
        r, g, b, life, maxLife: life, size, grav,
      });
    }
  }

  update(dt) {
    const alive = [];
    for (const p of this._particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.grav * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      alive.push(p);
    }
    this._particles = alive;

    // rebuild buffer
    const n = Math.min(alive.length, this._maxParticles);
    for (let i = 0; i < n; i++) {
      const p = alive[i];
      const alpha = p.life / p.maxLife;
      this._positions[i*3]   = p.x;
      this._positions[i*3+1] = p.y;
      this._positions[i*3+2] = p.z;
      this._colors[i*3]   = p.r * alpha;
      this._colors[i*3+1] = p.g * alpha;
      this._colors[i*3+2] = p.b * alpha;
      this._sizes[i] = p.size * alpha;
    }
    // zero out unused slots
    for (let i = n; i < this._maxParticles; i++) {
      this._positions[i*3] = -9999;
    }

    this._geo.attributes.position.needsUpdate = true;
    this._geo.attributes.color.needsUpdate    = true;
    this._geo.attributes.size.needsUpdate     = true;
    this._geo.setDrawRange(0, n);
  }
}
