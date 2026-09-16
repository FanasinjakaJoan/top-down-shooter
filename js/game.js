/* ============================================================
   BLOODY HEIST — game.js
   The orchestrator: scene, renderer, state machine
   (menu / briefing / playing / paused / victory / defeat),
   input → world, simulation, rewind capture/restore.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;
  const CFG = root.BH.config;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.settings = CFG.loadSettings();

      /* ---- three basics ---- */
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x07080b);

      this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
      this.cam = new root.BH.IsoCamera(this.camera, CFG.TUNING.camera);

      /* ---- systems ---- */
      this.input = new root.BH.Input({ canvas });
      this.audio = new root.BH.AudioEngine(this.settings);
      this.ui = new root.BH.UI(this);
      this.rewind = null;

      /* ---- runtime state ---- */
      this.state = "menu";
      this.levelKey = "warehouse";
      this.world = null;
      this.mission = null;
      this.effects = null;
      this.actors = [];
      this.players = [];
      this.enemies = [];
      this.activeIdx = 0;
      this.rewinding = false;

      this.activeInput = { x: 0, z: 0 };
      this.activeAim = new THREE.Vector3();
      this.activeFiring = false;
      this.activeSprint = false;
      this.activeReload = false;

      this._dt = 0.016;
      this._clock = { last: 0 };
      this._smokeT = 0;
      this._tension = 0;
      this._menuWorldBuilt = false;
      this._ray = new THREE.Raycaster();
      this._floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this._hit = new THREE.Vector3();
      this._basis = { f: new THREE.Vector3(), r: new THREE.Vector3() };
      this._tGlobal = 0;
      this._nameTexCache = {};
      this.activeRing = null;
      this.nameLabel = null;

      this._onResize = this._onResize.bind(this);
      window.addEventListener("resize", this._onResize);
      this._onResize();

      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    _onResize() {
      const w = this.canvas.clientWidth || root.innerWidth;
      const h = this.canvas.clientHeight || root.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    /* ================= world / mission lifecycle ================= */

    _buildLevel(key) {
      if (this.world) {
        this.scene.remove(this.world.group);
        this.world.clear();
      }
      if (this.effects) {
        this.scene.remove(this.effects.group);
      }
      const Cls = root.BH.Levels[key] || root.BH.Levels.warehouse;
      this.world = new Cls(this, this.scene);
      this.world.build();
      this.effects = new root.BH.Effects(this.scene);
      this.levelKey = key;
      return this.world;
    }

    buildMenuWorld() {
      if (this._menuWorldBuilt && this.levelKey === "warehouse") return;
      this._buildLevel("warehouse");
      this._menuWorldBuilt = true;
      this.audio.setAmbience("menu");
    }

    openBriefing(key) {
      this.levelKey = key;
      this.state = "briefing";
      // fresh build so the briefing panel sits over the actual mission level
      this._buildLevel(key);
      this.ui.showBriefing(this.levelKey);
    }

    startMission(key) {
      this._menuWorldBuilt = false;
      this._buildLevel(key || this.levelKey);
      this.levelKey = key || this.levelKey;
      const info = this.world.levelInfo;

      // rewind system
      if (this.rewind) this.rewind.reset();
      this.rewind = new root.BH.RewindSystem(this);
      this.rewinding = false;

      // actors
      for (const a of this.actors) if (a.group.parent) a.group.parent.remove(a.group);
      this.actors = [];
      this.players = [];
      this.enemies = [];
      CFG.CREW.forEach((c, i) => {
        const p = new root.BH.Player(this, c, i, info.spawns[i]);
        this.players.push(p);
        this.actors.push(p);
      });
      for (const es of info.enemies) {
        const e = new root.BH.Enemy(this, CFG.ENEMIES[es.type], es, es.patrol);
        this.enemies.push(e);
        this.actors.push(e);
      }

      this.mission = new root.BH.Mission(this);
      this.activeIdx = 0;
      this.rewinding = false;

      this._buildActiveIndicators();
      this._applyActiveVisuals();

      // camera: snap to active
      const p0 = this.players[0];
      this.cam.target.set(p0.pos.x, 1, p0.pos.z);
      this.cam.zoomTarget = CFG.TUNING.camera.distStart;
      this.cam.dist = CFG.TUNING.camera.distStart;

      this.state = "playing";
      this.audio.unlock();
      this.audio.setAmbience(info.ambience);
      this.ui.startMission(info);
    }

    quitToMenu() {
      this.rewinding = false;
      this.rewind && this.rewind.end();
      for (const a of this.actors) if (a.group.parent) a.group.parent.remove(a.group);
      this.actors = [];
      this.players = [];
      this.enemies = [];
      this.mission = null;
      this.state = "menu";
      if (this.activeRing) this.activeRing.visible = false;
      if (this.nameLabel) this.nameLabel.visible = false;
      this.buildMenuWorld();
      this.audio.stopAmbience();
      this.audio.setAmbience("menu");
      this.ui.showMenu();
    }

    /* ================= control helpers ================= */

    activePlayer() { return this.players[this.activeIdx] || null; }

    setActive(i, silent) {
      if (i < 0 || i >= this.players.length) return;
      const same = i === this.activeIdx;
      if (same && this.state === "playing") return;
      this.activeIdx = i;
      if (!silent) {
        this.audio.switchChar();
      }
      this._applyActiveVisuals();
      this.ui && this.ui.refreshCharCards();
    }

    /** ring color + name label for the active character */
    _applyActiveVisuals() {
      const p = this.players[this.activeIdx];
      if (!p) return;
      if (this.activeRing) this.activeRing.material.color.setHex(p.ident);
      if (this.nameLabel) {
        const key = p.def.id;
        if (!this._nameTexCache[key]) {
          const nm = p.name.split(" ")[0] + " " + ((p.name.split(" ")[1] || "F").charAt(0) + ".");
          this._nameTexCache[key] = root.BH.Characters.makeNameLabelTexture(nm, p.ident);
        }
        this.nameLabel.material.map = this._nameTexCache[key];
        this.nameLabel.material.needsUpdate = true;
      }
    }

    _buildActiveIndicators() {
      if (!this.activeRing) {
        this.activeRing = new THREE.Mesh(
          new THREE.RingGeometry(0.52, 0.64, 36),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
        );
        this.activeRing.rotation.x = -Math.PI / 2;
        this.activeRing.position.y = 0.035;
        this.activeRing.visible = false;
        this.scene.add(this.activeRing);
      }
      if (!this.nameLabel) {
        this.nameLabel = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
        this.nameLabel.scale.set(1.7, 0.42, 1);
        this.nameLabel.visible = false;
        this.scene.add(this.nameLabel);
      }
    }

    _updateActiveIndicators() {
      if (!this.activeRing) return;
      const ap = this.activePlayer();
      if (!ap) return;
      this.activeRing.visible = ap.alive;
      this.nameLabel.visible = ap.alive;
      if (ap.alive) {
        this.activeRing.position.set(ap.pos.x, 0.035, ap.pos.z);
        this.activeRing.scale.setScalar(1 + Math.sin(this._tGlobal * 4) * 0.07);
        this.nameLabel.position.set(ap.pos.x, 2.35, ap.pos.z);
      }
    }

    wasKey(code) { return this.input.wasPressed(code); }

    _computeActiveControl(dt) {
      const T = CFG.TUNING;
      this.cam.screenBasis(this._basis);
      let mx = 0, mz = 0;
      const inp = this.input;
      if (inp.down("KeyW") || inp.down("ArrowUp")) { mx += this._basis.f.x; mz += this._basis.f.z; }
      if (inp.down("KeyS") || inp.down("ArrowDown")) { mx -= this._basis.f.x; mz -= this._basis.f.z; }
      if (inp.down("KeyD") || inp.down("ArrowRight")) { mx += this._basis.r.x; mz += this._basis.r.z; }
      if (inp.down("KeyA") || inp.down("ArrowLeft")) { mx -= this._basis.r.x; mz -= this._basis.r.z; }
      const gp = inp.gamepad;
      if (gp) {
        // gamepad: stick in screen space -> rotate into world
        mx += this._basis.f.x * -gp.moveY + this._basis.r.x * gp.moveX;
        mz += this._basis.f.z * -gp.moveY + this._basis.r.z * gp.moveX;
      }
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
      this.activeInput.x = mx;
      this.activeInput.z = mz;

      // aim: mouse ray to floor
      this._ray.setFromCamera({ x: inp.mouse.ndcX, y: inp.mouse.ndcY }, this.camera);
      if (this._ray.ray.intersectPlane(this._floorPlane, this._hit)) {
        this.activeAim.copy(this._hit);
      } else {
        // fallback: keep last
      }
      this.activeFiring = inp.mouse.left;
      this.activeSprint = inp.down("ShiftLeft") || inp.down("ShiftRight");
      this.activeReload = inp.wasPressed("KeyF");

      // camera controls
      if (inp.down("KeyQ")) this.cam.rotateBy(dt * 1.8);
      if (inp.down("KeyE")) this.cam.rotateBy(-dt * 1.8);
      if (gp && gp.aimX) this.cam.rotateBy(gp.aimX * dt * 2.2);
      if (gp && gp.aimY) this.cam.zoomBy(-gp.aimY * dt * 4);
      const wl = inp.mouse.wheel;
      if (wl) for (let i = 0; i < Math.abs(wl); i++) this.cam.zoomBy(wl > 0 ? -1 : 1);

      // character switch
      for (let i = 0; i < 4; i++) {
        if (inp.wasPressed("Digit" + (i + 1))) this.setActive(i);
      }
      if (gp) {
        if (gp.switchChar) this.setActive((this.activeIdx + 1) % 4);
        if (gp.prevChar) this.setActive((this.activeIdx + 3) % 4);
      }
    }

    /* ================= combat events ================= */

    get cameras() {
      return (this.world && this.world.levelInfo && this.world.levelInfo.cameras) || [];
    }

    onCameraDestroyed() {
      this.ui && this.ui.refreshObjectives(this.mission);
    }

    onShotFired(shooter, muzzle, weapon) {
      for (const e of this.enemies) {
        if (e.id !== shooter.id) e.hearShot(muzzle.x, muzzle.z, weapon);
      }
    }

    onActorHit(shooter, victim, killed) {
      if (shooter.team === 0 && victim.team === 1) {
        this.audio.hitEnemy();
        if (killed) this.audio.kill();
      }
    }

    onEnemyKilled(victim) {
      if (this.mission) {
        this.mission.addKill(victim.def);
        this.ui.refreshStats();
        this.ui.refreshObjectives(this.mission);
      }
    }

    /* ================= win / lose ================= */

    winMission() {
      if (this.state !== "playing") return;
      this.rewinding = false;
      this.rewind && this.rewind.end();
      this.state = "victory";
      const m = this.mission;
      if (m) m.done = true;
      const T = CFG.TUNING;
      const timeBonus = Math.max(0, Math.floor((420 - m.time) * T.score.timeBonusPerSec));
      const survivors = this.players.filter(p => p.alive).length;
      const finalScore = m.score + timeBonus + survivors * T.score.survivor;
      // victory poses
      for (const p of this.players) if (p.alive) { p.anim.win = true; p.anim.winT = 0; }
      this.audio.victory();
      // save progress
      const prog = this._loadProgress();
      prog.unlocked = Math.max(prog.unlocked, this._levelIndex(this.levelKey) + 1);
      prog.best[this._levelIndex(this.levelKey)] = Math.max(prog.best[this._levelIndex(this.levelKey)] || 0, finalScore);
      this._saveProgress(prog);
      this.ui.showVictory({
        time: m.time, kills: m.kills, score: finalScore,
        survivors, timeBonus, base: m.score,
        last: this._levelIndex(this.levelKey) === 2,
      });
    }

    loseMission() {
      if (this.state !== "playing") return;
      this.rewinding = false;
      this.rewind && this.rewind.end();
      this.state = "defeat";
      this.audio.defeat();
      this.ui.showDefeat({ time: this.mission ? this.mission.time : 0, kills: this.mission ? this.mission.kills : 0 });
    }

    _levelIndex(key) { return ["warehouse", "street", "bank"].indexOf(key); }

    _loadProgress() {
      try {
        const raw = localStorage.getItem(CFG.TUNING.saveKey);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && Array.isArray(p.best)) return { unlocked: p.unlocked || 0, best: p.best };
        }
      } catch (e) { /* ignore */ }
      return { unlocked: 0, best: [0, 0, 0] };
    }
    _saveProgress(p) {
      try { localStorage.setItem(CFG.TUNING.saveKey, JSON.stringify(p)); } catch (e) { /* ignore */ }
    }
    nextLevelKey() {
      const i = Math.min(2, this._levelIndex(this.levelKey) + 1);
      return ["warehouse", "street", "bank"][i];
    }

    /* ================= rewind state capture / restore ================= */

    captureState() {
      const m = this.mission;
      return {
        activeIdx: this.activeIdx,
        players: this.players.map(p => p.snapshot()),
        enemies: this.enemies.map(e => e.snapshot()),
        mission: m ? m.captureState() : null,
      };
    }

    restoreState(snap, fromRewind) {
      this.activeIdx = snap.activeIdx;
      this.players.forEach((p, i) => p.restore(snap.players[i]));
      this.enemies.forEach((e, i) => e.restore(snap.enemies[i]));
      if (snap.mission && this.mission) this.mission.restoreState(snap.mission);
      // if active char is down, pass control
      if (!this.players[this.activeIdx].alive) {
        for (let i = 0; i < this.players.length; i++) {
          if (this.players[i].alive) { this.activeIdx = i; break; }
        }
      }
      this.effects.clearAll();
      this._applyActiveVisuals();
      this.ui.refreshCharCards();
      this.ui.refreshStats();
      this.ui.refreshObjectives(this.mission);
    }

    /* ================= main loop ================= */

    _loop(now) {
      requestAnimationFrame(this._loop);
      const t = now * 0.001;
      let dt = t - this._clock.last;
      this._clock.last = t;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) dt = 0.001;
      this._dt = dt;
      this._tGlobal += dt;

      this.input.pollGamepad();

      if (this.state === "playing") this._updatePlaying(dt);
      else if (this.state === "menu" || this.state === "briefing") this._updateMenu(dt);
      else if (this.state === "victory" || this.state === "defeat") {
        // keep world alive (bodies fall, particles settle)
        this._updateSpectate(dt);
      }
      // pause: freeze simulation

      this.input.endFrame();
      this.ui.update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    _updatePlaying(dt) {
      const g = this;
      this._computeActiveControl(dt);

      // rewind control
      const wantRewind = this.input.down("KeyR") || (this.input.gamepad && this.input.gamepad.rewind);
      if (wantRewind) this.rewind.begin();
      else if (this.rewinding) this.rewind.end();

      // ambient smoke
      this._smokeT -= dt;
      if (this._smokeT <= 0) {
        this._smokeT = 0.25;
        for (const v of this.world.smokeVents) {
          if (Math.random() < 0.5) this.effects.puff(v, "smoke");
        }
      }

      // rewind tick (records + scrubs)
      this.rewind.tick(dt);

      // actors
      for (const p of this.players) p.update(dt);
      for (const e of this.enemies) e.update(dt);

      // win/lose & objectives
      if (this.mission) {
        this.mission.update(dt);
        this.mission.updateVaultDoor(dt);
      }

      // victory check handled in mission (calls winMission)

      // camera follow
      const ap = this.activePlayer();
      if (ap && ap.alive) this.cam.follow(ap, dt, this.activeAim);
      else if (ap) this.cam.follow(ap, dt, null);

      // score tension for music
      const anyCombat = this.enemies.some(e => e.alive && e.state === "combat");
      const target = anyCombat ? 0.75 : 0.25;
      this._tension = U.damp(this._tension, target, 0.8, dt);
      this.audio.setTension(this._tension);

      // active character indicators
      this._updateActiveIndicators();

      // HUD stats (cheap, every frame)
      this.ui.refreshStats();
      this.ui.updateRewindPanel(this.activePlayer());
    }

    _updateSpectate(dt) {
      for (const p of this.players) p.update(dt);
      for (const e of this.enemies) e.update(dt);
      this.effects.update(dt);
      if (this.mission) this.mission.updateVaultDoor(dt);
      const ap = this.activePlayer();
      if (ap) this.cam.follow(ap, dt, null);
    }

    _updateMenu(dt) {
      if (!this.world) return;
      // slow cinematic orbit INSIDE the warehouse
      const c = new THREE.Vector3(0, 0, -1);
      this.cam.orbit(dt, c, 11.5, 8.5);
      this.effects.update(dt);
      this._smokeT -= dt;
      if (this._smokeT <= 0) {
        this._smokeT = 0.4;
        for (const v of this.world.smokeVents) if (Math.random() < 0.5) this.effects.puff(v, "smoke");
      }
      this.audio.setTension(0.05);
    }

    /* ================= pause ================= */

    pause() {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.rewinding = false;
      this.rewind && this.rewind.end();
      this.ui.showPause();
    }
    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.ui.hidePause();
    }
    togglePause() {
      if (this.input.wasPressed("Escape") || this.input.wasPressed("KeyP")) {
        if (this.state === "playing") this.pause();
        else if (this.state === "paused") this.resume();
      }
    }
  }

  root.BH.Game = Game;
})();
