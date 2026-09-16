/* ============================================================
   BLOODY HEIST — ui.js
   DOM interface: main menu, briefing, HUD (char cards,
   objectives, stats, rewind panel, crosshair, hitmarker,
   damage/rewind overlays), pause, victory, defeat, modals.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const CFG = root.BH.config;

  function $(id) { return document.getElementById(id); }

  class UI {
    constructor(game) {
      this.game = game;
      this.dmg = 0;
      this.toastT = 0;
      this._cards = [];
      this._buildCharCards();
      this._bind();
      this.hideAllScreens();
    }

    _buildCharCards() {
      const strip = $("char-strip");
      strip.innerHTML = "";
      this._cards = CFG.CREW.map((c, i) => {
        const el = document.createElement("div");
        el.className = "char-card";
        el.style.setProperty("--card-color", U.hexA(c.ident, 0.9));
        const cv = document.createElement("canvas");
        cv.width = cv.height = 96;
        root.BH.Characters.drawPortrait(cv, c, c.weapon);
        const meta = document.createElement("div");
        meta.className = "cc-meta";
        meta.innerHTML = `<span class="cc-name">${c.name.split(" ")[1] || c.name}</span><span class="cc-key">[${c.key}] ${c.role.toUpperCase()}</span>`;
        const hp = document.createElement("div");
        hp.className = "cc-bar";
        hp.innerHTML = `<div class="cc-bar-fill" style="width:100%"></div>`;
        const rw = document.createElement("div");
        rw.className = "cc-rw";
        rw.innerHTML = `<div class="cc-rw-fill" style="width:100%"></div>`;
        const ammo = document.createElement("div");
        ammo.className = "cc-ammo";
        ammo.innerHTML = `<span>${c.weapon === "smg" ? "SMG" : "PST"}</span><b>12/72</b>`;
        el.appendChild(cv);
        el.appendChild(meta);
        el.appendChild(hp);
        el.appendChild(rw);
        el.appendChild(ammo);
        strip.appendChild(el);
        return { el, hp: hp.querySelector(".cc-bar-fill"), rw: rw.querySelector(".cc-rw-fill"), ammo: ammo.querySelector("b") };
      });
    }

    _bind() {
      const g = this.game;
      const click = (fn) => (e) => { g.audio.unlock(); g.audio.uiClick(); fn(e); };
      $("btn-new-game").onclick = click(() => g.openBriefing("warehouse"));
      $("btn-continue").onclick = click(() => {
        const prog = g._loadProgress();
        const i = Math.min(2, Math.max(0, prog.unlocked));
        g.openBriefing(["warehouse", "street", "bank"][i]);
      });
      $("btn-settings").onclick = click(() => this.showSettings());
      $("btn-controls").onclick = click(() => this.showControls());
      $("btn-quit").onclick = click(() => {
        $("menu").classList.add("hidden");
        if (root.close) root.close();
        setTimeout(() => $("menu").classList.remove("hidden"), 50);
      });

      $("btn-brief-back").onclick = click(() => g.quitToMenu());
      $("btn-brief-start").onclick = click(() => g.startMission(g.levelKey));

      $("btn-resume").onclick = click(() => g.resume());
      $("btn-restart").onclick = click(() => { g.resume(); g.startMission(g.levelKey); });
      $("btn-settings-2").onclick = click(() => this.showSettings());
      $("btn-main-menu").onclick = click(() => g.quitToMenu());

      $("btn-vic-restart").onclick = click(() => g.startMission(g.levelKey));
      $("btn-vic-next").onclick = click(() => {
        const n = g.nextLevelKey();
        if (n === g.levelKey) g.quitToMenu();
        else g.openBriefing(n);
      });
      $("btn-vic-menu").onclick = click(() => g.quitToMenu());

      $("btn-def-retry").onclick = click(() => g.startMission(g.levelKey));
      $("btn-def-menu").onclick = click(() => g.quitToMenu());
    }

    hideAllScreens() {
      for (const id of ["menu", "briefing", "pause", "victory", "defeat", "modal"]) $(id).classList.add("hidden");
      $("hud").classList.add("hidden");
      $("crosshair").classList.add("hidden");
      document.body.classList.remove("playing");
    }

    /* ---------------- screens ---------------- */

    showMenu() {
      this.hideAllScreens();
      $("menu").classList.remove("hidden");
      const prog = this.game._loadProgress();
      $("btn-continue").disabled = prog.unlocked <= 0 && !prog.best.some(b => b > 0);
    }

    showBriefing(key) {
      this.hideAllScreens();
      const Cls = root.BH.Levels[key];
      const info = Cls.prototype._briefInfo || {};
      // build a lightweight info mirror without constructing a world
      const briefs = {
        warehouse: {
          title: "OPERATION: BACKDOOR",
          desc: "The money moved to Pier 9. Three briefcases are sitting in the warehouse, and the crew left eight men to watch them. Grab the cases, clear the room, and get out the north door. Keep your head down — they hear everything.",
          objectives: ["Recover the 3 briefcases", "Eliminate all 8 hostiles", "Escape through the north exit"],
        },
        street: {
          title: "OPERATION: NIGHT RUN",
          desc: "The buyer's car is parked on Mercer Street, trunk open, cash inside. Six guards between you and the trunk. Lift the money, clean up the street, and disappear through the east alley before the sirens find you.",
          objectives: ["Steal the cash from the target car", "Eliminate all 6 hostiles", "Escape east through the alley"],
        },
        bank: {
          title: "OPERATION: SAFEHOUSE",
          desc: "The big one. First Meridian Bank. Cut the three cameras, crack the vault door, and walk out west through the emergency exit. The vault crew is heavy — move like you mean it.",
          objectives: ["Destroy the 3 security cameras", "Crack the vault (hold position 3s)", "Eliminate all 6 hostiles", "Escape west via the emergency exit"],
        },
      };
      const b = briefs[key] || briefs.warehouse;
      $("brief-title").textContent = b.title;
      $("brief-desc").textContent = b.desc;
      $("brief-obj-list").innerHTML = b.objectives.map(o => `<li>${o}</li>`).join("");
      const roster = $("brief-roster");
      roster.innerHTML = "";
      CFG.CREW.forEach(c => {
        const card = document.createElement("div");
        card.className = "roster-card";
        const cv = document.createElement("canvas");
        cv.width = cv.height = 96;
        root.BH.Characters.drawPortrait(cv, c, c.weapon);
        const name = document.createElement("div");
        name.className = "roster-name";
        name.textContent = c.name.split(" ")[0] + " " + (c.name.split(" ")[1] ? c.name.split(" ")[1][0] + "." : "");
        const role = document.createElement("div");
        role.className = "roster-role";
        role.textContent = c.role;
        const stat = document.createElement("div");
        stat.className = "roster-stat";
        stat.innerHTML = `HP ${c.hp} · SPD ${c.speed}<br><span style="color:${U.hexA(c.ident, 0.9)}">${c.ability}</span>`;
        card.appendChild(cv); card.appendChild(name); card.appendChild(role); card.appendChild(stat);
        roster.appendChild(card);
      });
      $("briefing").classList.remove("hidden");
    }

    startMission(info) {
      this.hideAllScreens();
      document.body.classList.add("playing");
      $("hud").classList.remove("hidden");
      $("crosshair").classList.remove("hidden");
      $("hud-mission-title").textContent = info.name;
      this.refreshObjectives(this.game.mission);
      this.refreshCharCards();
      this.refreshStats();
    }

    showPause() { $("pause").classList.remove("hidden"); }
    hidePause() { $("pause").classList.add("hidden"); }

    showVictory(s) {
      $("victory").classList.remove("hidden");
      $("victory-stats").innerHTML = `
        <div class="stats-grid">
          <div class="sg-row"><span>Time</span><b>${U.fmtTime(s.time)}</b></div>
          <div class="sg-row"><span>Hostiles down</span><b>${s.kills}</b></div>
          <div class="sg-row"><span>Heist score</span><b>${s.base}</b></div>
          <div class="sg-row"><span>Time bonus</span><b>+${s.timeBonus}</b></div>
          <div class="sg-row"><span>Crew alive</span><b>${s.survivors}/4</b></div>
          <div class="sg-row"><span>Survivor bonus</span><b>+${s.survivors * 250}</b></div>
          <div class="sg-row" style="border:none"><span style="color:#e0a53a">TOTAL SCORE</span><b style="font-size:1.2rem">${s.score}</b></div>
        </div>`;
      $("btn-vic-next").style.display = s.last ? "none" : "block";
    }

    showDefeat(s) {
      $("defeat").classList.remove("hidden");
      $("defeat-stats").innerHTML = `
        <div class="stats-grid">
          <div class="sg-row"><span>Survived</span><b>${U.fmtTime(s.time)}</b></div>
          <div class="sg-row"><span>Hostiles down</span><b>${s.kills}</b></div>
        </div>`;
    }

    /* ---------------- modals ---------------- */

    showControls() {
      $("modal-title").textContent = "CONTROLS";
      $("modal-body").innerHTML = `
        <table>
          <tr><td><kbd>W A S D</kbd></td><td>Move (screen-relative)</td></tr>
          <tr><td><kbd>Mouse</kbd></td><td>Aim</td></tr>
          <tr><td><kbd>Left click</kbd></td><td>Shoot (hold for auto weapons)</td></tr>
          <tr><td><kbd>1 2 3 4</kbd></td><td>Switch crew member</td></tr>
          <tr><td><kbd>R</kbd> (hold)</td><td>Rewind time — active character's timeline</td></tr>
          <tr><td><kbd>F</kbd></td><td>Reload</td></tr>
          <tr><td><kbd>Shift</kbd></td><td>Sprint</td></tr>
          <tr><td><kbd>Q / E</kbd></td><td>Rotate camera</td></tr>
          <tr><td><kbd>Wheel</kbd></td><td>Zoom</td></tr>
          <tr><td><kbd>Esc / P</kbd></td><td>Pause</td></tr>
        </table>
        <p style="margin-top:12px">Inactive crew members follow your active character and auto-engage visible hostiles. Every character carries a rewind charge — the blue bar on their card. Hold <b>R</b> to scrub the world back up to 5 seconds.</p>`;
      $("modal").classList.remove("hidden");
    }

    showSettings() {
      const s = this.game.settings;
      $("modal-title").textContent = "SETTINGS";
      $("modal-body").innerHTML = `
        <div class="set-row"><label>MUSIC VOLUME</label><input type="range" id="set-music" min="0" max="1" step="0.05" value="${s.music}"></div>
        <div class="set-row"><label>SFX VOLUME</label><input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></div>
        <div class="set-row"><label>SCREEN SHAKE</label><input type="checkbox" id="set-shake" ${s.shake ? "checked" : ""}></div>
        <div class="set-row"><label>QUALITY</label>
          <select id="set-quality" style="background:#14161c;color:#e8e6e1;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 8px">
            <option value="high" ${s.quality === "high" ? "selected" : ""}>HIGH</option>
            <option value="low" ${s.quality === "low" ? "selected" : ""}>LOW</option>
          </select>
        </div>`;
      $("modal").classList.remove("hidden");
      const apply = () => {
        s.music = parseFloat($("set-music").value);
        s.sfx = parseFloat($("set-sfx").value);
        s.shake = $("set-shake").checked;
        s.quality = $("set-quality").value;
        this.game.audio.setVolumes(s.music, s.sfx);
        CFG.saveSettings();
      };
      ["set-music", "set-sfx", "set-shake", "set-quality"].forEach(id => $(id).oninput = apply);
    }

    _bindModal() {
      if (this._modalBound) return;
      this._modalBound = true;
      $("btn-modal-close").onclick = () => {
        this.game.audio.uiClick();
        $("modal").classList.add("hidden");
      };
    }

    /* ---------------- HUD refresh ---------------- */

    refreshCharCards() {
      const g = this.game;
      g.players.forEach((p, i) => {
        const c = this._cards[i];
        if (!c) return;
        c.el.classList.toggle("active", i === g.activeIdx);
        c.el.classList.toggle("dead", !p.alive);
        c.hp.style.width = (U.clamp(p.hp / p.maxHp, 0, 1) * 100) + "%";
        c.hp.style.background = p.hp / p.maxHp > 0.5 ? "#58b368" : (p.hp / p.maxHp > 0.25 ? "#d9a53a" : "#d02a31");
        c.rw.style.width = p.rewindEnergy + "%";
        c.ammo.textContent = `${p.weapon.mag}/${p.weapon.reserve}`;
      });
    }

    refreshStats() {
      const m = this.game.mission;
      if (!m) return;
      $("stat-time").textContent = U.fmtTime(m.time);
      $("stat-kills").textContent = m.kills + "/" + (this.game.world.levelInfo.enemiesTotal || 0);
      $("stat-score").textContent = m.score;
    }

    refreshObjectives(m) {
      if (!m) return;
      const list = $("hud-obj-list");
      list.innerHTML = "";
      let activeSet = false;
      m.objectives.forEach(o => {
        const li = document.createElement("li");
        li.textContent = o.text;
        if (o.done) li.classList.add("done");
        else if (!activeSet) { li.classList.add("active"); activeSet = true; }
        list.appendChild(li);
      });
    }

    updateRewindPanel(ap) {
      if (!ap) return;
      $("rewind-char-name").textContent = ap.name.split(" ")[0];
      $("rewind-fill").style.width = ap.rewindEnergy + "%";
      const g = this.game;
      const maxSec = g.rewind ? g.rewind.window : 5;
      const off = g.rewinding ? g.rewind.scrubOffset : 0;
      $("rewind-window-fill").style.width = U.clamp(off / maxSec, 0, 1) * 100 + "%";
      $("rewind-panel").classList.toggle("rewinding", g.rewinding);
    }

    toast(msg) {
      const el = $("objective-toast");
      el.textContent = msg;
      el.classList.add("show");
      this.toastT = 2.2;
    }

    flashHitmarker(hit) {
      const el = $("hitmarker");
      el.classList.remove("show");
      void el.offsetWidth; // restart animation
      el.classList.add("show");
    }

    setRewindOverlay(on) {
      $("rewind-overlay").classList.toggle("on", on);
    }

    /* ---------------- per-frame ---------------- */

    update(dt) {
      this._bindModal();
      const g = this.game;
      // crosshair
      const ch = $("crosshair");
      if (!ch.classList.contains("hidden")) {
        ch.style.left = g.input.mouse.x + "px";
        ch.style.top = g.input.mouse.y + "px";
        ch.classList.toggle("firing", g.activeFiring && g.state === "playing");
        const hm = $("hitmarker");
        hm.style.left = g.input.mouse.x + "px";
        hm.style.top = g.input.mouse.y + "px";
      }
      // hitmarker follows crosshair (set when shown)
      // damage vignette
      this.dmg = Math.max(0, this.dmg - dt * 1.8);
      const ap = g.activePlayer && g.state === "playing" ? g.activePlayer() : null;
      const lowHp = ap && ap.alive && ap.hp / ap.maxHp < 0.3;
      $("damage-vignette").style.opacity = this.dmg;
      const low = $("low-hp-overlay");
      low.classList.toggle("pulse", !!lowHp);
      if (!lowHp) low.classList.remove("pulse");
      // toast timer
      if (this.toastT > 0) {
        this.toastT -= dt;
        if (this.toastT <= 0) $("objective-toast").classList.remove("show");
      }
      // pause key
      if (g.state === "playing" || g.state === "paused") {
        if (g.input.wasPressed("Escape") || g.input.wasPressed("KeyP")) {
          if (g.state === "playing") g.pause(); else g.resume();
        }
      }
    }

    /** called by game when a player is hit */
    playerHit() { this.dmg = Math.min(0.85, this.dmg + 0.4); }
  }

  root.BH.UI = UI;
})();
