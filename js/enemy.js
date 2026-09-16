/* ============================================================
   BLOODY HEIST — enemy.js
   Enemy AI: patrol → alert (investigate gunshots) → combat
   (chase, strafe, burst fire), hearing, last-seen tracking.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class Enemy extends root.BH.Actor {
    constructor(game, typeDef, spawn, patrol) {
      super(game, typeDef, typeDef.weapon, { team: 1, x: spawn.x, z: spawn.z });
      this.typeId = typeDef.id;
      this.patrol = (patrol || [[spawn.x, spawn.z], [spawn.x, spawn.z]]).map(p => ({ x: p[0], z: p[1] }));
      this.wpIdx = 0;
      this.state = "patrol";
      this.alertPos = null;
      this.alertT = 0;
      this.targetId = null;
      this.lastSeen = null;
      this.loseT = 0;
      this.strafeDir = U.chance(0.5) ? 1 : -1;
      this.strafeT = U.rand(1, 2.5);
      this.detectT = Math.random() * 0.2;
      this.viewRange = typeDef.view || 13;
      this.burstLeft = 0;
      this.burstT = 0;
      this.headCheckT = U.rand(0.5, 2);
      this.headAng = this.heading;

      // floating "!" alert indicator (isometric readability)
      this._alertT = 0;
      if (this.sceneRoot) {
        const mat = new THREE.SpriteMaterial({
          map: root.BH.Characters.getAlertTexture(),
          transparent: true, opacity: 0, depthTest: false,
        });
        this.alertSprite = new THREE.Sprite(mat);
        this.alertSprite.scale.setScalar(0.55);
        this.alertSprite.position.set(0, 2.2, 0);
        this.group.add(this.alertSprite);
      }
    }

    _raiseAlert(strong) {
      if (this.state === "combat" && this._alertT > 0.6) return;
      this._alertT = strong ? 1.6 : 1.1;
    }

    getTarget() {
      if (this.targetId != null) {
        const a = this.game.actors.find(a => a.id === this.targetId && a.alive);
        if (a) return a;
      }
      return null;
    }

    /** hear a gunshot (called by game) */
    hearShot(x, z, weapon) {
      if (!this.alive) return;
      const T = root.BH.config.TUNING;
      const r = weapon.quiet ? T.alertRadiusQuiet : T.alertRadius;
      const d = U.dist(this.pos.x, this.pos.z, x, z);
      if (d < r && (this.state !== "combat" || d < 10)) {
        this.state = "alert";
        this.alertPos = { x, z };
        this.alertT = 5;
        this.burstLeft = 0;
        this._raiseAlert(false);
      }
    }

    onDamaged() {
      // get angry
      if (this.state !== "combat") {
        this.state = "combat";
        this._raiseAlert(true);
      }
    }

    update(dt) {
      super.update(dt);
      if (!this.alive) return;
      const g = this.game;

      /* ---- perception (staggered) ---- */
      this.detectT -= dt;
      if (this.detectT <= 0) {
        this.detectT = 0.14 + Math.random() * 0.12;
        let best = null, bestD = Infinity;
        for (const p of g.players) {
          if (!p.alive) continue;
          const d = U.dist(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
          if (d > this.viewRange) continue;
          if (!g.world.castLOS(this.pos.x, this.pos.z, p.pos.x, p.pos.z)) continue;
          if (d < bestD) { bestD = d; best = p; }
        }
        if (best) {
          if (this.state !== "combat") this._raiseAlert(true);
          this.state = "combat";
          this.targetId = best.id;
          this.lastSeen = { x: best.pos.x, z: best.pos.z };
          this.loseT = 0;
        }
      }

      /* ---- state machine ---- */
      let moveDir = null;

      if (this.state === "patrol") {
        const wp = this.patrol[this.wpIdx];
        const d = U.dist(this.pos.x, this.pos.z, wp.x, wp.z);
        if (d < 0.5) {
          this.wpIdx = (this.wpIdx + 1) % this.patrol.length;
        } else {
          const a = U.angleTo(this.pos.x, this.pos.z, wp.x, wp.z);
          moveDir = { x: Math.sin(a), z: Math.cos(a) };
          this.faceToward(wp.x, wp.z, dt, 6);
        }
        // head check: occasionally look around
        this.headCheckT -= dt;
        if (this.headCheckT <= 0) {
          this.headCheckT = U.rand(1.5, 3.5);
          this.headAng = this.heading + (Math.random() - 0.5) * 1.6;
        }
        if (!moveDir) this.faceToward(Math.sin(this.headAng), Math.cos(this.headAng), dt, 4);
      }

      else if (this.state === "alert") {
        this.alertT -= dt;
        if (this.alertPos) {
          const d = U.dist(this.pos.x, this.pos.z, this.alertPos.x, this.alertPos.z);
          if (d < 0.7 || this.alertT <= 0) {
            this.state = "patrol";
            // find nearest waypoint
            let bi = 0, bd = Infinity;
            this.patrol.forEach((p, i) => {
              const dd = U.dist2(this.pos.x, this.pos.z, p.x, p.z);
              if (dd < bd) { bd = dd; bi = i; }
            });
            this.wpIdx = bi;
            this.alertPos = null;
          } else {
            const a = U.angleTo(this.pos.x, this.pos.z, this.alertPos.x, this.alertPos.z);
            moveDir = { x: Math.sin(a), z: Math.cos(a) };
            this.faceToward(this.alertPos.x, this.alertPos.z, dt, 7);
          }
        } else {
          this.state = "patrol";
        }
      }

      else if (this.state === "combat") {
        const target = this.getTarget();
        if (target) {
          const d = U.dist(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
          const los = g.world.castLOS(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
          this.faceToward(target.pos.x, target.pos.z, dt, 9);

          if (los) {
            this.lastSeen = { x: target.pos.x, z: target.pos.z };
            this.loseT = 0;
            // movement: keep mid range, strafe
            this.strafeT -= dt;
            if (this.strafeT <= 0) { this.strafeT = U.rand(0.8, 2.2); this.strafeDir *= -1; }
            const a = U.angleTo(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
            if (d > 9) {
              moveDir = { x: Math.sin(a), z: Math.cos(a) };
            } else if (d < 3.2) {
              moveDir = { x: -Math.sin(a), z: -Math.cos(a) };
            } else {
              const sa = a + (Math.PI / 2) * this.strafeDir;
              moveDir = { x: Math.sin(sa) * 0.8, z: Math.cos(sa) * 0.8 };
            }
            // fire
            if (d < 16 && this.burstT <= 0) {
              const w = this.weapon;
              if (w.reloadT <= 0) {
                if (w.def.auto) {
                  this._fireAt(target, d);
                  this.burstLeft--;
                  if (this.burstLeft <= 0) { this.burstLeft = 3; this.burstT = 0.55; }
                } else {
                  if (this.burstLeft <= 0) this.burstLeft = 3;
                  this._fireAt(target, d);
                  this.burstLeft--;
                  if (this.burstLeft <= 0) this.burstT = 0.8;
                }
              }
            }
            this.burstT = Math.max(0, this.burstT - dt);
          } else {
            // no LOS: go to last seen
            if (this.lastSeen) {
              const d2 = U.dist(this.pos.x, this.pos.z, this.lastSeen.x, this.lastSeen.z);
              if (d2 > 1) {
                const a = U.angleTo(this.pos.x, this.pos.z, this.lastSeen.x, this.lastSeen.z);
                moveDir = { x: Math.sin(a), z: Math.cos(a) };
                this.faceToward(this.lastSeen.x, this.lastSeen.z, dt, 9);
              }
              this.loseT += dt;
              if (this.loseT > 4) {
                this.state = "alert";
                this.alertPos = this.lastSeen;
                this.alertT = 3;
                this.targetId = null;
              }
            }
          }
        } else {
          this.loseT += dt;
          if (this.loseT > 2.5) {
            this.state = "patrol";
            this.loseT = 0;
          }
        }
      }

      /* ---- alert indicator ---- */
      if (this.alertSprite) {
        this._alertT = Math.max(0, this._alertT - dt);
        const pulse = this.state === "combat" ? 0.7 + 0.3 * Math.sin(this.anim.t * 9) : 1;
        this.alertSprite.material.opacity = Math.min(1, this._alertT / 0.35) * pulse;
        this.alertSprite.position.y = 2.2 + Math.sin(this.anim.t * 4) * 0.05;
      }

      /* ---- move & anim ---- */
      const spd = this.move(dt, moveDir, false);
      this.anim.aiming = this.state === "combat" && this.getTarget() && this.weapon.reloadT <= 0;
    }

    _fireAt(target, d) {
      const hitChance = U.clamp(0.6 - d * 0.016, 0.12, 0.6) * (target.anim.moving ? 0.8 : 1);
      const aim = new THREE.Vector3(target.pos.x, 1, target.pos.z);
      if (Math.random() > hitChance) {
        // deliberate miss: aim off to the side
        const a = this.heading + (Math.random() - 0.5) * 0.5;
        const off = 0.5 + Math.random() * 0.9;
        aim.x += Math.sin(a) * off * (Math.random() < 0.5 ? 1 : -1);
        aim.z += Math.cos(a) * off * (Math.random() < 0.5 ? 1 : -1);
      }
      root.BH.weapons.tryFire(this, aim, { extraSpread: 0.02 + d * 0.002 });
    }

    onDeath() {
      this.game.onEnemyKilled && this.game.onEnemyKilled(this);
    }

    /* ---- rewind ---- */
    snapshot() {
      const s = super.snapshot();
      s.ai = {
        state: this.state, wpIdx: this.wpIdx,
        alertPos: this.alertPos, alertT: this.alertT,
        targetId: this.targetId, lastSeen: this.lastSeen,
        loseT: this.loseT, strafeDir: this.strafeDir,
        burstLeft: this.burstLeft, burstT: this.burstT,
      };
      return s;
    }
    restore(s) {
      super.restore(s);
      if (s.ai) {
        this.state = s.ai.state;
        this.wpIdx = s.ai.wpIdx;
        this.alertPos = s.ai.alertPos;
        this.alertT = s.ai.alertT;
        this.targetId = s.ai.targetId;
        this.lastSeen = s.ai.lastSeen;
        this.loseT = s.ai.loseT;
        this.strafeDir = s.ai.strafeDir;
        this.burstLeft = s.ai.burstLeft;
        this.burstT = s.ai.burstT;
      }
    }
  }

  root.BH.Enemy = Enemy;
})();
