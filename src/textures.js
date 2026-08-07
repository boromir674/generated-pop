import * as THREE from 'three';

/**
 * Build every texture the game needs using procedural canvas drawing.
 * Returns a map of { name: THREE.Texture }.
 */
export function buildTextures() {
  const tex = {};

  tex.stone    = stoneTexture();
  tex.stoneDark= stoneDarkTexture();
  tex.ceiling  = ceilingTexture();
  tex.floor    = floorTexture();
  tex.spikes   = spikesTexture();
  tex.torch    = torchTexture();
  tex.gate     = gateTexture();
  tex.door     = doorTexture();
  tex.bg       = bgTexture();
  tex.potion   = potionTexture();
  tex.loose    = looseFloorTexture();
  tex.arch     = archTexture();
  tex.mist     = mistTexture();
  tex.glow     = glowTexture();

  return tex;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}
function noise(x, y, scale = 1) {
  // simple deterministic pseudo-noise
  const n = Math.sin(x * 127.1 * scale + y * 311.7 * scale) * 43758.5453;
  return n - Math.floor(n);
}

// ── individual textures ───────────────────────────────────────────────────────

function stoneTexture() {
  const [c, g] = makeCanvas(64, 64);
  // base stone colour
  g.fillStyle = '#5a4830';
  g.fillRect(0, 0, 64, 64);

  // mortar lines (horizontal + vertical bricks)
  g.strokeStyle = '#2a1f10';
  g.lineWidth = 2;
  // horizontal mortar
  for (let y = 0; y <= 64; y += 16) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke();
  }
  // vertical mortar – offset every other row
  for (let row = 0; row < 4; row++) {
    const offX = row % 2 === 0 ? 0 : 16;
    for (let x = offX; x <= 64; x += 32) {
      g.beginPath(); g.moveTo(x, row * 16); g.lineTo(x, (row + 1) * 16); g.stroke();
    }
  }

  // per-pixel noise overlay
  const id = g.getImageData(0, 0, 64, 64);
  for (let i = 0; i < id.data.length; i += 4) {
    const px = (i / 4) % 64, py = Math.floor(i / 4 / 64);
    const n = (noise(px, py) - 0.5) * 30;
    id.data[i]   = Math.min(255, Math.max(0, id.data[i]   + n));
    id.data[i+1] = Math.min(255, Math.max(0, id.data[i+1] + n * 0.8));
    id.data[i+2] = Math.min(255, Math.max(0, id.data[i+2] + n * 0.6));
  }
  g.putImageData(id, 0, 0);

  // subtle edge highlight
  const grd = g.createLinearGradient(0, 0, 64, 64);
  grd.addColorStop(0, 'rgba(255,220,140,0.12)');
  grd.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return toTex(c);
}

function stoneDarkTexture() {
  const [c, g] = makeCanvas(64, 64);
  g.fillStyle = '#2e2018';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#170e07';
  g.lineWidth = 2;
  for (let y = 0; y <= 64; y += 16) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke();
  }
  for (let row = 0; row < 4; row++) {
    const offX = row % 2 === 0 ? 0 : 16;
    for (let x = offX; x <= 64; x += 32) {
      g.beginPath(); g.moveTo(x, row * 16); g.lineTo(x, (row + 1) * 16); g.stroke();
    }
  }
  const id = g.getImageData(0, 0, 64, 64);
  for (let i = 0; i < id.data.length; i += 4) {
    const px = (i / 4) % 64, py = Math.floor(i / 4 / 64);
    const n = (noise(px + 99, py + 77) - 0.5) * 20;
    id.data[i]   = Math.min(255, Math.max(0, id.data[i]   + n));
    id.data[i+1] = Math.min(255, Math.max(0, id.data[i+1] + n * 0.8));
    id.data[i+2] = Math.min(255, Math.max(0, id.data[i+2] + n * 0.5));
  }
  g.putImageData(id, 0, 0);
  return toTex(c);
}

function ceilingTexture() {
  const [c, g] = makeCanvas(64, 32);
  g.fillStyle = '#3a2c1a';
  g.fillRect(0, 0, 64, 32);
  g.strokeStyle = '#1a0f05';
  g.lineWidth = 2;
  for (let x = 0; x <= 64; x += 32) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 32); g.stroke();
  }
  g.beginPath(); g.moveTo(0, 16); g.lineTo(64, 16); g.stroke();
  return toTex(c);
}

function floorTexture() {
  const [c, g] = makeCanvas(64, 16);
  // flagstone look
  const grd = g.createLinearGradient(0, 0, 0, 16);
  grd.addColorStop(0, '#6b5438');
  grd.addColorStop(0.5, '#7a6040');
  grd.addColorStop(1, '#4a3520');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 16);
  g.strokeStyle = '#2a1a08';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 16); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.stroke();
  g.strokeStyle = 'rgba(255,220,120,0.15)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 1); g.lineTo(64, 1); g.stroke();
  return toTex(c);
}

function spikesTexture() {
  const [c, g] = makeCanvas(64, 32);
  g.fillStyle = '#1a1208';
  g.fillRect(0, 0, 64, 32);
  const count = 8;
  for (let i = 0; i < count; i++) {
    const x = i * (64 / count) + (64 / count / 2);
    const grd = g.createLinearGradient(x - 3, 32, x, 0);
    grd.addColorStop(0, '#888');
    grd.addColorStop(1, '#fff');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x - 4, 32);
    g.lineTo(x + 4, 32);
    g.lineTo(x, 0);
    g.closePath();
    g.fill();
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 4, 32); g.lineTo(x + 5, 32); g.closePath(); g.fill();
  }
  return toTex(c);
}

function torchTexture() {
  const [c, g] = makeCanvas(16, 32);
  g.clearRect(0, 0, 16, 32);
  // handle
  g.fillStyle = '#5a3010';
  g.fillRect(6, 16, 4, 16);
  // bowl
  g.fillStyle = '#8a5020';
  g.beginPath(); g.arc(8, 16, 5, 0, Math.PI * 2); g.fill();
  // flame (static base)
  const fl = g.createRadialGradient(8, 12, 0, 8, 14, 8);
  fl.addColorStop(0, '#ffffff');
  fl.addColorStop(0.3, '#ffdd44');
  fl.addColorStop(0.7, '#ff6600');
  fl.addColorStop(1, 'rgba(200,50,0,0)');
  g.fillStyle = fl;
  g.beginPath(); g.ellipse(8, 12, 5, 10, 0, 0, Math.PI * 2); g.fill();
  return toTex(c);
}

function gateTexture() {
  const [c, g] = makeCanvas(64, 128);
  g.fillStyle = '#1a1208';
  g.fillRect(0, 0, 64, 128);
  // iron bars
  for (let x = 6; x < 64; x += 10) {
    const grd = g.createLinearGradient(x, 0, x + 6, 0);
    grd.addColorStop(0, '#666');
    grd.addColorStop(0.5, '#aaa');
    grd.addColorStop(1, '#444');
    g.fillStyle = grd;
    g.fillRect(x, 0, 6, 128);
    // rivets
    for (let y = 16; y < 128; y += 32) {
      g.fillStyle = '#888';
      g.beginPath(); g.arc(x + 3, y, 3, 0, Math.PI * 2); g.fill();
    }
  }
  return toTex(c);
}

function doorTexture() {
  const [c, g] = makeCanvas(64, 128);
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#3a2010');
  grd.addColorStop(0.5, '#5a3820');
  grd.addColorStop(1, '#2a1808');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 128);
  // wood planks
  g.strokeStyle = '#1a0e05';
  g.lineWidth = 2;
  for (let y = 0; y < 128; y += 16) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke();
  }
  // door handle
  g.fillStyle = '#c8a050';
  g.beginPath(); g.arc(52, 64, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#a08030';
  g.beginPath(); g.arc(52, 64, 3, 0, Math.PI * 2); g.fill();
  return toTex(c);
}

function bgTexture() {
  const [c, g] = makeCanvas(512, 384);

  // deep background gradient (night sky / dungeon atmosphere)
  const grd = g.createLinearGradient(0, 0, 0, 384);
  grd.addColorStop(0, '#050305');
  grd.addColorStop(0.5, '#0c0808');
  grd.addColorStop(1, '#120c04');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 384);

  for (let i = 0; i < 5; i++) {
    const ax = 36 + i * 100;
    const archGrad = g.createLinearGradient(ax, 90, ax, 384);
    archGrad.addColorStop(0, 'rgba(90,70,32,0.12)');
    archGrad.addColorStop(1, 'rgba(15,8,6,0.6)');
    g.fillStyle = archGrad;
    g.beginPath();
    g.moveTo(ax, 384);
    g.lineTo(ax, 124);
    g.arc(ax + 30, 124, 30, Math.PI, 0);
    g.lineTo(ax + 60, 384);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(85,60,22,0.35)';
    g.lineWidth = 3;
    g.stroke();
  }

  const shaft = g.createLinearGradient(0, 0, 120, 384);
  shaft.addColorStop(0, 'rgba(255,210,110,0.12)');
  shaft.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = shaft;
  g.beginPath();
  g.moveTo(40, 0);
  g.lineTo(160, 384);
  g.lineTo(240, 384);
  g.lineTo(120, 0);
  g.closePath();
  g.fill();

  // subtle noise
  const id = g.getImageData(0, 0, 512, 384);
  for (let i = 0; i < id.data.length; i += 4) {
    const px = (i / 4) % 512, py = Math.floor(i / 4 / 512);
    const n = (noise(px * 0.5, py * 0.5, 0.2) - 0.5) * 8;
    id.data[i]   = Math.min(255, Math.max(0, id.data[i]   + n));
    id.data[i+1] = Math.min(255, Math.max(0, id.data[i+1] + n * 0.7));
    id.data[i+2] = Math.min(255, Math.max(0, id.data[i+2] + n * 0.4));
  }
  g.putImageData(id, 0, 0);
  return toTex(c);
}

function potionTexture() {
  const [c, g] = makeCanvas(16, 24);
  g.clearRect(0, 0, 16, 24);
  // bottle body
  const grd = g.createRadialGradient(8, 14, 1, 8, 14, 7);
  grd.addColorStop(0, '#dd4444');
  grd.addColorStop(0.6, '#882222');
  grd.addColorStop(1, '#330000');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(5, 10); g.lineTo(3, 22); g.lineTo(13, 22); g.lineTo(11, 10);
  g.arc(8, 10, 3, 0, Math.PI, true);
  g.closePath();
  g.fill();
  // neck + cork
  g.fillStyle = '#884422';
  g.fillRect(6, 5, 4, 6);
  g.fillStyle = '#c8a050';
  g.fillRect(5, 3, 6, 4);
  // highlight
  g.fillStyle = 'rgba(255,180,180,0.5)';
  g.beginPath(); g.ellipse(6, 14, 2, 4, -0.3, 0, Math.PI * 2); g.fill();
  return toTex(c);
}

function looseFloorTexture() {
  const [c, g] = makeCanvas(64, 16);
  const grd = g.createLinearGradient(0, 0, 0, 16);
  grd.addColorStop(0, '#7a6040');
  grd.addColorStop(1, '#4a3520');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 16);
  // crack lines
  g.strokeStyle = '#1a0a02';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(20, 0); g.lineTo(10, 16); g.stroke();
  g.beginPath(); g.moveTo(44, 0); g.lineTo(50, 16); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.stroke();
  // warning orange tint
  g.fillStyle = 'rgba(255,120,0,0.1)';
  g.fillRect(0, 0, 64, 16);
  return toTex(c);
}

function archTexture() {
  const [c, g] = makeCanvas(128, 256);
  g.clearRect(0, 0, 128, 256);

  const body = g.createLinearGradient(0, 0, 128, 0);
  body.addColorStop(0, 'rgba(80,55,28,0.65)');
  body.addColorStop(0.5, 'rgba(138,100,56,0.55)');
  body.addColorStop(1, 'rgba(48,28,18,0.65)');
  g.fillStyle = body;

  g.beginPath();
  g.moveTo(20, 256);
  g.lineTo(20, 88);
  g.quadraticCurveTo(20, 32, 64, 32);
  g.quadraticCurveTo(108, 32, 108, 88);
  g.lineTo(108, 256);
  g.closePath();
  g.fill();

  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(38, 256);
  g.lineTo(38, 102);
  g.quadraticCurveTo(38, 62, 64, 62);
  g.quadraticCurveTo(90, 62, 90, 102);
  g.lineTo(90, 256);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'source-over';

  g.strokeStyle = 'rgba(255,214,148,0.18)';
  g.lineWidth = 4;
  g.strokeRect(20, 88, 88, 156);
  g.beginPath();
  g.moveTo(20, 88);
  g.quadraticCurveTo(20, 32, 64, 32);
  g.quadraticCurveTo(108, 32, 108, 88);
  g.stroke();

  for (let y = 96; y < 244; y += 24) {
    g.strokeStyle = 'rgba(18,10,8,0.42)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(20, y);
    g.lineTo(108, y);
    g.stroke();
  }

  return toTex(c);
}

function mistTexture() {
  const [c, g] = makeCanvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 26;
    const y = 48 + Math.sin(i * 1.37) * 12;
    const grad = g.createRadialGradient(x, y, 4, x, y, 34);
    grad.addColorStop(0, 'rgba(255,220,180,0.16)');
    grad.addColorStop(0.45, 'rgba(120,92,72,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, 38, 18, Math.sin(i), 0, Math.PI * 2);
    g.fill();
  }
  return toTex(c);
}

function glowTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,240,180,0.95)');
  grad.addColorStop(0.45, 'rgba(255,176,90,0.45)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTex(c);
}
