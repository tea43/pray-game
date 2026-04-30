// P-RAY: The Game — modular entry point (skeleton)
// Phase 3: boots the canvas shell. Full game logic is extracted in Phase 4.
import { DISPLAY_NAME_DEFS } from './config/assets.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function drawPlaceholder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f5d04a';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(DISPLAY_NAME_DEFS.gameTitle, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = '#8a7a5a';
  ctx.font = '16px monospace';
  ctx.fillText('modular build skeleton — Phase 4 will wire the game', canvas.width / 2, canvas.height / 2 + 20);
  ctx.fillText('open wasteland_survivors-v4.html to play', canvas.width / 2, canvas.height / 2 + 44);
}

drawPlaceholder();
window.addEventListener('resize', drawPlaceholder);
