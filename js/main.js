/* ============================================================
   BLOODY HEIST — main.js
   Boot: construct the game, show the menu over the live
   warehouse scene.
   ============================================================ */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  const canvas = document.getElementById("game-canvas");
  const game = new root.BH.Game(canvas);
  root.BH.game = game;

  function boot() {
    game.buildMenuWorld();
    game.ui.showMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
