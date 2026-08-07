# generated-pop — Prince of Persia (Three.js Edition)

A classic 2D platform-adventure game inspired by the original Prince of Persia, built entirely in **Three.js** with procedural pixel-art textures, physics, sword combat, enemy AI, particle effects, and a Web Audio synthesizer.

## Features

| Category | Details |
|---|---|
| **Renderer** | Three.js orthographic 2D with depth-sorted layers |
| **Textures** | 100% procedural — stone brickwork, torchlight, spikes, potions, doors |
| **Physics** | Gravity, collision detection (AABB), loose floors that fall |
| **Player** | 12-state animation (idle, run, jump, fall, sword idle, attack, block, hurt, die, hang, crouch, climb) |
| **Enemies** | Guard AI with melee range detection, attack/block/advance FSM, HP bars |
| **Particles** | Sword sparks, blood, dust clouds, torch embers (additive blending) |
| **Lighting** | Per-torch animated point lights with flicker |
| **Audio** | Web Audio synthesised SFX — jump, sword clash, hit, potion, victory, death |
| **HUD** | HP pips, countdown timer, floor counter |
| **Levels** | 3 interconnected rooms with traps, potions, multiple enemies |

## Controls

| Key | Action |
|---|---|
| ← / → | Move |
| Space / ↑ | Jump |
| ↓ | Duck / climb down |
| **Q** | Draw / sheathe sword |
| **F** | Attack (sword must be drawn) |
| Shift | Block / parry |

## Development

```bash
npm install
npm run dev      # hot-reload dev server
npm run build    # production bundle → dist/
npm run preview  # serve production build
```

Requires Node 18+.
