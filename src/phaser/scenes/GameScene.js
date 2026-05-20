import Phaser from 'phaser';
import { G } from '../../globals.js';
import { state, generateTerrain } from '../../state.js';
import { Unit } from '../../entities/Unit.js';
import { WAVE_DEFS } from '../../config/waves.js';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';
import { DISPLAY_NAME_DEFS } from '../../config/assets.js';
import { spawnEnemy, spawnBoss, spawnAt } from '../../systems/spawning.js';
import { applyLoot } from '../../systems/loot.js';
import { rand, dist2, clamp } from '../../utils/math.js';
import { InputSystem } from '../systems/InputSystem.js';
import { playMusic, playSfx } from '../../systems/audio.js';
import { drawBackground, clearBackgroundCache } from '../../render/background.js';
import { drawBolts, drawExplosions, drawShockwaves, drawParticles, drawFloatingTexts, drawScreenFlash, drawCRTOverlay, drawPickupRings } from '../../render/effects.js';
import { drawAbilityPanel, updateDust } from '../../render/hud.js';
import { removeWaveUpgrades, applyWaveUpgrades, tickActiveSkillDurability } from '../../systems/upgrades.js';
import { buildFlowField } from '../../utils/terrain.js';
import { applyDeathPenalties, saveHighScore } from '../../systems/score.js';
import { preloadWeaponImages } from '../../render/weaponSprites.js';
import { updateGroupAbility, renderGroupAbility } from '../../systems/groupAbilities.js';
import { ABILITY_XP_CONFIG, WEAPON_XP_CONFIG } from '../../config/abilities.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this._realDt = 0;
  }

  init(data) {
    this._difficulty = data?.difficulty || 'brood-hunter';
  }

  create() {
    window.__prayInGame = true;
    preloadWeaponImages();
    this._syncG();

    // ── Canvas 2D texture bridge ───────────────────────────────────────────────
    // All existing render code (background.js, effects.js, entity draw methods)
    // writes to G.ctx which points to this CanvasTexture's 2D context.
    // Canvas is sized at physical pixels (DPR × CSS) so it maps 1:1 to the WebGL
    // framebuffer; ctx.scale(dpr, dpr) keeps all drawing coordinates in CSS space.
    // After each frame we call refresh() to upload to the GPU.
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.textures.exists('game-layer')) this.textures.remove('game-layer');
    this._canvasTex = this.textures.createCanvas('game-layer', G.W * this._dpr, G.H * this._dpr);
    G.ctx    = this._canvasTex.getContext();
    G.ctx.scale(this._dpr, this._dpr);
    G.canvas = this._canvasTex.getCanvas();

    // Single full-screen image displays the rendered frame at CSS dimensions
    this._renderImg = this.add.image(0, 0, 'game-layer').setOrigin(0, 0).setDisplaySize(G.W, G.H);

    this._input = new InputSystem(this, state);
    this._input.init();

    this._startNewGame();

    this.scale.on('resize', this._onResize, this);

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.launch('PauseScene');
      this.scene.pause('GameScene');
    });

    // Dev-mode only: K = kill all living enemies (triggers extraction)
    this.input.keyboard.on('keydown-K', () => {
      if (state.difficulty !== 'dev-mode') return;
      for (const e of state.enemies) {
        if (!e.dead) { e.hp = 0; }
      }
    });
  }

  _syncG() {
    G.W = this.scale.width;
    G.H = this.scale.height;
    G.PLAY_BOTTOM = G.H - G.PANEL_H - 22;
    G.WORLD_W = G.W * 3;
    G.WORLD_H = G.PLAY_BOTTOM * 3;
    G.COLS = Math.ceil(G.WORLD_W / G.TILE);
    G.ROWS = Math.ceil(G.WORLD_H / G.TILE);
  }

  _onResize() {
    this._syncG();
    if (this._canvasTex) {
      this._canvasTex.setSize(G.W * this._dpr, G.H * this._dpr);
      G.ctx = this._canvasTex.getContext();
      G.ctx.scale(this._dpr, this._dpr);
      G.canvas = this._canvasTex.getCanvas();
      this._renderImg.setDisplaySize(G.W, G.H);
    }
    generateTerrain();
    clearBackgroundCache();
  }

  _startNewGame() {
    state.difficulty = this._difficulty;
    const diff = DIFFICULTY_DEFS[this._difficulty] || DIFFICULTY_DEFS['brood-hunter'];

    Object.assign(state, {
      units: [], enemies: [], particles: [], bolts: [], projectiles: [], acidShots: [],
      loot: [], explosions: [], shockwaves: [], bloodStains: [], floatingTexts: [],
      hitStop: 0, flashAlpha: 0, selected: [], moveMarkers: [],
      time: 0, kills: 0, wave: 1, waveTimer: 0, spawnTimer: 1.5,
      spawnInterval: WAVE_DEFS.spawnIntervalStart / diff.enemy.spawnMult,
      gameOver: false, allDeadPending: false, victory: false, allWavesCleared: false,
      extractionPhase: false, helicopter: null, timeFlow: 0,
      manualPause: false, timeSpeed: 1, spaceHeld: false, spaceHoldDuration: 0,
      survivedSeconds: 0, menuPhase: 'playing', score: 0, heroesDied: 0,
      isUpgradeScreen: false, isLevelUpScreen: false, pendingLevelUps: 0, _pendingWaveUpgrade: false,
      pendingUpgrades: { eliott: null, dick: null, habib: null },
      upgradeSpinCredits: 0, selectedUpgradeHistory: { eliott: [], dick: [], habib: [] },
      xp: 0, level: 1, xpToNext: 50, _levelUpFlash: 0,
      abilityXp: 0, abilityXpThreshold: ABILITY_XP_CONFIG.startThreshold, abilityXpPicks: 0, pendingAbilityPicks: 0,
      heroReviveCounts: { eliott: 0, dick: 0, habib: 0 },
      groupAbility: null, cinematicSlowdown: 0,
      devAbilityTest: !!diff.devAbilityTest,
    });

    if (diff.devWaves?.length > 0) {
      state.wave = diff.devWaves[0];
      let iv = WAVE_DEFS.spawnIntervalStart / diff.enemy.spawnMult;
      for (let i = 1; i < state.wave; i++) {
        iv = Math.max(WAVE_DEFS.spawnIntervalMin, iv * WAVE_DEFS.spawnIntervalScale);
      }
      state.spawnInterval = iv;
    }

    generateTerrain();
    clearBackgroundCache();

    const cx = G.WORLD_W / 2, cy = G.WORLD_H / 2;
    state.units.push(new Unit(cx - 44, cy + 8,  'eliott'));
    state.units.push(new Unit(cx,       cy - 10, 'dick'));
    state.units.push(new Unit(cx + 44,  cy + 8,  'habib'));

    // Snap camera to world centre
    G.camera.x = Math.max(0, cx - G.W / 2);
    G.camera.y = Math.max(0, cy - G.PLAY_BOTTOM / 2);

    if (diff.devWaves?.length > 0) {
      const bossMap = diff.enemy.bosses;
      const bigCount  = bossMap.bigboss?.[state.wave]  ?? 0;
      const miniCount = bossMap.miniboss?.[state.wave] ?? 0;
      for (let i = 0; i < bigCount;  i++) spawnBoss('bigboss');
      for (let i = 0; i < miniCount; i++) spawnBoss('miniboss');

      // Pre-spawn all regular enemy types so they are visible immediately
      if (diff.devSpawn?.length > 0) {
        const slots = _devSpawnSlots(G.W, G.PLAY_BOTTOM, diff.devSpawn);
        diff.devSpawn.forEach(({ kind, count }) => {
          for (let i = 0; i < count; i++) {
            const pos = slots.shift() ?? { x: rand(80, G.WORLD_W - 80), y: rand(80, G.WORLD_H - 80) };
            spawnAt(pos.x, pos.y, kind);
          }
        });
      }
    }

    this.scene.launch('HUDScene');
    playMusic('game');
  }

  // ── Main update loop ─────────────────────────────────────────────────────────

  update(_time, delta) {
    if (state.menuPhase !== 'playing') return;
    this._realDt = Math.min(0.05, delta / 1000);
    this._updateTimeFlow(this._realDt);
    this._updateWorld(this._realDt);
    this._enforceGroupCohesion();
    this._updateCamera(this._realDt);
    this._draw(this._realDt);
    this._checkEndConditions();
  }

  _updateTimeFlow(realDt) {
    if (state.spaceHeld) state.spaceHoldDuration += realDt;
    const anyMoving     = state.units.some(u => !u.dead && !u.boarded && u.moving);
    const heliDeparting = state.helicopter?.flightState === 'departing';
    const anyAbilityActive = !!state.groupAbility || state.units.some(u => !u.dead && (
      (u._dominanceTargets?.length > 0) || u._wpHitReturn !== null ||
      u.flamethrowerTimer > 0 || u.acidGunTimer > 0 || u.millTimer > 0 || u.vortexTimer > 0 ||
      u.stonedTimer > 0
    ));
    const spaceHoldDriving = state.spaceHeld && state.spaceHoldDuration >= 1.0;
    let targetFlow = state.gameOver        ? 0
                   : state.allDeadPending  ? 1
                   : spaceHoldDriving      ? state.timeSpeed
                   : state.manualPause || state.isUpgradeScreen || state.isLevelUpScreen ? 0
                   : (anyMoving || heliDeparting || anyAbilityActive) ? state.timeSpeed
                   : 0;
    // Cinematic slowdown during group ability sequences overrides normal flow
    if (state.groupAbility && state.cinematicSlowdown > 0 && targetFlow > 0) {
      targetFlow = Math.min(targetFlow, state.cinematicSlowdown);
    }
    state.timeFlow += (targetFlow - state.timeFlow) * Math.min(1, realDt * 12);
    if (state.timeFlow < 0.001) state.timeFlow = 0;
  }

  _updateWorld(realDt) {
    let gameDt = realDt * state.timeFlow;
    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - realDt);
      gameDt = 0;
    }

    state.time += realDt;
    updateDust(realDt);
    if (state.shake > 0)      state.shake      = Math.max(0, state.shake      - realDt * 18);
    if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - realDt * 3.2);

    // Embers drift in real time (atmosphere lives even when paused)
    for (const em of state.embers || []) {
      em.x += em.vx * realDt; em.y += em.vy * realDt; em.life += realDt;
      if (em.life > em.maxLife || em.x < -10 || em.x > G.W + 10 || em.y < -20) {
        em.x = rand(0, G.W); em.y = G.PLAY_BOTTOM + rand(0, 30);
        em.vx = rand(-6, 6); em.vy = rand(-14, -2);
        em.life = 0; em.maxLife = rand(3, 6);
        em.size = rand(0.6, 1.6); em.hue = rand(20, 60);
      }
    }

    for (const ft of state.floatingTexts) ft.life -= realDt;
    state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

    // Walking dust under survivors (throttled under particle load)
    if (state.particles.length < 350) {
      for (const u of state.units) {
        if (u.dead || !u.moving) continue;
        if (Math.random() < realDt * 14) {
          const ang = u.facing + Math.PI + rand(-0.5, 0.5);
          const v = rand(20, 50);
          state.particles.push({
            x: u.x + rand(-3, 3), y: u.y + u.r - 1 + rand(-1, 1),
            vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - rand(10, 30),
            life: rand(0.25, 0.55), maxLife: 0.55,
            color: 'rgba(220, 195, 150, 0.6)', size: rand(1.6, 2.6), realtime: true,
          });
        }
      }
    }

    for (const m of state.moveMarkers) m.life -= realDt;
    state.moveMarkers = state.moveMarkers.filter(m => m.life > 0);
    for (const b of state.bolts) b.life -= realDt;
    state.bolts = state.bolts.filter(b => b.life > 0);
    for (const l of state.loot) l.update(realDt);

    for (const p of state.particles) {
      const d = p.realtime ? realDt : gameDt;
      p.x += p.vx * d; p.y += p.vy * d; p.vy += 220 * d; p.life -= d;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    // Open weapon level-up picker when pending and no other screen is active
    if (state.pendingLevelUps > 0 && !state.isLevelUpScreen && !state.isUpgradeScreen && !state.gameOver) {
      state.pendingLevelUps -= 1;
      state.isLevelUpScreen = true;
      this.scene.launch('WeaponLevelUpScene');
      this.scene.pause();
    }

    // Open ability upgrade picker when essence XP threshold crossed
    if (state.pendingAbilityPicks > 0 && !state.isUpgradeScreen && !state.isLevelUpScreen && !state.gameOver) {
      state.pendingAbilityPicks -= 1;
      state.isUpgradeScreen = true;
      this.scene.pause();
      this.scene.launch('UpgradeScene');
    }

    // Update group ability system (uses realDt for animation, gameDt for damage)
    updateGroupAbility(gameDt, realDt);
    // Keep superboost charge full in ability-test mode
    if (state.devAbilityTest) {
      for (const u of state.units) if (!u.dead) u.superboostCharge = 1;
    }

    if (gameDt > 0 && !state.gameOver) {
      state.survivedSeconds += gameDt;
      for (const u of state.units)    u.update(gameDt);
      // Rebuild flow field from living hero positions so enemies navigate around obstacles
      const _living = state.units.filter(u => !u.dead);
      if (_living.length > 0) state.flowField = buildFlowField(_living);
      for (const e of state.enemies)  e.update(gameDt);
      for (const pr of state.projectiles) pr.update(gameDt);
      state.projectiles = state.projectiles.filter(pr => !pr.dead);

      // Update acid shots
      if (state.acidShots?.length) {
        for (const shot of state.acidShots) {
          if (shot.dead) continue;
          shot.x += shot.vx * gameDt;
          shot.y += shot.vy * gameDt;
          shot.life -= gameDt;
          if (shot.life <= 0 || shot.x < 0 || shot.x > G.W || shot.y < 0 || shot.y > G.PLAY_BOTTOM) {
            shot.dead = true; continue;
          }
          for (const e of state.enemies) {
            if (e.dead) continue;
            if (dist2(shot.x, shot.y, e.x, e.y) < e.r + 6) {
              const baseDmg = shot.damage ?? 15;
              const dmg = Math.round(baseDmg * (shot.owner?.upgradeDmgMult || 1));
              e.hp -= dmg;
              e.hurtFlash = 0.4;
              e.acidDot = Math.max(e.acidDot || 0, shot.acidDuration ?? 3);
              if (shot.slowDuration > 0) {
                e.slowTimer = Math.max(e.slowTimer, shot.slowDuration);
                e.slowFactor = Math.min(e.slowFactor, shot.slowFactor ?? 0.5);
              }
              for (let i = 0; i < 10; i++) {
                const a = Math.random() * Math.PI * 2;
                const v = 40 + Math.random() * 80;
                state.particles.push({ x: shot.x, y: shot.y, vx: Math.cos(a)*v, vy: Math.sin(a)*v-20, life: 0.2+Math.random()*0.4, maxLife:0.5, color: i%2?'#40ff40':'#a0ff80', size: 2+Math.random()*3, realtime: true });
              }
              shot.dead = true; break;
            }
          }
        }
        state.acidShots = state.acidShots.filter(s => !s.dead);
      }

      // Loot pickup
      //  - Essence: Vampire-Survivors-style magnetism. Enters a hero's pickupR
      //    → locks onto that hero, accelerates toward them each frame, pops on
      //    body contact. Re-acquires nearest living hero if the target dies
      //    mid-flight; orphans if all heroes are dead.
      //  - All other loot: body contact only (u.r + l.r + 2).
      const ESSENCE_HOMING_BASE  = 60;    // px/s, speed at moment of capture
      const ESSENCE_HOMING_ACCEL = 300;   // px/s², gradual acceleration
      const ESSENCE_HOMING_MAX   = 280;   // px/s, terminal speed
      for (const l of state.loot) {
        if (l.picked) continue;

        if (l.type === 'essence') {
          // Target acquisition
          if (!l.homingTarget) {
            let bestU = null, bestD = Infinity;
            for (const u of state.units) {
              if (u.dead) continue;
              const d = dist2(u.x, u.y, l.x, l.y);
              if (d < u.pickupR && d < bestD) { bestU = u; bestD = d; }
            }
            if (bestU) { l.homingTarget = bestU; l.homingSpeed = ESSENCE_HOMING_BASE; }
          } else if (l.homingTarget.dead) {
            // Re-acquire nearest living hero (no radius gate — the orb is already in flight)
            let bestU = null, bestD = Infinity;
            for (const u of state.units) {
              if (u.dead) continue;
              const d = dist2(u.x, u.y, l.x, l.y);
              if (d < bestD) { bestU = u; bestD = d; }
            }
            l.homingTarget = bestU;
          }

          // Homing motion + arrival
          if (l.homingTarget && !l.homingTarget.dead) {
            const u = l.homingTarget;
            const dx = u.x - l.x, dy = u.y - l.y;
            const d = Math.hypot(dx, dy);
            l.homingSpeed = Math.min(
              ESSENCE_HOMING_MAX,
              (l.homingSpeed || ESSENCE_HOMING_BASE) + ESSENCE_HOMING_ACCEL * gameDt
            );
            const step = l.homingSpeed * gameDt;
            const arriveLimit = u.r + l.r + 2;
            if (d <= step + arriveLimit) {
              for (let i = 0; i < 8; i++) {
                const a = Math.random() * Math.PI * 2;
                const v = rand(40, 110);
                state.particles.push({
                  x: l.x, y: l.y,
                  vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
                  life: rand(0.25, 0.5), maxLife: 0.5,
                  color: i % 2 ? '#d0ff80' : '#60dd40',
                  size: rand(1.2, 2.4), additive: true, realtime: true,
                });
              }
              l.picked = true;
              applyLoot(l, u);
            } else if (d > 0.001) {
              l.x += (dx / d) * step;
              l.y += (dy / d) * step;
            }
          }
        } else {
          for (const u of state.units) {
            if (u.dead) continue;
            if (dist2(u.x, u.y, l.x, l.y) < u.r + l.r + 2) { l.picked = true; applyLoot(l, u); break; }
          }
        }
      }
      state.loot = state.loot.filter(l => !l.picked);

      for (const ex of state.explosions) {
        ex.life -= gameDt;
        ex.r += (ex.maxR - ex.r) * Math.min(1, gameDt * 8);
      }
      state.explosions = state.explosions.filter(ex => ex.life > 0);

      for (const sw of state.shockwaves) {
        const prevR = sw.r;
        sw.r += sw.speed * gameDt;
        sw.life -= gameDt;
        for (const u of state.units) {
          if (u.dead || sw.hit.has(u)) continue;
          const d = dist2(sw.x, sw.y, u.x, u.y);
          if (d > prevR - 8 && d < sw.r + 8) {
            u.hp -= sw.dmg; u.hurtFlash = 1; sw.hit.add(u);
            const ang = Math.atan2(u.y - sw.y, u.x - sw.x);
            for (let i = 0; i < 10; i++) {
              state.particles.push({
                x: u.x + rand(-3, 3), y: u.y + rand(-3, 3),
                vx: Math.cos(ang) * rand(80, 160) + rand(-40, 40),
                vy: Math.sin(ang) * rand(80, 160) + rand(-80, -10),
                life: rand(0.3, 0.7), maxLife: 0.7, color: '#a83a2a', size: rand(1.2, 2.5), realtime: true,
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
        if (u.hp <= 0 && !u.dead && u.immortalTimer <= 0) {
          playSfx('character.death.' + u.type);
          u.dead = true;
          u.deathX = u.x; u.deathY = u.y;
          state.heroesDied = (state.heroesDied || 0) + 1;
          const idx = state.selected.indexOf(u);
          if (idx >= 0) state.selected.splice(idx, 1);
          u.selected = false;
          state.bloodStains.push({ x: u.x, y: u.y + 2, r: u.r * 1.8, rot: rand(0, Math.PI), a: 0.6 });
          for (let i = 0; i < 25; i++) {
            state.particles.push({
              x: u.x, y: u.y, vx: rand(-130, 130), vy: rand(-160, -20),
              life: rand(0.7, 1.5), maxLife: 1.5, color: '#8a2a1a', size: rand(1.5, 3), realtime: true,
            });
          }
          if (!state.settings.noShake) state.shake = Math.max(state.shake, 7);
        }
      }
      if (state.bloodStains.length > 200) state.bloodStains.splice(0, state.bloodStains.length - 200);

      this._updateWaves(gameDt);
      this._updateHelicopterLogic(gameDt);
    }
  }

  _anyAbilityInProgress() {
    if (state.groupAbility) return true;
    return state.units.some(u => !u.dead && (
      (u._dominanceTargets?.length > 0) || u._wpHitReturn !== null ||
      u.flamethrowerTimer > 0 || u.acidGunTimer > 0 ||
      u.millTimer > 0 || u.vortexTimer > 0 || u.boomerang !== null
    ));
  }

  _updateWaves(gameDt) {
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];

    if (!state.allWavesCleared) {
      state.spawnTimer -= gameDt;
      if (state.spawnTimer <= 0) {
        const burst = WAVE_DEFS.burstChance * diff.enemy.burstChanceMult;
        if (state.devAbilityTest) {
          _spawnCloseToHeroes();
        } else {
          spawnEnemy();
          if (state.wave >= WAVE_DEFS.secondSpawnWave && Math.random() < burst) spawnEnemy();
          if (state.wave >= WAVE_DEFS.thirdSpawnWave  && Math.random() < burst) spawnEnemy();
        }
        state.spawnTimer = state.spawnInterval * rand(0.7, 1.3);
      }
    }

    if (!state.allWavesCleared) state.waveTimer += gameDt;
    if (!state.allWavesCleared && state.waveTimer > WAVE_DEFS.duration) {
      state.waveTimer = 0;
      state._pendingWaveUpgrade = true;
    }

    if (state._pendingWaveUpgrade && !state.allWavesCleared && !this._anyAbilityInProgress()) {
      state._pendingWaveUpgrade = false;
      if (state.wave < WAVE_DEFS.maxWave) {
        // Reset per-wave passive bonuses and advance wave immediately (no upgrade screen here)
        removeWaveUpgrades();
        tickActiveSkillDurability();
        this.advanceWave();
      } else {
        state.allWavesCleared = true;
        state.waveTimer = 0;
        state.moveMarkers.push({
          x: G.W / 2, y: G.PLAY_BOTTOM / 2, life: 2.5, maxLife: 2.5,
          type: 'wave', bossLabel: 'FINISH THEM ALL',
        });
      }
    }

    if (state.allWavesCleared && !state.extractionPhase && state.enemies.every(e => e.dead)) {
      state.extractionPhase = true;
      const living = state.units.filter(u => !u.dead);
      const hcx = living.length > 0 ? living.reduce((s, u) => s + u.x, 0) / living.length : G.WORLD_W / 2;
      const hcy = living.length > 0 ? living.reduce((s, u) => s + u.y, 0) / living.length : G.WORLD_H / 2;
      const htx = clamp(hcx, 80, G.WORLD_W - 80);
      const hty = clamp(hcy - 80, 80, G.WORLD_H - 80);
      state.helicopter = {
        x: htx, y: G.camera.y - 80,
        targetX: htx, targetY: hty,
        flightState: 'flying', boarded: new Set(), radius: 68,
      };
      state.moveMarkers.push({
        x: G.W / 2, y: G.PLAY_BOTTOM / 2, life: 3.0, maxLife: 3.0,
        type: 'wave', bossLabel: 'REACH THE HELICOPTER', extraction: true,
      });
    }
  }

  advanceWave() {
    state.isUpgradeScreen = false;
    state.wave++;
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
    const devWaves = diff.devWaves;
    if (devWaves) {
      const nextDev = devWaves.find(w => w > state.wave - 1);
      if (nextDev && nextDev !== state.wave) {
        state.wave = nextDev;
        let iv = WAVE_DEFS.spawnIntervalStart / diff.enemy.spawnMult;
        for (let i = 1; i < state.wave; i++) iv = Math.max(WAVE_DEFS.spawnIntervalMin, iv * WAVE_DEFS.spawnIntervalScale);
        state.spawnInterval = iv;
      } else {
        state.spawnInterval = Math.max(WAVE_DEFS.spawnIntervalMin, state.spawnInterval * WAVE_DEFS.spawnIntervalScale);
      }
    } else {
      state.spawnInterval = Math.max(WAVE_DEFS.spawnIntervalMin, state.spawnInterval * WAVE_DEFS.spawnIntervalScale);
    }
    const bossMap = diff.enemy.bosses;
    const bigCount  = bossMap.bigboss?.[state.wave]  ?? 0;
    const miniCount = bossMap.miniboss?.[state.wave] ?? 0;
    for (let i = 0; i < bigCount;  i++) spawnBoss('bigboss');
    for (let i = 0; i < miniCount; i++) spawnBoss('miniboss');
    state.moveMarkers.push({
      x: G.W / 2, y: G.PLAY_BOTTOM / 2, life: 1.6, maxLife: 1.6,
      type: 'wave', bossLabel: bigCount > 0 ? DISPLAY_NAME_DEFS.bigbossLabel : miniCount > 0 ? DISPLAY_NAME_DEFS.minibossLabel : null,
    });
    applyWaveUpgrades();
  }

  _updateHelicopterLogic(gameDt) {
    const heli = state.helicopter;
    if (!heli) return;

    if (heli.flightState === 'flying') {
      const dx = heli.targetX - heli.x, dy = heli.targetY - heli.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 4) {
        heli.x = heli.targetX; heli.y = heli.targetY; heli.flightState = 'landed';
      } else {
        const spd = 130 * gameDt;
        heli.x += (dx / d) * spd; heli.y += (dy / d) * spd;
      }
    }

    if (heli.flightState === 'landed') {
      for (const u of state.units) {
        if (u.dead || heli.boarded.has(u)) continue;
        const dx = u.x - heli.x, dy = u.y - heli.y;
        if (Math.sqrt(dx * dx + dy * dy) < heli.radius) {
          heli.boarded.add(u); u.boarded = true; u.stop();
          for (let i = 0; i < 18; i++) {
            state.particles.push({
              x: u.x, y: u.y, vx: rand(-90, 90), vy: rand(-130, -20),
              life: rand(0.4, 1.0), maxLife: 1.0, color: '#80d040', size: rand(2, 4), realtime: true,
            });
          }
        }
      }
      const living = state.units.filter(u => !u.dead);
      if (living.length > 0 && living.every(u => heli.boarded.has(u))) {
        heli.flightState = 'departing';
        if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
      }
    }

    if (heli.flightState === 'departing') {
      heli.y -= 220 * gameDt;
      if (heli.y < -160) {
        heli.flightState = 'gone';
        state.victory = true;
      }
    }
  }

  _enforceGroupCohesion() {
    const living = state.units.filter(u => !u.dead && !u.boarded);
    if (living.length < 2) return;
    const maxX = G.W / 2 - 80;
    const maxY = G.PLAY_BOTTOM / 2 - 80;
    const cx = living.reduce((s, u) => s + u.x, 0) / living.length;
    const cy = living.reduce((s, u) => s + u.y, 0) / living.length;
    for (const u of living) {
      // If this hero is already outside camera-visible range of the group centroid,
      // clamp their destination so they walk back into view.
      u.tx = clamp(u.tx, cx - maxX, cx + maxX);
      u.ty = clamp(u.ty, cy - maxY, cy + maxY);
    }
  }

  _updateCamera(realDt) {
    const living = state.units.filter(u => !u.dead && !u.boarded);
    if (!living.length) return;
    const centX = living.reduce((s, u) => s + u.x, 0) / living.length;
    const centY = living.reduce((s, u) => s + u.y, 0) / living.length;
    const targetX = clamp(centX - G.W / 2,           0, G.WORLD_W - G.W);
    const targetY = clamp(centY - G.PLAY_BOTTOM / 2, 0, G.WORLD_H - G.PLAY_BOTTOM);
    // Fast lerp when heroes are moving so camera never lags behind;
    // slow lerp when idle for a smooth settling feel.
    const anyMoving = living.some(u => u.moving);
    const lerp = Math.min(1, realDt * (anyMoving ? 18 : 6));
    G.camera.x += (targetX - G.camera.x) * lerp;
    G.camera.y += (targetY - G.camera.y) * lerp;
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────

  _draw(realDt) {
    const ctx = G.ctx;
    const { W, H, PLAY_BOTTOM } = G;

    ctx.save();
    if (state.shake > 0 && !state.settings.noShake) {
      ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
    }

    // ── World-space block (camera offset) ──────────────────────────────────
    ctx.save();
    ctx.translate(-G.camera.x, -G.camera.y);

    drawBackground();
    this._drawMoveMarkers(ctx);
    this._drawShadows(ctx);
    drawPickupRings(ctx);

    // Sort entities by Y (depth order)
    const drawables = [
      ...state.units.filter(u => !u.dead && !u.boarded),
      ...state.enemies.filter(e => !e.dead),
    ];
    drawables.sort((a, b) => a.y - b.y);

    for (const e of state.enemies) if (e.dead) e.draw(ctx);
    for (const l of state.loot) l.draw(ctx);
    this._drawHelicopter(ctx);
    for (const ent of drawables) ent.draw(ctx);
    for (const pr of state.projectiles) pr.draw(ctx);
    renderGroupAbility(ctx);

    // Render acid shots
    if (state.acidShots?.length) {
      for (const shot of state.acidShots) {
        if (shot.dead) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80, 255, 80, 0.85)';
        ctx.shadowColor = '#40ff40';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.strokeStyle = '#c0ffc0';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    drawBolts();
    drawExplosions();
    if (!state.settings.noLightning) drawShockwaves();
    drawParticles();
    drawFloatingTexts();

    ctx.restore(); // end camera transform
    // ── End world-space block ───────────────────────────────────────────────

    // Selection box — screen-space
    if (state.selectionBox) {
      const b = state.selectionBox;
      const x = Math.min(b.x1, b.x2), y = Math.min(b.y1, b.y2);
      const w = Math.abs(b.x2 - b.x1), h = Math.abs(b.y2 - b.y1);
      ctx.fillStyle   = 'rgba(180, 220, 130, 0.14)';
      ctx.strokeStyle = 'rgba(180, 220, 130, 0.9)';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    ctx.restore();

    // Time-freeze tint
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
        const ring = ctx.createRadialGradient(
          W / 2, PLAY_BOTTOM / 2, Math.min(W, PLAY_BOTTOM) * 0.35,
          W / 2, PLAY_BOTTOM / 2, Math.max(W, PLAY_BOTTOM) * 0.6
        );
        ring.addColorStop(0, 'rgba(120, 140, 200, 0)');
        ring.addColorStop(1, `rgba(100, 110, 200, ${(pauseAmount - 0.4) * (0.18 + pulse * 0.06)})`);
        ctx.fillStyle = ring;
        ctx.fillRect(0, 0, W, PLAY_BOTTOM + 8);
      }
    }

    drawScreenFlash();
    drawCRTOverlay();
    this._drawHeliArrow(ctx);
    this._drawWaveAnnouncements(ctx);
    this._drawExtractionBanner(ctx);
    drawAbilityPanel();
    if (state.difficulty === 'dev-mode') this._drawDevOverlay(ctx);

    // Upload canvas pixels to GPU texture
    this._canvasTex.refresh();
  }

  _drawShadows(ctx) {
    const shadowEntities = [
      ...state.units.filter(u => !u.dead && !u.boarded),
      ...state.enemies.filter(e => !e.dead),
      ...state.loot.filter(l => !l.picked),
      ...state.projectiles.filter(p => !p.dead)
    ];

    for (const ent of shadowEntities) {
      const isLoot = ent.spawnTime !== undefined;
      const isProj = ent.speed !== undefined && ent.maxRange !== undefined;
      
      let baseR = ent.r;
      let shadowY = ent.y;
      
      if (!isLoot && !isProj) {
        shadowY = ent.y + ent.r - 1;
        baseR = ent.r * 1.4;
      } else if (isLoot) {
        shadowY = ent.y + 7;
        baseR = 7;
        const popIn = Math.min(1, ent.spawnTime * 5);
        baseR *= (1 - Math.pow(1 - popIn, 3));
      }
      
      const z = ent.z || 0;
      const shadowZScale = Math.max(0.3, 1 - z / 80);
      const shadowScale = (isLoot || isProj) ? 1 : 1 + Math.sin(state.time * 4 + ent.x * 0.1) * 0.05;

      ctx.save();
      ctx.translate(ent.x, shadowY);
      ctx.scale(1, 0.4 * shadowZScale);
      
      const finalR = baseR * shadowScale;
      if (finalR > 0) {
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, finalR);
        const alpha = isLoot ? 0.42 * shadowZScale : 0.7 * shadowZScale;
        grd.addColorStop(0, `rgba(15,10,5,${alpha})`);
        grd.addColorStop(1, 'rgba(15,10,5,0)');
        
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, finalR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawMoveMarkers(ctx) {
    for (const m of state.moveMarkers) {
      if (m.type === 'wave') continue;
      const t = 1 - m.life / m.maxLife;
      if (m.type === 'heal' || m.type === 'stim' || m.type === 'xp') {
        const alpha = Math.min(1, m.life / m.maxLife * 1.4);
        const yFloat = m.y - t * 20;
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = m.type === 'heal' ? `rgba(120,230,140,${alpha})`
                      : m.type === 'xp'   ? `rgba(120,220,255,${alpha})`
                      :                     `rgba(255,130,90,${alpha})`;
        ctx.fillText(m.text || '', m.x, yFloat);
        ctx.textAlign = 'left';
        continue;
      }
      ctx.strokeStyle = m.type === 'attack'
        ? `rgba(220,80,60,${1-t})` : `rgba(180,220,130,${1-t})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(m.x, m.y, 4 + t * 14, 0, Math.PI * 2); ctx.stroke();
      if (m.type === 'attack') {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.x - 8, m.y); ctx.lineTo(m.x + 8, m.y);
        ctx.moveTo(m.x, m.y - 8); ctx.lineTo(m.x, m.y + 8);
        ctx.stroke();
      }
    }
  }

  _drawHelicopter(ctx) {
    const heli = state.helicopter;
    if (!heli) return;
    const { x, y, flightState, radius } = heli;

    ctx.save();

    if (flightState === 'landed') {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 3);
      ctx.beginPath(); ctx.arc(x, y + 18, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,200,60,${0.06+pulse*0.05})`; ctx.fill();
      ctx.strokeStyle = `rgba(110,250,80,${0.4+pulse*0.3})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = 'bold 20px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(130,255,90,${0.5+pulse*0.25})`;
      ctx.fillText('H', x, y + 18);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    ctx.translate(x, y);
    ctx.save(); ctx.scale(1, 0.28);
    ctx.beginPath(); ctx.arc(0, 72, 32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); ctx.restore();

    const ra = state.time * 14;
    ctx.strokeStyle = 'rgba(155,165,140,0.82)'; ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const a = ra + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*42, Math.sin(a)*8-16);
      ctx.lineTo(Math.cos(a+Math.PI)*42, Math.sin(a+Math.PI)*8-16);
      ctx.stroke();
    }

    ctx.fillStyle = '#4a5c38';
    ctx.beginPath(); ctx.roundRect(-23,-9,46,22,5); ctx.fill();
    ctx.fillStyle = '#3c4e2c';
    ctx.beginPath(); ctx.roundRect(-23,-11,24,18,[6,2,2,4]); ctx.fill();
    ctx.fillStyle = 'rgba(160,230,120,0.3)';
    ctx.beginPath(); ctx.roundRect(-21,-9,20,14,4); ctx.fill();
    ctx.fillStyle = '#3a4a2a'; ctx.fillRect(21,-3,22,7);

    const ta = state.time * 22;
    ctx.strokeStyle = 'rgba(140,150,125,0.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(41, Math.cos(ta)*8); ctx.lineTo(41, -Math.cos(ta)*8); ctx.stroke();

    ctx.strokeStyle = '#566245'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-20,10); ctx.lineTo(-20,17); ctx.lineTo(16,17); ctx.lineTo(16,10);
    ctx.moveTo(-14,9);  ctx.lineTo(-14,17);
    ctx.moveTo(10,9);   ctx.lineTo(10,17);
    ctx.stroke();

    if (flightState === 'landed') {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 3);
      ctx.font = 'bold 11px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(140,255,100,${0.85+pulse*0.15})`;
      ctx.shadowColor = 'rgba(80,200,40,0.5)'; ctx.shadowBlur = 6;
      ctx.fillText('▼ BOARD ▼', 0, -radius + 12);
      ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  _drawHeliArrow(ctx) {
    const heli = state.helicopter;
    if (!heli || heli.flightState === 'gone') return;

    // Convert helicopter world position to screen space
    const sx = heli.x - G.camera.x;
    const sy = heli.y - G.camera.y;

    // If helicopter is inside the viewport, no arrow needed
    const pad = 30;
    if (sx >= pad && sx <= G.W - pad && sy >= pad && sy <= G.PLAY_BOTTOM - pad) return;

    // Find the point on the screen-edge rectangle that the ray (centre → heli) hits
    const cx = G.W / 2, cy = G.PLAY_BOTTOM / 2;
    const dx = sx - cx, dy = sy - cy;
    const edgePad = 44;
    const halfW = G.W / 2 - edgePad;
    const halfH = G.PLAY_BOTTOM / 2 - edgePad;

    let t = Infinity;
    if (Math.abs(dx) > 0.001) t = Math.min(t, halfW / Math.abs(dx));
    if (Math.abs(dy) > 0.001) t = Math.min(t, halfH / Math.abs(dy));

    const ax = cx + dx * t;
    const ay = cy + dy * t;
    const angle = Math.atan2(dy, dx);
    const pulse = 0.7 + 0.3 * Math.sin(state.time * 4);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);

    // Chevron arrow pointing toward helicopter
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fillStyle = `rgba(100, 255, 80, ${pulse})`;
    ctx.shadowColor = 'rgba(60, 200, 40, 0.7)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(40, 160, 20, ${pulse * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Distance label below arrow
    const dist = Math.sqrt(dx * dx + dy * dy);
    const metres = Math.round(dist / 3);
    ctx.rotate(-angle);
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(160, 255, 120, ${pulse})`;
    ctx.fillText(`${metres}m`, 0, 24);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  _drawWaveAnnouncements(ctx) {
    const { W } = G;
    for (const m of state.moveMarkers) {
      if (m.type !== 'wave') continue;
      const t = 1 - m.life / m.maxLife;
      const alpha = m.life > 0.3 ? Math.min(1, (m.maxLife - m.life) * 3) : m.life * 3;
      const isExtraction = !!m.extraction;
      const isBig        = !isExtraction && m.bossLabel === DISPLAY_NAME_DEFS?.bigbossLabel;
      const isBoss       = !isExtraction && !!m.bossLabel;
      const titleColor = isExtraction ? `rgba(100,255,80,${alpha})`
                       : isBig        ? `rgba(180,240,90,${alpha})`
                       : isBoss       ? `rgba(255,130,60,${alpha})`
                       :                `rgba(200,60,40,${alpha*0.9})`;
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
        ? `rgba(160,255,120,${alpha*0.9})`
        : isBig  ? `rgba(220,255,160,${alpha*0.9})`
        : isBoss ? `rgba(255,200,140,${alpha*0.9})`
        :          `rgba(200,180,140,${alpha*0.7})`;
      ctx.fillText(m.bossLabel || (DISPLAY_NAME_DEFS?.waveSubtext || ''), m.x, y + 24);
      ctx.textAlign = 'left';
    }
  }

  _drawExtractionBanner(ctx) {
    const { W } = G;
    if (!state.extractionPhase || state.gameOver) return;
    const heli = state.helicopter;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 2.5);
    const boardedCount = heli ? heli.boarded.size : 0;
    const living = state.units.filter(u => !u.dead).length;
    const msg = heli && heli.flightState === 'flying'
      ? 'HELICOPTER INCOMING'
      : `REACH THE HELICOPTER  ${boardedCount} / ${living} BOARDED`;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(120,255,80,${0.75+pulse*0.25})`;
    ctx.shadowColor = 'rgba(80,200,40,0.6)'; ctx.shadowBlur = 8;
    ctx.fillText(msg, W / 2, 16);
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── Dev overlay ──────────────────────────────────────────────────────────────

  _drawDevOverlay(ctx) {
    const living = state.enemies.filter(e => !e.dead);
    if (!living.length) return;

    ctx.save();
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const e of living) {
      const labelY = e.y - e.r - 4;

      // HP bar background
      const barW = 36, barH = 4;
      const hpFrac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - barW / 2, labelY - barH - 1, barW, barH);
      ctx.fillStyle = hpFrac > 0.5 ? '#60d840' : hpFrac > 0.25 ? '#d8a020' : '#d83020';
      ctx.fillRect(e.x - barW / 2, labelY - barH - 1, Math.round(barW * hpFrac), barH);

      // Type name badge
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - 22, labelY - barH - 14, 44, 11);
      ctx.fillStyle = '#e0d090';
      ctx.fillText(e.kind.toUpperCase(), e.x, labelY - barH - 4);
    }

    // Corner hint
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,220,80,0.7)';
    ctx.fillText('DEV  ·  K = kill all', 8, 8);

    ctx.restore();
  }

  // ── End conditions ───────────────────────────────────────────────────────────

  _checkEndConditions() {
    if (!state.gameOver && !state.allDeadPending && state.units.every(u => u.dead)) {
      state.allDeadPending = true;
      this.time.delayedCall(2000, () => {
        if (!state.allDeadPending) return;
        applyDeathPenalties();
        saveHighScore();
        state.gameOver = true;
        state.allDeadPending = false;
        window.__prayInGame = false;
        this.scene.stop('HUDScene');
        this.scene.pause('GameScene');
        this.scene.launch('GameOverScene', { state });
      });
    }
    if (state.victory && !this._victoryTriggered) {
      this._victoryTriggered = true;
      applyDeathPenalties();
      saveHighScore();
      this.time.delayedCall(400, () => {
        window.__prayInGame = false;
        this.scene.stop('HUDScene');
        this.scene.start('VictoryScene', { state });
      });
    }
  }
}

// Generates evenly-distributed spawn positions for dev-mode pre-spawning.
// Fills a grid across the play area, avoiding the centre cluster where units start.
// Ability-test mode: spawn enemies in a ring 220-350px around the hero centroid
function _spawnCloseToHeroes() {
  const living = state.units.filter(u => !u.dead);
  if (living.length === 0) { spawnEnemy(); return; }
  const cx = living.reduce((s, u) => s + u.x, 0) / living.length;
  const cy = living.reduce((s, u) => s + u.y, 0) / living.length;
  const ang = rand(0, Math.PI * 2);
  const dist = rand(220, 350);
  const x = clamp(cx + Math.cos(ang) * dist, 6, G.WORLD_W - 6);
  const y = clamp(cy + Math.sin(ang) * dist, 6, G.WORLD_H - 6);
  const r = Math.random(), w = state.wave;
  let kind;
  if (w >= 4 && r < 0.18) kind = 'mutant';
  else if (w >= 3 && r < 0.32) kind = 'blinker';
  else if (w >= 2 && r < 0.52) kind = 'runner';
  else if (w >= 2 && r < 0.74) kind = 'ghoul';
  else kind = 'raider';
  spawnAt(x, y, kind);
}

function _devSpawnSlots(W, playBottom, devSpawn) {
  const total = devSpawn.reduce((s, e) => s + e.count, 0);
  const cols  = Math.ceil(Math.sqrt(total * (W / playBottom)));
  const rows  = Math.ceil(total / cols);
  const padX  = W * 0.12, padY = playBottom * 0.14;
  const stepX = (W - padX * 2) / Math.max(cols - 1, 1);
  const stepY = (playBottom - padY * 2) / Math.max(rows - 1, 1);
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (slots.length >= total) break;
      slots.push({
        x: padX + c * stepX + rand(-18, 18),
        y: padY + r * stepY + rand(-12, 12),
      });
    }
  }
  // Shuffle so enemy types are distributed rather than clustered by row
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}
