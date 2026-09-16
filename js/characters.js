/* ============================================================
   BLOODY HEIST — characters.js
   Procedural stylized-realistic character models (Three.js
   primitives, rigged pivots) + canvas portrait renderer.
   Every crew member & enemy gets distinct proportions,
   clothing, hair, glasses, beard and weapon.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  /* shared geometries */
  const G = {
    sphere: new THREE.SphereGeometry(1, 14, 12),
  };

  function mat(color, { rough = 0.85, metal = 0.02 } = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }

  /* ---------------- weapon builders (group points +Z) ---------------- */
  const WEAPON_BUILDERS = {
    handgun(p) {
      const g = new THREE.Group();
      const m = p.metal;
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.045, 0.16), m);
      slide.position.set(0, 0.045, 0.02);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.10, 0.05), p.dark);
      grip.position.set(0, -0.02, -0.045);
      grip.rotation.x = 0.18;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), m);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.048, 0.11);
      g.add(slide, grip, barrel);
      g.position.set(0, 0.02, 0.04);
      const mz = new THREE.Object3D(); mz.position.set(0, 0.048, 0.15); g.add(mz);
      return { group: g, muzzle: mz, hold: [0.16, 0.34] };
    },
    smg(p) {
      const g = new THREE.Group();
      const m = p.metal;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.3), m);
      body.position.set(0, 0.04, 0.02);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.06), p.dark);
      mag.position.set(0, -0.05, 0.05);
      mag.rotation.x = 0.12;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.14), p.dark);
      stock.position.set(0, 0.02, -0.19);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), m);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.055, 0.21);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.05), p.dark);
      grip.position.set(0, -0.03, -0.1);
      g.add(body, mag, stock, barrel, grip);
      const mz = new THREE.Object3D(); mz.position.set(0, 0.055, 0.28); g.add(mz);
      return { group: g, muzzle: mz, hold: [0.24, 0.42] };
    },
    suppressed(p) {
      const r = WEAPON_BUILDERS.handgun(p);
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.13, 10), p.metal);
      sup.rotation.x = Math.PI / 2;
      sup.position.set(0, 0.048, 0.17);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.02, 10), p.dark);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.048, 0.12);
      r.group.add(sup, ring);
      r.muzzle.position.set(0, 0.048, 0.25);
      return r;
    },
    driverPistol(p) {
      const r = WEAPON_BUILDERS.handgun(p);
      r.group.scale.set(1.1, 1.1, 1.15);
      return r;
    },
    eHandgun(p) { return WEAPON_BUILDERS.handgun(p); },
    eRifle(p) {
      const g = new THREE.Group();
      const m = p.metal;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.46), m);
      body.position.set(0, 0.045, 0.05);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.16, 8), m);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.055, 0.32);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), p.dark);
      mag.position.set(0, -0.04, 0.08);
      mag.rotation.x = 0.45;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.16), p.dark);
      stock.position.set(0, 0.01, -0.21);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.045), p.dark);
      grip.position.set(0, -0.03, -0.09);
      g.add(body, barrel, mag, stock, grip);
      const mz = new THREE.Object3D(); mz.position.set(0, 0.055, 0.42); g.add(mz);
      return { group: g, muzzle: mz, hold: [0.3, 0.5] };
    },
    eHeavy(p) {
      const g = new THREE.Group();
      const m = p.metal;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.34), m);
      body.position.set(0, 0.05, 0.03);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 10), p.dark);
      drum.position.set(0, -0.04, 0.1);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), m);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.06, 0.24);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.14), p.dark);
      stock.position.set(0, 0.02, -0.2);
      g.add(body, drum, barrel, stock);
      const mz = new THREE.Object3D(); mz.position.set(0, 0.06, 0.32); g.add(mz);
      return { group: g, muzzle: mz, hold: [0.26, 0.46] };
    },
  };

  /* ---------------- hair / face builders ---------------- */
  function buildHair(def, headGroup, skinMat, hairColor) {
    const h = def.hair || { type: "slick", color: 0x222222 };
    const hm = mat(h.color, { rough: 0.6 });
    const hair = new THREE.Group();
    const t = h.type;
    if (t === "slick" || t === "buzz" || t === "swept") {
      const cap = new THREE.Mesh(G.sphere, hm);
      const buzz = t === "buzz";
      cap.scale.set(0.148, buzz ? 0.115 : 0.135, 0.148);
      cap.position.set(0, buzz ? 0.045 : 0.055, -0.012);
      hair.add(cap);
      if (t === "swept") {
        const swoop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.05), hm);
        swoop.position.set(0.02, 0.105, 0.075);
        swoop.rotation.z = -0.22;
        hair.add(swoop);
      }
    } else if (t === "shaved") {
      // close-cropped side patches
      const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.09), hm);
      side1.position.set(-0.132, 0.01, -0.01);
      const side2 = side1.clone(); side2.position.x = 0.132;
      hair.add(side1, side2);
    } else if (t === "ponytail") {
      const cap = new THREE.Mesh(G.sphere, hm);
      cap.scale.set(0.148, 0.13, 0.148);
      cap.position.set(0, 0.055, -0.015);
      hair.add(cap);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), hm);
      tail.position.set(0, -0.09, -0.14);
      tail.rotation.x = 0.12;
      hair.add(tail);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 10), mat(0x333333));
      tie.position.set(0, 0.01, -0.135);
      hair.add(tie);
    }
    headGroup.add(hair);
  }

  function buildFace(def, headGroup, skinMat, hairColor) {
    const eyeM = mat(0x181412, { rough: 0.3 });
    const eyeL = new THREE.Mesh(G.sphere, eyeM);
    eyeL.scale.setScalar(0.016);
    eyeL.position.set(-0.047, 0.02, 0.118);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.047;
    headGroup.add(eyeL, eyeR);

    // nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.03), skinMat);
    nose.position.set(0, -0.015, 0.128);
    headGroup.add(nose);

    // mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.01), mat(0x7c4a3a, { rough: 0.6 }));
    mouth.position.set(0, -0.072, 0.115);
    headGroup.add(mouth);

    // eyebrows (stern)
    const browM = mat(def.hair ? def.hair.color : 0x222222, { rough: 0.6 });
    const bw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.012), browM);
    bw.position.set(-0.047, 0.052, 0.12);
    bw.rotation.z = 0.18;
    const bw2 = bw.clone(); bw2.position.x = 0.047; bw2.rotation.z = -0.18;
    headGroup.add(bw, bw2);

    if (def.glasses) {
      const glM = mat(0x0c0d10, { rough: 0.15, metal: 0.4 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.05, 0.014), glM);
      bar.position.set(0, 0.018, 0.125);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.05), glM);
      l.position.set(-0.09, 0.018, 0.11);
      const r = l.clone(); r.position.x = 0.09;
      headGroup.add(bar, l, r);
    }

    if (def.beard) {
      const bM = mat(def.hair ? def.hair.color : 0x222222, { rough: 0.75 });
      const jaw = new THREE.Mesh(G.sphere, bM);
      jaw.scale.set(0.125, 0.09, 0.09);
      jaw.position.set(0, -0.075, 0.055);
      headGroup.add(jaw);
      const stache = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), bM);
      stache.position.set(0, -0.045, 0.125);
      headGroup.add(stache);
    }
  }

  /* ============================================================
     buildCharacterModel(def, weaponId)
     def: { body:{w,h,arms}, suit, shirt, tie, belt, leather,
           skin, hair, glasses, beard, vest, enemy?, ident }
     returns { group, parts }
  ============================================================ */
  function buildCharacterModel(def, weaponId) {
    const w = def.body.w, h = def.body.h, aw = def.body.arms;
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);

    const mats = {};
    mats.suit = mat(def.suit, { rough: def.leather ? 0.55 : 0.88 });
    mats.shirt = mat(def.shirt || 0xf0ebe0, { rough: 0.9 });
    mats.skin = mat(def.skin || 0xc99873, { rough: 0.62 });
    mats.pants = mat(def.suit, { rough: 0.9 });
    mats.shoe = mat(0x0c0c0e, { rough: 0.35, metal: 0.15 });
    mats.belt = mat(def.belt || 0x14161a, { rough: 0.5, metal: 0.2 });
    mats.metal = mat(0x2a2d33, { rough: 0.32, metal: 0.85 });
    mats.dark = mat(0x111216, { rough: 0.5, metal: 0.3 });
    mats.tie = mat(def.tie || 0x8e1a20, { rough: 0.7 });
    if (def.vest) mats.vest = mat(def.vest, { rough: 0.7 });

    /* ---------- legs ---------- */
    const hipY = 0.92 * h;
    function makeLeg(side) { // side: -1 left, +1 right
      const pivot = new THREE.Group();
      pivot.position.set(0.115 * w * side, hipY, 0);
      body.add(pivot);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * aw, 0.3, 4, 10), mats.pants);
      thigh.position.y = -0.21;
      thigh.scale.set(w, 1, w * 0.95);
      pivot.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.42;
      pivot.add(knee);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * aw, 0.3, 4, 10), mats.pants);
      shin.position.y = -0.2;
      shin.scale.set(w, 1, w * 0.95);
      knee.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11 * w, 0.08, 0.24), mats.shoe);
      shoe.position.set(0, -0.445, 0.05);
      knee.add(shoe);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.11 * w, 0.05, 0.08), mats.shoe);
      toe.position.set(0, -0.462, 0.15);
      knee.add(toe);
      return { pivot, knee };
    }
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    /* ---------- torso ---------- */
    const torso = new THREE.Group();
    torso.position.y = 0.98 * h;
    torso.userData.baseY = 0.98 * h;
    body.add(torso);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34 * w, 0.2, 0.21), mats.pants);
    pelvis.position.y = -0.02;
    torso.add(pelvis);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42 * w, 0.5, 0.25), mats.suit);
    chest.position.y = 0.33;
    torso.add(chest);

    // tapered shoulders
    const shPadL = new THREE.Mesh(G.sphere, mats.suit);
    shPadL.scale.set(0.095 * aw, 0.08, 0.095 * aw);
    shPadL.position.set(-0.215 * w, 0.55, 0);
    const shPadR = shPadL.clone(); shPadR.position.x = 0.215 * w;
    torso.add(shPadL, shPadR);

    // shirt + tie (front)
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 0.02), mats.shirt);
    shirt.position.set(0, 0.4, 0.125);
    torso.add(shirt);
    if (!def.leather) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.015), mats.tie);
      tie.position.set(0, 0.32, 0.14);
      tie.rotation.x = 0.06;
      torso.add(tie);
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), mats.tie);
      knot.position.set(0, 0.485, 0.135);
      torso.add(knot);
    }
    // lapels
    const lapL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.015), mats.suit);
    lapL.position.set(-0.09, 0.4, 0.132);
    lapL.rotation.z = 0.12;
    const lapR = lapL.clone(); lapR.position.x = 0.09; lapR.rotation.z = -0.12;
    torso.add(lapL, lapR);
    // jacket hem
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.44 * w, 0.14, 0.27), mats.suit);
    hem.position.y = 0.02;
    torso.add(hem);
    // belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36 * w, 0.06, 0.23), mats.belt);
    belt.position.y = 0.1;
    torso.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), mats.metal);
    buckle.position.set(0, 0.1, 0.12);
    torso.add(buckle);

    if (def.vest) {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.4 * w, 0.36, 0.06), mats.vest);
      vest.position.set(0, 0.36, 0.15);
      torso.add(vest);
      for (let i = -1; i <= 1; i += 2) {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), mats.dark);
        pouch.position.set(i * 0.1, 0.3, 0.185);
        torso.add(pouch);
      }
    }
    if (def.enemy) {
      // red armband on left upper arm
      const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.13), mat(0x8e1a20, { rough: 0.7 }));
      arm1.position.set(-0.215 * w, 0.48, 0);
      arm1.rotation.z = 0.1;
      torso.add(arm1);
    }

    /* ---------- arms ---------- */
    function makeArm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.245 * w * side, 0.47, 0);
      torso.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055 * aw, 0.2, 4, 10), mats.suit);
      upper.position.y = -0.13;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.27;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048 * aw, 0.19, 4, 10), mats.suit);
      fore.position.y = -0.115;
      elbow.add(fore);
      // shirt cuff
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * aw, 0.05 * aw, 0.03, 8), mats.shirt);
      cuff.position.y = -0.215;
      elbow.add(cuff);
      const hand = new THREE.Mesh(G.sphere, mats.skin);
      hand.scale.set(0.045 * aw, 0.05 * aw, 0.05 * aw);
      hand.position.y = -0.25;
      elbow.add(hand);
      return { shoulder, elbow, hand };
    }
    const armL = makeArm(-1);
    const armR = makeArm(1);

    /* ---------- head ---------- */
    const head = new THREE.Group();
    head.position.y = 0.75;
    torso.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.18, 10), mats.skin);
    neck.position.y = -0.085;
    head.add(neck);
    // jacket collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.07, 10), mats.suit);
    collar.position.y = -0.115;
    head.add(collar);
    const skull = new THREE.Mesh(G.sphere, mats.skin);
    skull.scale.set(0.128, 0.148, 0.128);
    skull.position.y = 0.12;
    head.add(skull);
    const jaw = new THREE.Mesh(G.sphere, mats.skin);
    jaw.scale.set(0.105, 0.085, 0.1);
    jaw.position.set(0, 0.045, 0.028);
    head.add(jaw);
    const earL = new THREE.Mesh(G.sphere, mats.skin);
    earL.scale.setScalar(0.024);
    earL.position.set(-0.125, 0.11, 0);
    const earR = earL.clone(); earR.position.x = 0.125;
    head.add(earL, earR);
    buildFace(def, head, mats.skin, def.hair ? def.hair.color : 0x222222);
    buildHair(def, head, mats.skin, def.hair ? def.hair.color : 0x222222);

    /* ---------- weapon in right hand ---------- */
    const wp = WEAPON_BUILDERS[weaponId] || WEAPON_BUILDERS.handgun;
    const built = wp({ metal: mats.metal, dark: mats.dark });
    const weapon = built.group;
    weapon.position.set(0, -0.25, 0.045);
    armR.elbow.add(weapon);
    // left hand support point (aim pose)
    const support = new THREE.Object3D();
    support.position.set(0, -0.25, 0.045);
    armL.elbow.add(support);

    /* ---------- soft blob shadow ---------- */
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42 * w, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.015;
    group.add(blob);

    // shadows
    const casters = [chest, pelvis, skull, jaw, hem];
    body.traverse(o => {
      if (o.isMesh) {
        o.castShadow = o === chest || o === pelvis || o === skull || o === jaw || o === hem ||
          (o.geometry && o.geometry.type === "CapsuleGeometry");
        o.receiveShadow = false;
      }
    });

    const parts = {
      body, torso, head,
      legL: legL.pivot, legR: legR.pivot, kneeL: legL.knee, kneeR: legR.knee,
      armL: armL.shoulder, armR: armR.shoulder, elbowL: armL.elbow, elbowR: armR.elbow,
      handL: armL.hand, handR: armR.hand,
      weapon, muzzle: built.muzzle,
      blob, mats,
    };
    group.userData.parts = parts;
    return { group, parts };
  }

  /* ============================================================
     Pose animator — called every frame with a state object.
     anim: { t, walkPhase, walkSpeed(0..1), moving, aiming, recoil,
             hitT, dead, deathT, win, winT, reload }
  ============================================================ */
  function animateModel(parts, anim) {
    const { body, torso, head, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, weapon } = parts;
    const t = anim.t || 0;
    const ph = anim.walkPhase || 0;
    const ws = anim.moving ? (anim.walkSpeed || 0.5) : 0;

    if (anim.dead) {
      // fall backwards (rotate about X, -Z is behind)
      const k = U.clamp((anim.deathT || 0) / 0.6, 0, 1);
      const e = U.easeOutCubic(k);
      body.rotation.x = -1.48 * e;
      body.position.y = Math.sin(k * Math.PI) * 0.18;
      if (k < 1) {
        legL.rotation.x = 0.35 * e; legR.rotation.x = 0.25 * e;
        armL.rotation.x = -0.5 * e; armR.rotation.x = -0.5 * e;
      }
      torso.rotation.z = 0.1 * e;
      return;
    }

    if (anim.win) {
      const wt = anim.winT || 0;
      body.rotation.x = 0;
      body.position.y = Math.abs(Math.sin(wt * 5)) * 0.12 * Math.exp(-wt * 0.4);
      armL.rotation.x = -2.7; armR.rotation.x = -2.7;
      armL.rotation.z = 0.5 + Math.sin(wt * 6) * 0.25;
      armR.rotation.z = -0.5 - Math.sin(wt * 6) * 0.25;
      elbowL.rotation.x = -0.4; elbowR.rotation.x = -0.4;
      legL.rotation.x = 0; legR.rotation.x = 0;
      kneeL.rotation.x = 0; kneeR.rotation.x = 0;
      torso.rotation.z = Math.sin(wt * 5) * 0.06;
      head.rotation.y = Math.sin(wt * 3) * 0.3;
      return;
    }

    /* --- gait --- */
    const amp = 0.62 * ws;
    legL.rotation.x = Math.sin(ph) * amp;
    legR.rotation.x = -Math.sin(ph) * amp;
    kneeL.rotation.x = Math.max(0, Math.sin(ph - 1.4)) * 0.85 * ws;
    kneeR.rotation.x = Math.max(0, Math.sin(ph - 1.4 + Math.PI)) * 0.85 * ws;
    // torso bob & sway
    torso.position.y = (parts.torso.userData.baseY || 0.98) + Math.abs(Math.cos(ph)) * 0.028 * ws;
    torso.rotation.z = Math.sin(ph) * 0.035 * ws;
    torso.rotation.x = 0.06 * ws + (anim.hitT || 0) * 0.18;

    /* --- arms: walk swing, or aim pose --- */
    let Lx, Rx, Lz, Rz, Lb, Rb;
    if (anim.aiming) {
      // both hands on the weapon
      Lx = -1.25; Rx = -1.38; Lz = -0.28; Rz = 0.14; Lb = -0.45; Rb = -0.18;
      if (anim.reload) { Rx += 0.7; Rz += 0.55; Rb += 0.8; Lx += 0.4; }
    } else {
      Lx = -Math.sin(ph) * 0.5 * ws; Rx = Math.sin(ph) * 0.5 * ws;
      Lz = 0.07; Rz = -0.07; Lb = 0.12; Rb = 0.12;
      Rx += Math.sin(t * 1.7) * 0.02; // idle sway
    }
    // hit flinch
    if (anim.hitT > 0) { Rx -= anim.hitT * 0.4; Lx -= anim.hitT * 0.3; }
    const rec = anim.recoil || 0;
    Rx += rec * 0.34;

    const k = 1 - Math.exp(-14 * (anim.dt || 0.016));
    armL.rotation.x += (Lx - armL.rotation.x) * k;
    armR.rotation.x += (Rx - armR.rotation.x) * k;
    armL.rotation.z += (Lz - armL.rotation.z) * k;
    armR.rotation.z += (Rz - armR.rotation.z) * k;
    elbowL.rotation.x += (Lb - elbowL.rotation.x) * k;
    elbowR.rotation.x += (Rb - elbowR.rotation.x) * k;

    // head: subtle tracking + idle
    head.rotation.x = U.damp(head.rotation.x, anim.aiming ? -0.06 : 0, 8, anim.dt || 0.016) + (anim.hitT || 0) * 0.2;
    head.rotation.y = Math.sin(t * 0.9) * 0.05 * (1 - ws);
    if (anim.hitT > 0) head.rotation.x -= anim.hitT * 0.25;

    // breathing
    torso.scale.y = 1 + Math.sin(t * 2.1) * 0.008;
    body.rotation.x = 0.045 * ws;
    body.rotation.z = 0;

    // weapon drop when not aiming
    const targetDrop = anim.aiming ? 0 : 0.55;
    weapon.rotation.x += (targetDrop - weapon.rotation.x) * k;
    weapon.rotation.z = 0;
  }

  /* ============================================================
     Canvas portrait (HUD cards / briefing roster)
  ============================================================ */
  function drawPortrait(canvas, def, weaponId) {
    const S = canvas.width; // assume square canvas
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, S, S);
    // bg
    const bg = c.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.72);
    bg.addColorStop(0, "#1c2027");
    bg.addColorStop(1, "#08090c");
    c.fillStyle = bg;
    c.fillRect(0, 0, S, S);
    // identity arc
    c.strokeStyle = U.hexA(def.ident, 0.9);
    c.lineWidth = S * 0.02;
    c.beginPath();
    c.arc(S * 0.5, S * 0.5, S * 0.42, -Math.PI * 0.85, Math.PI * 0.35);
    c.stroke();
    c.strokeStyle = U.hexA(def.ident, 0.25);
    c.beginPath();
    c.arc(S * 0.5, S * 0.5, S * 0.42, Math.PI * 0.35, Math.PI * 1.15);
    c.stroke();

    const cx = S * 0.5;
    // shoulders (suit)
    c.fillStyle = "#" + def.suit.toString(16).padStart(6, "0");
    c.beginPath();
    c.moveTo(cx - S * 0.34, S);
    c.quadraticCurveTo(cx - S * 0.36, S * 0.78, cx - S * 0.22, S * 0.72);
    c.lineTo(cx + S * 0.22, S * 0.72);
    c.quadraticCurveTo(cx + S * 0.36, S * 0.78, cx + S * 0.34, S);
    c.closePath();
    c.fill();
    // shirt V
    c.fillStyle = "#" + (def.shirt || 0xf0ebe0).toString(16).padStart(6, "0");
    c.beginPath();
    c.moveTo(cx - S * 0.1, S * 0.72);
    c.lineTo(cx, S * 0.86);
    c.lineTo(cx + S * 0.1, S * 0.72);
    c.closePath();
    c.fill();
    // tie
    if (!def.leather && def.tie) {
      c.fillStyle = "#" + def.tie.toString(16).padStart(6, "0");
      c.beginPath();
      c.moveTo(cx - S * 0.028, S * 0.73);
      c.lineTo(cx + S * 0.028, S * 0.73);
      c.lineTo(cx + S * 0.016, S * 0.85);
      c.lineTo(cx, S * 0.9);
      c.lineTo(cx - S * 0.016, S * 0.85);
      c.closePath();
      c.fill();
    }
    // lapels
    c.fillStyle = U.hexA(0xffffff, 0.07);
    c.beginPath();
    c.moveTo(cx - S * 0.2, S * 0.72); c.lineTo(cx - S * 0.1, S * 0.72); c.lineTo(cx - S * 0.16, S * 0.92);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(cx + S * 0.2, S * 0.72); c.lineTo(cx + S * 0.1, S * 0.72); c.lineTo(cx + S * 0.16, S * 0.92);
    c.closePath(); c.fill();

    // neck
    c.fillStyle = "#" + (def.skin || 0xc99873).toString(16).padStart(6, "0");
    c.fillRect(cx - S * 0.06, S * 0.6, S * 0.12, S * 0.14);
    // head
    c.beginPath();
    c.ellipse(cx, S * 0.44, S * 0.155, S * 0.185, 0, 0, Math.PI * 2);
    c.fill();
    // hair
    c.fillStyle = "#" + (def.hair ? def.hair.color : 0x222222).toString(16).padStart(6, "0");
    const ht = def.hair ? def.hair.type : "slick";
    c.beginPath();
    if (ht === "ponytail") {
      c.ellipse(cx, S * 0.375, S * 0.16, S * 0.1, 0, Math.PI, Math.PI * 2);
      c.fill();
      c.fillRect(cx - S * 0.02, S * 0.3, S * 0.05, S * 0.34); // tail over shoulder
    } else if (ht === "shaved") {
      c.rect(cx - S * 0.165, S * 0.36, S * 0.045, S * 0.08);
      c.rect(cx + S * 0.12, S * 0.36, S * 0.045, S * 0.08);
    } else {
      c.ellipse(cx, S * 0.365, S * 0.162, ht === "buzz" ? S * 0.075 : S * 0.105, 0, Math.PI, Math.PI * 2);
    }
    c.fill();
    // brows
    c.strokeStyle = c.fillStyle;
    c.lineWidth = S * 0.016;
    c.beginPath(); c.moveTo(cx - S * 0.115, S * 0.415); c.lineTo(cx - S * 0.045, S * 0.4); c.stroke();
    c.beginPath(); c.moveTo(cx + S * 0.115, S * 0.415); c.lineTo(cx + S * 0.045, S * 0.4); c.stroke();
    // eyes / glasses
    if (def.glasses) {
      c.fillStyle = "#0b0c10";
      c.fillRect(cx - S * 0.115, S * 0.42, S * 0.105, S * 0.05);
      c.fillRect(cx + S * 0.01, S * 0.42, S * 0.105, S * 0.05);
      c.fillRect(cx - S * 0.015, S * 0.435, S * 0.03, S * 0.008);
    } else {
      c.fillStyle = "#14100d";
      c.beginPath(); c.ellipse(cx - S * 0.078, S * 0.445, S * 0.018, S * 0.022, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx + S * 0.078, S * 0.445, S * 0.018, S * 0.022, 0, 0, Math.PI * 2); c.fill();
    }
    // nose & mouth
    c.strokeStyle = U.hexA(0x000000, 0.25);
    c.lineWidth = S * 0.012;
    c.beginPath(); c.moveTo(cx, S * 0.47); c.lineTo(cx, S * 0.52); c.stroke();
    c.beginPath(); c.moveTo(cx - S * 0.035, S * 0.575); c.lineTo(cx + S * 0.035, S * 0.575); c.stroke();
    // beard
    if (def.beard) {
      c.fillStyle = c.fillStyle;
      c.fillStyle = "#" + (def.hair ? def.hair.color : 0x222222).toString(16).padStart(6, "0");
      c.beginPath();
      c.ellipse(cx, S * 0.56, S * 0.11, S * 0.075, 0, 0, Math.PI);
      c.fill();
      c.fillRect(cx - S * 0.055, S * 0.545, S * 0.11, S * 0.02);
    }
    // vignette
    const vg = c.createRadialGradient(cx, S * 0.5, S * 0.3, cx, S * 0.5, S * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = vg;
    c.fillRect(0, 0, S, S);
  }

  /* shared "!" alert sprite texture */
  let _alertTex = null;
  function getAlertTexture() {
    if (_alertTex) return _alertTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = "900 46px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,64,52,0.95)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(255,72,60,0.98)";
    ctx.fillText("!", 32, 34);
    _alertTex = new THREE.CanvasTexture(c);
    return _alertTex;
  }

  /** name tag texture for the active character label */
  function makeNameLabelTexture(name, colorHex) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "rgba(8,10,14,0.78)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(30, 12, 196, 40, 8);
    else ctx.rect(30, 12, 196, 40);
    ctx.fill();
    ctx.strokeStyle = U.hexA(colorHex, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "700 24px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#" + (colorHex >>> 0).toString(16).padStart(6, "0");
    ctx.fillText(name.toUpperCase(), 128, 33);
    return new THREE.CanvasTexture(c);
  }

  root.BH.Characters = { buildCharacterModel, animateModel, drawPortrait, getAlertTexture, makeNameLabelTexture };
})();
