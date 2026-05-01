import { G } from '../globals.js';
import { rand, randInt } from '../utils/math.js';
import { state } from '../state.js';
import { Enemy } from '../entities/Enemy.js';
import { WAVE_DEFS } from '../config/waves.js';
import { playSfx } from './audio.js';

export function spawnEnemy() {
  const edge = randInt(0, 3);
  let x, y;
  const margin = 40;
  if (edge === 0) { x = rand(-margin, G.W + margin); y = -margin; }
  else if (edge === 1) { x = G.W + margin; y = rand(-margin, G.PLAY_BOTTOM + margin); }
  else if (edge === 2) { x = rand(-margin, G.W + margin); y = G.PLAY_BOTTOM + margin; }
  else { x = -margin; y = rand(-margin, G.PLAY_BOTTOM + margin); }

  const r = Math.random();
  let kind;
  const w = state.wave;
  if (w >= 4 && r < 0.18) kind = 'mutant';
  else if (w >= 3 && r < (w >= 5 ? 0.32 : 0.22)) kind = 'blinker';
  else if (w >= 2 && r < (w >= 5 ? 0.52 : 0.40)) kind = 'runner';
  else if (w >= 2 && r < (w >= 5 ? 0.74 : 0.62)) kind = 'ghoul';
  else kind = 'raider';

  state.enemies.push(new Enemy(x, y, kind));
}

export function spawnBoss(kind) {
  const edge = randInt(0, 3);
  let x, y;
  const margin = 60;
  if (edge === 0) { x = rand(G.W * 0.2, G.W * 0.8); y = -margin; }
  else if (edge === 1) { x = G.W + margin; y = rand(G.PLAY_BOTTOM * 0.2, G.PLAY_BOTTOM * 0.8); }
  else if (edge === 2) { x = rand(G.W * 0.2, G.W * 0.8); y = G.PLAY_BOTTOM + margin; }
  else { x = -margin; y = rand(G.PLAY_BOTTOM * 0.2, G.PLAY_BOTTOM * 0.8); }
  state.enemies.push(new Enemy(x, y, kind));
  playSfx('boss.walk.default');
}
