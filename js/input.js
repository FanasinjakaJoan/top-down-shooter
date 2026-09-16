/* ============================================================
   BLOODY HEIST — input.js
   Keyboard, mouse and basic gamepad state.
   Poll-style: the game reads input.state each frame.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;

  class Input {
    constructor(dom) {
      // dom = { canvas } ; may be null in headless tests
      this.dom = dom;
      this.keys = {};            // code -> down
      this.pressed = {};         // code -> true this frame (consumed on read)
      this.mouse = {
        x: root.innerWidth ? root.innerWidth / 2 : 480,
        y: root.innerHeight ? root.innerHeight / 2 : 320,
        ndcX: 0, ndcY: 0,
        left: false, right: false, wheel: 0,
        inside: false,
      };
      this.gamepad = null;
      this._onKey = this._onKey.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onBlur = this._onBlur.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseDown = this._onMouseDown.bind(this);
      this._onMouseUp = this._onMouseUp.bind(this);
      this._onWheel = this._onWheel.bind(this);
      this._onCtx = this._onCtx.bind(this);

      if (dom && dom.canvas) {
        const el = dom.canvas;
        window.addEventListener("keydown", this._onKeyDown);
        window.addEventListener("keyup", this._onKey);
        window.addEventListener("blur", this._onBlur);
        el.addEventListener("mousemove", this._onMouseMove);
        el.addEventListener("mousedown", this._onMouseDown);
        window.addEventListener("mouseup", this._onMouseUp);
        el.addEventListener("wheel", this._onWheel, { passive: false });
        el.addEventListener("contextmenu", this._onCtx);
      }
    }

    _onKeyDown(e) {
      if (e.repeat) { e.preventDefault(); return; }
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      // prevent page scroll / selection on game keys
      if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    }
    _onKey(e) { this.keys[e.code] = false; }
    _onBlur() { this.keys = {}; this.mouse.left = false; this.mouse.right = false; }

    _onMouseMove(e) {
      const r = this.dom.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.ndcX = (this.mouse.x / Math.max(1, r.width)) * 2 - 1;
      this.mouse.ndcY = -(this.mouse.y / Math.max(1, r.height)) * 2 + 1;
      this.mouse.inside = true;
    }
    _onMouseDown(e) {
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
      this._onMouseMove(e);
    }
    _onMouseUp(e) {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    }
    _onWheel(e) {
      e.preventDefault();
      this.mouse.wheel += (e.deltaY > 0 ? 1 : -1);
    }
    _onCtx(e) { e.preventDefault(); }

    /** true once, then cleared — use for one-shot actions */
    wasPressed(code) {
      if (this.pressed[code]) { this.pressed[code] = false; return true; }
      return false;
    }
    down(code) { return !!this.keys[code]; }

    /** read + clear gamepad once per frame */
    pollGamepad() {
      let gp = null;
      try {
        const list = navigator.getGamepads ? navigator.getGamepads() : null;
        if (list) for (const g of list) if (g) { gp = g; break; }
      } catch (e) { /* no gamepad */ }
      if (!gp) { this.gamepad = null; return; }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const dx = gp.axes[2] || 0, dy = gp.axes[3] || 0;
      this.gamepad = {
        moveX: Math.abs(ax) > 0.18 ? ax : 0,
        moveY: Math.abs(ay) > 0.18 ? ay : 0,
        aimX: Math.abs(dx) > 0.18 ? dx : 0,
        aimY: Math.abs(dy) > 0.18 ? dy : 0,
        fire: !!(gp.buttons[7] && gp.buttons[7].pressed) || !!(gp.buttons[0] && gp.buttons[0].pressed),
        rewind: !!(gp.buttons[1] && gp.buttons[1].pressed),
        switchChar: !!(gp.buttons[5] && gp.buttons[5].pressed),
        prevChar: !!(gp.buttons[4] && gp.buttons[4].pressed),
        pause: !!(gp.buttons[9] && gp.buttons[9].pressed),
      };
    }

    endFrame() { this.pressed = {}; this.mouse.wheel = 0; }
  }

  root.BH.Input = Input;
})();
