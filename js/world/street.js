/* ============================================================
   BLOODY HEIST — world/street.js
   Level 2: "OPERATION: NIGHT RUN" — urban street.
   Buildings, sidewalks, parked cars, street lamps, alleys,
   shops with neon signs, target car with the cash.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class Street extends root.BH.World {
    build() {
      const g = this.group;
      this.levelInfo = this.levelInfo || {};
      this.bounds = { minX: -23, maxX: 23, minZ: -13, maxZ: 13 };

      const M = {
        building: new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.95 }),
        building2: new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.95 }),
        sidewalk: new THREE.MeshStandardMaterial({ color: 0x52555a, roughness: 0.95 }),
        curb: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 }),
        car: new THREE.MeshStandardMaterial({ color: 0x5a1f24, roughness: 0.35, metalness: 0.6 }),
        car2: new THREE.MeshStandardMaterial({ color: 0x24303e, roughness: 0.4, metalness: 0.5 }),
        car3: new THREE.MeshStandardMaterial({ color: 0x51483a, roughness: 0.45, metalness: 0.4 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x1d2833, roughness: 0.15, metalness: 0.7 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 }),
        pole: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.6 }),
        lamp: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
        neon1: new THREE.MeshBasicMaterial({ color: 0xd94b53 }),
        neon2: new THREE.MeshBasicMaterial({ color: 0xe0a53a }),
        neon3: new THREE.MeshBasicMaterial({ color: 0x5fc7d4 }),
        dumpster: new THREE.MeshStandardMaterial({ color: 0x2c3a2e, roughness: 0.8 }),
        wood: new THREE.MeshStandardMaterial({ map: root.BH.makeTexture("wood"), roughness: 0.85 }),
      };

      /* ---- ground ---- */
      this.makeFloor("asphalt", 48, [12, 7]);
      // sidewalks (north & south strips)
      const sideN = new THREE.Mesh(new THREE.PlaneGeometry(46, 6.5), M.sidewalk);
      sideN.rotation.x = -Math.PI / 2;
      sideN.position.set(0, 0.012, -9.7);
      sideN.receiveShadow = true;
      g.add(sideN);
      const sideS = sideN.clone();
      sideS.position.set(0, 0.012, 9.7);
      g.add(sideS);
      // lane markings
      for (let x = -22; x < 22; x += 3.2) {
        const lm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18),
          new THREE.MeshBasicMaterial({ color: 0x9a8f6a, transparent: true, opacity: 0.7 }));
        lm.rotation.x = -Math.PI / 2;
        lm.position.set(x, 0.015, 0);
        g.add(lm);
      }
      // manhole
      const mh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), M.dark);
      mh.rotation.x = -Math.PI / 2;
      mh.position.set(8, 0.015, -2);
      g.add(mh);

      /* ---- buildings (with alley gaps) ---- */
      // north row: three blocks, alleys between
      this.addBox(-15.5, -9.4, 11, 7, 4.6, { mat: M.building, type: "wall" });
      this.addBox(-3.5, -9.6, 8.5, 6.6, 5.2, { mat: M.building2, type: "wall" });
      this.addBox(8.5, -9.4, 13, 7, 4.2, { mat: M.building, type: "wall" });
      // south row
      this.addBox(-16, 9.6, 10, 6.8, 4.4, { mat: M.building2, type: "wall" });
      this.addBox(-4, 9.4, 8, 7, 4.8, { mat: M.building, type: "wall" });
      this.addBox(9, 9.6, 13, 6.8, 4.2, { mat: M.building2, type: "wall" });

      // shop windows (emissive) + awnings on south row
      const awning = (x, z, w, col) => {
        const a = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 1.6), col);
        a.position.set(x, 2.4, z);
        a.rotation.x = 0.18;
        g.add(a);
      };
      this.addBox(-16, 6.4, 9, 0.3, 1.6, { y: 0.9, mat: M.glass, type: "window", noShadow: true });
      this.addBox(-4, 6.1, 7, 0.3, 1.6, { y: 0.9, mat: M.glass, type: "window", noShadow: true });
      this.addBox(9, 6.4, 12, 0.3, 1.6, { y: 0.9, mat: M.glass, type: "window", noShadow: true });
      awning(-16, 6.9, 9, M.neon1);
      awning(-4, 6.6, 7, M.neon3);
      awning(9, 6.9, 12, M.neon2);

      // neon signs
      const sign = (x, y, z, w, h, col, rotY = 0) => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), col);
        s.position.set(x, y, z);
        s.rotation.y = rotY;
        g.add(s);
      };
      sign(-16, 3.4, 6.1, 5, 0.7, M.neon1);
      sign(-4, 3.6, 5.9, 4.4, 0.7, M.neon3);
      sign(9, 3.2, 6.1, 6, 0.7, M.neon2);
      sign(-3.5, 4.0, -6.2, 5.5, 0.8, M.neon1);
      sign(8.5, 3.6, -5.9, 7, 0.7, M.neon3);

      /* ---- street lamps ---- */
      const lamp = (x, z) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8), M.pole);
        pole.position.set(x, 2.2, z);
        pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), M.pole);
        arm.position.set(x, 4.35, z + 0.55 * Math.sign(z > 0 ? -1 : 1));
        g.add(arm);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.6), M.lamp);
        head.position.set(x, 4.3, z + 1.1 * Math.sign(z > 0 ? -1 : 1));
        g.add(head);
        this.addPointLight(0xffd9a0, 0.5, x, 4.1, z + 1.1 * Math.sign(z > 0 ? -1 : 1), 10);
      };
      lamp(-12, -4.2); lamp(12, -4.2); lamp(-12, 4.2); lamp(12, 4.2);

      /* ---- parked cars ---- */
      const wheels = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 });
      const makeCar = (x, z, rotY, mat, isTarget) => {
        const c = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.85, 1.9), mat);
        body.position.y = 0.75;
        body.castShadow = true;
        c.add(body);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 1.7), M.glass);
        cabin.position.set(-0.2, 1.5, 0);
        c.add(cabin);
        for (const [wx, wz] of [[-1.4, 0.95], [1.4, 0.95], [-1.4, -0.95], [1.4, -0.95]]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), wheels);
          w.rotation.x = Math.PI / 2;
          w.position.set(wx, 0.34, wz);
          c.add(w);
        }
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.5), M.lamp);
        hl.position.set(2.16, 0.8, 0.6);
        const hl2 = hl.clone(); hl2.position.z = -0.6;
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.4), M.neon1);
        tl.position.set(-2.16, 0.85, 0.6);
        const tl2 = tl.clone(); tl2.position.z = -0.6;
        c.add(hl, hl2, tl, tl2);
        if (isTarget) {
          // open trunk glow
          const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.5), M.dark);
          trunk.position.set(-2.4, 1.0, 0);
          trunk.rotation.z = 0.5;
          c.add(trunk);
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
            new THREE.MeshBasicMaterial({ color: 0xd4a53c, transparent: true, opacity: 0.35 }));
          glow.rotation.y = -Math.PI / 2;
          glow.position.set(-2.25, 0.9, 0);
          c.add(glow);
        }
        c.position.set(x, 0, z);
        c.rotation.y = rotY;
        g.add(c);
        this.addObstacle(x - 2.3, z - 1.1, x + 2.3, z + 1.1, 1.9, "car");
        return c;
      };
      makeCar(-16, -4.8, 0, M.car2, false);
      makeCar(16, 4.8, Math.PI, M.car, false);
      makeCar(-9, 4.8, Math.PI, M.car3, false);
      const targetCar = makeCar(3, -4.8, 0, M.car2, true);

      /* ---- crates, pallets, dumpsters ---- */
      this.addBox(-21, 3, 1.2, 1.2, 0.9, { mat: M.wood, type: "crate" });
      this.addBox(-21, 5.2, 0.9, 0.9, 0.7, { mat: M.wood, type: "crate" });
      this.addBox(21, -8, 1.2, 1.2, 0.9, { mat: M.wood, type: "crate" });
      this.addBox(21, -10, 1.0, 1.0, 1.4, { mat: M.wood, type: "crate" });
      this.addBox(-12, -6.2, 2.4, 1.2, 1.1, { mat: M.dumpster, type: "dumpster" });
      this.addBox(13, 7.5, 2.4, 1.2, 1.1, { mat: M.dumpster, type: "dumpster" });
      // alley clutter
      this.addBox(-9, -6.5, 1.0, 1.0, 0.8, { mat: M.wood, type: "crate" });
      this.addBox(9, 6.8, 1.1, 1.1, 0.9, { mat: M.wood, type: "crate" });

      /* ---- east alley exit ---- */
      const exitGlow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24),
        new THREE.MeshBasicMaterial({ color: 0x2fae5f, transparent: true, opacity: 0.16 }));
      exitGlow.rotation.x = -Math.PI / 2;
      exitGlow.position.set(20.5, 0.02, 0);
      g.add(exitGlow);
      const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.8),
        new THREE.MeshBasicMaterial({ color: 0x39d97a }));
      exitSign.position.set(22.5, 3, 0);
      g.add(exitSign);
      this.addPointLight(0x39d97a, 0.4, 20.5, 2.5, 0, 8);

      this.smokeVents.push(new THREE.Vector3(-12, 4.8, -6.2), new THREE.Vector3(13, 4.6, 7.5));

      this.levelInfo = Object.assign(this.levelInfo, {
        name: "OPERATION: NIGHT RUN",
        place: "Mercer Street — Downtown",
        ambience: "street",
        keyLight: { color: 0x7f9cc9, intensity: 0.85, pos: [-10, 20, -8] },
        fog: [0x0a0b10, 20, 58],
        spawns: [[-2.2, 11.8], [0, 12.2], [2.2, 11.8], [4.4, 12.2]],
        enemies: [
          { type: "guard", x: -8, z: -1, patrol: [[-8, -1], [0, -1]] },
          { type: "guard", x: 8, z: 2, patrol: [[8, 2], [0, 2]] },
          { type: "rifleman", x: -9.2, z: -5.5, patrol: [[-9.2, -5.5], [-9.2, -1.5]] },
          { type: "guard", x: 3, z: -8, patrol: [[3, -8], [3, -6.5]] },
          { type: "guard", x: 14, z: 1, patrol: [[14, 1], [18, 1]] },
          { type: "rifleman", x: -15, z: 1, patrol: [[-15, 1], [-11, 1]] },
        ],
        enemiesTotal: 6,
        targetCar: { x: 0.6, z: -4.8, r: 2.2 },
        escape: { x: 20.5, z: 0, r: 2.4, label: "Escape east through the alley" },
        objectives: [
          "Steal the cash from the target car",
          "Eliminate all hostiles (" + 6 + ")",
          "Escape east through the alley",
        ],
      });

      this.setFog(...this.levelInfo.fog);
      this.setupKeyLight(this.levelInfo.keyLight);
      return targetCar;
    }
  }

  root.BH.Levels = root.BH.Levels || {};
  root.BH.Levels.street = Street;
})();
