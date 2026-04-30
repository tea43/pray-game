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
  selected: [],
  mouse: { x: 0, y: 0, down: false, downX: 0, downY: 0, startedOnUnit: false, clickedPortrait: false },
  selectionBox: null,
  moveMarkers: [],
  time: 0,
  shake: 0,
  kills: 0,
  wave: 1,
  waveTimer: 0,
  spawnTimer: 1.5,
  spawnInterval: 1.4,
  gameOver: false,
  victory: false,
  timeFlow: 0,
  timeSpeed: 1,
  manualPause: false,
  spaceHeld: false,
  spaceHoldDuration: 0,
  survivedSeconds: 0,
  score: 0,
  difficulty: 'brood-hunter',
  menuPhase: 'main',
};

export function generateTerrain() {
  state.debris = [];
  state.cracks = [];
  for (let i = 0; i < 90; i++) {
    state.debris.push({
      x: rand(20, G.W - 20),
      y: rand(20, G.PLAY_BOTTOM - 10),
      type: randInt(0, 4),
      rot: rand(0, Math.PI * 2),
      size: rand(0.7, 1.4),
      shade: rand(0.65, 1),
    });
  }
  for (let i = 0; i < 18; i++) {
    const x = rand(0, G.W), y = rand(0, G.PLAY_BOTTOM);
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
  for (let i = 0; i < 55; i++) {
    state.dust.push({
      x: rand(0, G.W), y: rand(0, G.PLAY_BOTTOM),
      vx: rand(-12, 12), vy: rand(-4, 4),
      life: rand(0, 1), size: rand(0.6, 1.4),
    });
  }
}
