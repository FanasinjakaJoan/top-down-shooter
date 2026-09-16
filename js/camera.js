/* ============================================================
   BLOODY HEIST — camera.js
   Isometric 3D camera rig: smooth follow, zoom, rotation,
   screen-space input mapping, screen shake, aim offset.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class IsoCamera {
    constructor(camera, t) {
      this.camera = camera;
      this.rot = Math.PI * 0.25;      // 45° — classic iso start
      this.elev = t.elev;
      this.dist = t.distStart;
      this.distMin = t.distMin; this.distMax = t.distMax;
      this.follow = t.follow;
      this.target = new THREE.Vector3(0, 0, 0);
      this._desired = new THREE.Vector3(0, 0, 0);
      this._aimOffset = new THREE.Vector3();
      this.shakeT = 0;
      this.shakeMag = 0;
      this._shakeVec = new THREE.Vector3();
      this.zoomTarget = t.distStart;
    }

    zoomBy(dir) { // dir: +1 zoom in, -1 zoom out
      this.zoomTarget = U.clamp(this.zoomTarget + dir * 1.6, this.distMin, this.distMax);
    }
    rotateBy(rad) { this.rot += rad; }

    shake(mag) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeT = Math.max(this.shakeT, 0.28);
    }

    /** follow an actor; aimDir: optional unit XZ vector to bias the view toward the aim */
    follow(actor, dt, aimPoint) {
      this._desired.copy(actor.pos);
      this._desired.y = 1.05;
      if (aimPoint) {
        const d = U.dist(actor.pos.x, actor.pos.z, aimPoint.x, aimPoint.z);
        const k = U.clamp((d - 1.5) * 0.16, 0, 1.5);
        this._aimOffset.set(
          Math.sin(actor.heading) * k * 0.6, 0, Math.cos(actor.heading) * k * 0.6
        );
        this._desired.add(this._aimOffset);
      }
      const l = U.damp(0, 1, this.follow, dt);
      this.target.x = U.damp(this.target.x, this._desired.x, this.follow, dt);
      this.target.z = U.damp(this.target.z, this._desired.z, this.follow, dt);
      this.target.y = U.damp(this.target.y, this._desired.y, this.follow * 0.7, dt);
      this.dist = U.damp(this.dist, this.zoomTarget, 7, dt);

      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const m = this.shakeMag * Math.max(0, this.shakeT) * 3.2;
        this._shakeVec.set(
          (Math.random() - 0.5) * m,
          (Math.random() - 0.5) * m * 0.6,
          (Math.random() - 0.5) * m
        );
        if (this.shakeT <= 0) this.shakeMag = 0;
      } else {
        this._shakeVec.set(0, 0, 0);
      }

      const ce = Math.cos(this.elev), se = Math.sin(this.elev);
      const sr = Math.sin(this.rot), cr = Math.cos(this.rot);
      this.camera.position.set(
        this.target.x + this.dist * ce * sr + this._shakeVec.x,
        this.target.y + this.dist * se + this._shakeVec.y,
        this.target.z + this.dist * ce * cr + this._shakeVec.z
      );
      this.camera.lookAt(this.target.x, this.target.y + 0.4, this.target.z);
    }

    /** unit XZ vectors for screen-relative movement (WASD) */
    screenBasis(out) {
      const ce = Math.cos(this.elev), sr = Math.sin(this.rot), cr = Math.cos(this.rot);
      // camera forward on XZ = from camera to target
      const fx = -sr, fz = -cr;
      out.f.set(fx, 0, fz).normalize();
      out.r.set(-fz, 0, fx).normalize();   // right = forward × up... check handedness below
      return out;
    }

    /** static camera for menu: slow orbit around a point */
    orbit(dt, center, radius, height) {
      this._menuT = (this._menuT || 0) + dt * 0.06;
      const a = this._menuT;
      this.camera.position.set(
        center.x + Math.cos(a) * radius,
        center.y + height,
        center.z + Math.sin(a) * radius
      );
      this.camera.lookAt(center.x, center.y + 1, center.z);
    }
  }

  root.BH.IsoCamera = IsoCamera;
})();
