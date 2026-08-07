// ─── Constants ────────────────────────────────────────────────────────────────
export const TILE_W = 64;   // world-space tile width
export const TILE_H = 64;   // world-space tile height
export const GRAVITY = -28; // units / s²
export const MAX_FALL_SPEED = -25;
export const PLAYER_SPEED = 7;
export const JUMP_VELOCITY = 13;
export const PLAYER_MAX_HP = 6;

// animation states
export const STATE = {
  IDLE:       'idle',
  RUN:        'run',
  JUMP:       'jump',
  FALL:       'fall',
  CROUCH:     'crouch',
  CLIMB_UP:   'climb_up',
  CLIMB_DOWN: 'climb_down',
  SWORD_IDLE: 'sword_idle',
  ATTACK:     'attack',
  BLOCK:      'block',
  HURT:       'hurt',
  DIE:        'die',
  HANG:       'hang',
};

// tile types
export const TILE = {
  EMPTY:  0,
  SOLID:  1,
  SPIKES: 2,
  GATE:   3,
  DOOR:   4,
  LOOSE:  5,  // loose floor that falls after being stepped on
  POTION: 6,
};
