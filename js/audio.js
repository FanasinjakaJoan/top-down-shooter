/* ============================================================
   BLOODY HEIST — audio.js
   100% procedural WebAudio: every SFX and the tension score
   are synthesized at runtime. No external audio assets.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;

  class AudioEngine {
    constructor(settings) {
      this.settings = settings;
      this.ctx = null;
      this.master = null;
      this.sfxBus = null;
      this.musicBus = null;
      this.ambBus = null;
      this.noiseBuf = null;
      this.ambSrc = null;
      this.musicTimer = null;
      this.rewindTimer = null;
      this.rewindOn = false;
      this.tension = 0;          // 0..1 score intensity
      this.musicStep = 0;
      this.musicNext = 0;
      this.enabled = true;
    }

    /* called from a user gesture (click) */
    unlock() {
      if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.settings.sfx;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.settings.music * 0.5;
      this.musicBus.connect(this.master);
      this.ambBus = this.ctx.createGain();
      this.ambBus.gain.value = this.settings.music * 0.3;
      this.ambBus.connect(this.master);

      // 2s white noise buffer for gunshots / impacts
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._startMusicScheduler();
    }

    setVolumes(music, sfx) {
      this.settings.music = music; this.settings.sfx = sfx;
      if (this.musicBus) this.musicBus.gain.value = music * 0.5;
      if (this.sfxBus) this.sfxBus.gain.value = sfx;
      if (this.ambBus) this.ambBus.gain.value = music * 0.3;
    }

    /* ---------------- building blocks ---------------- */

    _env(gainNode, t0, a, peak, decay) {
      const g = gainNode.gain;
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
      g.exponentialRampToValueAtTime(0.0001, t0 + a + decay);
    }

    _noise(dur, { type = "bandpass", freq = 1200, q = 0.8, gain = 0.5, decay = 0.25, at = 0, bus = null } = {}) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + at;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain();
      this._env(g, t0, 0.005, gain, decay);
      src.connect(f).connect(g).connect(bus || this.sfxBus);
      src.start(t0); src.stop(t0 + 0.05 + decay + 0.05);
    }

    _tone({ type = "sine", f0 = 440, f1 = null, dur = 0.2, gain = 0.3, at = 0, bus = null, attack = 0.005 }) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + at;
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      const g = this.ctx.createGain();
      this._env(g, t0, attack, gain, dur);
      o.connect(g).connect(bus || this.sfxBus);
      o.start(t0); o.stop(t0 + attack + dur + 0.05);
    }

    /* ---------------- SFX ---------------- */

    shoot(weaponId) {
      if (!this.ctx) return;
      const w = root.BH.config.WEAPONS[weaponId] || {};
      const quiet = !!w.quiet;
      // body crack
      this._noise(0.06, { type: "lowpass", freq: quiet ? 500 : 2600, gain: quiet ? 0.25 : 0.55, decay: quiet ? 0.09 : 0.06 });
      // boom
      this._tone({ type: "sine", f0: quiet ? 120 : 150, f1: 40, dur: quiet ? 0.08 : 0.16, gain: quiet ? 0.18 : 0.5 });
      // high tick for rimfire snap
      if (!quiet) this._tone({ type: "square", f0: 2400, f1: 900, dur: 0.03, gain: 0.06 });
    }

    step(run) {
      this._noise(0.045, { type: "lowpass", freq: 320 + Math.random() * 160, gain: run ? 0.16 : 0.1, decay: 0.04 });
    }

    reload(start) {
      if (start) {
        this._tone({ type: "square", f0: 700, f1: 400, dur: 0.05, gain: 0.12 });
      } else {
        this._tone({ type: "square", f0: 500, f1: 900, dur: 0.06, gain: 0.16, at: 0.02 });
        this._noise(0.05, { type: "highpass", freq: 2500, gain: 0.1, decay: 0.04, at: 0.01 });
      }
    }

    empty() { this._tone({ type: "square", f0: 900, f1: 700, dur: 0.04, gain: 0.08 }); }

    hitEnemy() {
      this._tone({ type: "triangle", f0: 320, f1: 120, dur: 0.07, gain: 0.22 });
      this._noise(0.05, { type: "bandpass", freq: 800, gain: 0.2, decay: 0.05 });
    }
    kill() {
      this._tone({ type: "sawtooth", f0: 220, f1: 45, dur: 0.3, gain: 0.2, attack: 0.01 });
      this._noise(0.2, { type: "lowpass", freq: 500, gain: 0.25, decay: 0.2 });
    }
    hurt() {
      this._tone({ type: "sine", f0: 180, f1: 60, dur: 0.18, gain: 0.4 });
      this._noise(0.1, { type: "lowpass", freq: 700, gain: 0.2, decay: 0.1 });
    }
    switchChar() { this._tone({ type: "triangle", f0: 520, f1: 780, dur: 0.08, gain: 0.15 }); }
    uiClick() { this._tone({ type: "square", f0: 1100, f1: 900, dur: 0.03, gain: 0.07 }); }
    pickup() {
      this._tone({ type: "sine", f0: 660, dur: 0.09, gain: 0.2 });
      this._tone({ type: "sine", f0: 990, dur: 0.14, gain: 0.2, at: 0.08 });
    }
    objective() {
      this._tone({ type: "triangle", f0: 659, dur: 0.12, gain: 0.22 });
      this._tone({ type: "triangle", f0: 988, dur: 0.2, gain: 0.22, at: 0.1 });
    }
    victory() {
      const notes = [220, 277, 330, 440];
      notes.forEach((f, i) => this._tone({ type: "triangle", f0: f, dur: 0.35, gain: 0.25, at: i * 0.14, attack: 0.02 }));
      this._tone({ type: "triangle", f0: 440, dur: 0.8, gain: 0.3, at: 0.6, attack: 0.03 });
      this._tone({ type: "triangle", f0: 554, dur: 0.8, gain: 0.22, at: 0.6, attack: 0.03 });
      this._tone({ type: "triangle", f0: 659, dur: 0.8, gain: 0.2, at: 0.6, attack: 0.03 });
    }
    defeat() {
      this._tone({ type: "sawtooth", f0: 196, f1: 98, dur: 1.2, gain: 0.2, attack: 0.05 });
      this._tone({ type: "sine", f0: 98, f1: 49, dur: 1.4, gain: 0.25, at: 0.1, attack: 0.05 });
    }
    escape() {
      this._tone({ type: "triangle", f0: 392, dur: 0.15, gain: 0.25 });
      this._tone({ type: "triangle", f0: 523, dur: 0.15, gain: 0.25, at: 0.12 });
      this._tone({ type: "triangle", f0: 659, dur: 0.3, gain: 0.25, at: 0.24 });
    }
    cameraBreak() { this._tone({ type: "square", f0: 1800, f1: 200, dur: 0.12, gain: 0.15 }); this._noise(0.15, { type: "highpass", freq: 1500, gain: 0.2, decay: 0.12 }); }

    startRewind() {
      if (!this.ctx || this.rewindOn) return;
      this.rewindOn = true;
      // descending sweep
      this._tone({ type: "sine", f0: 900, f1: 140, dur: 0.45, gain: 0.22, attack: 0.02 });
      this._tone({ type: "triangle", f0: 452, f1: 70, dur: 0.5, gain: 0.14, at: 0.03, attack: 0.02 });
      // tape ticks
      const tick = () => {
        if (!this.rewindOn) return;
        this._noise(0.02, { type: "highpass", freq: 3000, gain: 0.05, decay: 0.015 });
      };
      tick();
      this.rewindTimer = setInterval(tick, 80);
    }
    stopRewind() {
      this.rewindOn = false;
      if (this.rewindTimer) { clearInterval(this.rewindTimer); this.rewindTimer = null; }
      if (this.ctx) this._tone({ type: "sine", f0: 140, f1: 520, dur: 0.2, gain: 0.15, attack: 0.01 });
    }

    /* ---------------- ambience ---------------- */

    setAmbience(kind) {
      if (!this.ctx) return;
      if (this.ambSrc) { try { this.ambSrc.stop(); } catch (e) {} this.ambSrc = null; }
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      g.gain.value = 0.0;
      if (kind === "warehouse") { f.type = "lowpass"; f.frequency.value = 220; }
      else if (kind === "street") { f.type = "bandpass"; f.frequency.value = 420; f.Q.value = 0.4; }
      else if (kind === "bank") { f.type = "lowpass"; f.frequency.value = 300; }
      else { f.type = "lowpass"; f.frequency.value = 250; }
      src.connect(f).connect(g).connect(this.ambBus);
      src.start();
      g.gain.linearRampToValueAtTime(kind === "menu" ? 0.05 : 0.09, this.ctx.currentTime + 1.2);
      this.ambSrc = src;
    }
    stopAmbience() {
      if (this.ambSrc) { try { this.ambSrc.stop(); } catch (e) {} this.ambSrc = null; }
    }

    /* ---------------- tension score (procedural) ----------------
       A minor, 84 BPM, 16 steps. Layers intensify with tension. */

    _startMusicScheduler() {
      const STEP = 60 / 84 / 4; // 16th notes
      this.musicNext = this.ctx.currentTime + 0.1;
      const schedule = () => {
        while (this.musicNext < this.ctx.currentTime + 0.25) {
          this._playStep(this.musicStep, this.musicNext);
          this.musicStep = (this.musicStep + 1) % 64;
          this.musicNext += STEP;
        }
      };
      this.musicTimer = setInterval(schedule, 90);
      schedule();
    }

    _playStep(step, t0) {
      const at = Math.max(0, t0 - this.ctx.currentTime);
      const bar = Math.floor(step / 16) % 4;      // 4-bar loop
      const s = step % 16;                          // step in bar
      const chords = [
        [110.0, 130.81, 164.81],  // A  A  E
        [110.0, 130.81, 164.81],
        [87.31, 110.00, 130.81],  // F  A  C
        [98.00, 123.47, 146.83],  // G  B  D
      ];
      const ch = chords[bar];
      const t = U.clamp(this.tension, 0, 1);
      const bus = this.musicBus;

      // bass — roots on beats, syncopated with tension
      if (s === 0 || s === 8 || (t > 0.4 && (s === 10 || s === 14))) {
        this._tone({ type: "triangle", f0: ch[0], dur: s === 0 ? 0.5 : 0.22, gain: 0.30, at, bus });
      }
      // pad — chord stab each bar
      if (s === 0) {
        for (const f of [ch[1], ch[2]]) {
          this._tone({ type: "sine", f0: f, dur: 1.4, gain: 0.05 + t * 0.03, at, bus, attack: 0.15 });
        }
      }
      // hats — 8ths, louder when tense
      if (s % 2 === 0) {
        this._noise(0.02, { type: "highpass", freq: 7000, gain: 0.015 + t * 0.03, decay: 0.02, at, bus: bus });
      }
      // snare-ish tick on 2 & 4 (when tense)
      if (t > 0.35 && (s === 4 || s === 12)) {
        this._noise(0.06, { type: "bandpass", freq: 1800, gain: 0.06, decay: 0.06, at, bus });
      }
      // tense arpeggio run on last two bars
      if (t > 0.7 && (bar === 3) && s % 2 === 0) {
        const seq = [ch[1], ch[2], ch[1] * 2, ch[2] * 2];
        this._tone({ type: "triangle", f0: seq[(s / 2) % 4], dur: 0.1, gain: 0.045, at, bus });
      }
    }

    setTension(v) { this.tension = U.clamp(v, 0, 1); }

    destroy() {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.stopRewind(); this.stopAmbience();
    }
  }

  root.BH.AudioEngine = AudioEngine;
})();
