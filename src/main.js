import { G } from './globals.js';
import { rand, dist2 } from './utils/math.js';
import { state, generateTerrain } from './state.js';
import { Unit } from './entities/Unit.js';
import { WAVE_DEFS } from './config/waves.js';
import { DIFFICULTY_DEFS } from './config/difficulty.js';
import { DISPLAY_NAME_DEFS, loadAssets } from './config/assets.js';
import manifest from './config/manifest.json';
import { spawnEnemy, spawnBoss } from './systems/spawning.js';
import { applyLoot } from './systems/loot.js';
import { initInput, setNewGameFn } from './systems/input.js';
import { initMenu, setMenuCallbacks, showMainMenu } from './systems/menu.js';
import { resetScore, addDeathPenalty, addWaveClearBonus, saveHighScore } from './systems/score.js';
import { drawBackground } from './render/background.js';
import { drawBolts, drawExplosions, drawShockwaves, drawParticles, drawFloatingTexts, drawScreenFlash, drawCRTOverlay } from './render/effects.js';
import { drawAbilityPanel, updateDust, updateHUD } from './render/hud.js';
import { playMusic, playSfx } from './systems/audio.js';

// ==================== INIT ====================
function initCanvas() {
  G.canvas = document.getElementById('game');
  G.ctx = G.canvas.getContext('2d');
  resize();
}

function resize() {
  G.canvas.width = window.innerWidth;
  G.canvas.height = window.innerHeight;
  G.W = G.canvas.width;
  G.H = G.canvas.height;
  G.PLAY_BOTTOM = G.H - G.PANEL_H - 22;
}

// ==================== NEW GAME ====================
function newGame() {
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];

  state.units = [];
  state.enemies = [];
  state.particles = [];
  state.bolts = [];
  state.projectiles = [];
  state.loot = [];
  state.explosions = [];
  state.shockwaves = [];
  state.bloodStains = [];
  state.floatingTexts = [];
  state.hitStop = 0;
  state.flashAlpha = 0;
  state.selected = [];
  state.moveMarkers = [];
  state.time = 0;
  state.kills = 0;
  state.wave = 1;
  state.waveTimer = 0;
  state.spawnTimer = 1.5;
  state.spawnInterval = WAVE_DEFS.spawnIntervalStart / diff.enemy.spawnMult;
  state.gameOver = false;
  state.victory = false;
  state.timeFlow = 0;
  state.manualPause = false;
  state.timeSpeed = 1;
  state.spaceHeld = false;
  state.spaceHoldDuration = 0;
  state.survivedSeconds = 0;
  state.menuPhase = 'playing';
  resetScore();
  playMusic('combat');

  document.getElementById('gameOverText').textContent = 'ALL SURVIVORS DEAD';
  document.getElementById('gameOverText').classList.remove('victory');

  const cx = G.W / 2, cy = G.PLAY_BOTTOM / 2;
  state.units.push(new Unit(cx - 44, cy + 8, 'elliot'));
  state.units.push(new Unit(cx, cy - 10, 'dick'));
  state.units.push(new Unit(cx + 44, cy + 8, 'habib'));

  document.getElementById('overlay').classList.remove('show');
  document.getElementById('survCount').textContent = state.units.length;
  updateHUD();
}

function startGame() {
  newGame();
}

// ==================== GAME LOOP ====================
let lastTime = performance.now();

function frame(now) {
  const realDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.spaceHeld) state.spaceHoldDuration += realDt;

  const anyMoving = state.units.some(u => !u.dead && u.moving);
  const spaceHoldDriving = state.spaceHeld && state.spaceHoldDuration >= 1.0;
  const targetFlow = state.menuPhase !== 'playing' ? 0
                   : state.gameOver ? 0
                   : spaceHoldDriving ? state.timeSpeed
                   : state.manualPause ? 0
                   : anyMoving ? state.timeSpeed
                   : 0;
  state.timeFlow += (targetFlow - state.timeFlow) * Math.min(1, realDt * 12);
  if (state.timeFlow < 0.001) state.timeFlow = 0;
  let gameDt = realDt * state.timeFlow;

  // Hit-stop: brief world freeze on heavy impacts. Decays in real time so playback feels responsive.
  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - realDt);
    gameDt = 0;
  }

  state.time += realDt;
  updateDust(realDt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - realDt * 18);
  if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - realDt * 3.2);

  // Drift embers in real time so atmosphere lives even while paused.
  if (state.embers && state.embers.length) {
    for (const em of state.embers) {
      em.x += em.vx * realDt;
      em.y += em.vy * realDt;
      em.life += realDt;
      if (em.life > em.maxLife || em.x < -10 || em.x > G.W + 10 || em.y < -20) {
        em.x = rand(0, G.W);
        em.y = G.PLAY_BOTTOM + rand(0, 30);
        em.vx = rand(-6, 6);
        em.vy = rand(-14, -2);
        em.life = 0;
        em.maxLife = rand(3, 6);
        em.size = rand(0.6, 1.6);
        em.hue = rand(20, 60);
      }
    }
  }

  // Floating damage/heal numbers age in real time so they read clearly.
  for (const ft of state.floatingTexts) ft.life -= realDt;
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

  // Walking dust under moving survivors.
  for (const u of state.units) {
    if (u.dead || !u.moving) continue;
    if (Math.random() < realDt * 14) {
      const ang = u.facing + Math.PI + rand(-0.5, 0.5);
      const v = rand(20, 50);
      state.particles.push({
        x: u.x + rand(-3, 3),
        y: u.y + u.r - 1 + rand(-1, 1),
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - rand(10, 30),
        life: rand(0.25, 0.55), maxLife: 0.55,
        color: 'rgba(220, 195, 150, 0.6)', size: rand(1.6, 2.6), realtime: true,
      });
    }
  }

  for (const m of state.moveMarkers) m.life -= realDt;
  state.moveMarkers = state.moveMarkers.filter(m => m.life > 0);

  for (const b of state.bolts) b.life -= realDt;
  state.bolts = state.bolts.filter(b => b.life > 0);

  // Loot visual update plays regardless of time freeze
  for (const l of state.loot) l.update(realDt);

  for (const p of state.particles) {
    const d = p.realtime ? realDt : gameDt;
    p.x += p.vx * d;
    p.y += p.vy * d;
    p.vy += 220 * d;
    p.life -= d;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  if (gameDt > 0 && !state.gameOver && state.menuPhase === 'playing') {
    state.survivedSeconds += gameDt;
    for (const u of state.units) u.update(gameDt);
    for (const e of state.enemies) e.update(gameDt);

    for (const pr of state.projectiles) pr.update(gameDt);
    state.projectiles = state.projectiles.filter(pr => !pr.dead);

    // Loot pickup
    for (const l of state.loot) {
      if (l.picked) continue;
      for (const u of state.units) {
        if (u.dead) continue;
        if (dist2(u.x, u.y, l.x, l.y) < u.r + l.r + 2) {
          l.picked = true;
          applyLoot(l, u);
          break;
        }
      }
    }
    state.loot = state.loot.filter(l => !l.picked);

    // Explosions
    for (const ex of state.explosions) {
      ex.life -= gameDt;
      ex.r += (ex.maxR - ex.r) * Math.min(1, gameDt * 8);
    }
    state.explosions = state.explosions.filter(ex => ex.life > 0);

    // Boss shockwaves
    for (const sw of state.shockwaves) {
      const prevR = sw.r;
      sw.r += sw.speed * gameDt;
      sw.life -= gameDt;
      for (const u of state.units) {
        if (u.dead || sw.hit.has(u)) continue;
        const d = dist2(sw.x, sw.y, u.x, u.y);
        if (d > prevR - 8 && d < sw.r + 8) {
          u.hp -= sw.dmg;
          u.hurtFlash = 1;
          sw.hit.add(u);
          const ang = Math.atan2(u.y - sw.y, u.x - sw.x);
          for (let i = 0; i < 10; i++) {
            state.particles.push({
              x: u.x + rand(-3, 3), y: u.y + rand(-3, 3),
              vx: Math.cos(ang) * rand(80, 160) + rand(-40, 40),
              vy: Math.sin(ang) * rand(80, 160) + rand(-80, -10),
              life: rand(0.3, 0.7), maxLife: 0.7,
              color: '#a83a2a', size: rand(1.2, 2.5), realtime: true,
            });
          }
          if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
        }
      }
      if (sw.r > sw.maxR) sw.life = 0;
    }
    state.shockwaves = state.shockwaves.filter(sw => sw.life > 0);

    for (const e of state.enemies) {
      if (e.dead && e.deathTimer < 0.1 && e.deathTimer + gameDt >= 0.1) {
        state.bloodStains.push({ x: e.x, y: e.y + 2, r: e.r * 1.4, rot: rand(0, Math.PI), a: 0.55 });
      }
    }
    state.enemies = state.enemies.filter(e => !(e.dead && e.deathTimer > 3));

    for (const u of state.units) {
      if (u.hp <= 0 && !u.dead) {
        u.dead = true;
        playSfx(`character.death.${u.type}`, { fallback: 'character.death.default', synthetic: 'death' });
        addDeathPenalty();
        const idx = state.selected.indexOf(u);
        if (idx >= 0) state.selected.splice(idx, 1);
        u.selected = false;
        state.bloodStains.push({ x: u.x, y: u.y + 2, r: u.r * 1.8, rot: rand(0, Math.PI), a: 0.6 });
        for (let i = 0; i < 25; i++) {
          state.particles.push({
            x: u.x, y: u.y,
            vx: rand(-130, 130), vy: rand(-160, -20),
            life: rand(0.7, 1.5), maxLife: 1.5,
            color: '#8a2a1a', size: rand(1.5, 3), realtime: true,
          });
        }
        if (!state.settings.noShake) state.shake = Math.max(state.shake, 7);
      }
    }

    if (state.bloodStains.length > 200) {
      state.bloodStains.splice(0, state.bloodStains.length - 200);
    }

    state.spawnTimer -= gameDt;
    if (state.spawnTimer <= 0) {
      const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
      const burst = WAVE_DEFS.burstChance * diff.enemy.burstChanceMult;
      spawnEnemy();
      if (state.wave >= WAVE_DEFS.secondSpawnWave && Math.random() < burst) spawnEnemy();
      if (state.wave >= WAVE_DEFS.thirdSpawnWave && Math.random() < burst) spawnEnemy();
      state.spawnTimer = state.spawnInterval * rand(0.7, 1.3);
    }

    state.waveTimer += gameDt;
    if (state.waveTimer > WAVE_DEFS.duration) {
      state.waveTimer = 0;
      if (state.wave < WAVE_DEFS.maxWave) {
        addWaveClearBonus(state.wave);
        state.wave++;
        state.spawnInterval = Math.max(WAVE_DEFS.spawnIntervalMin, state.spawnInterval * WAVE_DEFS.spawnIntervalScale);
        const waveDiff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
        const bossMap = waveDiff.enemy.bosses;
        const bigCount  = bossMap.bigboss?.[state.wave]  ?? 0;
        const miniCount = bossMap.miniboss?.[state.wave] ?? 0;
        for (let i = 0; i < bigCount;  i++) spawnBoss('bigboss');
        for (let i = 0; i < miniCount; i++) spawnBoss('miniboss');
        const bossLabel = bigCount  > 0 ? DISPLAY_NAME_DEFS.bigbossLabel
                        : miniCount > 0 ? DISPLAY_NAME_DEFS.minibossLabel
                        : null;
        playSfx('wave');
        state.moveMarkers.push({
          x: G.W / 2, y: G.PLAY_BOTTOM / 2, life: 1.6, maxLife: 1.6,
          type: 'wave', bossLabel,
        });
      } else {
        state.gameOver = true;
        state.victory = true;
        playMusic('menu');
        saveHighScore();
        const total = Math.floor(state.survivedSeconds);
        document.getElementById('gameOverText').textContent = 'YOU SURVIVED';
        document.getElementById('gameOverText').classList.add('victory');
        document.getElementById('finalStats').textContent =
          `ALL ${WAVE_DEFS.maxWave} WAVES CLEARED · KILLS ${state.kills} · SCORE ${state.score} · TIME ${total}s`;
        document.getElementById('overlay').classList.add('show');
      }
    }

    if (state.units.every(u => u.dead)) {
      state.gameOver = true;
      playMusic('menu');
      saveHighScore();
      const total = Math.floor(state.survivedSeconds);
      document.getElementById('finalStats').textContent =
        `SURVIVED ${total}s · KILLS ${state.kills} · SCORE ${state.score} · WAVE ${state.wave}`;
      document.getElementById('overlay').classList.add('show');
    }
  }

  // ==== DRAW ====
  const { ctx, W, PLAY_BOTTOM } = G;
  ctx.save();
  if (state.shake > 0 && !state.settings.noShake) ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));

  drawBackground();

  // Move markers (non-wave)
  for (const m of state.moveMarkers) {
    if (m.type === 'wave') continue;
    const t = 1 - m.life / m.maxLife;
    if (m.type === 'heal' || m.type === 'stim') {
      const alpha = Math.min(1, m.life / m.maxLife * 1.4);
      const yFloat = m.y - t * 20;
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = m.type === 'heal'
        ? `rgba(120, 230, 140, ${alpha})`
        : `rgba(255, 130, 90, ${alpha})`;
      ctx.fillText(m.text || '', m.x, yFloat);
      ctx.textAlign = 'left';
      continue;
    }
    ctx.strokeStyle = m.type === 'attack'
      ? `rgba(220, 80, 60, ${1 - t})`
      : `rgba(180, 220, 130, ${1 - t})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 4 + t * 14, 0, Math.PI * 2);
    ctx.stroke();
    if (m.type === 'attack') {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x - 8, m.y); ctx.lineTo(m.x + 8, m.y);
      ctx.moveTo(m.x, m.y - 8); ctx.lineTo(m.x, m.y + 8);
      ctx.stroke();
    }
  }

  // Sort and draw entities by Y
  const drawables = [];
  for (const u of state.units) if (!u.dead) drawables.push(u);
  for (const e of state.enemies) if (!e.dead) drawables.push(e);
  drawables.sort((a, b) => a.y - b.y);

  for (const e of state.enemies) if (e.dead) e.draw(ctx);
  for (const l of state.loot) l.draw(ctx);
  for (const ent of drawables) ent.draw(ctx);
  for (const pr of state.projectiles) pr.draw(ctx);

  drawBolts();
  drawExplosions();
  if (!state.settings.noLightning) drawShockwaves();
  drawParticles();
  drawFloatingTexts();

  // Selection box
  if (state.selectionBox) {
    const b = state.selectionBox;
    const x = Math.min(b.x1, b.x2), y = Math.min(b.y1, b.y2);
    const w = Math.abs(b.x2 - b.x1), h = Math.abs(b.y2 - b.y1);
    ctx.fillStyle = 'rgba(180, 220, 130, 0.14)';
    ctx.strokeStyle = 'rgba(180, 220, 130, 0.9)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();

  // Time freeze overlay — cool desaturating tint + faint vignette pulse.
  if (state.timeFlow < 1) {
    const pauseAmount = 1 - state.timeFlow;
    const tint = ctx.createLinearGradient(0, 0, 0, PLAY_BOTTOM + 8);
    tint.addColorStop(0,   `rgba(40, 50, 90, ${pauseAmount * 0.22})`);
    tint.addColorStop(0.5, `rgba(70, 60, 110, ${pauseAmount * 0.18})`);
    tint.addColorStop(1,   `rgba(20, 30, 60, ${pauseAmount * 0.26})`);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, PLAY_BOTTOM + 8);
    if (pauseAmount > 0.4) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 2);
      const ring = ctx.createRadialGradient(W / 2, PLAY_BOTTOM / 2, Math.min(W, PLAY_BOTTOM) * 0.35,
                                            W / 2, PLAY_BOTTOM / 2, Math.max(W, PLAY_BOTTOM) * 0.6);
      ring.addColorStop(0, 'rgba(120, 140, 200, 0)');
      ring.addColorStop(1, `rgba(100, 110, 200, ${(pauseAmount - 0.4) * (0.18 + pulse * 0.06)})`);
      ctx.fillStyle = ring;
      ctx.fillRect(0, 0, W, PLAY_BOTTOM + 8);
    }
  }

  // Screen flash for explosions / boss deaths / abilities.
  drawScreenFlash();

  drawCRTOverlay();

  // Wave announcements
  for (const m of state.moveMarkers) {
    if (m.type !== 'wave') continue;
    const t = 1 - m.life / m.maxLife;
    const alpha = m.life > 0.3 ? Math.min(1, (m.maxLife - m.life) * 3) : m.life * 3;
    const isBoss = !!m.bossLabel;
    const isBig = m.bossLabel === DISPLAY_NAME_DEFS.bigbossLabel;
    const titleColor = isBig ? `rgba(180, 240, 90, ${alpha})`
                     : isBoss ? `rgba(255, 130, 60, ${alpha})`
                     : `rgba(200, 60, 40, ${alpha * 0.9})`;
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${isBoss ? 46 : 42}px Georgia, serif`;
    ctx.textAlign = 'center';
    const y = m.y - t * 20;
    if (isBoss) {
      ctx.shadowColor = isBig ? '#a0ff40' : '#ff6020';
      ctx.shadowBlur = 12;
    }
    ctx.fillText(`WAVE ${state.wave}`, m.x, y);
    ctx.shadowBlur = 0;
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = isBoss
      ? (isBig ? `rgba(220, 255, 160, ${alpha * 0.9})` : `rgba(255, 200, 140, ${alpha * 0.9})`)
      : `rgba(200, 180, 140, ${alpha * 0.7})`;
    ctx.fillText(m.bossLabel || DISPLAY_NAME_DEFS.waveSubtext, m.x, y + 24);
    ctx.textAlign = 'left';
  }

  drawAbilityPanel();
  updateHUD();
  requestAnimationFrame(frame);
}

// ==================== BOOT ====================
initCanvas();
window.addEventListener('resize', () => {
  resize();
  generateTerrain();
});

setNewGameFn(newGame);
setMenuCallbacks(startGame, newGame);
initInput();
initMenu();

window.addEventListener('beforeunload', e => {
  if (state.menuPhase === 'playing' || state.menuPhase === 'paused') {
    e.preventDefault();
    e.returnValue = '';
  }
});

loadAssets(manifest);
generateTerrain();
requestAnimationFrame(frame);
