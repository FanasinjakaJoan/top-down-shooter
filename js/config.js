/* ============================================================
   BLOODY HEIST — config.js
   Central data: playable characters, weapons, enemy types,
   tunable balance constants, settings.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};

  /* ----------------------------------------------------------
     WEAPONS
     dmg: damage per bullet
     rof: rounds per second
     auto: can fire on hold
     mag / reserve: magazine & spare rounds
     spread: radians of random cone
     quiet: suppressed — makes far less noise to enemies
     tracers: tracer visual strength
  ---------------------------------------------------------- */
  const WEAPONS = {
    handgun: {
      id: "handgun", name: "KAR-9", icon: "P9",
      dmg: 34, rof: 4.2, auto: false, mag: 12, reserve: 72,
      spread: 0.018, reloadT: 1.15, quiet: false, tracers: 1,
      kick: 0.35, noise: 26, shake: 1.6,
    },
    smg: {
      id: "smg", name: "KOLOV-7", icon: "SMG",
      dmg: 15, rof: 11, auto: true, mag: 32, reserve: 144,
      spread: 0.05, reloadT: 1.6, quiet: false, tracers: 0.7,
      kick: 0.22, noise: 24, shake: 1.1,
    },
    suppressed: {
      id: "suppressed", name: "VANE SP-8", icon: "SP8",
      dmg: 30, rof: 3.2, auto: false, mag: 10, reserve: 50,
      spread: 0.01, reloadT: 1.3, quiet: true, tracers: 0.35,
      kick: 0.28, noise: 9, shake: 1.0,
    },
    driverPistol: {
      id: "driverPistol", name: "ROSAR .45", icon: "45",
      dmg: 29, rof: 4.8, auto: false, mag: 13, reserve: 65,
      spread: 0.02, reloadT: 1.05, quiet: false, tracers: 1,
      kick: 0.32, noise: 26, shake: 1.5,
    },
    // enemy weapons
    eHandgun: {
      id: "eHandgun", name: "P-12", icon: "EG",
      dmg: 11, rof: 2.4, auto: false, mag: 9, reserve: 99,
      spread: 0.045, reloadT: 1.4, quiet: false, tracers: 0.5,
      kick: 0.3, noise: 20, shake: 0,
    },
    eRifle: {
      id: "eRifle", name: "AK-44", icon: "ER",
      dmg: 17, rof: 3.6, auto: true, mag: 24, reserve: 99,
      spread: 0.055, reloadT: 1.9, quiet: false, tracers: 0.6,
      kick: 0.3, noise: 22, shake: 0,
    },
    eHeavy: {
      id: "eHeavy", name: "RPG-9", icon: "EH",
      dmg: 12, rof: 7.5, auto: true, mag: 40, reserve: 99,
      spread: 0.07, reloadT: 2.2, quiet: false, tracers: 0.5,
      kick: 0.25, noise: 22, shake: 0,
    },
  };

  /* ----------------------------------------------------------
     PLAYABLE CREW (original characters)
     body: width multiplier   height: scale
     ident: character identity color (HUD / selection)
  ---------------------------------------------------------- */
  const CREW = [
    {
      id: "vito", name: "VITO MARSALA", role: "The Leader", key: "1",
      ident: 0x4d7cc7,           // midnight blue
      suit: 0x14151a, shirt: 0xefe9dc, tie: 0x8e1a20, belt: 0x101114,
      skin: 0xc99873, hair: { type: "slick", color: 0x23201d },
      glasses: false, beard: false,
      body: { w: 1.0, h: 1.0, arms: 1.0 },
      speed: 4.3, sprint: 1.28, hp: 110,
      weapon: "handgun",
      ability: "Commander's Calm — rewinds recharge 30% faster",
      abilityType: "regen",
      bio: "Runs the crew like a boardroom. Never raises his voice; the shot does it for him.",
    },
    {
      id: "bruno", name: "BRUNO KESSLER", role: "The Heavy", key: "2",
      ident: 0xe0a53a,           // industrial yellow
      suit: 0x23262e, shirt: 0xd8d2c4, tie: 0x3a3f4a, belt: 0x181a1f,
      skin: 0xb9825c, hair: { type: "buzz", color: 0x2a2320 },
      glasses: false, beard: true, beardType: "full",
      body: { w: 1.3, h: 0.98, arms: 1.28 },
      speed: 3.35, sprint: 1.18, hp: 170,
      weapon: "smg",
      ability: "Iron Frame — takes 25% less damage, but moves slowly",
      abilityType: "armor",
      bio: "Two hundred kilos of borrowed coat. The first in, the last out, the loudest shot.",
    },
    {
      id: "elias", name: "ELIAS VANE", role: "The Ghost", key: "3",
      ident: 0x9aa7b5,           // ghost gray
      suit: 0x98a1ac, shirt: 0xf2f0ea, tie: 0x50575f, belt: 0x3c4046,
      skin: 0xd8b394, hair: { type: "swept", color: 0xcfd4d8 },
      glasses: true, beard: false,
      body: { w: 0.84, h: 1.03, arms: 0.82 },
      speed: 4.9, sprint: 1.42, hp: 80,
      weapon: "suppressed",
      ability: "Silent Work — suppressed rounds barely spook the guard",
      abilityType: "quiet",
      bio: "Gone before the alarm chime finishes. Wears gray so the shadows wear him.",
    },
    {
      id: "rosa", name: "ROSA DELGADO", role: "The Driver", key: "4",
      ident: 0xc1272d,           // dark red
      suit: 0x2b1d14, shirt: 0xe8e2d5, tie: 0x1d1d20, belt: 0x191411,
      leather: true,             // leather jacket instead of suit
      skin: 0xb06f4a, hair: { type: "ponytail", color: 0x191411 },
      glasses: false, beard: false,
      body: { w: 0.95, h: 0.97, arms: 0.9 },
      speed: 5.4, sprint: 1.5, hp: 90,
      weapon: "driverPistol",
      ability: "Outrun It — the fastest legs in the city",
      abilityType: "fast",
      bio: "Knew every alley before the job was planned. If the plan breaks, she's already gone.",
    },
  ];

  /* ----------------------------------------------------------
     ENEMY TYPES
  ---------------------------------------------------------- */
  const ENEMIES = {
    guard: {
      id: "guard", label: "Guard",
      hp: 55, speed: 2.6, weapon: "eHandgun",
      suit: 0x3a3f48, shirt: 0x22262c, belt: 0x22252b,
      skin: 0xc08a63, hair: { type: "buzz", color: 0x1f1b18 },
      body: { w: 1.0, h: 1.0, arms: 1.0 },
      view: 13, dmgMul: 1.0, score: 100,
    },
    rifleman: {
      id: "rifleman", label: "Rifle Guard",
      hp: 70, speed: 2.9, weapon: "eRifle",
      suit: 0x2e333c, shirt: 0x1c2026, belt: 0x1d2026,
      skin: 0xb57e55, hair: { type: "slick", color: 0x14110e },
      body: { w: 1.05, h: 1.02, arms: 1.0 },
      view: 16, dmgMul: 1.0, score: 150,
    },
    heavy: {
      id: "heavy", label: "Heavy",
      hp: 200, speed: 2.0, weapon: "eHeavy",
      suit: 0x272c33, shirt: 0x15181d, belt: 0x191c21, vest: 0x3d4450,
      skin: 0xa9754e, hair: { type: "shaved", color: 0x0f0d0b },
      body: { w: 1.42, h: 1.05, arms: 1.35 },
      view: 12, dmgMul: 1.15, score: 300,
    },
  };

  /* ----------------------------------------------------------
     TUNING
  ---------------------------------------------------------- */
  const TUNING = {
    rewind: {
      window: 5,          // seconds recorded
      sample: 0.1,        // snapshot interval
      cost: 30,           // rewind energy per second scrubbed
      regen: 14,          // energy regen per second
      scrubSpeed: 2.2,    // seconds of game-time scrubbed per real second
    },
    playerRadius: 0.42,
    enemyRadius: 0.42,
    chestY: 1.18,
    chestR: 0.46,
    bulletY: 1.32,
    bulletMaxRange: 42,
    obstacleBulletH: 1.15, // obstacles at least this tall block bullets
    alertRadius: 15,
    alertRadiusQuiet: 7,
    camera: {
      elev: 0.66,         // ~38 degrees
      distMin: 9, distMax: 26, distStart: 15.5,
      follow: 5.5,
    },
    score: { kill: null, objective: 500, timeBonusPerSec: 3, survivor: 250 },
    saveKey: "bloodyheist.save.v1",
  };

  /* ----------------------------------------------------------
     SETTINGS (persisted)
  ---------------------------------------------------------- */
  const SETTINGS = {
    music: 0.5, sfx: 0.8, shake: true, quality: "high",
  };
  const SETTINGS_KEY = "bloodyheist.settings.v1";

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(SETTINGS, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return SETTINGS;
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ }
  }

  root.BH.config = { WEAPONS, CREW, ENEMIES, TUNING, SETTINGS, SETTINGS_KEY, loadSettings, saveSettings };
})();
