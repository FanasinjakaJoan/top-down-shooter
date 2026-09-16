/* ============================================================
   BLOODY HEIST — weapons.js
   Shared hitscan firing: spread, raycast vs obstacles &
   actors, damage, tracers, impacts, reloads.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  const W = {};

  /** world-space muzzle point of the actor */
  function muzzleOf(actor, out) {
    // ensure world matrices are fresh (headless tests have no render loop)
    actor.group.updateMatrixWorld(true);
    actor.parts.muzzle.getWorldPosition(out);
    return out;
  }

  /**
   * Fire one shot from `actor` at world point `aim` (Vector3).
   * opts: { aimOffset: extra random spread, friendlyFire }
   * returns { hitActor, hitPoint } or null when it can't fire.
   */
  W.tryFire = function (actor, aim, opts = {}) {
    const game = actor.game;
    const w = actor.weapon;
    if (!actor.alive || w.cd > 0 || w.reloadT > 0) return null;
    if (w.mag <= 0) {
      if (!w.autoEmpty) {
        w.autoEmpty = true;
        game.audio && game.audio.empty();
        actor.startReload();
      }
      return null;
    }
    w.autoEmpty = false;
    w.mag--;
    w.cd = 1 / w.def.rof;
    actor.anim.recoil = 1;

    const T = root.BH.config.TUNING;
    const from = muzzleOf(actor, new THREE.Vector3());
    const to = new THREE.Vector3(aim.x, T.chestY, aim.z);
    let dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    // spread: small random cone around the aim direction
    const spread = w.def.spread + (opts.extraSpread || 0);
    if (spread > 0) {
      const s = (Math.random() * 2 - 1) * spread;
      const sa = Math.sin(s), ca = Math.cos(s);
      const nx = dx * ca - dz * sa, nz = dx * sa + dz * ca;
      dx = nx; dz = nz;
      dy += (Math.random() * 2 - 1) * spread * 0.5;
      const nl = Math.hypot(dx, dy, dz);
      dx /= nl; dy /= nl; dz /= nl;
    }

    // --- find nearest obstacle hit ---
    let bestT = T.bulletMaxRange;
    let hitObstacle = null;
    for (const ob of game.world.obstacles) {
      if (ob.h < T.obstacleBulletH) continue;
      const t = U.rayAABB2D(from.x, from.z, dx, dz, ob.min.x, ob.min.z, ob.max.x, ob.max.z);
      if (t > 0.05 && t < bestT) { bestT = t; hitObstacle = ob; }
    }
    // --- find nearest actor hit (opposing team) ---
    let hitActor = null;
    for (const a of game.actors) {
      if (!a.alive || a.team === actor.team) continue;
      const t = U.raySphere(from.x, from.y, from.z, dx, dy, dz,
        a.pos.x, T.chestY, a.pos.z, T.chestR);
      if (t > 0.05 && t < bestT) {
        bestT = t;
        hitActor = a;
        hitObstacle = null;
      }
    }
    // --- security cameras (bank) are destructible too ---
    let hitCam = null;
    const cams = game.cameras || [];
    for (const cam of cams) {
      if (!cam.alive) continue;
      const t = U.raySphere(from.x, from.y, from.z, dx, dy, dz, cam.x, cam.y, cam.z, 0.55);
      if (t > 0.05 && t < bestT) {
        bestT = t;
        hitCam = cam;
        hitActor = null;
        hitObstacle = null;
      }
    }

    const hitPoint = new THREE.Vector3(
      from.x + dx * bestT, from.y + dy * bestT, from.z + dz * bestT
    );

    // --- effects & audio ---
    const fx = game.effects;
    if (fx) {
      fx.muzzleFlash(from, new THREE.Vector3(-dx, 0, -dz), w.def);
      fx.tracer(from, hitPoint, w.def.quiet ? 0x8fb8dd : 0xffd27a, w.def.tracers);
    }
    if (game.audio) game.audio.shoot(w.def.id);
    if (actor.team === 0) game.camera && game.camera.shake(w.def.shake * 0.5);

    // --- damage ---
    let killed = false;
    if (hitCam) {
      hitCam.hp -= w.def.dmg;
      if (fx) fx.sparks(hitPoint, new THREE.Vector3(-dx, 0, -dz), 10, 0x9fc4e8);
      if (hitCam.hp <= 0) {
        hitCam.alive = false;
        hitCam.head.visible = false;
        if (game.audio) game.audio.cameraBreak();
        game.onCameraDestroyed && game.onCameraDestroyed(hitCam);
      }
    }
    if (hitActor) {
      killed = hitActor.takeDamage(w.def.dmg, from.x, from.z, actor);
      game.onActorHit && game.onActorHit(actor, hitActor, killed, hitPoint);
    } else if (hitObstacle) {
      if (fx) {
        const onMetal = hitObstacle.type === "barrel" || hitObstacle.type === "container" || hitObstacle.type === "car";
        fx.sparks(hitPoint, new THREE.Vector3(-dx, 0, -dz), 6, onMetal ? 0xffe9b0 : 0xcfc4ae);
        fx.decal(hitPoint, hitObstacle.type === "floor" ? 0x000000 : 0x14110c, 0.9);
      }
    } else {
      // walked off into the void — floor impact
      if (fx) fx.decal(hitPoint, 0x14110c, 0.9);
    }

    // enemies hear this
    game.onShotFired && game.onShotFired(actor, from, w.def);

    if (w.mag <= 0) actor.startReload();

    return { hitActor, killed, hitPoint };
  };

  root.BH.weapons = W;
})();
