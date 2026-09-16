/* ============================================================
   BLOODY HEIST — actor.js
   Base actor: movement + collision, facing, health, weapon
   state, animation state, snapshot/restore for the rewind.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  let NEXT_ID = 1;

  class Actor {
    constructor(game, def, weaponId, opts = {}) {
      this.game = game;
      this.id = NEXT_ID++;
      this.def = def;
      this.team = opts.team || 0;               // 0 players, 1 enemies
      this.name = def.name || def.label || "ACTOR";
      this.ident = def.ident || 0x888888;
      this.speed = def.speed || 4;
      this.sprintMul = def.sprint || 1;
      this.radius = opts.radius || (this.team === 0 ? 0.42 : 0.42);
      this.dmgMul = def.dmgMul || 1;
      this.armor = def.abilityType === "armor" ? 0.75 : 1;

      this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
      this.heading = opts.heading || 0;
      this._vel = new THREE.Vector3();
      this.maxHp = def.hp || 100;
      this.hp = this.maxHp;
      this.alive = true;
      this.deathT = 0;

      this.weapon = {
        def: root.BH.config.WEAPONS[weaponId],
        mag: root.BH.config.WEAPONS[weaponId].mag,
        reserve: root.BH.config.WEAPONS[weaponId].reserve,
        cd: 0,
        reloadT: 0,
        firing: false,
      };

      this.anim = {
        t: Math.random() * 10,
        walkPhase: 0,
        walkSpeed: 0,
        moving: false,
        aiming: false,
        recoil: 0,
        hitT: 0,
        dead: false,
        deathT: 0,
        win: false,
        winT: 0,
        reload: false,
        dt: 0.016,
      };

      // model
      const built = root.BH.Characters.buildCharacterModel(def, weaponId);
      this.group = built.group;
      this.parts = built.parts;
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.heading;
      this.sceneRoot = opts.scene || (game && game.scene);
      if (this.sceneRoot) this.sceneRoot.add(this.group);

      this._muzzle = new THREE.Vector3();
      this._stainDone = false;
      this.stepT = 0;
      this.rewindEnergy = 100;        // players only, but harmless on enemies
    }

    setScene(scene) { this.sceneRoot = scene; }

    muzzleWorld(out) {
      this.parts.muzzle.getWorldPosition(out || this._muzzle);
      return this._muzzle;
    }

    /* ---------------- movement ---------------- */
    /**
     * input: {x, z} world-space unit-ish direction
     * returns actual speed (m/s) this frame
     */
    move(dt, input, sprint) {
      if (!this.alive) { this._vel.set(0, 0, 0); return 0; }
      const sp = this.speed * (sprint ? this.sprintMul : 1);
      let tx = 0, tz = 0;
      if (input) {
        tx = input.x * sp;
        tz = input.z * sp;
        const l = Math.hypot(tx, tz);
        if (l > sp) { tx = tx / l * sp; tz = tz / l * sp; }
      }
      const k = 1 - Math.exp(-12 * dt);
      this._vel.x += (tx - this._vel.x) * k;
      this._vel.z += (tz - this._vel.z) * k;

      const nx = this.pos.x + this._vel.x * dt;
      const nz = this.pos.z + this._vel.z * dt;
      if (this.game.world) {
        this.game.world.resolveCircle(this.pos, nx, nz, this.radius);
      } else {
        this.pos.x = nx; this.pos.z = nz;
      }
      this.group.position.set(this.pos.x, 0, this.pos.z);

      const spd = Math.hypot(this._vel.x, this._vel.z);
      this.anim.moving = spd > 0.4;
      this.anim.walkSpeed = U.clamp(spd / (this.speed * 1.4), 0, 1);
      if (this.anim.moving) {
        this.anim.walkPhase += dt * (6 + 7 * this.anim.walkSpeed);
        // footsteps
        this.stepT -= dt * (1 + this.anim.walkSpeed * 1.2);
        if (this.stepT <= 0 && this.game.audio) {
          this.stepT = 0.42 / (0.7 + this.anim.walkSpeed);
          this.game.audio.step(sprint);
        }
        // dust when sprinting
        if (sprint && this.anim.walkSpeed > 0.55 && Math.random() < dt * 6 && this.game.effects) {
          this.game.effects.puff(new THREE.Vector3(this.pos.x, 0.06, this.pos.z), "dust");
        }
      }
      return spd;
    }

    faceToward(x, z, dt, turnSpeed) {
      const target = U.angleTo(this.pos.x, this.pos.z, x, z);
      const ts = turnSpeed || 11;
      this.heading = U.approachAngle(this.heading, target, ts * dt);
      this.group.rotation.y = this.heading;
    }

    /* ---------------- damage ---------------- */
    takeDamage(dmg, fromX, fromZ, source) {
      if (!this.alive) return false;
      dmg *= this.armor;
      this.hp -= dmg;
      this.anim.hitT = 1;
      // flash materials
      for (const key of ["suit", "shirt", "skin", "pants"]) {
        const m = this.parts.mats[key];
        if (m) m.emissive.setHex(0x661014);
        if (m) m.emissiveIntensity = 0.9;
      }
      // blood
      if (this.game.effects) {
        this.game.effects.blood(new THREE.Vector3(this.pos.x, 1.2, this.pos.z),
          new THREE.Vector3(-(fromX - this.pos.x), 0, -(fromZ - this.pos.z)).normalize(), 9);
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.die(source);
        return true;
      }
      this.onDamaged && this.onDamaged(dmg, fromX, fromZ);
      return false;
    }

    die(source) {
      if (!this.alive) return;
      this.alive = false;
      this.anim.dead = true;
      this.anim.deathT = 0;
      this.anim.aiming = false;
      this.anim.moving = false;
      if (this.game.audio) this.game.audio.kill();
      this.onDeath && this.onDeath(source);
    }

    /* ---------------- per-frame update ---------------- */
    update(dt) {
      this.anim.t += dt;
      this.anim.dt = dt;
      this.anim.hitT = Math.max(0, this.anim.hitT - dt * 3.2);
      this.anim.recoil = Math.max(0, this.anim.recoil - dt * 5);
      this.weapon.cd = Math.max(0, this.weapon.cd - dt);

      // reload
      if (this.weapon.reloadT > 0) {
        this.weapon.reloadT -= dt;
        this.anim.reload = true;
        if (this.weapon.reloadT <= 0) {
          this.anim.reload = false;
          const need = this.weapon.def.mag - this.weapon.mag;
          const take = Math.min(need, this.weapon.reserve);
          this.weapon.mag += take;
          this.weapon.reserve -= take;
          if (this.game.audio) this.game.audio.reload(false);
        }
      } else {
        this.anim.reload = false;
      }

      if (this.alive) {
        // decay hit flash
        if (this.anim.hitT <= 0) {
          for (const key in this.parts.mats) {
            const m = this.parts.mats[key];
            if (m.emissive && m.emissiveIntensity > 0) m.emissiveIntensity = 0;
          }
        }
      } else {
        this.anim.deathT += dt;
        // stain the body after a while
        if (!this._stainDone && this.anim.deathT > 5) {
          this._stainDone = true;
          this.parts.mats.suit.color.multiplyScalar(0.55);
          this.parts.mats.shirt.color.multiplyScalar(0.55);
          if (this.game.effects) this.game.effects.decal(this.pos, 0x2a0708, 2.2);
        }
      }

      root.BH.Characters.animateModel(this.parts, this.anim);
    }

    startReload() {
      const w = this.weapon;
      if (w.reloadT > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
      w.reloadT = w.def.reloadT;
      this.game.audio && this.game.audio.reload(true);
    }

    /* ---------------- rewind snapshots ---------------- */
    snapshot() {
      return {
        x: this.pos.x, z: this.pos.z, heading: this.heading,
        hp: this.hp, alive: this.alive, deathT: this.anim.deathT,
        mag: this.weapon.mag, reserve: this.weapon.reserve,
        reloadT: this.weapon.reloadT,
        walkPhase: this.anim.walkPhase,
        win: this.anim.win, winT: this.anim.winT,
      };
    }
    restore(s) {
      this.pos.set(s.x, 0, s.z);
      this.group.position.copy(this.pos);
      this.heading = s.heading;
      this.group.rotation.y = s.heading;
      this.hp = s.hp;
      this.weapon.mag = s.mag;
      this.weapon.reserve = s.reserve;
      this.weapon.reloadT = s.reloadT;
      this.anim.walkPhase = s.walkPhase;
      this.anim.win = s.win;
      this.anim.winT = s.winT || 0;
      if (s.alive && !this.alive) {
        // resurrect
        this.alive = true;
        this.anim.dead = false;
        this.anim.deathT = 0;
        this.group.rotation.x = 0;
        this.parts.body.rotation.x = 0;
        this.parts.body.position.y = 0;
        this._stainDone = false;
        // restore colors
        const d = this.def;
        this.parts.mats.suit.color.setHex(d.suit);
        this.parts.mats.shirt.color.setHex(d.shirt || 0xf0ebe0);
        this.parts.mats.pants.color.setHex(d.suit);
      } else if (!s.alive) {
        if (!this.alive) { this.anim.deathT = Math.min(s.deathT, 1.2); }
        else this.die();
      }
    }
  }

  root.BH.Actor = Actor;
})();
