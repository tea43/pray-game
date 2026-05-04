import { G } from '../../globals.js';
import { clamp, dist2 } from '../../utils/math.js';

const Keys = null; // resolved lazily from Phaser.Input.Keyboard.KeyCodes

export class InputSystem {
  constructor(scene, state) {
    this.scene  = scene;
    this.state  = state;
  }

  init() {
    const scene = this.scene;
    const state = this.state;

    // Disable right-click context menu on Phaser canvas
    scene.input.mouse?.disableContextMenu();

    // ── Mouse ────────────────────────────────────────────────────────────────

    scene.input.on('pointerdown', (ptr) => {
      if (state.gameOver || state.isUpgradeScreen) return;
      const { x, y } = ptr;
      state.mouse.x = x; state.mouse.y = y;

      if (ptr.leftButtonDown()) {
        const pu = this._getPortraitUnit(x, y);
        if (pu) {
          state.mouse.clickedPortrait = true;
          if (pu.dead) return;
          if (ptr.event.shiftKey) {
            const idx = state.selected.indexOf(pu);
            if (idx >= 0) state.selected.splice(idx, 1);
            else state.selected.push(pu);
          } else {
            state.selected = [pu];
          }
          for (const u of state.units) u.selected = state.selected.includes(u);
          return;
        }
        state.mouse.clickedPortrait = false;
        state.mouse.down  = true;
        state.mouse.downX = x;
        state.mouse.downY = y;
        state.selectionBox = null;
        state.mouse.startedOnUnit = state.units.some(u => !u.dead && dist2(x, y, u.x, u.y) < u.r + 4);
      }

      if (ptr.rightButtonDown()) {
        if (state.selected.length === 0) return;
        if (y > G.PLAY_BOTTOM + 10) return;

        let targetEnemy = null;
        for (const en of state.enemies) {
          if (en.dead) continue;
          if (dist2(x, y, en.x, en.y) < en.r + 6) { targetEnemy = en; break; }
        }

        if (targetEnemy) {
          for (const u of state.selected) u.attackMove(targetEnemy);
          state.moveMarkers.push({ x: targetEnemy.x, y: targetEnemy.y, life: 0.7, maxLife: 0.7, type: 'attack' });
        } else {
          const n = state.selected.length;
          if (n === 1) {
            state.selected[0].moveTo(x, y);
          } else {
            const spacing = 26;
            const cols = Math.ceil(Math.sqrt(n));
            state.selected.forEach((u, i) => {
              const row = Math.floor(i / cols);
              const col = i % cols;
              u.moveTo(x + (col - (cols - 1) / 2) * spacing, y + (row - (Math.ceil(n / cols) - 1) / 2) * spacing);
            });
          }
          state.moveMarkers.push({ x, y, life: 0.6, maxLife: 0.6, type: 'move' });
        }
      }
    });

    scene.input.on('pointermove', (ptr) => {
      state.mouse.x = ptr.x; state.mouse.y = ptr.y;
      if (state.mouse.down && !state.mouse.startedOnUnit) {
        if (dist2(ptr.x, ptr.y, state.mouse.downX, state.mouse.downY) > 6) {
          state.selectionBox = {
            x1: state.mouse.downX, y1: state.mouse.downY,
            x2: ptr.x, y2: ptr.y,
          };
        }
      }
    });

    scene.input.on('pointerup', (ptr) => {
      if (ptr.rightButtonReleased()) return;
      if (state.gameOver || state.mouse.clickedPortrait || state.isUpgradeScreen) {
        state.mouse.down = false; state.mouse.clickedPortrait = false; return;
      }
      if (!state.mouse.down) return;
      const { x, y } = ptr;

      if (state.selectionBox) {
        const box = state.selectionBox;
        const minX = Math.min(box.x1, box.x2), maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2), maxY = Math.max(box.y1, box.y2);
        if (!ptr.event.shiftKey) state.selected = [];
        for (const u of state.units) {
          if (u.dead) continue;
          if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
            if (!state.selected.includes(u)) state.selected.push(u);
          }
        }
        state.selectionBox = null;
      } else {
        let clicked = null;
        for (const u of state.units) {
          if (u.dead) continue;
          if (dist2(x, y, u.x, u.y) < u.r + 5) { clicked = u; break; }
        }
        if (clicked) {
          if (ptr.event.shiftKey) {
            const idx = state.selected.indexOf(clicked);
            if (idx >= 0) state.selected.splice(idx, 1);
            else state.selected.push(clicked);
          } else {
            state.selected = [clicked];
          }
        } else if (!ptr.event.shiftKey) {
          state.selected = [];
        }
      }

      for (const u of state.units) u.selected = state.selected.includes(u);
      state.mouse.down = false;
    });

    // ── Keyboard ─────────────────────────────────────────────────────────────

    const kb = scene.input.keyboard;

    kb.on('keydown', (e) => {
      if (state.gameOver || state.isUpgradeScreen) return;
      const k = e.key.toLowerCase();

      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        state.timeSpeed = clamp(state.timeSpeed + 1, 1, 3);
        return;
      }
      if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        state.timeSpeed = clamp(state.timeSpeed - 1, 1, 3);
        return;
      }
      if (k === 's') { for (const u of state.selected) u.stop(); return; }

      if (e.key === ' ') {
        e.preventDefault();
        if (!state.spaceHeld) { state.spaceHeld = true; state.spaceHoldDuration = 0; }
        return;
      }
      if (k === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        state.selected = state.units.filter(u => !u.dead);
        for (const u of state.units) u.selected = state.selected.includes(u);
        return;
      }
      if (k === 'q' || k === 'w' || k === 'e') {
        e.preventDefault();
        for (const u of state.selected) {
          if (u.abilityKey.toLowerCase() === k && !u.dead) u.cast();
        }
      }
    });

    kb.on('keyup', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (state.spaceHeld) {
          if (state.spaceHoldDuration < 1.0) state.manualPause = !state.manualPause;
          state.spaceHeld = false; state.spaceHoldDuration = 0;
        }
      }
    });
  }

  _getPortraitUnit(x, y) {
    const slotW = 150, gap = 12;
    const slots = this.state.units;
    const totalW = slots.length * slotW + (slots.length - 1) * gap;
    const startX = (G.W - totalW) / 2;
    const py = G.H - G.PANEL_H - 12;
    if (y < py || y > py + G.PANEL_H) return null;
    for (let i = 0; i < slots.length; i++) {
      const px = startX + i * (slotW + gap);
      if (x >= px && x <= px + slotW) return slots[i];
    }
    return null;
  }
}
