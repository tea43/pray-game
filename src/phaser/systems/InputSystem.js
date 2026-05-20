import { G } from '../../globals.js';
import { clamp, dist2 } from '../../utils/math.js';
import { tryFireComboForSelection } from '../../systems/groupAbilities.js';

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
      if (state.gameOver || state.allDeadPending || state.isUpgradeScreen) return;
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
        // Convert screen → world for unit hit test
        const wx0 = x + G.camera.x, wy0 = y + G.camera.y;
        state.mouse.startedOnUnit = state.units.some(u => !u.dead && dist2(wx0, wy0, u.x, u.y) < u.r + 4);
      }

      if (ptr.rightButtonDown()) {
        if (y > G.PLAY_BOTTOM + 10) return;
        // Auto-select all living heroes if nothing selected
        if (state.selected.length === 0) {
          state.selected = state.units.filter(u => !u.dead);
          for (const u of state.units) u.selected = state.selected.includes(u);
          if (state.selected.length === 0) return;
        }

        // Convert screen → world coords
        const wx = x + G.camera.x, wy = y + G.camera.y;

        let targetEnemy = null;
        for (const en of state.enemies) {
          if (en.dead) continue;
          if (dist2(wx, wy, en.x, en.y) < en.r + 6) { targetEnemy = en; break; }
        }

        if (targetEnemy) {
          for (const u of state.selected) u.attackMove(targetEnemy);
          state.moveMarkers.push({ x: targetEnemy.x, y: targetEnemy.y, life: 0.7, maxLife: 0.7, type: 'attack' });
        } else {
          const dest = this._clampToLeash(wx, wy);
          const n = state.selected.length;
          if (n === 1) {
            state.selected[0].moveTo(dest.x, dest.y);
          } else {
            const spacing = 26;
            const cols = Math.ceil(Math.sqrt(n));
            state.selected.forEach((u, i) => {
              const row = Math.floor(i / cols);
              const col = i % cols;
              u.moveTo(dest.x + (col - (cols - 1) / 2) * spacing, dest.y + (row - (Math.ceil(n / cols) - 1) / 2) * spacing);
            });
          }
          state.moveMarkers.push({ x: dest.x, y: dest.y, life: 1.2, maxLife: 1.2, type: 'move' });
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
      if (state.gameOver || state.allDeadPending || state.mouse.clickedPortrait || state.isUpgradeScreen) {
        state.mouse.down = false; state.mouse.clickedPortrait = false; return;
      }
      if (!state.mouse.down) return;
      const { x, y } = ptr;

      if (state.selectionBox) {
        const box = state.selectionBox;
        // Box is screen-space; convert to world for unit comparison
        const minX = Math.min(box.x1, box.x2) + G.camera.x, maxX = Math.max(box.x1, box.x2) + G.camera.x;
        const minY = Math.min(box.y1, box.y2) + G.camera.y, maxY = Math.max(box.y1, box.y2) + G.camera.y;
        if (!ptr.event.shiftKey) state.selected = [];
        for (const u of state.units) {
          if (u.dead) continue;
          if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
            if (!state.selected.includes(u)) state.selected.push(u);
          }
        }
        state.selectionBox = null;
      } else {
        // Convert screen → world for unit hit test
        const wx = x + G.camera.x, wy = y + G.camera.y;
        let clicked = null;
        for (const u of state.units) {
          if (u.dead) continue;
          if (dist2(wx, wy, u.x, u.y) < u.r + 5) { clicked = u; break; }
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
      if (state.gameOver || state.allDeadPending || state.isUpgradeScreen) return;
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
      if (k === 'v') { for (const u of state.selected) u.stop(); return; }

      if (k === 's') {
        for (const u of state.units) {
          if (u.type === 'dick' && !u.dead) u.castTree(3);
        }
        return;
      }

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

      // Basic abilities: 1/2/3 (Eliott/Dick/Habib) — always fire immediately
      if (k === '1' || k === '2' || k === '3') {
        e.preventDefault();
        for (const u of state.units) {
          if (u.abilityKey === k && !u.dead) u.cast();
        }
      }

      // Group ability — F fires the combo for the currently selected heroes
      if (k === 'f' && !state.groupAbility) {
        e.preventDefault();
        tryFireComboForSelection(state.selected);
      }

      // Secondary ability trees: Q/W/E → tree 2; A/D → tree 3 (S handled above for Dick tree 3)
      const TREE_KEYS = {
        'q': { type: 'eliott', treeNum: 2 },
        'w': { type: 'dick',   treeNum: 2 },
        'e': { type: 'habib',  treeNum: 2 },
        'a': { type: 'eliott', treeNum: 3 },
        'd': { type: 'habib',  treeNum: 3 },
      };
      if (TREE_KEYS[k] && !e.ctrlKey && !e.metaKey) {
        const { type, treeNum } = TREE_KEYS[k];
        for (const u of state.units) {
          if (u.type === type && !u.dead) u.castTree(treeNum);
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

  _clampToLeash(wx, wy) {
    const living = this.state.units.filter(u => !u.dead);
    if (living.length < 2) return { x: wx, y: wy };
    // Use each hero's destination (tx, ty) so concurrent move commands account
    // for where heroes will end up, not just where they currently are.
    // Destination must be within one viewport of EVERY other hero's destination.
    const margin = 60;
    const maxSpreadX = G.W - margin * 2;
    const maxSpreadY = G.PLAY_BOTTOM - margin * 2;
    let loX = -Infinity, hiX = Infinity, loY = -Infinity, hiY = Infinity;
    for (const u of living) {
      loX = Math.max(loX, u.tx - maxSpreadX);
      hiX = Math.min(hiX, u.tx + maxSpreadX);
      loY = Math.max(loY, u.ty - maxSpreadY);
      hiY = Math.min(hiY, u.ty + maxSpreadY);
    }
    // If heroes are already spread wider than a viewport, pull toward their centroid
    if (loX > hiX) { const cx = living.reduce((s, u) => s + u.tx, 0) / living.length; loX = hiX = cx; }
    if (loY > hiY) { const cy = living.reduce((s, u) => s + u.ty, 0) / living.length; loY = hiY = cy; }
    return { x: clamp(wx, loX, hiX), y: clamp(wy, loY, hiY) };
  }

  _getPortraitUnit(x, y) {
    const slotW = 180, gap = 12;
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
