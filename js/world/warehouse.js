/* ============================================================
   BLOODY HEIST — world/warehouse.js
   Level 1: "OPERATION: BACKDOOR" — industrial warehouse.
   Concrete floor, crates, shipping containers, barrels,
   pillars, industrial lamps, smoke, briefcase objectives.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class Warehouse extends root.BH.World {
    build() {
      const g = this.group;
      this.levelInfo = this.levelInfo || {};
      this.bounds = { minX: -22, maxX: 22, minZ: -15, maxZ: 15 };

      /* ---- materials ---- */
      const M = {
        wall: new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
        wallDark: new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.95 }),
        concrete: new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.95 }),
        wood: new THREE.MeshStandardMaterial({ map: root.BH.makeTexture("wood"), roughness: 0.85 }),
        woodDark: new THREE.MeshStandardMaterial({ color: 0x57402a, roughness: 0.9 }),
        container: new THREE.MeshStandardMaterial({ map: root.BH.makeTexture("rust"), roughness: 0.8, metalness: 0.35 }),
        barrel: new THREE.MeshStandardMaterial({ color: 0x8c3a22, roughness: 0.55, metalness: 0.5 }),
        metal: new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.4, metalness: 0.7 }),
        lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
        sign: new THREE.MeshBasicMaterial({ color: 0x39d97a }),
        window: new THREE.MeshBasicMaterial({ color: 0x2a3b52 }),
      };

      /* ---- floor ---- */
      this.makeFloor("concrete", 46, [11, 8]);
      // oil stains
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.CircleGeometry(1 + Math.random() * 1.6, 16),
          new THREE.MeshBasicMaterial({ color: 0x17181b, transparent: true, opacity: 0.5 }));
        s.rotation.x = -Math.PI / 2;
        s.position.set(U.rand(-18, 18), 0.005, U.rand(-12, 12));
        g.add(s);
      }

      /* ---- perimeter walls with gaps ---- */
      const WH = 3.4;
      // south (spawn) — gap in middle for entrance
      this.addBox(-11.3, 15, 21.4, 0.7, WH, { mat: M.wall, type: "wall" });
      this.addBox(11.3, 15, 21.4, 0.7, WH, { mat: M.wall, type: "wall" });
      // north — gap for exit
      this.addBox(-12, -15, 20, 0.7, WH, { mat: M.wallDark, type: "wall" });
      this.addBox(12, -15, 20, 0.7, WH, { mat: M.wallDark, type: "wall" });
      // west / east
      this.addBox(-22, 0, 0.7, 30.7, WH, { mat: M.wallDark, type: "wall" });
      this.addBox(22, 0, 0.7, 30.7, WH, { mat: M.wallDark, type: "wall" });

      // entrance lintel + door frame
      this.addBox(0, 15, 3.4, 0.7, 0.8, { y: 2.6, mat: M.metal, type: "wall" });
      this.addBox(-1.8, 15, 0.5, 0.9, 3.4, { mat: M.metal, type: "wall" });
      this.addBox(1.8, 15, 0.5, 0.9, 3.4, { mat: M.metal, type: "wall" });
      // entrance door (open, swung)
      const door = this.addBox(-2.9, 14.6, 0.12, 3.2, 3.2, { mat: M.metal, type: "wall", rotY: 0.5 });

      // windows on north wall (emissive panes)
      for (const wx of [-17, -7, 7, 17]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), M.window);
        p.position.set(wx, 2.2, -14.62);
        g.add(p);
        const frame = this.addBox(wx, -15, 3.4, 0.2, 0.15, { y: 3.0, mat: M.metal, noShadow: true, blockBullets: false });
      }

      /* ---- pillars ---- */
      for (const [px, pz] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) {
        this.addBox(px, pz, 1.1, 1.1, 5.4, { mat: M.concrete, type: "pillar" });
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.3, 1.14), M.metal);
        band.position.set(px, 0.2, pz);
        g.add(band);
      }

      /* ---- shipping containers ---- */
      const cMat = [M.container, M.container, M.container];
      const containers = [[-14, -8], [-9, -8], [-4, -8], [14, -7]];
      containers.forEach(([cx, cz], i) => {
        this.addBox(cx, cz, 4.2, 2.4, 2.6, { mat: cMat[i % 3], type: "container" });
        // door ribs on top
        for (let i2 = 0; i2 < 3; i2++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 2.44), M.metal);
          rib.position.set(cx - 1.6 + i2 * 1.6, 2.7, cz);
          g.add(rib);
        }
      });

      /* ---- crates ---- */
      const crate = (x, z, s, y, mat) => this.addBox(x, z, s, s, s, { y, mat: mat || M.wood, type: "crate" });
      // center cluster
      crate(1, 4, 2.2);
      crate(3.6, 4, 1.4);
      crate(1, 1.8, 1.4);
      crate(3.6, 1.8, 1.4, 0);
      crate(1, 4, 1.4, 2.2);
      // southeast cluster
      crate(10, 8, 2.0);
      crate(12.4, 8, 1.4);
      crate(10, 8, 1.4, 2.0);
      // southwest cluster
      crate(-12, 9, 1.8);
      crate(-14.2, 9, 1.2);
      crate(-12, 6.8, 1.2);
      // near exit
      crate(-5, -11, 1.4);
      crate(5, -11, 1.6);

      /* ---- barrels ---- */
      const barrels = [[-6, 9.5], [-5.1, 10.3], [7, -2], [7.9, -1.1], [18, 10.5], [-18, 2]];
      for (const [bx, bz] of barrels) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 14), M.barrel);
        b.position.set(bx, 0.6, bz);
        b.castShadow = true;
        g.add(b);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.465, 0.465, 0.08, 14), M.metal);
        ring.position.set(bx, 0.85, bz);
        g.add(ring);
        this.addObstacle(bx - 0.5, bz - 0.5, bx + 0.5, bz + 0.5, 1.2, "barrel");
      }

      /* ---- industrial lamps (hanging) ---- */
      const lampAt = (x, z, y = 4.6) => {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.4 - y, 6), M.metal);
        cord.position.set(x, 5.4 - (5.4 - y) / 2, z);
        g.add(cord);
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.42, 12, 1, true), M.metal);
        hood.position.set(x, y + 0.2, z);
        g.add(hood);
        const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), M.lamp);
        bulb.position.set(x, y, z);
        g.add(bulb);
        this.addPointLight(0xffc36b, 0.55, x, y - 0.6, z, 11);
      };
      lampAt(-14, -3); lampAt(0, -8); lampAt(14, -3);
      lampAt(-14, 8); lampAt(0, 3); lampAt(14, 8);

      /* ---- EXIT (escape) north ---- */
      const exitDoor = this.addBox(0, -15, 4, 0.3, 3.4, { mat: M.metal, type: "exitdoor" });
      const exitSign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), M.sign);
      exitSign.position.set(0, 3.7, -14.6);
      g.add(exitSign);
      const exitGlow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24),
        new THREE.MeshBasicMaterial({ color: 0x2fae5f, transparent: true, opacity: 0.16 }));
      exitGlow.rotation.x = -Math.PI / 2;
      exitGlow.position.set(0, 0.02, -13);
      g.add(exitGlow);
      this.addPointLight(0x39d97a, 0.4, 0, 2.5, -13, 8);

      /* ---- smoke vents ---- */
      this.smokeVents.push(new THREE.Vector3(-10, 5.2, -5), new THREE.Vector3(10, 5.2, 5), new THREE.Vector3(0, 5.0, -11));

      /* ---- briefcases (3 objectives) ---- */
      const briefcaseMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.4, metalness: 0.3 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a53c, roughness: 0.3, metalness: 0.8 });
      // [x, z, height, grabRadius]
      const spots = [[-9, -8, 2.72, 2.9], [1, 4, 3.62, 2.7], [11.2, 7.4, 0, 1.4]];
      this.levelInfo.briefcases = spots.map(([x, z, y, r]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.4), briefcaseMat);
        b.position.set(x, y + 0.18, z);
        b.rotation.y = U.rand(0, 3);
        b.castShadow = true;
        g.add(b);
        const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.42), goldMat);
        clasp.position.set(x, y + 0.36, z);
        clasp.rotation.y = b.rotation.y;
        g.add(clasp);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16),
          new THREE.MeshBasicMaterial({ color: 0xd4a53c, transparent: true, opacity: 0.2 }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(x, Math.max(0.03, y + 0.01), z);
        g.add(glow);
        return { x, z, mesh: b, glow, taken: false, y, r };
      });

      /* ---- level info ---- */
      this.levelInfo = Object.assign(this.levelInfo || {}, {
        name: "OPERATION: BACKDOOR",
        place: "Dockside Warehouse — Pier 9",
        ambience: "warehouse",
        keyLight: { color: 0xbfd0e8, intensity: 1.1, pos: [8, 22, 6] },
        fog: [0x0a0c10, 24, 62],
        spawns: [[-2.2, 13.2], [0, 13.6], [2.2, 13.2], [4.4, 13.6]],
        enemies: [
          { type: "guard", x: -14, z: -10.5, patrol: [[-14, -10.5], [-8, -10.5], [-4, -10.5]] },
          { type: "guard", x: -6, z: -12, patrol: [[-6, -12], [-6, -6]] },
          { type: "rifleman", x: 6, z: -10.5, patrol: [[6, -10.5], [10, -10.5]] },
          { type: "guard", x: 14, z: -4.5, patrol: [[14, -4.5], [14, 0]] },
          { type: "rifleman", x: -16, z: 2, patrol: [[-16, 2], [-12, 2]] },
          { type: "guard", x: 17, z: 4, patrol: [[17, 4], [13, 6]] },
          { type: "guard", x: -4, z: 8, patrol: [[-4, 8], [0, 6]] },
          { type: "heavy", x: 0, z: -3, patrol: [[0, -3], [3, 0], [0, 3]] },
        ],
        enemiesTotal: 8,
        briefcaseCount: 3,
        escape: { x: 0, z: -12.8, r: 2.6, label: "Escape north through the loading door" },
        objectives: [
          "Recover the 3 briefcases",
          "Eliminate all hostiles (" + 8 + ")",
          "Escape through the north exit",
        ],
      });

      this.setFog(...this.levelInfo.fog);
      this.setupKeyLight(this.levelInfo.keyLight);
    }
  }

  root.BH.Levels = root.BH.Levels || {};
  root.BH.Levels.warehouse = Warehouse;
})();
