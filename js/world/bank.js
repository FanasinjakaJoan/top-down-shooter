/* ============================================================
   BLOODY HEIST — world/bank.js
   Level 3: "OPERATION: SAFEHOUSE" — bank & vault.
   Tiled lobby, counters, security room, cameras, vault door,
   gold, emergency exit.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.BH = root.BH || {};
  const U = root.BH.utils;
  const THREE = root.THREE;

  class Bank extends root.BH.World {
    build() {
      const g = this.group;
      this.levelInfo = this.levelInfo || {};
      this.bounds = { minX: -16, maxX: 16, minZ: -18, maxZ: 18 };

      const M = {
        wall: new THREE.MeshStandardMaterial({ color: 0x6e675c, roughness: 0.9 }),
        wallDark: new THREE.MeshStandardMaterial({ color: 0x4d4a44, roughness: 0.9 }),
        marble: new THREE.MeshStandardMaterial({ color: 0x8d8779, roughness: 0.6 }),
        counter: new THREE.MeshStandardMaterial({ color: 0x3d3428, roughness: 0.5, metalness: 0.2 }),
        counterTop: new THREE.MeshStandardMaterial({ color: 0x57503f, roughness: 0.35 }),
        gold: new THREE.MeshStandardMaterial({ color: 0xd4a53c, roughness: 0.25, metalness: 0.9 }),
        steel: new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.3, metalness: 0.85 }),
        vault: new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.4, metalness: 0.7 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x25333f, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.55 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 }),
        sign: new THREE.MeshBasicMaterial({ color: 0x39d97a }),
        red: new THREE.MeshBasicMaterial({ color: 0xd94b53 }),
        cam: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.5 }),
        camLens: new THREE.MeshBasicMaterial({ color: 0xff4444 }),
        lamp: new THREE.MeshBasicMaterial({ color: 0xfff2d0 }),
      };

      this.makeFloor("banktiles", 34, [8, 9]);
      // carpet strip down the middle
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6, 34),
        new THREE.MeshStandardMaterial({ color: 0x5a2430, roughness: 1 }));
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(0, 0.012, 0);
      carpet.receiveShadow = true;
      g.add(carpet);

      const WH = 4.2;
      /* ---- perimeter with entrance gap (south) & west emergency exit ---- */
      this.addBox(-9.5, 18, 14.5, 0.7, WH, { mat: M.wall, type: "wall" });
      this.addBox(9.5, 18, 14.5, 0.7, WH, { mat: M.wall, type: "wall" });
      this.addBox(0, -18, 32.7, 0.7, WH, { mat: M.wall, type: "wall" });
      this.addBox(-16, -2.5, 0.7, 28, WH, { mat: M.wall, type: "wall" });   // west: gap for emergency exit
      this.addBox(-16, 14.5, 0.7, 6, WH, { mat: M.wall, type: "wall" });
      this.addBox(16, 0, 0.7, 36.7, WH, { mat: M.wall, type: "wall" });

      // grand entrance: columns + glass doors
      this.addBox(-3.2, 17.2, 1.0, 1.0, WH, { mat: M.marble, type: "pillar" });
      this.addBox(3.2, 17.2, 1.0, 1.0, WH, { mat: M.marble, type: "pillar" });
      const glassL = this.addBox(-1.6, 17.9, 1.5, 0.15, 3.6, { mat: M.glass, type: "window", noShadow: true });
      const glassR = this.addBox(1.6, 17.9, 1.5, 0.15, 3.6, { mat: M.glass, type: "window", noShadow: true });

      /* ---- lobby columns ---- */
      for (const [px, pz] of [[-8, 6], [8, 6], [-8, -4], [8, -4]]) {
        this.addBox(px, pz, 1.2, 1.2, WH, { mat: M.marble, type: "pillar" });
      }

      /* ---- service counters ---- */
      for (const cx of [-10.5, -3.5, 3.5, 10.5]) {
        this.addBox(cx, 9, 5, 0.9, 1.0, { mat: M.counter, type: "counter" });
        const top = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.08, 1.0), M.counterTop);
        top.position.set(cx, 1.04, 9);
        top.castShadow = true;
        g.add(top);
      }
      // teller booths (low glass, back of counters)
      for (const cx of [-10.5, -3.5, 3.5, 10.5]) {
        this.addBox(cx, 12.5, 5, 0.2, 1.4, { mat: M.glass, type: "window", noShadow: true, blockBullets: false });
      }

      /* ---- security room (NE corner) ---- */
      this.addBox(12.5, -13, 7, 7, 1.1, { mat: M.glass, type: "window", noShadow: true, blockBullets: false }); // low glass walls
      this.addBox(12.5, -16.4, 7, 0.2, 2.2, { mat: M.wallDark, type: "wall" });
      this.addBox(15.8, -13, 0.2, 7, 2.2, { mat: M.wallDark, type: "wall" });
      // desk inside
      this.addBox(13.5, -14.5, 2.4, 0.9, 0.8, { mat: M.counter, type: "counter" });
      // monitors (emissive)
      for (let i = 0; i < 3; i++) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06),
          new THREE.MeshBasicMaterial({ color: 0x3a7d5a }));
        mon.position.set(12.6 + i * 0.85, 1.15, -14.5);
        mon.rotation.y = -0.6;
        g.add(mon);
      }

      /* ---- vault (north center) ---- */
      this.addBox(0, -17.3, 6, 1.4, 4.2, { mat: M.vault, type: "wall" }); // vault wall section
      this.vaultDoorMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 24), M.steel);
      this.vaultDoorMesh.rotation.z = Math.PI / 2;
      this.vaultDoorMesh.rotation.y = Math.PI / 2;
      this.vaultDoorMesh.position.set(0, 1.7, -16.6);
      this.vaultDoorMesh.castShadow = true;
      g.add(this.vaultDoorMesh);
      // wheel
      this.vaultWheel = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 8, 20), M.steel);
      this.vaultWheel.position.set(0, 1.7, -16.25);
      g.add(this.vaultWheel);
      const vaultLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.1), M.red);
      vaultLight.position.set(0, 3.4, -16.5);
      g.add(vaultLight);
      this.vaultLight = vaultLight;
      // gold pile (hidden until vault open)
      this.goldGroup = new THREE.Group();
      for (let i = 0; i < 26; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.16), M.gold);
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 1.1;
        bar.position.set(Math.cos(a) * rr, 0.1 + Math.floor(Math.random() * 4) * 0.12, Math.sin(a) * rr);
        bar.rotation.y = Math.random() * Math.PI;
        bar.castShadow = true;
        this.goldGroup.add(bar);
      }
      this.goldGroup.position.set(0, 0, -15.6);
      this.goldGroup.visible = false;
      g.add(this.goldGroup);
      this.addPointLight(0xd4a53c, 0, 0, 2.2, -15.6, 8);
      this.goldLight = this._lights.children[this._lights.children.length - 1];

      /* ---- security cameras (3 destructible) ---- */
      const camSpots = [[-15.5, 14, -Math.PI / 2], [15.5, -2, Math.PI / 2], [0, 17.6, Math.PI]];
      this.levelInfo.cameras = camSpots.map(([x, z, ry]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), M.cam);
        pole.position.set(x, 0.58, z);
        g.add(pole);
        const head = new THREE.Group();
        head.position.set(x, 1.35, z);
        head.rotation.y = ry;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.55), M.cam);
        head.add(body);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 10), M.camLens);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 0, 0.32);
        head.add(lens);
        g.add(head);
        return {
          x, z, y: 1.35, head,
          hp: 30, alive: true,
        };
      });

      /* ---- ceiling lights (bank panels) ---- */
      const panel = (x, z) => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.6), M.lamp);
        p.position.set(x, 4.1, z);
        g.add(p);
        this.addPointLight(0xfff2d0, 0.4, x, 3.4, z, 10);
      };
      panel(-8, 8); panel(0, 8); panel(8, 8);
      panel(-8, -6); panel(0, -6); panel(8, -6);

      /* ---- emergency exit (west) ---- */
      const exitDoor = this.addBox(-15.7, -6, 0.4, 3, 3.4, { mat: M.dark, type: "exitdoor" });
      const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.8), M.sign);
      exitSign.position.set(-15.4, 3.7, -6);
      g.add(exitSign);
      const exitGlow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24),
        new THREE.MeshBasicMaterial({ color: 0x2fae5f, transparent: true, opacity: 0.16 }));
      exitGlow.rotation.x = -Math.PI / 2;
      exitGlow.position.set(-13.5, 0.02, -6);
      g.add(exitGlow);
      this.addPointLight(0x39d97a, 0.4, -13.5, 2.5, -6, 8);

      /* ---- decor: potted plants, benches ---- */
      for (const [px, pz] of [[-13, 14], [13, 14], [-13, -14], [13, 14.5]]) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.5, 10), M.dark);
        pot.position.set(px, 0.25, pz);
        g.add(pot);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x2e4a33, roughness: 0.9 }));
        leaf.position.set(px, 1.05, pz);
        leaf.castShadow = true;
        g.add(leaf);
      }

      this.smokeVents.push(new THREE.Vector3(0, 4.2, -15.6));

      this.levelInfo = Object.assign(this.levelInfo, {
        name: "OPERATION: SAFEHOUSE",
        place: "First Meridian Bank — Vault Floor",
        ambience: "bank",
        keyLight: { color: 0xd8d2c0, intensity: 1.0, pos: [6, 20, 10] },
        fog: [0x0b0c0e, 18, 52],
        spawns: [[-2.4, 15.8], [0, 16.2], [2.4, 15.8], [4.8, 16.2]],
        enemies: [
          { type: "guard", x: -3, z: 14, patrol: [[-3, 14], [3, 14]] },
          { type: "guard", x: 6, z: 12, patrol: [[6, 12], [10, 12]] },
          { type: "rifleman", x: -10.5, z: 11, patrol: [[-10.5, 11], [-6, 11]] },
          { type: "rifleman", x: 13.5, z: -13.5, patrol: [[13.5, -13.5], [11, -15]] },
          { type: "guard", x: -6, z: -12, patrol: [[-6, -12], [0, -13]] },
          { type: "heavy", x: 0, z: -9, patrol: [[0, -9], [4, -11], [0, -13]] },
        ],
        enemiesTotal: 6,
        vault: { x: 0, z: -14.6, r: 2.9, time: 3 },
        escape: { x: -13.5, z: -6, r: 2.6, label: "Escape west through the emergency exit" },
        objectives: [
          "Destroy the 3 security cameras",
          "Crack the vault (hold position 3s)",
          "Eliminate all hostiles (" + 6 + ")",
          "Escape west via the emergency exit",
        ],
      });

      this.setFog(...this.levelInfo.fog);
      this.setupKeyLight(this.levelInfo.keyLight);
    }
  }

  root.BH.Levels = root.BH.Levels || {};
  root.BH.Levels.bank = Bank;
})();
