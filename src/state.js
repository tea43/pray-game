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
  roads: [],
  buildings: [],
  cloudShadows: [],
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
  nukeFlashAlpha: 0,    // sustained white-out for nuclear explosion effect
  nukeFlashDecay: 0,    // alpha units/sec (set from nukeFlash config when triggered)
  cameraZoom: 1.0,      // current zoom multiplier (1 = normal)
  cameraZoomTarget: 1.0,// zoom lerps toward this each frame
  cameraZoomSpeed: 0,   // lerp speed (set from config on trigger)
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

  // ── Water (flooded craters / basements) — passable but slow ───────────────
  const grid = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (noiseAt(c, r, 37) > 0.82) grid[r * COLS + c] = 1;
    }
  }

  // Cleanup pass: remove isolated single-tile water (no same-type neighbour).
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

  // ── Roads (walkable asphalt strips, decoration only) ──────────────────────
  const roadW = Math.round(TILE * 1.7);
  state.roads = [
    { x: 0, y: Math.round(WH * rand(0.2, 0.36)), w: WW, h: roadW, vertical: false, seed: randInt(1, 0x7fffffff) },
    { x: Math.round(WW * rand(0.62, 0.78)), y: 0, w: roadW, h: WH, vertical: true, seed: randInt(1, 0x7fffffff) },
  ];

  // ── Buildings — post-soviet blocks on impassable (type 2) tiles ───────────
  // Rectangular footprints; collision semantics identical to the old mountains
  // (terrain type 2). Visuals live in src/render/buildings.js.
  state.buildings = [];
  const screens = (WW * WH) / Math.max(1, G.W * G.PLAY_BOTTOM);
  const targetBuildings = Math.max(6, Math.round(screens * 1.5));
  let attempts = 0;
  while (state.buildings.length < targetBuildings && attempts++ < 500) {
    const cols = randInt(2, 5);
    const rows = randInt(2, 3);
    const c0 = randInt(EDGE + 1, COLS - EDGE - cols - 1);
    const r0 = randInt(EDGE + 1, ROWS - EDGE - rows - 1);
    if (c0 < EDGE + 1 || r0 < EDGE + 1) continue;

    // Keep clear of the hero spawn circle
    const nc = Math.max(c0, Math.min(spawnCol, c0 + cols - 1));
    const nr = Math.max(r0, Math.min(spawnRow, r0 + rows - 1));
    const dc = nc - spawnCol, dr = nr - spawnRow;
    if (dc * dc + dr * dr <= (clearR + 2) * (clearR + 2)) continue;

    // 2-tile buffer must be free of water and other buildings (no pinch points)
    let blocked = false;
    for (let r = r0 - 2; r <= r0 + rows + 1 && !blocked; r++) {
      for (let c = c0 - 2; c <= c0 + cols + 1 && !blocked; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (grid[r * COLS + c] !== 0) blocked = true;
      }
    }
    if (blocked) continue;

    // Stay off the roads (1-tile margin)
    const px = c0 * TILE, py = r0 * TILE, pw = cols * TILE, ph = rows * TILE;
    const m = TILE;
    if (state.roads.some(rd =>
      px - m < rd.x + rd.w && px + pw + m > rd.x &&
      py - m < rd.y + rd.h && py + ph + m > rd.y)) continue;

    for (let r = r0; r < r0 + rows; r++) {
      for (let c = c0; c < c0 + cols; c++) grid[r * COLS + c] = 2;
    }

    const styleRoll = Math.random();
    const style = styleRoll < 0.42 ? 'panelka' : styleRoll < 0.72 ? 'brick' : 'industrial';
    state.buildings.push({
      x: px, y: py, w: pw, h: ph, baseY: py + ph,
      style,
      // Facade height above the footprint top — squat industrial halls vs tall blocks
      extraUp: style === 'industrial' ? randInt(14, 44) : randInt(50, 130),
      seed: randInt(1, 0x7fffffff),
      alpha: 1,          // occlusion fade, updated each frame
      litWindows: null,  // filled when the facade cache is built
      _cv: null,         // offscreen facade cache (lazy)
    });
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

  // Cloud shadows — huge soft blobs drifting across the ground (world-space).
  // Positions are derived statelessly from state.time at draw, so only seeds live here.
  state.cloudShadows = [];
  for (let i = 0; i < 6; i++) {
    state.cloudShadows.push({
      x0: rand(0, WW), y0: rand(0, WH),
      r: rand(420, 820),
      vx: rand(5, 12) * (Math.random() < 0.5 ? -1 : 1),
      vy: rand(2, 5),
      a: rand(0.05, 0.09),
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
