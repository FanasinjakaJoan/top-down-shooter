/* ============================================================
   BLOODY HEIST — missions.js
   Mission runtime: objectives, win/lose conditions, score.
   Objectives are small state machines checked each frame.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class Mission {
    constructor(game) {
      this.game = game;
      this.info = game.world.levelInfo;
      this.time = 0;
      this.score = 0;
      this.kills = 0;
      this.done = false;
      this.escaped = false;
      this.holdT = 0;
      this.vaultHold = 0;
      this.vaultOpen = false;
      this._defeatT = 0;
      this.objectives = this._buildObjectives();
    }

    _buildObjectives() {
      const g = this.game;
      const info = this.info;
      const mission = this;
      const objs = [];
      const nearAny = (x, z, r) => g.players.some(p => p.alive && U.dist2(p.pos.x, p.pos.z, x, z) < r * r);

      if (info.briefcaseCount) {
        objs.push({
          text: info.objectives[0],
          sub: () => `briefcases ${info.briefcases.filter(b => b.taken).length}/${info.briefcaseCount}`,
          check() {
            for (const b of info.briefcases) {
              if (b.taken) continue;
              if (nearAny(b.x, b.z, b.r || 1.4)) {
                b.taken = true;
                b.mesh.visible = false;
                b.glow.visible = false;
                g.audio.pickup();
              }
            }
            if (info.briefcases.every(b => b.taken)) this.onDone();
          },
        });
      }
      if (info.targetCar) {
        objs.push({
          text: info.objectives[0],
          sub: () => `hold position ${Math.max(0, 1.5 - mission.holdT).toFixed(1)}s`,
          check() {
            if (nearAny(info.targetCar.x, info.targetCar.z, info.targetCar.r) && g.activePlayer().alive) {
              mission.holdT += g._dt;
              if (mission.holdT >= 1.5) this.onDone();
            } else {
              mission.holdT = Math.max(0, mission.holdT - g._dt * 2);
            }
          },
        });
      }
      if (info.cameras && info.cameras.length) {
        objs.push({
          text: info.objectives[0],
          sub: () => `cameras ${info.cameras.filter(c => !c.alive).length}/${info.cameras.length}`,
          check() {
            if (info.cameras.every(c => !c.alive)) this.onDone();
          },
        });
      }
      if (info.vault) {
        objs.push({
          text: info.objectives[1],
          sub: () => `cracking ${Math.max(0, info.vault.time - mission.vaultHold).toFixed(1)}s`,
          check() {
            if (mission.vaultOpen) return;
            const camsDone = !info.cameras || info.cameras.every(c => !c.alive);
            if (camsDone && nearAny(info.vault.x, info.vault.z, info.vault.r)) {
              mission.vaultHold += g._dt;
              g.camera && g.camera.shake(0.4);
              if (mission.vaultHold >= info.vault.time) {
                mission.vaultOpen = true;
                mission._openVault();
                this.onDone();
              }
            } else {
              mission.vaultHold = Math.max(0, mission.vaultHold - g._dt * 3);
            }
          },
        });
      }
      objs.push({
        text: info.objectives[info.objectives.indexOf(info.objectives.find(t => t.startsWith("Eliminate")))],
        sub: () => `hostiles ${this.kills}/${info.enemiesTotal}`,
        check() {
          if (mission.kills >= info.enemiesTotal) this.onDone();
        },
      });
      const escapeObj = {
        text: info.objectives[info.objectives.length - 1],
        sub: () => mission.escaped ? "" : (objs.every(o => o.done || o === escapeObj) ? "" : "complete objectives first"),
        check() {
          if (!objs.every(o => o.done || o === escapeObj)) return;
          if (nearAny(info.escape.x, info.escape.z, info.escape.r)) {
            mission.escaped = true;
            this.onDone();
            g.winMission();
          }
        },
      };
      objs.push(escapeObj);

      // attach onDone
      objs.forEach((o, i) => {
        o.idx = i;
        o.done = false;
        o.onDone = () => {
          if (o.done) return;
          o.done = true;
          this.score += 500;
          g.audio.objective();
          g.ui && g.ui.toast("OBJECTIVE COMPLETE");
          g.ui && g.ui.refreshObjectives(this);
        };
      });
      return objs;
    }

    _openVault() {
      const w = this.game.world;
      if (w.vaultDoorMesh) {
        w.vaultOpenT = 0;
      }
      if (w.goldGroup) w.goldGroup.visible = true;
      if (w.goldLight) w.goldLight.intensity = 1.2;
      if (w.vaultLight) w.vaultLight.material.color.setHex(0x39d97a);
      this.game.audio && this.game.audio.escape();
    }

    /** animate vault door swing (called from game.update) */
    updateVaultDoor(dt) {
      const w = this.game.world;
      if (w.vaultOpenT == null) return;
      w.vaultOpenT = Math.min(1, w.vaultOpenT + dt * 0.5);
      w.vaultDoorMesh.rotation.y = (Math.PI / 2) * (1 - w.vaultOpenT);
      w.vaultWheel.rotation.z += dt * 3 * (1 - w.vaultOpenT);
    }

    addKill(def) {
      this.kills++;
      this.score += def.score || 100;
    }

    /* ---------------- rewind support ---------------- */
    captureState() {
      const info = this.info;
      return {
        time: this.time, score: this.score, kills: this.kills,
        holdT: this.holdT, vaultHold: this.vaultHold, vaultOpen: this.vaultOpen,
        briefcases: info.briefcases ? info.briefcases.map(b => b.taken) : null,
        cameras: info.cameras ? info.cameras.map(c => ({ hp: c.hp, alive: c.alive })) : null,
        objectives: this.objectives.map(o => o.done),
      };
    }

    restoreState(s) {
      this.time = s.time;
      this.score = s.score;
      this.kills = s.kills;
      this.holdT = s.holdT;
      this.vaultHold = s.vaultHold;
      this.vaultOpen = s.vaultOpen;
      this.escaped = this.objectives[this.objectives.length - 1] && s.objectives[this.objectives.length - 1];
      this.objectives.forEach((o, i) => { o.done = !!s.objectives[i]; });
      const info = this.info;
      const w = this.game.world;
      if (s.briefcases && info.briefcases) {
        info.briefcases.forEach((b, i) => {
          b.taken = !!s.briefcases[i];
          b.mesh.visible = !b.taken;
          b.glow.visible = !b.taken;
        });
      }
      if (s.cameras && info.cameras) {
        info.cameras.forEach((c, i) => {
          c.hp = s.cameras[i].hp;
          c.alive = s.cameras[i].alive;
          c.head.visible = c.alive;
        });
      }
      if (info.vault) {
        if (w.goldGroup) w.goldGroup.visible = s.vaultOpen;
        if (w.goldLight) w.goldLight.intensity = s.vaultOpen ? 1.2 : 0;
        if (w.vaultDoorMesh) {
          w.vaultOpenT = s.vaultOpen ? 1 : 0;
          w.vaultDoorMesh.rotation.y = s.vaultOpen ? 0 : Math.PI / 2;
        }
        if (w.vaultLight) w.vaultLight.material.color.setHex(s.vaultOpen ? 0x39d97a : 0xd94b53);
      }
    }

    update(dt) {
      if (this.done) return;
      this.time += dt;
      for (const o of this.objectives) if (!o.done) o.check && o.check();

      // defeat: all players down
      if (this.game.players.every(p => !p.alive)) {
        this._defeatT += dt;
        if (this._defeatT > 1.6) { this.done = true; this.game.loseMission(); return; }
      } else {
        this._defeatT = 0;
      }
    }
  }

  root.BH.Mission = Mission;
})();
