/* ============================================================
   BLOODY HEIST — player.js
   Playable crew member. Active character is driven by the
   player (WASD + mouse). Inactive allies follow and
   auto-engage (simple tactical orders system).
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class Player extends root.BH.Actor {
    constructor(game, crewDef, index, spawn) {
      super(game, crewDef, crewDef.weapon, { team: 0, x: spawn[0], z: spawn[1] });
      this.index = index;
      this.rewindEnergy = 100;
      this.regenMul = crewDef.abilityType === "regen" ? 1.3 : 1;
      this._allyFireT = 0;
      this._allyTargetId = null;
    }

    isActive() { return this.game.activeIdx === this.index; }

    onDamaged() {
      this.game.ui && this.game.ui.playerHit();
      if (this.game.settings.shake && this.game.camera) this.game.camera.shake(2.2);
    }

    onDeath() {
      const g = this.game;
      g.audio && g.audio.hurt();
      g.ui && g.ui.playerHit();
      if (this.isActive()) {
        // switch to next alive crew member
        for (let i = 1; i <= 4; i++) {
          const n = (this.index + i) % g.players.length;
          if (g.players[n].alive) { g.setActive(n, true); break; }
        }
      }
      g.ui && g.ui.refreshCharCards();
    }

    update(dt) {
      super.update(dt);

      // rewind energy
      if (!this.game.rewinding || !this.isActive()) {
        this.rewindEnergy = Math.min(100, this.rewindEnergy + root.BH.config.TUNING.rewind.regen * this.regenMul * dt);
      }

      if (!this.alive) return;
      const g = this.game;

      if (this.isActive()) {
        /* ---------- player-controlled ---------- */
        const input = g.activeInput; // world-space {x,z}
        const sprint = g.activeSprint;
        this.move(dt, input, sprint);

        // aim
        const aim = g.activeAim;
        this.anim.aiming = true;
        this.faceToward(aim.x, aim.z, dt, 13);

        // fire
        const w = this.weapon;
        const mouseDown = g.activeFiring;
        if (mouseDown) {
          if (w.def.auto || !this._wasFiring) {
            const res = root.BH.weapons.tryFire(this, aim, {});
            g.ui && g.ui.flashHitmarker(!!res && !!res.hitActor);
          }
        }
        this._wasFiring = mouseDown;

        // manual reload (F)
        if (g.activeReload) {
          this.startReload();
          g.activeReload = false;
        }
      } else {
        /* ---------- ally AI (follow & engage) ---------- */
        const active = g.players[g.activeIdx];
        let input = null;
        let wantFire = false;

        if (active && active.alive && this !== active) {
          // follow behind the active char with lateral offsets
          const i = this.index;
          const back = 1.6 + (i % 2) * 0.9;
          const side = (i % 2 === 0 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.6);
          const hx = Math.sin(active.heading), hz = Math.cos(active.heading);
          const tx = active.pos.x - hx * back - hz * side;
          const tz = active.pos.z - hz * back + hx * side;
          const d = U.dist(this.pos.x, this.pos.z, tx, tz);
          if (d > 0.6) {
            const a = U.angleTo(this.pos.x, this.pos.z, tx, tz);
            input = { x: Math.sin(a), z: Math.cos(a) };
            if (!wantFire) this.faceToward(tx, tz, dt, 9);
          }

          // engage: nearest visible hostile
          this._allyFireT -= dt;
          let target = null;
          if (this._allyTargetId != null) {
            target = g.actors.find(a => a.id === this._allyTargetId && a.alive);
          }
          if (!target) {
            let bd = Infinity;
            for (const a of g.actors) {
              if (!a.alive || a.team !== 1) continue;
              const dd = U.dist(this.pos.x, this.pos.z, a.pos.x, a.pos.z);
              if (dd > 17 || dd < bd) {
                if (dd < 17) {
                  if (g.world.castLOS(this.pos.x, this.pos.z, a.pos.x, a.pos.z)) { bd = dd; target = a; }
                }
              }
            }
          }
          if (target) {
            this._allyTargetId = target.id;
            this.anim.aiming = true;
            this.faceToward(target.pos.x, target.pos.z, dt, 12);
            if (this._allyFireT <= 0 && this.weapon.reloadT <= 0) {
              this._allyFireT = 0.5 + Math.random() * 0.35;
              root.BH.weapons.tryFire(this, new THREE.Vector3(target.pos.x, 1, target.pos.z), { extraSpread: 0.02 });
            }
          } else {
            this._allyTargetId = null;
            this.anim.aiming = false;
          }
        } else {
          this.anim.aiming = false;
        }
        this.move(dt, input, false);
      }
    }

    snapshot() {
      const s = super.snapshot();
      s.rewindEnergy = this.rewindEnergy;
      return s;
    }
    restore(s) {
      super.restore(s);
      // NOTE: rewind energy is deliberately NOT restored — it is the cost of
      // the rewind itself, so scrubbing back can't refund it (no free loops).
    }
  }

  root.BH.Player = Player;
})();
