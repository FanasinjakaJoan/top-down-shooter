/* ============================================================
   BLOODY HEIST — rewind.js
   The time-rewind mechanic.
   Records a snapshot of the whole simulation (players,
   enemies, weapons, objectives, score, clock) every 100ms
   into a 5-second ring buffer. Holding R scrubs back through
   those snapshots, restoring the exact previous state —
   positions, health, ammo, AI states, mission clock.
   The active character's rewind energy is consumed while
   scrubbing and recharges when not.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;

  class RewindSystem {
    constructor(game) {
      this.game = game;
      const T = root.BH.config.TUNING.rewind;
      this.window = T.window;
      this.sample = T.sample;
      this.cost = T.cost;
      this.scrubSpeed = T.scrubSpeed;
      this.buf = [];
      this.timer = 0;
      this.scrubOffset = 0;      // seconds back from "now" while holding
      this.active = false;
    }

    /** called every frame while playing */
    tick(dt) {
      if (this.game.rewinding) {
        // scrub backward through the buffer
        const active = this.game.activePlayer();
        if (active && active.alive && active.rewindEnergy > 0) {
          const step = dt * this.scrubSpeed;
          this.scrubOffset += step;
          active.rewindEnergy = Math.max(0, active.rewindEnergy - step * this.cost);
          const snap = this.snapshotAt(this.scrubOffset);
          if (snap) this.game.restoreState(snap, true);
          if (active.rewindEnergy <= 0) this.end();
        } else {
          this.end();
        }
      }
      if (this.scrubOffset > 0 && !this.game.rewinding) {
        this.scrubOffset = 0;
      }

      // record
      if (this.game.state === "playing") {
        this.timer += dt;
        while (this.timer >= this.sample) {
          this.timer -= this.sample;
          this.buf.push(this.game.captureState());
          const maxN = Math.floor(this.window / this.sample);
          if (this.buf.length > maxN) this.buf.shift();
        }
      }
    }

    /** snapshot `sec` seconds in the past (0 = most recent) */
    snapshotAt(sec) {
      if (!this.buf.length) return null;
      const i = Math.min(this.buf.length - 1, Math.max(0, Math.ceil(sec / this.sample) - 1));
      return this.buf[i] || null;
    }

    available() { return Math.min(this.scrubOffset > 0 ? this.buf.length : this.buf.length, Math.floor(this.window / this.sample)); }

    begin() {
      if (this.game.state !== "playing" || this.game.rewinding) return;
      const active = this.game.activePlayer();
      if (!active || !active.alive || active.rewindEnergy <= 5) return;
      if (this.buf.length < 2) return;
      this.game.rewinding = true;
      this.game.audio && this.game.audio.startRewind();
      this.game.ui && this.game.ui.setRewindOverlay(true);
    }

    end() {
      if (!this.game.rewinding) return;
      this.game.rewinding = false;
      this.scrubOffset = 0;
      this.game.audio && this.game.audio.stopRewind();
      this.game.ui && this.game.ui.setRewindOverlay(false);
    }

    reset() {
      this.buf.length = 0;
      this.timer = 0;
      this.scrubOffset = 0;
      this.end();
    }
  }

  root.BH.RewindSystem = RewindSystem;
})();
