// Shared canvas references and dimension state.
// Updated by main.js on init and every resize.
export const G = {
  canvas: null,
  ctx: null,
  W: 0,
  H: 0,
  PANEL_H: 126,
  PLAY_BOTTOM: 0,
  // Large map
  WORLD_W: 0,
  WORLD_H: 0,
  TILE: 64,
  COLS: 0,
  ROWS: 0,
  camera: { x: 0, y: 0 },
};
