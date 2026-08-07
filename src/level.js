import { TILE } from './constants.js';

/**
 * Level data: array of room objects.
 * Each room has:
 *   - tiles: 2D array [row][col] of TILE values
 *   - exits: { right, left, up, down } – indices of connected rooms
 *   - potions: [{col, row}]
 *   - enemies: [{col, row, hp}]
 *   - torches: [{col, row}]
 *   - startCol / startRow: player start position within room
 */

const W = 20; // tiles per row
const H = 12; // tiles per column

function row(s) {
  // parse a string of W characters into tile array
  return s.split('').map(ch => {
    switch (ch) {
      case '#': return TILE.SOLID;
      case '.': return TILE.EMPTY;
      case '^': return TILE.SPIKES;
      case '=': return TILE.LOOSE;
      case 'G': return TILE.GATE;
      case 'D': return TILE.DOOR;
      default:  return TILE.EMPTY;
    }
  });
}

// ── Room 0 – Start ────────────────────────────────────────────────────────────
const room0 = {
  startCol: 2, startRow: 9,
  potions:  [{ col: 17, row: 9 }],
  enemies:  [{ col: 14, row: 9, hp: 3 }],
  torches:  [{ col: 6, row: 8 }, { col: 13, row: 8 }],
  exits: { right: 1, left: -1, up: -1, down: -1 },
  tiles: [
    row('####################'),
    row('#..................#'),
    row('#..................#'),
    row('#....######........#'),
    row('#....#.....#.......#'),
    row('#....#.....########'),
    row('#....#..............'),
    row('#....##############.'),
    row('#...................'),
    row('##############.....#'),
    row('#..................#'),
    row('####################'),
  ],
};

// ── Room 1 – Middle ───────────────────────────────────────────────────────────
const room1 = {
  startCol: 1, startRow: 9,
  potions:  [],
  enemies:  [{ col: 10, row: 9, hp: 3 }, { col: 17, row: 9, hp: 3 }],
  torches:  [{ col: 3, row: 8 }, { col: 16, row: 8 }],
  exits: { right: 2, left: 0, up: -1, down: -1 },
  tiles: [
    row('####################'),
    row('#..................#'),
    row('#..................#'),
    row('#.......######.....#'),
    row('#..........^.......#'),
    row('###########.########'),
    row('....................'),
    row('.......######.......'),
    row('....................',),
    row('##########.#########'),
    row('#..................#'),
    row('####################'),
  ],
};

// ── Room 2 – Exit room ────────────────────────────────────────────────────────
const room2 = {
  startCol: 1, startRow: 9,
  potions:  [{ col: 5, row: 9 }],
  enemies:  [{ col: 15, row: 9, hp: 5 }],
  torches:  [{ col: 4, row: 8 }, { col: 14, row: 8 }],
  exits: { right: -1, left: 1, up: -1, down: -1 },
  tiles: [
    row('####################'),
    row('#..................#'),
    row('#..................#'),
    row('#..................#'),
    row('#..####............#'),
    row('#....^.....######..D'),
    row('#..................#'),
    row('#.######...........#'),
    row('#..................#'),
    row('####.....##########.'),
    row('#..................#'),
    row('####################'),
  ],
};

export const LEVELS = [room0, room1, room2];
