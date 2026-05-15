import { G } from '../globals.js';
import { state } from '../state.js';

// ── Terrain config ─────────────────────────────────────────────────────────────
// Edit these values to tune water penalty without touching game logic.
export const TERRAIN_CONFIG = {
  waterSpeedMult: 0.45, // heroes and enemies move at 45% speed inside water tiles
};

// Reusable typed-array buffers — resized only when world dimensions change.
let _field = new Float32Array(0);
let _dist  = new Int32Array(0);
let _bufN  = 0;

function _ensureBuffers() {
  const n = G.COLS * G.ROWS;
  if (n !== _bufN) {
    _field = new Float32Array(n * 2);
    _dist  = new Int32Array(n);
    _bufN  = n;
  }
}

export function terrainAt(wx, wy) {
  if (!state.terrain || state.terrain.length === 0) return 0;
  const col = Math.floor(wx / G.TILE);
  const row = Math.floor(wy / G.TILE);
  if (col < 0 || col >= G.COLS || row < 0 || row >= G.ROWS) return 2;
  return state.terrain[row * G.COLS + col];
}

// Only mountains (type 2) are impassable. Water (type 1) is passable but slow.
export function isWalkable(wx, wy) {
  return terrainAt(wx, wy) !== 2;
}

// Returns the speed multiplier for the terrain at (wx, wy). 1.0 on ground, <1 on water.
export function terrainSpeedMult(wx, wy) {
  return terrainAt(wx, wy) === 1 ? TERRAIN_CONFIG.waterSpeedMult : 1.0;
}

// BFS outward from (wx, wy) — returns centre of the nearest walkable tile.
export function nearestWalkable(wx, wy) {
  if (!state.terrain || state.terrain.length === 0) return { x: wx, y: wy };
  if (isWalkable(wx, wy)) return { x: wx, y: wy };

  const COLS = G.COLS, ROWS = G.ROWS, TILE = G.TILE;
  const startCol = Math.max(0, Math.min(COLS - 1, Math.floor(wx / TILE)));
  const startRow = Math.max(0, Math.min(ROWS - 1, Math.floor(wy / TILE)));

  const visited = new Uint8Array(COLS * ROWS);
  const queue = [startCol + startRow * COLS];
  visited[startRow * COLS + startCol] = 1;
  let head = 0;

  while (head < queue.length) {
    const packed = queue[head++];
    const c = packed % COLS, r = (packed / COLS) | 0;
    if (state.terrain[r * COLS + c] !== 2) {
      return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
    }
    for (const [dc, dr] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const ni = nr * COLS + nc;
      if (!visited[ni]) { visited[ni] = 1; queue.push(nc + nr * COLS); }
    }
  }

  return { x: G.WORLD_W / 2, y: G.WORLD_H / 2 };
}

// Multi-source BFS flow field directed toward the given hero positions.
// Returns a shared Float32Array[COLS*ROWS*2] of (dx, dy) unit vectors per tile.
// The array is reused each call — do not hold a reference across frames.
export function buildFlowField(heroPositions) {
  if (!state.terrain || state.terrain.length === 0 || G.COLS === 0) return _field;
  _ensureBuffers();
  const COLS = G.COLS, ROWS = G.ROWS, TILE = G.TILE;
  const terrain = state.terrain;

  _dist.fill(-1);
  _field.fill(0);

  const queue = [];

  // Seed BFS from every hero tile that is walkable
  for (const pos of heroPositions) {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(pos.x / TILE)));
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(pos.y / TILE)));
    const idx = row * COLS + col;
    if (_dist[idx] === -1 && terrain[idx] !== 2) {
      _dist[idx] = 0;
      queue.push(col + row * COLS);
    }
  }

  // Fallback: heroes are all on non-walkable tiles — find nearest walkable for each
  if (queue.length === 0) {
    for (const pos of heroPositions) {
      const w = nearestWalkable(pos.x, pos.y);
      const col = Math.max(0, Math.min(COLS - 1, Math.floor(w.x / TILE)));
      const row = Math.max(0, Math.min(ROWS - 1, Math.floor(w.y / TILE)));
      const idx = row * COLS + col;
      if (_dist[idx] === -1) { _dist[idx] = 0; queue.push(col + row * COLS); }
    }
  }

  // BFS outward across walkable tiles
  const DIRS4 = [[0,-1],[1,0],[0,1],[-1,0]];
  let head = 0;
  while (head < queue.length) {
    const packed = queue[head++];
    const c = packed % COLS, r = (packed / COLS) | 0;
    const d = _dist[r * COLS + c];
    for (const [dc, dr] of DIRS4) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const ni = nr * COLS + nc;
      if (_dist[ni] !== -1 || terrain[ni] === 2) continue;
      _dist[ni] = d + 1;
      queue.push(nc + nr * COLS);
    }
  }

  // Each walkable tile gets a direction vector toward the neighbour with lowest dist
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (terrain[idx] === 2 || _dist[idx] === -1) continue;
      let bestDist = _dist[idx], bestDx = 0, bestDy = 0;
      for (const [dc, dr] of DIRS4) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        if (_dist[ni] !== -1 && _dist[ni] < bestDist) {
          bestDist = _dist[ni]; bestDx = dc; bestDy = dr;
        }
      }
      _field[idx * 2]     = bestDx;
      _field[idx * 2 + 1] = bestDy;
    }
  }

  return _field;
}
