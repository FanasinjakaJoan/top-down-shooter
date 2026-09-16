/* ============================================================
   BLOODY HEIST — utils.js
   Math helpers, easing, small shared utilities.
   No DOM dependencies (safe for headless Node tests).
   ============================================================ */
(function () {
  "use strict";

  const U = {
    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    /** frame-rate independent exponential damping */
    damp(a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    dist2(ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; return dx * dx + dz * dz; },
    dist(ax, az, bx, bz) { return Math.sqrt(U.dist2(ax, az, bx, bz)); },
    /** angle from (ax,az) toward (bx,bz), in XZ plane (0 = +Z) */
    angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); },
    /** shortest signed angular difference a->b */
    angDiff(a, b) {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    /** rotate angle a toward b by at most maxStep */
    approachAngle(a, b, maxStep) {
      const d = U.angDiff(a, b);
      if (Math.abs(d) <= maxStep) return b;
      return a + Math.sign(d) * maxStep;
    },
    easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
    easeInCubic(t) { return t * t * t; },
    easeOutQuad(t) { return 1 - (1 - t) * (1 - t); },
    easeOutBack(t) { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance(p) { return Math.random() < p; },
    /** format seconds as m:ss */
    fmtTime(s) {
      s = Math.max(0, Math.floor(s));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    },
    hexA(hex, a) {
      // hex like 0xc1272d or '#c1272d' -> css rgba()
      let h = String(hex).replace("#", "");
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    },
    /** 2D ray vs AABB slab test. Returns t (entry distance) or Infinity. */
    rayAABB2D(ox, oz, dx, dz, minx, minz, maxx, maxz) {
      let tmin = 0, tmax = Infinity;
      // X axis
      if (Math.abs(dx) < 1e-9) {
        if (ox < minx || ox > maxx) return Infinity;
      } else {
        const inv = 1 / dx;
        let t1 = (minx - ox) * inv, t2 = (maxx - ox) * inv;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return Infinity;
      }
      // Z axis
      if (Math.abs(dz) < 1e-9) {
        if (oz < minz || oz > maxz) return Infinity;
      } else {
        const inv = 1 / dz;
        let t1 = (minz - oz) * inv, t2 = (maxz - oz) * inv;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return Infinity;
      }
      return tmin;
    },
    /** 3D ray vs sphere. Returns t or Infinity. */
    raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
      const fx = ox - cx, fy = oy - cy, fz = oz - cz;
      const b = fx * dx + fy * dy + fz * dz;
      const c = fx * fx + fy * fy + fz * fz - r * r;
      if (c > 0 && b > 0) return Infinity; // behind & outside
      const disc = b * b - c;
      if (disc < 0) return Infinity;
      let t = -b - Math.sqrt(disc);
      if (t < 0) t = -Math.sqrt(Math.max(0, -c)); // inside sphere
      return t;
    },
  };

  // deterministic-ish RNG helper for procedural variety
  U.mkRng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  root.BH.utils = U;
})();
