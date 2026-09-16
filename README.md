# BLOODY HEIST

**An original isometric 2.5D tactical heist shooter** — four suited criminals, three jobs,
and a time-rewind mechanic that lets you undo a bad moment. Built with Three.js (WebGL),
vanilla JS and a fully procedural WebAudio score. No external assets: every model, texture,
portrait, sound and level is generated in code.

> Inspired in *feel* by isometric crime-action tactical games. All characters, names,
> environments, dialogue-free flavor text, art and audio are original.

![stack](https://img.shields.io/badge/Three.js-r147-black) ![tests](https://img.shields.io/badge/tests-64%20headless-passing)

---

## Play

```bash
npm start          # python3 http.server on 0.0.0.0:8000
```

Open the preview URL. Click any button once to unlock audio.

**Test the gameplay logic headless (no browser needed):**

```bash
npm test           # node test/smoke.js — 64 functional tests
```

The smoke harness runs the *real* game modules (worlds, character rigs, AI, combat,
rewind, missions) in Node with a fake DOM and asserts on gameplay outcomes:
collision, line-of-sight, hitscan damage, enemy detect→engage→fire, full mission
flows on all three levels, and rewind restore/energy semantics.

---

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Move (screen-relative) |
| Mouse | Aim |
| Left click | Shoot (hold for auto weapons) |
| `1 2 3 4` | Switch crew member |
| **`R` (hold)** | **Rewind time** — scrubs the whole world back up to 5 s, spends the active character's rewind charge |
| `F` | Reload |
| `Shift` | Sprint |
| `Q / E` | Rotate camera |
| Mouse wheel | Zoom |
| `Esc / P` | Pause |

Gamepad: left stick move, right stick camera, `A` fire, `RB/LB` switch, `B` rewind, `Start` pause.

Inactive crew members **follow your active character and auto-engage visible hostiles** —
use them as mobile fire support while you maneuver.

---

## The crew

| # | Character | Role | Kit |
|---|---|---|---|
| 1 | **Vito Marsala** | The Leader | Black suit, KAR-9 handgun · balanced · rewinds recharge +30% |
| 2 | **Bruno Kessler** | The Heavy | Dark suit, KOLOV-7 SMG · 170 HP, −25% damage taken, slow |
| 3 | **Elias Vane** | The Ghost | Gray suit, silenced VANE SP-8 · fast, quiet rounds barely alert guards |
| 4 | **Rosa Delgado** | The Driver | Leather jacket, ROSAR .45 · fastest in the crew |

## Missions

1. **OPERATION: BACKDOOR** — warehouse. Collect 3 briefcases, clear 8 hostiles, escape north.
2. **OPERATION: NIGHT RUN** — night street. Steal the cash from the target car, clear 6, escape east through the alley.
3. **OPERATION: SAFEHOUSE** — bank. Destroy 3 security cameras, crack the vault (hold 3 s), clear 6, escape west via the emergency exit.

Win: finish objectives and reach the escape zone. Lose: the whole crew goes down.
Score = kills + objectives + time bonus + survivor bonus. Progress persists in `localStorage`.

---

## Architecture

```
index.html              entry, loads THREE + game scripts in dependency order
css/style.css           cinematic HUD & menus
vendor/three.min.js     vendored Three.js r147 (UMD)
js/utils.js             math, easing, ray/AABB/sphere tests
js/config.js            crew, weapons, enemies, tuning, settings
js/input.js             keyboard / mouse / gamepad
js/audio.js             100% synthesized WebAudio: gunshots, SFX, tension score, ambience
js/camera.js            isometric rig: smooth follow, zoom, rotate, shake, orbit
js/effects.js           pooled particles: sparks, blood, smoke, tracers, shells, decals, muzzle flash
js/characters.js        procedural rigged character models + canvas portraits
js/actor.js             movement/collision, facing, health, weapon state, snapshots
js/weapons.js           hitscan firing vs obstacles, actors & security cameras
js/enemy.js             patrol → alert (hears shots) → combat (strafe, burst fire)
js/player.js            active control + ally follow/engage AI, rewind energy
js/rewind.js            5 s snapshot ring buffer; hold R to scrub & restore world state
js/world/*.js           World base (AABB collision, LOS, procedural textures) + 3 levels
js/missions.js          objective state machines, win/lose, score, mission snapshots
js/ui.js                HUD, menus, modals, toasts, hitmarker, overlays
js/game.js              orchestrator: state machine, capture/restore, events
test/smoke.js           headless functional test harness
```

### How rewind works

Every 100 ms the game snapshots the *entire* simulation — all four players
(position, heading, HP, ammo, walk phase), every enemy (position, HP, AI state,
patrol index, burst state), objectives, kill count, score and the mission clock —
into a 5-second ring buffer. Holding **R** scrubs through those snapshots at 2.2×
and restores each one exactly. Scrubbing drains the active character's rewind
energy (30/s); energy is **not** refunded by the restore, so a full 5 s scrub
costs the entire bar. Dead characters come back from a pre-death snapshot;
kills, score, ammo and AI states all roll back with it.

### Balance knobs

Everything tunable lives in `js/config.js` (`TUNING`): rewind window/cost/regen,
spread, damage, alert radii, camera distances, score values.
