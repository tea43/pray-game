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
  state.allWavesCleared = false;
  state.extractionPhase = false;
  state.helicopter = null;
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

// ==================== VICTORY SCREEN ====================
function triggerVictoryScreen() {
  const overlay = document.getElementById('overlay');
  overlay.style.opacity = '0';
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';

  const video = document.getElementById('victoryBg');
  if (video) {
    video.src = '/assets/video/victory/victory.mp4';
    video.load();
    video.play().then(() => {
      video.style.display = 'block';
    }).catch(() => {});
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 3.5s ease-in';
    overlay.style.opacity = '1';
  }));
}

// ==================== HELICOPTER ====================
function drawHelicopter(ctx) {
  const heli = state.helicopter;
  if (!heli) return;
  const { x, y, flightState, radius } = heli;

  ctx.save();

  // Landing zone ring + fill
  if (flightState === 'landed') {
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 3);
    ctx.beginPath();
    ctx.arc(x, y + 18, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80, 200, 60, ${0.06 + pulse * 0.05})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(110, 250, 80, ${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // H marker on ground
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(130, 255, 90, ${0.5 + pulse * 0.25})`;
    ctx.fillText('H', x, y + 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  ctx.translate(x, y);

  // Ground shadow (flat ellipse below skids)
  ctx.save();
  ctx.scale(1, 0.28);
  ctx.beginPath();
  ctx.arc(0, 72, 32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  ctx.restore();

  // Main rotor blades (cross, fast spin)
  const ra = state.time * 14;
  ctx.strokeStyle = 'rgba(155, 165, 140, 0.82)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const a = ra + i * Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 8 - 16);
    ctx.lineTo(Math.cos(a + Math.PI) * 42, Math.sin(a + Math.PI) * 8 - 16);
    ctx.stroke();
  }

  // Body
  ctx.fillStyle = '#4a5c38';
  ctx.beginPath();
  ctx.roundRect(-23, -9, 46, 22, 5);
  ctx.fill();

  // Cockpit bubble
  ctx.fillStyle = '#3c4e2c';
  ctx.beginPath();
  ctx.roundRect(-23, -11, 24, 18, [6, 2, 2, 4]);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 230, 120, 0.3)';
  ctx.beginPath();
  ctx.roundRect(-21, -9, 20, 14, 4);
  ctx.fill();

  // Tail boom
  ctx.fillStyle = '#3a4a2a';
  ctx.fillRect(21, -3, 22, 7);

  // Tail rotor (vertical spin)
  const ta = state.time * 22;
  ctx.strokeStyle = 'rgba(140, 150, 125, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(41, Math.cos(ta) * 8);
  ctx.lineTo(41, -Math.cos(ta) * 8);
  ctx.stroke();

  // Skids
  ctx.strokeStyle = '#566245';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-20, 10); ctx.lineTo(-20, 17); ctx.lineTo(16, 17); ctx.lineTo(16, 10);
  ctx.moveTo(-14, 9);  ctx.lineTo(-14, 17);
  ctx.moveTo(10, 9);   ctx.lineTo(10, 17);
  ctx.stroke();

  // BOARD label above helicopter (only when landed)
  if (flightState === 'landed') {
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 3);
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(140, 255, 100, ${0.85 + pulse * 0.15})`;
    ctx.shadowColor = 'rgba(80, 200, 40, 0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText('▼ BOARD ▼', 0, -radius + 12);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  ctx.restore();
}

// ==================== GAME LOOP ====================
let lastTime = performance.now();

function frame(now) {
  const realDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.spaceHeld) state.spaceHoldDuration += realDt;

  const anyMoving = state.units.some(u => !u.dead && !u.boarded && u.moving);
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

    if (!state.allWavesCleared) {
      state.spawnTimer -= gameDt;
      if (state.spawnTimer <= 0) {
        const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
        const burst = WAVE_DEFS.burstChance * diff.enemy.burstChanceMult;
        spawnEnemy();
        if (state.wave >= WAVE_DEFS.secondSpawnWave && Math.random() < burst) spawnEnemy();
        if (state.wave >= WAVE_DEFS.thirdSpawnWave && Math.random() < burst) spawnEnemy();
        state.spawnTimer = state.spawnInterval * rand(0.7, 1.3);
      }
    }

    if (!state.allWavesCleared) state.waveTimer += gameDt;
    if (!state.allWavesCleared && state.waveTimer > WAVE_DEFS.duration) {
      state.waveTimer = 0;
      if (state.wave < WAVE_DEFS.maxWave) {
        addWaveClearBonus(state.wave);
        state.wave++;
        const waveDiff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
        const devWaves = waveDiff.devWaves;
        if (devWaves) {
          const nextDev = devWaves.find(w => w > state.wave - 1);
          if (nextDev && nextDev !== state.wave) {
            state.wave = nextDev;
            let iv = WAVE_DEFS.spawnIntervalStart / waveDiff.enemy.spawnMult;
            for (let i = 1; i < state.wave; i++) iv = Math.max(WAVE_DEFS.spawnIntervalMin, iv * WAVE_DEFS.spawnIntervalScale);
            state.spawnInterval = iv;
          } else {
            state.spawnInterval = Math.max(WAVE_DEFS.spawnIntervalMin, state.spawnInterval * WAVE_DEFS.spawnIntervalScale);
          }
        } else {
          state.spawnInterval = Math.max(WAVE_DEFS.spawnIntervalMin, state.spawnInterval * WAVE_DEFS.spawnIntervalScale);
        }
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
        addWaveClearBonus(state.wave);
        state.allWavesCleared = true;
        state.waveTimer = 0;
        playSfx('wave');
        state.moveMarkers.push({
          x: G.W / 2, y: G.PLAY_BOTTOM / 2, life: 2.5, maxLife: 2.5,
          type: 'wave', bossLabel: 'FINISH THEM ALL',
        });
      }
    }

    // Trigger extraction when all waves cleared and all enemies gone
    if (state.allWavesCleared && !state.extractionPhase && state.enemies.every(e => e.dead)) {
      state.extractionPhase = true;
      state.helicopter = {
        x: G.W / 2, y: -80,
        targetX: G.W / 2, targetY: G.PLAY_BOTTOM * 0.38,
        flightState: 'flying',
        boarded: new Set(),
        radius: 68,
      };
      playSfx('boss_spawn');
      state.moveMarkers.push({
        x: G.W / 2, y: G.PLAY_BOTTOM / 2, life: 3.0, maxLife: 3.0,
        type: 'wave', bossLabel: 'REACH THE HELICOPTER', extraction: true,
      });
    }

    // Update helicopter
    if (state.extractionPhase && state.helicopter) {
      const heli = state.helicopter;
      if (heli.flightState === 'flying') {
        const dx = heli.targetX - heli.x, dy = heli.targetY - heli.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 4) {
          heli.x = heli.targetX; heli.y = heli.targetY;
          heli.flightState = 'landed';
        } else {
          const spd = 130 * gameDt;
          heli.x += (dx / d) * spd;
          heli.y += (dy / d) * spd;
        }
      }
      if (heli.flightState === 'landed') {
        for (const u of state.units) {
          if (u.dead || heli.boarded.has(u)) continue;
          const dx = u.x - heli.x, dy = u.y - heli.y;
          if (Math.sqrt(dx * dx + dy * dy) < heli.radius) {
            heli.boarded.add(u);
            u.boarded = true;
            u.stop();
            playSfx('loot');
            for (let i = 0; i < 18; i++) {
              state.particles.push({
                x: u.x, y: u.y,
                vx: rand(-90, 90), vy: rand(-130, -20),
                life: rand(0.4, 1.0), maxLife: 1.0,
                color: '#80d040', size: rand(2, 4), realtime: true,
              });
            }
          }
        }
        const living = state.units.filter(u => !u.dead);
        if (living.length > 0 && living.every(u => heli.boarded.has(u))) {
          heli.flightState = 'departing';
          if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
          playSfx('boss_spawn');
        }
      }

      if (heli.flightState === 'departing') {
        heli.y -= 220 * gameDt;
        if (heli.y < -160) {
          heli.flightState = 'gone';
          state.gameOver = true;
          state.victory = true;
          playMusic('menu');
          saveHighScore();
          const total = Math.floor(state.survivedSeconds);
          document.getElementById('gameOverText').textContent = 'YOU SURVIVED';
          document.getElementById('gameOverText').classList.add('victory');
          document.getElementById('finalStats').textContent =
            `ALL ${WAVE_DEFS.maxWave} WAVES CLEARED · KILLS ${state.kills} · SCORE ${state.score} · TIME ${total}s`;
          triggerVictoryScreen();
        }
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
  for (const u of state.units) if (!u.dead && !u.boarded) drawables.push(u);
  for (const e of state.enemies) if (!e.dead) drawables.push(e);
  drawables.sort((a, b) => a.y - b.y);

  for (const e of state.enemies) if (e.dead) e.draw(ctx);
  for (const l of state.loot) l.draw(ctx);
  drawHelicopter(ctx);
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
    const isExtraction = !!m.extraction;
    const isBoss = !isExtraction && !!m.bossLabel;
    const isBig = !isExtraction && m.bossLabel === DISPLAY_NAME_DEFS.bigbossLabel;
    const titleColor = isExtraction ? `rgba(100, 255, 80, ${alpha})`
                     : isBig       ? `rgba(180, 240, 90, ${alpha})`
                     : isBoss      ? `rgba(255, 130, 60, ${alpha})`
                     :               `rgba(200, 60, 40, ${alpha * 0.9})`;
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${isBoss ? 46 : 42}px Georgia, serif`;
    ctx.textAlign = 'center';
    const y = m.y - t * 20;
    if (isBoss || isExtraction) {
      ctx.shadowColor = isExtraction ? '#40c820' : isBig ? '#a0ff40' : '#ff6020';
      ctx.shadowBlur = 12;
    }
    ctx.fillText(isExtraction ? 'EXTRACTION' : `WAVE ${state.wave}`, m.x, y);
    ctx.shadowBlur = 0;
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = isExtraction
      ? `rgba(160, 255, 120, ${alpha * 0.9})`
      : isBoss
        ? (isBig ? `rgba(220, 255, 160, ${alpha * 0.9})` : `rgba(255, 200, 140, ${alpha * 0.9})`)
        : `rgba(200, 180, 140, ${alpha * 0.7})`;
    ctx.fillText(m.bossLabel || DISPLAY_NAME_DEFS.waveSubtext, m.x, y + 24);
    ctx.textAlign = 'left';
  }

  // Extraction status banner
  if (state.extractionPhase && !state.gameOver) {
    const heli = state.helicopter;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 2.5);
    const boardedCount = heli ? heli.boarded.size : 0;
    const living = state.units.filter(u => !u.dead).length;
    const msg = heli && heli.flightState === 'flying'
      ? 'HELICOPTER INCOMING'
      : `REACH THE HELICOPTER  ${boardedCount} / ${living} BOARDED`;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(120, 255, 80, ${0.75 + pulse * 0.25})`;
    ctx.shadowColor = 'rgba(80, 200, 40, 0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(msg, W / 2, 16);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
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

const _htpBtn = document.getElementById('htpBtn');
const _controlsPanel = document.getElementById('controls');
_htpBtn.addEventListener('click', () => {
  const visible = _controlsPanel.classList.toggle('visible');
  _htpBtn.textContent = visible ? '× CLOSE' : '? HOW TO PLAY';
});
document.addEventListener('click', e => {
  if (_controlsPanel.classList.contains('visible') && e.target !== _htpBtn && !_controlsPanel.contains(e.target)) {
    _controlsPanel.classList.remove('visible');
    _htpBtn.textContent = '? HOW TO PLAY';
  }
});

window.addEventListener('beforeunload', e => {
  if (state.menuPhase === 'playing' || state.menuPhase === 'paused') {
    e.preventDefault();
    e.returnValue = '';
  }
});

loadAssets(manifest);
generateTerrain();
requestAnimationFrame(frame);
