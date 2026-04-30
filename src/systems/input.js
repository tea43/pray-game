import { G } from '../globals.js';
import { clamp, dist2 } from '../utils/math.js';
import { state } from '../state.js';

// newGame is injected at init time to avoid circular deps
let _newGame = null;
export function setNewGameFn(fn) { _newGame = fn; }

function canvasPt(e) {
  const r = G.canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (G.canvas.width / r.width),
    y: (e.clientY - r.top) * (G.canvas.height / r.height),
  };
}

function getPortraitUnit(x, y) {
  const slotW = 150, slotH = G.PANEL_H, gap = 12;
  const slots = state.units;
  const totalW = slots.length * slotW + (slots.length - 1) * gap;
  const startX = (G.W - totalW) / 2;
  const py = G.H - slotH - 12;
  if (y < py || y > py + slotH) return null;
  for (let i = 0; i < slots.length; i++) {
    const px = startX + i * (slotW + gap);
    if (x >= px && x <= px + slotW) return slots[i];
  }
  return null;
}

export function initInput() {
  G.canvas.addEventListener('contextmenu', e => e.preventDefault());

  G.canvas.addEventListener('mousedown', (e) => {
    if (state.gameOver) return;
    const p = canvasPt(e);
    state.mouse.x = p.x; state.mouse.y = p.y;

    if (e.button === 0) {
      const pu = getPortraitUnit(p.x, p.y);
      if (pu) {
        state.mouse.clickedPortrait = true;
        if (pu.dead) return;
        if (e.shiftKey) {
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
      state.mouse.down = true;
      state.mouse.downX = p.x;
      state.mouse.downY = p.y;
      state.selectionBox = null;
      state.mouse.startedOnUnit = state.units.some(u => !u.dead && dist2(p.x, p.y, u.x, u.y) < u.r + 4);
    } else if (e.button === 2) {
      if (state.selected.length === 0) return;
      if (p.y > G.PLAY_BOTTOM + 10) return;

      let targetEnemy = null;
      for (const en of state.enemies) {
        if (en.dead) continue;
        if (dist2(p.x, p.y, en.x, en.y) < en.r + 6) { targetEnemy = en; break; }
      }

      if (targetEnemy) {
        for (const u of state.selected) u.attackMove(targetEnemy);
        state.moveMarkers.push({ x: targetEnemy.x, y: targetEnemy.y, life: 0.7, maxLife: 0.7, type: 'attack' });
      } else {
        const n = state.selected.length;
        if (n === 1) {
          state.selected[0].moveTo(p.x, p.y);
        } else {
          const spacing = 26;
          const cols = Math.ceil(Math.sqrt(n));
          const rows = Math.ceil(n / cols);
          state.selected.forEach((u, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const dx = (col - (cols - 1) / 2) * spacing;
            const dy = (row - (rows - 1) / 2) * spacing;
            u.moveTo(p.x + dx, p.y + dy);
          });
        }
        state.moveMarkers.push({ x: p.x, y: p.y, life: 0.6, maxLife: 0.6, type: 'move' });
      }
    }
  });

  G.canvas.addEventListener('mousemove', (e) => {
    const p = canvasPt(e);
    state.mouse.x = p.x; state.mouse.y = p.y;
    if (state.mouse.down && !state.mouse.startedOnUnit) {
      const dr = dist2(p.x, p.y, state.mouse.downX, state.mouse.downY);
      if (dr > 6) {
        state.selectionBox = {
          x1: state.mouse.downX, y1: state.mouse.downY,
          x2: p.x, y2: p.y,
        };
      }
    }
  });

  G.canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (state.gameOver || state.mouse.clickedPortrait) {
      state.mouse.down = false;
      state.mouse.clickedPortrait = false;
      return;
    }

    const p = canvasPt(e);

    if (state.selectionBox) {
      const box = state.selectionBox;
      const minX = Math.min(box.x1, box.x2), maxX = Math.max(box.x1, box.x2);
      const minY = Math.min(box.y1, box.y2), maxY = Math.max(box.y1, box.y2);
      if (!e.shiftKey) state.selected = [];
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
        if (dist2(p.x, p.y, u.x, u.y) < u.r + 5) { clicked = u; break; }
      }
      if (clicked) {
        if (e.shiftKey) {
          const idx = state.selected.indexOf(clicked);
          if (idx >= 0) state.selected.splice(idx, 1);
          else state.selected.push(clicked);
        } else {
          state.selected = [clicked];
        }
      } else if (!e.shiftKey) {
        state.selected = [];
      }
    }

    for (const u of state.units) u.selected = state.selected.includes(u);
    state.mouse.down = false;
  });

  document.addEventListener('keydown', (e) => {
    if (state.gameOver) {
      if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') _newGame && _newGame();
      return;
    }
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
    if (k === 's') {
      for (const u of state.selected) u.stop();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (!state.spaceHeld) {
        state.spaceHeld = true;
        state.spaceHoldDuration = 0;
      }
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

  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (state.spaceHeld) {
        if (state.spaceHoldDuration < 1.0) {
          state.manualPause = !state.manualPause;
        }
        state.spaceHeld = false;
        state.spaceHoldDuration = 0;
      }
    }
  });

  document.getElementById('restart').addEventListener('click', () => _newGame && _newGame());
}
