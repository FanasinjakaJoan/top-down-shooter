/* ============================================================
   BLOODY HEIST — world/world.js
   World base: bounds, AABB obstacles, circle collision
   resolution, LOS queries, procedural floor textures,
   lighting & shadow setup. Level builders extend this.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  /* ---------------- procedural textures ---------------- */
  function canvasTex(size, fn, repeatX = 1, repeatY = 1) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    fn(ctx, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 4;
    return t;
  }

  root.BH.makeTexture = function (name) {
    root.BH._texCache = root.BH._texCache || {};
    if (root.BH._texCache[name]) return root.BH._texCache[name];
    let t;
    const rng = U.mkRng(name.length * 7919 + 13);
    if (name === "concrete") {
      t = canvasTex(256, (c, s) => {
        c.fillStyle = "#585b60";
        c.fillRect(0, 0, s, s);
        for (let i = 0; i < 2600; i++) {
          const g = 60 + Math.floor(rng() * 60);
          c.fillStyle = `rgba(${g},${g},${g + 4},${0.16 + rng() * 0.2})`;
          c.fillRect(rng() * s, rng() * s, 1 + rng() * 2, 1 + rng() * 2);
        }
        // tile seams
        c.strokeStyle = "rgba(20,21,24,0.85)";
        c.lineWidth = 3;
        for (let i = 0; i <= 2; i++) {
          c.beginPath(); c.moveTo(i * s / 2, 0); c.lineTo(i * s / 2, s); c.stroke();
          c.beginPath(); c.moveTo(0, i * s / 2); c.lineTo(s, i * s / 2); c.stroke();
        }
        // stains
        for (let i = 0; i < 7; i++) {
          const g = c.createRadialGradient(rng() * s, rng() * s, 2, rng() * s, rng() * s, 20 + rng() * 30);
          g.addColorStop(0, "rgba(30,32,36,0.28)");
          g.addColorStop(1, "rgba(30,32,36,0)");
          c.fillStyle = g;
          c.fillRect(0, 0, s, s);
        }
      });
    } else if (name === "asphalt") {
      t = canvasTex(256, (c, s) => {
        c.fillStyle = "#26282c";
        c.fillRect(0, 0, s, s);
        for (let i = 0; i < 3200; i++) {
          const g = 28 + Math.floor(rng() * 50);
          c.fillStyle = `rgba(${g},${g},${g + 2},${0.2 + rng() * 0.3})`;
          c.fillRect(rng() * s, rng() * s, 1 + rng(), 1 + rng());
        }
        // cracks
        c.strokeStyle = "rgba(12,12,14,0.7)";
        for (let i = 0; i < 6; i++) {
          c.lineWidth = 1;
          c.beginPath();
          let x = rng() * s, y = rng() * s;
          c.moveTo(x, y);
          for (let j = 0; j < 6; j++) {
            x += (rng() - 0.5) * 50; y += (rng() - 0.5) * 50;
            c.lineTo(x, y);
          }
          c.stroke();
        }
        // puddle
        const g = c.createRadialGradient(s * 0.7, s * 0.6, 4, s * 0.7, s * 0.6, 46);
        g.addColorStop(0, "rgba(90,110,140,0.35)");
        g.addColorStop(1, "rgba(90,110,140,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
      });
    } else if (name === "banktiles") {
      t = canvasTex(256, (c, s) => {
        c.fillStyle = "#b7b0a2";
        c.fillRect(0, 0, s, s);
        c.strokeStyle = "rgba(70,66,58,0.9)";
        c.lineWidth = 4;
        for (let i = 0; i <= 2; i++) {
          c.beginPath(); c.moveTo(i * s / 2, 0); c.lineTo(i * s / 2, s); c.stroke();
          c.beginPath(); c.moveTo(0, i * s / 2); c.lineTo(s, i * s / 2); c.stroke();
        }
        for (let i = 0; i < 1500; i++) {
          const g = 150 + Math.floor(rng() * 50);
          c.fillStyle = `rgba(${g},${g - 5},${g - 14},0.12)`;
          c.fillRect(rng() * s, rng() * s, 2, 2);
        }
      });
    } else if (name === "wood") {
      t = canvasTex(128, (c, s) => {
        c.fillStyle = "#6b4e30";
        c.fillRect(0, 0, s, s);
        for (let i = 0; i < 5; i++) {
          const y = i * s / 5;
          const g = 96 + Math.floor(rng() * 40);
          c.fillStyle = `rgb(${g},${g * 0.72 | 0},${g * 0.45 | 0})`;
          c.fillRect(0, y, s, s / 5 - 3);
          c.strokeStyle = "rgba(40,26,14,0.8)";
          c.lineWidth = 3;
          c.strokeRect(1, y, s - 2, s / 5 - 3);
        }
        c.strokeStyle = "rgba(30,20,10,0.9)";
        c.lineWidth = 6;
        c.strokeRect(3, 3, s - 6, s - 6);
        // nails
        c.fillStyle = "rgba(30,30,32,0.9)";
        [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]].forEach(p => {
          c.beginPath(); c.arc(p[0], p[1], 3, 0, Math.PI * 2); c.fill();
        });
      });
    } else if (name === "rust") {
      t = canvasTex(128, (c, s) => {
        c.fillStyle = "#3c4550";
        c.fillRect(0, 0, s, s);
        for (let i = 0; i < 900; i++) {
          const r = 40 + Math.floor(rng() * 50), g2 = 42 + Math.floor(rng() * 40), b = 48 + Math.floor(rng() * 40);
          c.fillStyle = `rgba(${r},${g2},${b},0.5)`;
          c.fillRect(rng() * s, rng() * s, 2 + rng() * 5, 2 + rng() * 5);
        }
        // rust streaks
        for (let i = 0; i < 10; i++) {
          const x = rng() * s;
          const g = c.createLinearGradient(x, 0, x, s);
          g.addColorStop(0, "rgba(110,66,30,0.5)");
          g.addColorStop(1, "rgba(110,66,30,0)");
          c.fillStyle = g;
          c.fillRect(x - 4, 0, 8, s);
        }
        // panel lines
        c.strokeStyle = "rgba(15,18,22,0.9)";
        c.lineWidth = 3;
        for (let i = 1; i < 4; i++) {
          c.beginPath(); c.moveTo(i * s / 4, 0); c.lineTo(i * s / 4, s); c.stroke();
        }
      });
    }
    root.BH._texCache[name] = t;
    return t;
  };

  /* ---------------- World ---------------- */
  class World {
    constructor(game, scene) {
      this.game = game;
      this.group = new THREE.Group();
      scene.add(this.group);
      this.obstacles = [];       // {min:{x,z}, max:{x,z}, h, type}
      this.bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
      this.smokeVents = [];      // ambient smoke emitter points
      this.fogColor = 0x0a0c10;
      this.ambience = "warehouse";
      this._dirLight = null;

      this._lights = new THREE.Group();
      this.group.add(this._lights);
      const hemi = new THREE.HemisphereLight(0x8899bb, 0x1a1c20, 0.55);
      this._lights.add(hemi);
      this.hemi = hemi;
    }

    setupKeyLight(opts) {
      const d = new THREE.DirectionalLight(opts.color, opts.intensity);
      d.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
      d.castShadow = true;
      const q = this.game.settings.quality === "high" ? 2048 : 1024;
      d.shadow.mapSize.set(q, q);
      const s = 26;
      d.shadow.camera.left = -s; d.shadow.camera.right = s;
      d.shadow.camera.top = s; d.shadow.camera.bottom = -s;
      d.shadow.camera.near = 1; d.shadow.camera.far = 90;
      d.shadow.bias = -0.0015;
      this._lights.add(d);
      this._lights.add(d.target);
      this._dirLight = d;
    }

    addPointLight(color, intensity, x, y, z, dist) {
      const p = new THREE.PointLight(color, intensity, dist, 1.8);
      p.position.set(x, y, z);
      this._lights.add(p);
      return p;
    }

    setFog(color, near, far) {
      this.game.scene.fog = new THREE.Fog(color, near, far);
      this.game.scene.background = new THREE.Color(color);
      this.fogColor = color;
    }

    addObstacle(minx, minz, maxx, maxz, h, type) {
      const ob = {
        min: { x: minx, z: minz }, max: { x: maxx, z: maxz },
        h, type: type || "block",
      };
      this.obstacles.push(ob);
      return ob;
    }

    /** add a box mesh (center x,z, top at y) + obstacle record */
    addBox(cx, cz, w, d, h, { y = 0, mat, type = "block", rotY = 0, noShadow = false, blockBullets = true } = {}) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(cx, y + h / 2, cz);
      m.rotation.y = rotY;
      m.castShadow = !noShadow;
      m.receiveShadow = true;
      this.group.add(m);
      let minx, maxx, minz, maxz;
      if (Math.abs(rotY) < 0.001) {
        minx = cx - w / 2; maxx = cx + w / 2;
        minz = cz - d / 2; maxz = cz + d / 2;
      } else {
        // rotated boxes: use AABB of the rotated corners (conservative)
        const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
        const ex = (w / 2) * c + (d / 2) * s, ez = (w / 2) * s + (d / 2) * c;
        minx = cx - ex; maxx = cx + ex;
        minz = cz - ez; maxz = cz + ez;
      }
      if (!blockBullets) return { mesh: m, ob: null };
      const ob = this.addObstacle(minx, minz, maxx, maxz, h, type);
      ob.mesh = m;
      return { mesh: m, ob };
    }

    makeFloor(textureName, size, repeat) {
      const tex = root.BH.makeTexture(textureName);
      tex.repeat.set(repeat[0], repeat[1]);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.02 })
      );
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    }

    /* ---------------- collision ---------------- */
    _circleHits(x, z, r) {
      // bounds
      if (x - r < this.bounds.minX || x + r > this.bounds.maxX) return true;
      if (z - r < this.bounds.minZ || z + r > this.bounds.maxZ) return true;
      for (const ob of this.obstacles) {
        const cx = U.clamp(x, ob.min.x, ob.max.x);
        const cz = U.clamp(z, ob.min.z, ob.max.z);
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < r * r) return true;
      }
      return false;
    }

    /** slide-resolve: try X, then Z, then both. Mutates pos (THREE.Vector3-like with x,z). */
    resolveCircle(pos, nx, nz, r) {
      if (!this._circleHits(nx, pos.z, r)) { pos.x = nx; }
      if (!this._circleHits(pos.x, nz, r)) { pos.z = nz; }
      // final clamp inside bounds (safety)
      pos.x = U.clamp(pos.x, this.bounds.minX + r, this.bounds.maxX - r);
      pos.z = U.clamp(pos.z, this.bounds.minZ + r, this.bounds.maxZ - r);
    }

    /** line-of-sight between two ground points (bullets block at chest height) */
    castLOS(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.001) return true;
      const T = root.BH.config.TUNING;
      const nx = dx / len, nz = dz / len;
      for (const ob of this.obstacles) {
        if (ob.h < T.obstacleBulletH) continue;
        const t = U.rayAABB2D(ax, az, nx, nz, ob.min.x, ob.min.z, ob.max.x, ob.max.z);
        if (t >= 0 && t < len - 0.05) return false;
      }
      return true;
    }

    /** is a point walkable? */
    isFree(x, z, r) { return !this._circleHits(x, z, r); }

    clear() {
      while (this.group.children.length) {
        const o = this.group.children.pop();
        if (o.geometry) o.geometry.dispose && o.geometry.dispose();
      }
      this.obstacles.length = 0;
      this.smokeVents.length = 0;
    }
  }

  root.BH.World = World;
})();
