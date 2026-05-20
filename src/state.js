import { G } from './globals.js';
import { rand, randInt } from './utils/math.js';

export const state = {
  units: [],
  enemies: [],
  particles: [],
  bolts: [],
  projectiles: [],
  loot: [],
  explosions: [],
  shockwaves: [],
  debris: [],
  dust: [],
  cracks: [],
  bloodStains: [],
  grassTufts: [],
  embers: [],
  floatingTexts: [],
  terrain: new Uint8Array(0),
  waterTiles: [],
  flowField: null,
  selected: [],
  mouse: { x: 0, y: 0, down: false, downX: 0, downY: 0, startedOnUnit: false, clickedPortrait: false },
  selectionBox: null,
  moveMarkers: [],
  time: 0,
  shake: 0,
  hitStop: 0,
  flashAlpha: 0,
  flashColor: '#ffe0a0',
  kills: 0,
  wave: 1,
  waveTimer: 0,
  spawnTimer: 1.5,
  spawnInterval: 1.4,
  gameOver: false,
  allDeadPending: false,
  victory: false,
  allWavesCleared: false,
  extractionPhase: false,
  helicopter: null,
  timeFlow: 0,
  timeSpeed: 1,
  manualPause: false,
  spaceHeld: false,
  spaceHoldDuration: 0,
  survivedSeconds: 0,
  isUpgradeScreen: false,
  isLevelUpScreen: false,
  pendingLevelUps: 0,
  pendingUpgrades: { eliott: null, dick: null, habib: null },
  upgradeSpinCredits: 0,
  selectedUpgradeHistory: { eliott: [], dick: [], habib: [] },
  score: 0,
  heroesDied: 0,
  heroReviveCounts: { eliott: 0, dick: 0, habib: 0 },
  xp: 0,
  level: 1,
  xpToNext: 50,
  _levelUpFlash: 0,
  // Ability XP — shared pool filled by essence drops; triggers ability tree picker
  abilityXp: 0,
  abilityXpThreshold: 100,
  abilityXpPicks: 0,       // total picks unlocked across the run
  pendingAbilityPicks: 0,  // picks queued but not yet consumed by picker UI
  smokeZones: [],
  groupAbility: null,        // active group combo state; see src/systems/groupAbilities.js
  cinematicSlowdown: 0,      // 0 = off; 0..1 overrides normal timeFlow during group ability
  devAbilityTest: false,     // ability testing dev mode: charge stays full, enemies spawn close
  difficulty: 'brood-hunter',
  menuPhase: 'main',
  settings: (() => {
    try {
      const s = JSON.parse(localStorage.getItem('praySettings') || '{}');
      return { noShake: !!s.noShake, noLightning: !!s.noLightning, showPickupRing: false };
    } catch { return { noShake: false, noLightning: false, showPickupRing: false }; }
  })(),
};

export function generateTerrain() {
  // World dimensions are set by resize() before this is called.
  const WW = G.WORLD_W || G.W * 3;
  const WH = G.WORLD_H || G.PLAY_BOTTOM * 3;
  const TILE = G.TILE;
  const COLS = G.COLS = Math.ceil(WW / TILE);
  const ROWS = G.ROWS = Math.ceil(WH / TILE);

  // ── Terrain grid (procedural noise) ───────────────────────────────────────
  function hash(n) {
    n = Math.imul((n | 0) ^ 0xdeadbeef, 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0xac4d9413);
    return (n ^ (n >>> 13)) / 2147483648;
  }
  function noiseAt(tx, ty, seed) {
    const c = hash(Math.floor(tx / 5) * 2311 + Math.floor(ty / 4) * 7919 + seed * 997);
    const f = hash(tx * 1597 + ty * 4999 + seed * 131);
    return c * 0.72 + f * 0.28;
  }

  // Target ~5% obstacle coverage. noiseAt returns a non-uniform blend in [-1, 1].
  // Thresholds of 0.76 / 0.82 yield ~3.5% mountain + ~2% water before cleanup,
  // settling at ~4-5% total after isolated-tile removal.
  const grid = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = noiseAt(c, r, 0);
      const w = noiseAt(c, r, 37);
      if (m > 0.76) grid[r * COLS + c] = 2;       // mountain
      else if (w > 0.82) grid[r * COLS + c] = 1;  // water
    }
  }

  // Cleanup pass: remove isolated single-tile obstacles (no same-type neighbour).
  // At sparse density the old majority-vote rule grew nothing and this is more useful.
  const next = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cur = grid[r * COLS + c];
      if (cur === 0) { next[r * COLS + c] = 0; continue; }
      let sameNeighbour = false;
      for (let dr = -1; dr <= 1 && !sameNeighbour; dr++) {
        for (let dc = -1; dc <= 1 && !sameNeighbour; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          if (grid[nr * COLS + nc] === cur) sameNeighbour = true;
        }
      }
      next[r * COLS + c] = sameNeighbour ? cur : 0; // lone tile → ground
    }
  }
  grid.set(next);

  // Diagonal-separation pass: if an obstacle tile has a diagonal obstacle neighbour
  // (checked in top-left → bottom-right scan order so each pair is evaluated once),
  // remove the later tile. Guarantees no two obstacles share only a corner — prevents
  // the pinch points that trap enemies and heroes.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c] === 0) continue;
      if (
        (r > 0 && c > 0      && grid[(r - 1) * COLS + (c - 1)] !== 0) ||
        (r > 0 && c < COLS-1 && grid[(r - 1) * COLS + (c + 1)] !== 0)
      ) {
        grid[r * COLS + c] = 0;
      }
    }
  }

  // Clear world edges (enemies spawn off-screen and walk in; obstacles at the edge look wrong)
  const EDGE = 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < EDGE || r >= ROWS - EDGE || c < EDGE || c >= COLS - EDGE) {
        grid[r * COLS + c] = 0;
      }
    }
  }

  // Clear spawn area (world centre, 7-tile radius)
  const spawnCol = Math.floor(COLS / 2);
  const spawnRow = Math.floor(ROWS / 2);
  const clearR = 7;
  for (let dr = -clearR; dr <= clearR; dr++) {
    for (let dc = -clearR; dc <= clearR; dc++) {
      if (dr * dr + dc * dc > clearR * clearR) continue;
      const r = spawnRow + dr, c = spawnCol + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r * COLS + c] = 0;
    }
  }

  state.terrain = grid;

  // Collect water tile positions for animation
  state.waterTiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c] === 1) state.waterTiles.push({ tx: c * TILE, ty: r * TILE });
    }
  }

  // ── Decorative scatter (world-space) ────────────────────────────────────
  state.debris = [];
  const debrisCount = Math.round((WW * WH) / (G.W * G.PLAY_BOTTOM) * 90);
  for (let i = 0; i < debrisCount; i++) {
    state.debris.push({
      x: rand(20, WW - 20),
      y: rand(20, WH - 10),
      type: randInt(0, 4),
      rot: rand(0, Math.PI * 2),
      size: rand(0.7, 1.4),
      shade: rand(0.65, 1),
    });
  }

  state.cracks = [];
  const crackCount = Math.round((WW * WH) / (G.W * G.PLAY_BOTTOM) * 18);
  for (let i = 0; i < crackCount; i++) {
    const x = rand(0, WW), y = rand(0, WH);
    const len = rand(40, 120);
    const ang = rand(0, Math.PI * 2);
    const pts = [{ x, y }];
    let cx = x, cy = y;
    for (let s = 0; s < 5; s++) {
      cx += Math.cos(ang + rand(-0.5, 0.5)) * (len / 5);
      cy += Math.sin(ang + rand(-0.5, 0.5)) * (len / 5);
      pts.push({ x: cx, y: cy });
    }
    state.cracks.push(pts);
  }

  state.dust = [];
  const dustCount = Math.round((WW * WH) / (G.W * G.PLAY_BOTTOM) * 55);
  for (let i = 0; i < dustCount; i++) {
    state.dust.push({
      x: rand(0, WW), y: rand(0, WH),
      vx: rand(-12, 12), vy: rand(-4, 4),
      life: rand(0, 1), size: rand(0.6, 1.4),
    });
  }

  state.grassTufts = [];
  const tuftCount = Math.floor((WW * WH) / 24000) + 24;
  for (let i = 0; i < tuftCount; i++) {
    state.grassTufts.push({
      x: rand(8, WW - 8),
      y: rand(20, WH - 8),
      blades: randInt(3, 7),
      size: rand(0.7, 1.6),
      phase: rand(0, Math.PI * 2),
      hue: rand(150, 178),
      glow: rand(0.45, 1),
    });
  }

  // Embers stay screen-space — keep 60 regardless of world size.
  state.embers = [];
  for (let i = 0; i < 60; i++) {
    state.embers.push({
      x: rand(0, G.W),
      y: rand(0, G.PLAY_BOTTOM),
      vx: rand(-6, 6),
      vy: rand(-14, -2),
      life: rand(0, 4),
      maxLife: rand(3, 6),
      size: rand(0.6, 1.6),
      hue: rand(20, 60),
    });
  }
}
