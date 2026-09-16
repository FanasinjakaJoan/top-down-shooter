/* ============================================================
   BLOODY HEIST — effects.js
   Pooled particle FX: sparks, blood, smoke/dust puffs,
   tracers, shell casings, ground decals, muzzle flash.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  const SPRITE_COUNT = 48;
  const TRACER_COUNT = 64;
  const SHELL_COUNT = 48;
  const DECAL_COUNT = 36;

  function makeGlowTexture(inner, outer) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  class Effects {
    constructor(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      scene.add(this.group);

      this.glowTex = makeGlowTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)");
      this.softTex = makeGlowTexture("rgba(255,255,255,0.55)", "rgba(255,255,255,0)");

      /* ---- point pools (sparks & blood) ---- */
      this._pools = {};
      this._pools.spark = this._makePool(900, 0.085, THREE.AdditiveBlending);
      this._pools.blood = this._makePool(500, 0.13, THREE.NormalBlending);
      this._pools.rain = this._makePool(300, 0.06, THREE.AdditiveBlending); // generic (rewind sparkles)

      /* ---- sprites (smoke, dust, flash) ---- */
      this.sprites = [];
      const sprMat = (tex, blending, opacity) => new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity, depthWrite: false, blending,
      });
      for (let i = 0; i < SPRITE_COUNT; i++) {
        const s = new THREE.Sprite(sprMat(this.glowTex, THREE.NormalBlending, 0));
        s.visible = false;
        s.userData = { life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 0, baseScale: 1, drag: 1, grav: 0, fade: true, color: null, tex: this.glowTex };
        this.group.add(s);
        this.sprites.push(s);
      }
      this._sprCursor = 0;

      /* ---- tracers ---- */
      this.tracers = [];
      for (let i = 0; i < TRACER_COUNT; i++) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const mat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        line.visible = false;
        line.userData = { life: 0 };
        this.group.add(line);
        this.tracers.push(line);
      }
      this._trCursor = 0;

      /* ---- shell casings ---- */
      this.shells = [];
      const shellGeo = new THREE.BoxGeometry(0.02, 0.02, 0.05);
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xc9a13b, metalness: 0.9, roughness: 0.3 });
      for (let i = 0; i < SHELL_COUNT; i++) {
        const m = new THREE.Mesh(shellGeo, shellMat.clone());
        m.visible = false;
        m.userData = { life: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0 };
        this.group.add(m);
        this.shells.push(m);
      }
      this._shCursor = 0;

      /* ---- impact decals ---- */
      this.decals = [];
      const decalGeo = new THREE.CircleGeometry(0.09, 10);
      for (let i = 0; i < DECAL_COUNT; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
        const m = new THREE.Mesh(decalGeo, mat);
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        m.userData = { life: 0 };
        this.group.add(m);
        this.decals.push(m);
      }
      this._dcCursor = 0;

      /* ---- shared muzzle flash light ---- */
      this.flashLight = new THREE.PointLight(0xffc266, 0, 9, 2);
      this.group.add(this.flashLight);
    }

    _makePool(n, size, blending) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size, vertexColors: true, transparent: true, opacity: 1,
        blending, depthWrite: false, sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      this.group.add(pts);
      return {
        pts, n, size, cursor: 0,
        life: new Float32Array(n),
        vel: new Float32Array(n * 3),
        color: new Float32Array(n * 3),
        pos: geo.attributes.position.array,
        col: geo.attributes.color.array,
        geo,
      };
    }

    _emit(pool, x, y, z, vx, vy, vz, r, g, b, life) {
      const i = pool.cursor; pool.cursor = (pool.cursor + 1) % pool.n;
      pool.pos[i * 3] = x; pool.pos[i * 3 + 1] = y; pool.pos[i * 3 + 2] = z;
      pool.vel[i * 3] = vx; pool.vel[i * 3 + 1] = vy; pool.vel[i * 3 + 2] = vz;
      pool.color[i * 3] = r; pool.color[i * 3 + 1] = g; pool.color[i * 3 + 2] = b;
      pool.life[i] = life;
      pool.col[i * 3] = r; pool.col[i * 3 + 1] = g; pool.col[i * 3 + 2] = b;
    }

    sparks(pos, dir, n = 8, color = 0xffd27a) {
      const p = this._pools.spark;
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random();
        const sp = 2 + Math.random() * 4;
        this._emit(p, pos.x, pos.y, pos.z,
          (dir ? dir.x * 2 : 0) + Math.cos(a) * sp * (0.4 + e),
          (dir ? dir.y * 2 : 1) + Math.random() * 3,
          (dir ? dir.z * 2 : 0) + Math.sin(a) * sp * (0.4 + e),
          c.r, c.g, c.b, 0.25 + Math.random() * 0.3);
      }
      p.geo.attributes.color.needsUpdate = true;
    }

    blood(pos, dir, n = 10) {
      const p = this._pools.blood;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2.6;
        const r = 0.36 + Math.random() * 0.14, g = 0.03, b = 0.04;
        this._emit(p, pos.x, pos.y, pos.z,
          (dir ? dir.x * 1.5 : 0) + Math.cos(a) * sp,
          0.6 + Math.random() * 2.2,
          (dir ? dir.z * 1.5 : 0) + Math.sin(a) * sp,
          r, g, b, 0.5 + Math.random() * 0.45);
      }
      p.geo.attributes.color.needsUpdate = true;
    }

    /** soft round puff: kind 'smoke' | 'dust' | 'flash' | 'after' */
    puff(pos, kind, opts = {}) {
      const s = this.sprites[this._sprCursor]; this._sprCursor = (this._sprCursor + 1) % SPRITE_COUNT;
      const ud = s.userData;
      const conf = {
        smoke: { life: 1.6, scale: 0.7, vy: 0.55, grow: 0.9, opacity: 0.34, tex: this.softTex, blend: THREE.NormalBlending, color: 0x9aa0a8 },
        dust: { life: 0.5, scale: 0.35, vy: 0.25, grow: 0.7, opacity: 0.3, tex: this.softTex, blend: THREE.NormalBlending, color: 0xb8ae9a },
        flash: { life: 0.06, scale: 1.15, vy: 0, grow: 0, opacity: 0.95, tex: this.glowTex, blend: THREE.AdditiveBlending, color: 0xffd9a0 },
        after: { life: 0.35, scale: 0.5, vy: 0, grow: 0.15, opacity: 0.4, tex: this.glowTex, blend: THREE.AdditiveBlending, color: 0x6fa8ff },
      }[kind] || {};
      Object.assign(ud, {
        life: conf.life, maxLife: conf.life,
        vx: 0, vy: conf.vy, vz: 0,
        grow: conf.grow, baseScale: conf.scale,
        opacity: conf.opacity, color: conf.color, tex: conf.tex,
      });
      if (opts.color) ud.color = opts.color;
      if (opts.vx) { ud.vx = opts.vx; ud.vz = opts.vz || 0; }
      s.material.map = conf.tex;
      s.material.color.set(conf.color);
      s.material.blending = conf.blend;
      s.material.opacity = conf.opacity;
      s.material.needsUpdate = true;
      s.position.set(pos.x, pos.y, pos.z);
      s.scale.setScalar(conf.scale);
      s.visible = true;
    }

    tracer(from, to, color = 0xffd27a, width = 1) {
      const t = this.tracers[this._trCursor]; this._trCursor = (this._trCursor + 1) % TRACER_COUNT;
      const a = t.geometry.attributes.position;
      a.setXYZ(0, from.x, from.y, from.z);
      a.setXYZ(1, to.x, to.y, to.z);
      a.needsUpdate = true;
      t.material.color.set(color);
      t.material.opacity = 0.85 * width;
      t.userData.life = 0.07;
      t.visible = true;
    }

    muzzleFlash(pos, dir, weapon) {
      this.puff(pos, "flash", { color: weapon && weapon.quiet ? 0x9fc4e8 : 0xffd9a0 });
      this.flashLight.position.set(pos.x, pos.y + 0.05, pos.z);
      this.flashLight.intensity = 2.6;
      this.flashLight.color.set(weapon && weapon.quiet ? 0x9fc4e8 : 0xffc266);
      // small shell casing
      const sh = this.shells[this._shCursor]; this._shCursor = (this._shCursor + 1) % SHELL_COUNT;
      sh.visible = true;
      sh.position.set(pos.x, pos.y, pos.z);
      const side = Math.random() < 0.5 ? 1 : -1;
      sh.userData.life = 6;
      sh.userData.vx = -dir.z * side * (1.6 + Math.random()) + (Math.random() - 0.5);
      sh.userData.vy = 2.2 + Math.random() * 1.4;
      sh.userData.vz = dir.x * side * (1.6 + Math.random()) + (Math.random() - 0.5);
      sh.userData.rx = (Math.random() - 0.5) * 20;
      sh.userData.rz = (Math.random() - 0.5) * 20;
    }

    decal(pos, color = 0x0d0d0d, size = 1) {
      const d = this.decals[this._dcCursor]; this._dcCursor = (this._dcCursor + 1) % DECAL_COUNT;
      d.position.set(pos.x, 0.012 + Math.random() * 0.004, pos.z);
      d.rotation.x = -Math.PI / 2;
      d.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      d.material.color.set(color);
      d.material.opacity = 0.55;
      d.userData.life = 26;
      d.visible = true;
    }

    clearAll() {
      for (const k in this._pools) {
        const p = this._pools[k];
        for (let i = 0; i < p.n; i++) { p.life[i] = 0; p.pos[i * 3 + 1] = -999; }
        p.geo.attributes.position.needsUpdate = true;
      }
      for (const s of this.sprites) s.visible = false;
      for (const t of this.tracers) t.visible = false;
      for (const sh of this.shells) sh.visible = false;
      for (const d of this.decals) { d.visible = false; d.userData.life = 0; }
      this.flashLight.intensity = 0;
    }

    update(dt) {
      // point pools
      for (const k in this._pools) {
        const p = this._pools[k];
        let any = false;
        for (let i = 0; i < p.n; i++) {
          if (p.life[i] <= 0) continue;
          any = true;
          p.life[i] -= dt;
          if (p.life[i] <= 0) { p.pos[i * 3 + 1] = -999; continue; }
          p.vel[i * 3 + 1] -= 9.8 * dt;
          p.pos[i * 3] += p.vel[i * 3] * dt;
          p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt;
          p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
          if (p.pos[i * 3 + 1] < 0.02) { p.pos[i * 3 + 1] = 0.02; p.vel[i * 3 + 1] *= -0.35; }
          // fade by darkening color near end of life
          const f = Math.min(1, p.life[i] / 0.25);
          p.col[i * 3] = p.color[i * 3] * f;
          p.col[i * 3 + 1] = p.color[i * 3 + 1] * f;
          p.col[i * 3 + 2] = p.color[i * 3 + 2] * f;
        }
        if (any) {
          p.geo.attributes.position.needsUpdate = true;
          p.geo.attributes.color.needsUpdate = true;
        }
      }

      // sprites
      for (const s of this.sprites) {
        if (!s.visible) continue;
        const ud = s.userData;
        ud.life -= dt;
        if (ud.life <= 0) { s.visible = false; continue; }
        s.position.x += ud.vx * dt;
        s.position.y += ud.vy * dt;
        s.position.z += ud.vz * dt;
        if (ud.grow) s.scale.setScalar(Math.min(4, s.scale.x * (1 + ud.grow * dt * 3)));
        const t = ud.life / ud.maxLife;
        s.material.opacity = ud.opacity * (t < 0.4 ? t / 0.4 : 1) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      }

      // tracers
      for (const t of this.tracers) {
        if (!t.visible) continue;
        t.userData.life -= dt;
        if (t.userData.life <= 0) { t.visible = false; continue; }
        t.material.opacity = Math.max(0, (t.userData.life / 0.07)) * 0.85;
      }

      // shells
      for (const sh of this.shells) {
        if (!sh.visible) continue;
        const ud = sh.userData;
        ud.life -= dt;
        if (ud.life <= 0) { sh.visible = false; continue; }
        ud.vy -= 9.8 * dt;
        sh.position.x += ud.vx * dt;
        sh.position.y += ud.vy * dt;
        sh.position.z += ud.vz * dt;
        sh.rotation.x += ud.rx * dt;
        sh.rotation.z += ud.rz * dt;
        if (sh.position.y < 0.015) {
          sh.position.y = 0.015;
          ud.vy *= -0.3;
          ud.vx *= 0.7; ud.vz *= 0.7;
          ud.rx *= 0.5; ud.rz *= 0.5;
          if (Math.abs(ud.vy) < 0.4) ud.vy = 0;
        }
        if (ud.life < 1) sh.material.opacity = ud.life;
      }

      // decals
      for (const d of this.decals) {
        if (!d.visible) continue;
        d.userData.life -= dt;
        if (d.userData.life <= 0) { d.visible = false; continue; }
        if (d.userData.life > 24) d.material.opacity = 0.55 * (1 - (26 - d.userData.life) / 2) ;
        if (d.userData.life < 2) d.material.opacity = 0.55 * (d.userData.life / 2);
      }

      // muzzle flash light decay
      this.flashLight.intensity *= Math.exp(-26 * dt);
      if (this.flashLight.intensity < 0.02) this.flashLight.intensity = 0;
    }
  }

  root.BH.Effects = Effects;
})();
