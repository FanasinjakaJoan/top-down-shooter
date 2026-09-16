/* ============================================================
   BLOODY HEIST — headless smoke test
   Runs the real game modules (worlds, characters, actors,
   AI, combat, rewind, missions) in Node with a fake DOM.
   `npm test`
   ============================================================ */
"use strict";

/* ---------------- fake DOM ---------------- */
function fakeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, prop) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") return () => ({ addColorStop() {} });
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (prop in t) return t[prop];
      return () => {};
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function fakeCanvas(w = 256) {
  return { width: w, height: w, style: {}, getContext: () => fakeCtx() };
}
function fakeEl() {
  return {
    style: {}, width: 96, height: 96,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    _innerHTML: "",
    set innerHTML(v) { this._innerHTML = v; },
    get innerHTML() { return this._innerHTML; },
    get offsetWidth() { return 0; },
    appendChild() {}, addEventListener() {}, remove() {},
    getContext: () => fakeCtx(),
    querySelector: () => fakeEl(),
  };
}
global.document = {
  createElement: (t) => (t === "canvas" ? fakeCanvas() : fakeEl()),
  getElementById: () => fakeEl(),
  readyState: "complete",
  addEventListener() {},
};
global.window = globalThis;
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
global.requestAnimationFrame = () => 0;

/* ---------------- load three + game modules ---------------- */
const THREE = require("three");
globalThis.THREE = THREE;

const path = require("path");
function load(rel) {
  require(path.join(__dirname, "..", rel));
}
load("js/utils.js");
load("js/config.js");
load("js/input.js");
load("js/audio.js");
load("js/camera.js");
load("js/effects.js");
load("js/characters.js");
load("js/actor.js");
load("js/weapons.js");
load("js/enemy.js");
load("js/player.js");
load("js/rewind.js");
load("js/world/world.js");
load("js/world/warehouse.js");
load("js/world/street.js");
load("js/world/bank.js");
load("js/missions.js");
// ui.js + game.js need a real canvas/WebGL — loaded separately in the browser.

const BH = globalThis.BH;
const CFG = BH.config;
const U = BH.utils;

/* ---------------- tiny test kit ---------------- */
let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { passed++; console.log("  ok  " + msg); }
  else { failed++; failures.push(msg); console.log("FAIL  " + msg); }
}
function section(name) { console.log("\n== " + name + " =="); }

const noopAudio = new Proxy({}, { get: (t, p) => (p === Symbol.toPrimitive ? undefined : () => {}) });

/* ---------------- test game harness ---------------- */
function makeTestGame(levelKey) {
  const scene = new THREE.Scene();
  const g = {
    scene, state: "playing", activeIdx: 0, rewinding: false,
    actors: [], players: [], enemies: [],
    activeInput: { x: 0, z: 0 },
    activeAim: new THREE.Vector3(0, 1.18, 10),
    activeFiring: false, activeSprint: false, activeReload: false,
    _dt: 1 / 60,
    settings: CFG.loadSettings(),
    audio: noopAudio, effects: null, world: null, mission: null,
    camera: null, ui: null,
    won: false, lost: false,
    get cameras() { return (this.world && this.world.levelInfo && this.world.levelInfo.cameras) || []; },
    activePlayer() { return this.players[this.activeIdx]; },
    setActive(i) { this.activeIdx = i; },
    onShotFired(shooter, muzzle, weapon) {
      for (const e of this.enemies) if (e.id !== shooter.id) e.hearShot(muzzle.x, muzzle.z, weapon);
    },
    onActorHit() {},
    onEnemyKilled(v) { if (this.mission) this.mission.addKill(v.def); },
    onCameraDestroyed() {},
    winMission() { this.state = "victory"; this.won = true; },
    loseMission() { this.state = "defeat"; this.lost = true; },
    captureState() { return capture(this); },
    restoreState(snap) { restore(this, snap); },
  };
  const Cls = BH.Levels[levelKey];
  g.world = new Cls(g, scene);
  g.world.build();
  CFG.CREW.forEach((c, i) => {
    const p = new BH.Player(g, c, i, g.world.levelInfo.spawns[i]);
    g.players.push(p);
    g.actors.push(p);
  });
  g.world.levelInfo.enemies.forEach((es) => {
    const e = new BH.Enemy(g, CFG.ENEMIES[es.type], es, es.patrol);
    g.enemies.push(e);
    g.actors.push(e);
  });
  g.mission = new BH.Mission(g);
  return g;
}

function frame(g, dt = 1 / 60) {
  g._dt = dt;
  for (const p of g.players) p.update(dt);
  for (const e of g.enemies) e.update(dt);
  if (g.mission) { g.mission.update(dt); g.mission.updateVaultDoor(dt); }
}

/** teleport an actor (pos + mesh group + heading) */
function teleport(a, x, z, heading) {
  a.pos.set(x, 0, z);
  a.group.position.set(x, 0, z);
  if (heading != null) { a.heading = heading; a.group.rotation.y = heading; }
}

function capture(g) {
  return {
    activeIdx: g.activeIdx,
    players: g.players.map((p) => p.snapshot()),
    enemies: g.enemies.map((e) => e.snapshot()),
    mission: g.mission ? g.mission.captureState() : null,
  };
}
function restore(g, snap) {
  g.activeIdx = snap.activeIdx;
  g.players.forEach((p, i) => p.restore(snap.players[i]));
  g.enemies.forEach((e, i) => e.restore(snap.enemies[i]));
  if (snap.mission) g.mission.restoreState(snap.mission);
  if (!g.players[g.activeIdx].alive) {
    for (let i = 0; i < g.players.length; i++) if (g.players[i].alive) { g.activeIdx = i; break; }
  }
}

/* ================= TESTS ================= */

section("Levels build");
for (const key of ["warehouse", "street", "bank"]) {
  const g = makeTestGame(key);
  const info = g.world.levelInfo;
  ok(g.world.obstacles.length > 8, key + ": obstacles (" + g.world.obstacles.length + ")");
  ok(info.enemies.length > 0 && info.spawns.length === 4, key + ": spawns & enemies");
  ok(!!info.escape && info.objectives.length >= 3, key + ": objectives & escape");
  ok(g.players.length === 4 && g.enemies.length === info.enemies.length, key + ": actors spawned");
}

section("Character models");
for (const c of CFG.CREW) {
  const m = BH.Characters.buildCharacterModel(c, c.weapon);
  let meshes = 0;
  m.group.traverse((o) => { if (o.isMesh) meshes++; });
  ok(meshes > 20, c.id + ": " + meshes + " meshes");
  ok(!!m.parts.muzzle && !!m.parts.body && !!m.parts.torso, c.id + ": rig parts");
  // run animations through the states
  for (let i = 0; i < 20; i++) BH.Characters.animateModel(m.parts, { t: i * 0.1, walkPhase: i * 0.4, walkSpeed: 0.8, moving: true, aiming: i % 2, recoil: 0.3, dt: 0.1 });
  BH.Characters.animateModel(m.parts, { t: 1, dead: true, deathT: 0.2, dt: 0.1 });
  BH.Characters.animateModel(m.parts, { t: 1, dead: true, deathT: 1.5, dt: 0.1 });
  BH.Characters.animateModel(m.parts, { t: 1, win: true, winT: 0.5, dt: 0.1 });
  ok(true, c.id + ": animations ran");
}
for (const k of ["guard", "rifleman", "heavy"]) {
  const m = BH.Characters.buildCharacterModel(CFG.ENEMIES[k], CFG.ENEMIES[k].weapon);
  ok(!!m.parts.muzzle, "enemy " + k + " model");
}
for (const c of CFG.CREW) {
  BH.Characters.drawPortrait(fakeCanvas(96), c, c.weapon);
}
ok(true, "portraits drawn");

section("Movement & collision (warehouse)");
{
  const g = makeTestGame("warehouse");
  const p = g.players[0];
  for (const e of g.enemies) teleport(e, 19.5, 13); // quarantine threats (SE corner, out of view range)
  teleport(p, 0, 0);
  g.activeInput = { x: -1, z: 0 }; // toward west wall
  for (let i = 0; i < 1500; i++) frame(g); // 25s — plenty to reach the wall
  ok(p.pos.x < -21.0 && p.pos.x > -21.95, "west wall blocks: x=" + p.pos.x.toFixed(2));

  teleport(p, 1, 6.5);
  g.activeInput = { x: 0, z: -1 }; // toward crate at (1,4) size 2.2 (z 2.9..5.1)
  for (let i = 0; i < 300; i++) frame(g);
  ok(p.pos.z > 5.45 && p.pos.z < 5.65, "crate blocks: z=" + p.pos.z.toFixed(2));

  g.activeInput = { x: 0, z: 0 };
}

section("Line of sight");
{
  const g = makeTestGame("warehouse");
  ok(g.world.castLOS(0, 0, 5, 0), "open lane clear");
  ok(!g.world.castLOS(-11.5, -8, -16.5, -8), "container blocks LOS");
  ok(!g.world.castLOS(0, 0, 0, 4.5), "crate stack blocks LOS from (0,0)");
}

section("Combat: hit & kill");
{
  const g = makeTestGame("warehouse");
  const p = g.players[0];
  const e = g.enemies[0];
  for (const other of g.enemies) if (other !== e) teleport(other, 19.5, 13); // quarantine
  teleport(p, 0, 0, Math.PI / 2);
  teleport(e, 6, 0, -Math.PI / 2);
  e.state = "combat"; e.targetId = p.id;
  const killsBefore = g.mission.kills;
  p.update(0.1); // aim pose so muzzle is up front
  const res1 = BH.weapons.tryFire(p, new THREE.Vector3(6, 1, 0));
  ok(res1 && res1.hitActor === e, "shot hit enemy");
  ok(e.hp < e.maxHp, "enemy damaged: " + e.hp + "/" + e.maxHp);
  p.update(0.5); // let the fire cooldown lapse
  const res2 = BH.weapons.tryFire(p, new THREE.Vector3(6, 1, 0));
  ok(res2 && res2.hitActor === e, "second shot hit");
  e.takeDamage(9999, 0, 0, p); // finish it
  ok(!e.alive, "enemy dead");
  ok(g.mission.kills === killsBefore + 1, "kill counted: " + g.mission.kills);
  ok(g.mission.score > 0, "score awarded: " + g.mission.score);
  // wall impact
  p.update(0.5);
  const resW = BH.weapons.tryFire(p, new THREE.Vector3(-22, 1, 0));
  ok(resW && !resW.hitActor, "wall shot stopped by obstacle");
}

section("Enemy AI: detect → combat → fire");
{
  const g = makeTestGame("warehouse");
  const p = g.players[0];
  const e = g.enemies[0];
  for (const other of g.enemies) if (other !== e) teleport(other, 19.5, 13); // quarantine
  teleport(p, 13, 0); // open ground, clear LOS
  teleport(e, 8, 0);
  e.state = "patrol";
  const pHp0 = p.hp;
  for (let i = 0; i < 900; i++) frame(g); // 15s
  ok(e.state === "combat" || p.hp < pHp0, "enemy engaged (state=" + e.state + ", playerHp " + p.hp + "/" + pHp0 + ")");
}

section("Rewind: restore pre-kill state");
{
  const g = makeTestGame("warehouse");
  const p = g.players[0];
  const e = g.enemies[0];
  for (const other of g.enemies) if (other !== e) teleport(other, 19.5, 13); // quarantine
  teleport(p, 0, 0, Math.PI / 2);
  teleport(e, 6, 0);
  const snap = capture(g);
  // take some damage + fire
  p.takeDamage(20, 6, 0, e);
  BH.weapons.tryFire(p, new THREE.Vector3(6, 1, 0));
  e.takeDamage(9999, 0, 0, p);
  ok(!e.alive && g.mission.kills === 1, "pre-restore: enemy dead, kills=1");
  restore(g, snap);
  ok(e.alive, "enemy restored alive");
  ok(e.hp === e.maxHp, "enemy hp restored: " + e.hp);
  ok(g.mission.kills === 0, "kills restored: " + g.mission.kills);
  ok(p.hp === snap.players[0].hp, "player hp restored: " + p.hp);
  ok(p.weapon.mag === snap.players[0].mag, "ammo restored: " + p.weapon.mag);
  // player death rewind: kill the player, then restore
  p.takeDamage(9999, 6, 0, e);
  ok(!p.alive, "player dead");
  restore(g, snap);
  ok(p.alive && p.hp === snap.players[0].hp, "player resurrected by rewind");
}

section("Mission flow: collect → clear → escape (warehouse)");
{
  const g = makeTestGame("warehouse");
  const p = g.players[0];
  for (const e of g.enemies) e.takeDamage(9999, 0, 0, p); // clear threats first (deterministic)
  frame(g);
  const bcs = g.world.levelInfo.briefcases;
  for (const bc of bcs) { teleport(p, bc.x + 0.4, bc.z + 0.4); for (let i = 0; i < 30; i++) frame(g); }
  ok(bcs.every(b => b.taken), "all briefcases collected");
  frame(g);
  ok(g.mission.kills === g.world.levelInfo.enemiesTotal, "all enemies cleared: " + g.mission.kills);
  const esc = g.world.levelInfo.escape;
  teleport(p, esc.x, esc.z);
  for (let i = 0; i < 60; i++) frame(g);
  ok(g.won && g.state === "victory", "mission won by escaping");
  ok(g.mission.objectives.every(o => o.done), "all objectives done");
}

section("Bank: cameras, vault, escape");
{
  const g = makeTestGame("bank");
  const p = g.players[0];
  for (const e of g.enemies) e.takeDamage(9999, 0, 0, p); // clear threats first (deterministic)
  frame(g);
  // shoot each camera
  for (const cam of g.cameras) {
    teleport(p, cam.x * 0.94, cam.z * 0.94);
    let guard = 0;
    while (cam.alive && guard++ < 5) {
      p.update(0.3); // let fire cooldown lapse
      BH.weapons.tryFire(p, new THREE.Vector3(cam.x, 1.3, cam.z));
    }
  }
  ok(g.cameras.every(c => !c.alive), "all 3 cameras destroyed");
  frame(g);
  ok(g.mission.objectives[0].done, "camera objective done");
  // clear the room first (the heavy patrols the vault itself)
  for (const e of g.enemies) e.takeDamage(9999, 0, 0, p);
  frame(g);
  // hold vault
  const v = g.world.levelInfo.vault;
  teleport(p, v.x, v.z + 1.5);
  for (let i = 0; i < 240; i++) frame(g); // 4s
  ok(g.mission.vaultOpen && g.world.goldGroup.visible, "vault open, gold revealed");
  ok(g.mission.objectives[1].done, "vault objective done");
  const esc = g.world.levelInfo.escape;
  teleport(p, esc.x, esc.z);
  for (let i = 0; i < 60; i++) frame(g);
  ok(g.won, "bank mission won");
}

section("Street: target car + defeat condition");
{
  const g = makeTestGame("street");
  const p = g.players[0];
  for (const e of g.enemies) e.takeDamage(9999, 0, 0, p); // clear threats first (deterministic)
  frame(g);
  const tc = g.world.levelInfo.targetCar;
  teleport(p, tc.x + 0.7, tc.z); // just outside the car's collision box
  for (let i = 0; i < 120; i++) frame(g); // 2s
  ok(g.mission.objectives[0].done, "cash stolen (hold position)");
  // defeat: kill whole crew
  for (const pl of g.players) pl.takeDamage(9999, 0, 0, null);
  for (let i = 0; i < 150; i++) frame(g);
  ok(g.lost && g.state === "defeat", "defeat when crew wiped");
}

section("Rewind energy drain");
{
  const g = makeTestGame("warehouse");
  const p = g.players[0];
  for (const e of g.enemies) e.takeDamage(9999, 0, 0, p); // clear threats (deterministic)
  p.rewindEnergy = 100;
  const rw = new BH.RewindSystem(g);
  g.rewind = rw;
  g.audio = noopAudio;
  // feed snapshots
  for (let i = 0; i < 30; i++) { frame(g); rw.tick(0.1); }
  ok(rw.buf.length >= 20, "buffer recording (" + rw.buf.length + ")");
  g.rewinding = false;
  g.activeFiring = false;
  rw.begin();
  ok(g.rewinding, "rewind begins");
  const e0 = p.rewindEnergy;
  for (let i = 0; i < 30; i++) rw.tick(0.1);
  ok(p.rewindEnergy < e0, "energy drained: " + e0.toFixed(0) + " -> " + p.rewindEnergy.toFixed(0));
  rw.end();
  ok(!g.rewinding, "rewind ends");
}

/* ---------------- summary ---------------- */
console.log("\n========================================");
console.log(passed + " passed, " + failed + " failed");
if (failed) {
  console.log("Failures:");
  failures.forEach(f => console.log("  - " + f));
  process.exit(1);
}
console.log("ALL SMOKE TESTS PASSED");
