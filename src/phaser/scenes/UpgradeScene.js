import Phaser from 'phaser';
import { state } from '../../state.js';
import { playSfx } from '../../systems/audio.js';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';
import { ABILITY_DEFS, HERO_ABILITY_TREES, REVIVE_MINIGAME_CONFIG } from '../../config/abilities.js';

const DPR    = window.devicePixelRatio || 1;
const CARD_H = 150;
const CARD_GAP = 8;
const STRIDE   = CARD_H + CARD_GAP;
const ICON_SZ  = 64;

const HEROES = [
  { id: 'eliott', label: 'ELIOTT' },
  { id: 'dick',   label: 'DICK'   },
  { id: 'habib',  label: 'HABIB'  },
];

// Level colours: subtle progression from grey → gold → orange
const LEVEL_COLOR = ['#888880', '#d0b060', '#e87030'];

// ─────────────────────────────────────────────────────────────────────────────
export class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  init(data) { this._initData = data || {}; }

  preload() {
    Object.entries(ABILITY_DEFS).forEach(([id, def]) => {
      const key = `ability_icon_${id}`;
      if (def.icon && !this.textures.exists(key)) {
        this.load.svg(key, def.icon, { width: ICON_SZ * 2, height: ICON_SZ * 2 });
      }
    });
  }

  // ── Scene entry ────────────────────────────────────────────────────────────
  create() {
    const { width: W, height: H } = this.scale;

    if (state.units && state.units.every(u => u.dead)) {
      state.isUpgradeScreen = false;
      this.scene.stop();
      this.scene.resume('GameScene');
      return;
    }

    state.pendingUpgrades = { eliott: null, dick: null, habib: null };

    this.add.graphics().fillStyle(0x000000, 0.62).fillRect(0, 0, W, H);

    // ── Frame geometry ────────────────────────────────────────────────────────
    const FW = Math.min(W * 0.82, 720);
    const FH = Math.min(H * 0.88, 620);
    const FX = Math.round((W - FW) / 2);
    const FY = Math.round((H - FH) / 2);
    const PAD     = 16;
    const SIDEBAR = 50;

    const fg = this.add.graphics();
    fg.fillStyle(0x0d0a07, 1);
    fg.fillRect(FX, FY, FW, FH);
    fg.lineStyle(1, 0x4a3420);
    fg.strokeRect(FX, FY, FW, FH);
    fg.lineStyle(1, 0x1e1510);
    fg.strokeRect(FX + 3, FY + 3, FW - 6, FH - 6);

    // ── Header ────────────────────────────────────────────────────────────────
    const HDR_H = 42;
    fg.fillStyle(0x171008, 1);
    fg.fillRect(FX + 1, FY + 1, FW - 2, HDR_H);
    fg.lineStyle(1, 0x3a2818);
    fg.beginPath().moveTo(FX + 1, FY + HDR_H).lineTo(FX + FW - 1, FY + HDR_H).strokePath();

    this._txt(FX + (FW - SIDEBAR) / 2, FY + 11, 'WAVE CLEARED — CHOOSE AN ABILITY UPGRADE', {
      fontSize: '16px', fontFamily: 'Georgia, serif',
      color: '#d9c7a0', letterSpacing: 3,
    }).setOrigin(0.5, 0);

    // ── Column layout ─────────────────────────────────────────────────────────
    const colAreaX = FX + PAD;
    const colAreaW = FW - PAD * 2 - SIDEBAR;
    const COL_GAP  = 10;
    const colW     = Math.floor((colAreaW - COL_GAP * 2) / 3);
    const CARD_W   = Math.min(colW - 6, 168);

    this._colCX = HEROES.map((_, i) =>
      Math.round(colAreaX + i * (colW + COL_GAP) + colW / 2)
    );

    // ── Hero name labels ──────────────────────────────────────────────────────
    const LABEL_Y = FY + HDR_H + 8;
    HEROES.forEach((h, i) => {
      const heroUnit = state.units?.find(u => u.type === h.id);
      const isDead = heroUnit?.dead ?? false;
      this._txt(this._colCX[i], LABEL_Y, isDead ? `✝ ${h.label}` : h.label, {
        fontSize: '13px', fontFamily: "'Courier New', monospace",
        fontStyle: 'bold', color: isDead ? '#5a2a1a' : '#e8d8b0', letterSpacing: 3,
      }).setOrigin(0.5, 0);
    });

    const HR1 = LABEL_Y + 22;
    fg.lineStyle(1, 0x2a1e12);
    fg.beginPath().moveTo(FX + PAD, HR1).lineTo(FX + FW - SIDEBAR - PAD, HR1).strokePath();

    // ── Reel band ─────────────────────────────────────────────────────────────
    const reelAreaTop = HR1 + 8;
    const reelAreaBot = FY + FH - 40;
    this._reelCY = Math.round(reelAreaTop + (reelAreaBot - reelAreaTop) / 2);

    fg.fillStyle(0xffffff, 0.025);
    fg.fillRect(FX + PAD, this._reelCY - CARD_H / 2 - 1, colAreaW, CARD_H + 2);
    fg.lineStyle(1, 0x3a2814, 0.6);
    fg.strokeRect(FX + PAD, this._reelCY - CARD_H / 2 - 1, colAreaW, CARD_H + 2);

    this._fadeTop = reelAreaTop;
    this._fadeBot = FY + FH - 40;
    this._fadeFX  = FX + PAD;
    this._fadeW   = colAreaW;

    fg.lineStyle(1, 0x3a2818);
    fg.beginPath()
      .moveTo(FX + FW - SIDEBAR, FY + 1)
      .lineTo(FX + FW - SIDEBAR, FY + FH - 1)
      .strokePath();

    // ── Build reels ───────────────────────────────────────────────────────────
    this._reels    = [];
    this._cardW    = CARD_W;
    this._spinning = false;
    this._selected = null;
    this._ready    = false;
    this._tooltipContainer = null;
    this._reviveStates = {};   // keyed by heroId
    this._FX = FX; this._FY = FY; this._FW = FW; this._FH = FH;

    HEROES.forEach((h, i) => this._buildReel(h, i));

    this._drawFadeStrips();
    this._drawSpinButton(FX + FW - SIDEBAR / 2, FY + FH / 2);

    this.input.keyboard.addKey('ESC').on('down', () => {
      if (!this.scene.isActive('PauseScene')) {
        this.scene.launch('PauseScene', { fromUpgrade: true });
        this.scene.bringToTop('PauseScene');
      }
    });

    this._doSpin(true);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _txt(x, y, str, style) {
    return this.add.text(x, y, str, { ...style, resolution: DPR });
  }

  _drawFadeStrips() {
    const steps = 5;
    const fadeH = 26;
    for (let s = 0; s < steps; s++) {
      const alpha = (1 - s / steps) * 0.92;
      const g = this.add.graphics();
      g.fillStyle(0x0d0a07, alpha);
      g.fillRect(this._fadeFX, this._fadeTop + (s * fadeH / steps), this._fadeW, fadeH / steps);
    }
    for (let s = 0; s < steps; s++) {
      const alpha = (s / steps) * 0.92;
      const g = this.add.graphics();
      g.fillStyle(0x0d0a07, alpha);
      g.fillRect(this._fadeFX, this._fadeBot - fadeH + (s * fadeH / steps), this._fadeW, fadeH / steps);
    }
  }

  // ── Build ability-tree pool for a hero ────────────────────────────────────

  _buildTreePool(heroId) {
    const heroUnit = state.units?.find(u => u.type === heroId);
    const trees = heroUnit?.abilityTrees ?? { 1: 1, 2: 0, 3: 0 };
    const treeDefs = HERO_ABILITY_TREES[heroId] || [];
    const pool = [];
    for (const td of treeDefs) {
      const currentLevel = trees[td.treeNum] ?? 0;
      if (currentLevel >= 3) continue; // already maxed
      pool.push({
        id:           `${heroId}_tree_${td.treeNum}`,
        treeNum:      td.treeNum,
        treeName:     td.name,
        abilityId:    td.abilityId,
        hotkey:       td.hotkey,
        currentLevel,
        nextLevel:    currentLevel + 1,
        levelName:    td.levelNames[currentLevel] ?? `Level ${currentLevel + 1}`,
        description:  td.levelDescs?.[currentLevel] ?? '',
      });
    }
    return pool;
  }

  // ── Reel building ──────────────────────────────────────────────────────────

  _buildReel(hero, colIdx) {
    const cx      = this._colCX[colIdx];
    const centreY = this._reelCY;
    const cardW   = this._cardW;

    const unit = state.units?.find(u => u.type === hero.id);

    if (unit?.dead) {
      this._buildReviveMinigame(hero, colIdx, cx, centreY);
      this._reels.push(null);
      return;
    }

    const pool = this._buildTreePool(hero.id);

    if (pool.length === 0) {
      this._txt(cx, centreY, 'ALL TREES\nMAXED', {
        fontSize: '11px', fontFamily: "'Courier New', monospace",
        color: '#5a4a2a', align: 'center',
      }).setOrigin(0.5);
      state.pendingUpgrades[hero.id] = 'none';
      this._reels.push(null);
      return;
    }

    const pool2 = [...pool].sort(() => Math.random() - 0.5);
    const n     = pool2.length;

    const p = { top: n - 1, centre: 0, bot: 1 % n };

    const baseY = centreY - Math.round(CARD_H / 2);
    const makeCard = (poolIdx, yOff, dim) =>
      this._makeCardObj(pool2[poolIdx], cx, baseY + yOff, cardW, dim);

    const reel = {
      heroId: hero.id,
      pool: pool2,
      n,
      p,
      top:    makeCard(p.top,    -STRIDE, true),
      centre: makeCard(p.centre,  0,      false),
      bot:    makeCard(p.bot,     STRIDE, true),
      _centreBg:     null,
      _centreDrawBg: null,
      _centreUpg:    null,
    };

    this._reels.push(reel);
  }

  _makeCardObj(upg, cx, cy, cardW, dim) {
    const nextLvl   = upg?.nextLevel ?? 1;
    const tint      = nextLvl === 3 ? 0xe87030 : nextLvl === 2 ? 0xd0b060 : 0x606060;
    const tintAlpha = 0.14;

    const cc  = this.add.container(cx, cy);
    const bg  = this.add.graphics();

    const drawBg = (hovered, selected) => {
      bg.clear();
      bg.fillStyle(tint, selected ? tintAlpha * 2.8 : hovered ? tintAlpha * 2 : tintAlpha);
      bg.fillRect(-cardW / 2, 0, cardW, CARD_H);
      bg.fillStyle(0x110d09, selected ? 0.70 : 0.91);
      bg.fillRect(-cardW / 2 + 3, 0, cardW - 3, CARD_H);
      bg.fillStyle(tint, selected ? 1 : 0.6);
      bg.fillRect(-cardW / 2, 0, 3, CARD_H);
      bg.lineStyle(1, selected ? 0xa0d040 : hovered ? tint : 0x251d14);
      bg.strokeRect(-cardW / 2, 0, cardW, CARD_H);
    };

    drawBg(false, false);
    cc.add(bg);

    this._populateCardContent(cc, upg, cardW);
    cc.setAlpha(dim ? 0.25 : 1);

    return { cc, bg, drawBg, upg };
  }

  _populateCardContent(cc, upg, cardW) {
    if (!upg) return;
    const nextLvl = upg.nextLevel ?? 1;
    const lvlColor = LEVEL_COLOR[nextLvl - 1] ?? '#888880';

    // Level badge top-right
    cc.add(this._txt(cardW / 2 - 4, 4, `LV ${nextLvl}`, {
      fontSize: '10px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: lvlColor,
      stroke: '#080502', strokeThickness: 2,
    }).setOrigin(1, 0));

    // Tree name (medium)
    cc.add(this._txt(0, 10, upg.treeName ?? '', {
      fontSize: '11px', fontFamily: "'Courier New', monospace",
      color: '#a09070', align: 'center',
      wordWrap: { width: cardW - 12 },
    }).setOrigin(0.5, 0));

    // Ability icon
    const iconKey = `ability_icon_${upg.abilityId}`;
    const iconY   = 30;
    if (this.textures.exists(iconKey)) {
      cc.add(this.add.image(0, iconY + ICON_SZ / 2, iconKey)
        .setDisplaySize(ICON_SZ, ICON_SZ)
        .setAlpha(0.85));
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(0x444440, 0.35);
      ph.fillRect(-ICON_SZ / 2, iconY, ICON_SZ, ICON_SZ);
      cc.add(ph);
    }

    // Level ability name (large)
    const nameY = iconY + ICON_SZ + 8;
    cc.add(this._txt(0, nameY, upg.levelName ?? '', {
      fontSize: '14px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: '#f0e4c0',
      wordWrap: { width: cardW - 12 }, align: 'center',
      stroke: '#1a0f06', strokeThickness: 2,
    }).setOrigin(0.5, 0));
  }

  // ── Update card content in-place ───────────────────────────────────────────

  _updateCardContent(cardObj, upg) {
    const { cc } = cardObj;
    const dim    = cc.alpha < 0.5;
    const cardW  = this._cardW;

    cc.removeAll(true);

    const nextLvl   = upg?.nextLevel ?? 1;
    const tint      = nextLvl === 3 ? 0xe87030 : nextLvl === 2 ? 0xd0b060 : 0x606060;
    const tintAlpha = 0.14;

    const newBg = this.add.graphics();
    const drawBg = (hovered, selected) => {
      newBg.clear();
      newBg.fillStyle(tint, selected ? tintAlpha * 2.8 : hovered ? tintAlpha * 2 : tintAlpha);
      newBg.fillRect(-cardW / 2, 0, cardW, CARD_H);
      newBg.fillStyle(0x110d09, selected ? 0.70 : 0.91);
      newBg.fillRect(-cardW / 2 + 3, 0, cardW - 3, CARD_H);
      newBg.fillStyle(tint, selected ? 1 : 0.6);
      newBg.fillRect(-cardW / 2, 0, 3, CARD_H);
      newBg.lineStyle(1, selected ? 0xa0d040 : hovered ? tint : 0x251d14);
      newBg.strokeRect(-cardW / 2, 0, cardW, CARD_H);
    };
    drawBg(false, false);
    cc.add(newBg);

    this._populateCardContent(cc, upg, cardW);
    cc.setAlpha(dim ? 0.25 : 1);

    cardObj.bg = newBg;
    cardObj.drawBg = drawBg;
    cardObj.upg = upg;
  }

  // ── Spin logic ─────────────────────────────────────────────────────────────

  _doSpin(initial) {
    this._spinning = true;
    this._clearSelection();
    playSfx('upgrade_reel_spin_start');

    const validReels = this._reels.filter(Boolean);
    if (!validReels.length) { this._spinning = false; return; }

    const onColDone = (reel) => {
      playSfx('upgrade_reel_column_stop');
      this._activateCentreCard(reel);
      if (validReels.every(r => !r._spinning)) {
        this._spinning = false;
      }
    };

    if (initial) {
      const baseMs = 300 + Math.random() * 400;
      validReels.forEach(reel => {
        const colMs = Math.max(400, Math.min(1000, baseMs + (Math.random() * 2 - 1) * 300));
        this._spinReel(reel, colMs, 0, true, () => onColDone(reel));
      });
    } else {
      const baseMs = 500 + Math.random() * 3000;
      validReels.forEach(reel => {
        const colMs = Math.max(500, Math.min(4000, baseMs + (Math.random() * 2 - 1) * 1000));
        this._spinReel(reel, colMs, 0, true, () => onColDone(reel));
      });
    }
  }

  _spinReel(reel, duration, startDelay, easeOut, onDone) {
    reel._spinning = true;
    let elapsed = 0;
    const TWEEN_MS = 45;
    const BASE_MS  = 55;
    const DECEL_MS = 800;

    const step = () => {
      if (elapsed >= duration) {
        reel._spinning = false;
        onDone();
        return;
      }

      this.tweens.add({
        targets: [reel.top.cc, reel.centre.cc, reel.bot.cc],
        y: `-=${STRIDE}`,
        duration: TWEEN_MS,
        ease: 'Linear',
        onComplete: () => {
          const oldTop = reel.top;
          reel.top    = reel.centre;
          reel.centre = reel.bot;
          reel.bot    = oldTop;

          reel.p.top    = reel.p.centre;
          reel.p.centre = reel.p.bot;
          reel.p.bot    = (reel.p.bot + 1) % reel.n;

          reel.bot.cc.y = reel.centre.cc.y + STRIDE;
          this._updateCardContent(reel.bot, reel.pool[reel.p.bot]);
          reel.bot.cc.setAlpha(0.25);
          reel.top.cc.setAlpha(0.25);
          reel.centre.cc.setAlpha(1);

          const timeLeft = duration - elapsed;
          const decelProgress = easeOut ? Math.max(0, 1 - timeLeft / DECEL_MS) : 0;
          const nextDelay = (elapsed + TWEEN_MS >= duration)
            ? 0
            : BASE_MS + decelProgress * 380;

          elapsed += TWEEN_MS + nextDelay;
          this.time.delayedCall(nextDelay, step);
        },
      });
    };

    this.time.delayedCall(startDelay, step);
  }

  _activateCentreCard(reel) {
    const { bg, drawBg, upg } = reel.centre;

    reel._centreBg     = bg;
    reel._centreDrawBg = drawBg;
    reel._centreUpg    = upg;

    bg.removeInteractive();
    bg.removeAllListeners();

    bg.setInteractive(
      new Phaser.Geom.Rectangle(-this._cardW / 2, 0, this._cardW, CARD_H),
      Phaser.Geom.Rectangle.Contains
    );

    bg.on('pointerover', () => {
      if (this._selected?.heroId !== reel.heroId) drawBg(true, false);
      this._showTooltip(reel.centre.cc.x, reel.centre.cc.y, upg);
    });
    bg.on('pointerout', () => {
      if (this._selected?.heroId !== reel.heroId) drawBg(false, false);
      this._hideTooltip();
    });
    bg.on('pointerdown', () => {
      this._hideTooltip();
      playSfx('upgrade_card_select');
      this._selectCard(reel);
    });
  }

  _showTooltip(cardX, cardY, upg) {
    this._hideTooltip();
    if (!upg?.description) return;

    const TW = 220, PAD = 10;
    const { width: W } = this.scale;

    const cnt = this.add.container(0, 0);
    const bg  = this.add.graphics();
    cnt.add(bg);

    const nextLvl   = upg.nextLevel ?? 1;
    const tint      = nextLvl === 3 ? 0xe87030 : nextLvl === 2 ? 0xd0b060 : 0x888880;
    const tintHex   = `#${tint.toString(16).padStart(6, '0')}`;

    const lvlTxt  = this._txt(PAD, PAD, `LV ${nextLvl} — ${upg.levelName}`, {
      fontSize: '11px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: tintHex,
    });
    const descTxt = this._txt(PAD, PAD + 18, upg.description, {
      fontSize: '13px', fontFamily: 'Georgia, serif',
      color: '#c8b890', wordWrap: { width: TW - PAD * 2 },
    });
    cnt.add([lvlTxt, descTxt]);

    const TH = descTxt.y + descTxt.height + PAD;
    bg.fillStyle(0x060402, 0.97);
    bg.fillRect(0, 0, TW, TH);
    bg.lineStyle(1, tint, 0.7);
    bg.strokeRect(0, 0, TW, TH);

    let tx = cardX - TW / 2;
    let ty = cardY - TH - 8;
    tx = Math.max(4, Math.min(W - TW - 4, tx));
    ty = Math.max(4, ty);

    cnt.setPosition(tx, ty);
    cnt.setDepth(100);
    this._tooltipContainer = cnt;
  }

  _hideTooltip() {
    if (this._tooltipContainer) {
      this._tooltipContainer.destroy(true);
      this._tooltipContainer = null;
    }
  }

  _selectCard(reel) {
    if (this._ready || this._spinning) return;

    if (this._selected && this._selected.heroId !== reel.heroId) {
      const prev = this._reels.find(r => r?.heroId === this._selected.heroId);
      prev?._centreDrawBg?.(false, false);
    }

    this._selected = { heroId: reel.heroId, upg: reel._centreUpg };
    state.pendingUpgrades[reel.heroId] = reel._centreUpg;
    reel._centreDrawBg(false, true);
    this._ready = true;

    this.time.delayedCall(380, () => this._advance());
  }

  _advance() {
    const { heroId, upg } = this._selected;
    const unit = state.units?.find(u => u.type === heroId);

    if (unit && upg?.treeNum != null) {
      const currentLevel = unit.abilityTrees[upg.treeNum] ?? 0;
      unit.abilityTrees[upg.treeNum] = Math.min(3, currentLevel + 1);
    }

    this._resumeGame();
  }

  _resumeGame() {
    // Cancel any in-progress revive (player picked an upgrade instead)
    for (const rv of Object.values(this._reviveStates)) {
      rv.done = true;
    }
    const initData = this._initData || {};
    this.scene.stop();
    if (initData.returnScene) {
      this.scene.start(initData.returnScene, { cycle: (initData.cycle || 0) + 1 });
    } else {
      this.scene.resume('GameScene');
      this.scene.get('GameScene').advanceWave();
    }
  }

  // ── Revive Minigame ──────────────────────────────────────────────────────────

  _buildReviveMinigame(hero, colIdx, cx, centreY) {
    const cardW = this._cardW;
    const heroId = hero.id;

    const reviveCount = state.heroReviveCounts?.[heroId] ?? 0;
    const roundsNeeded = REVIVE_MINIGAME_CONFIG.baseRounds
      + reviveCount * REVIVE_MINIGAME_CONFIG.roundsIncrement;

    // Heart icon (pulsing)
    const heartTxt = this._txt(cx, centreY - 52, '♥', {
      fontSize: '30px', fontFamily: 'Georgia, serif', color: '#c03030',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: heartTxt, scaleX: 1.25, scaleY: 1.25,
      yoyo: true, repeat: -1, duration: 480, ease: 'Sine.easeInOut',
    });

    this._txt(cx, centreY - 18, 'REVIVE', {
      fontSize: '11px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: '#c04040',
    }).setOrigin(0.5);

    // EKG bar
    const BAR_W = cardW - 8;
    const BAR_H = 20;
    const barX  = cx - BAR_W / 2;
    const barY  = centreY + 4;

    const barGfx    = this.add.graphics();
    const markerGfx = this.add.graphics();
    const roundTxt  = this._txt(cx, barY + BAR_H + 5, `ROUND 1 / ${roundsNeeded}`, {
      fontSize: '9px', fontFamily: "'Courier New', monospace", color: '#806040',
    }).setOrigin(0.5);
    const statusTxt = this._txt(cx, barY + BAR_H + 18, 'CLICK TO START', {
      fontSize: '9px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: '#c05030',
    }).setOrigin(0.5);

    // Click area — invisible rectangle over the column
    const hitZone = this.add.graphics();
    hitZone.fillStyle(0xffffff, 0.0);
    hitZone.fillRect(cx - cardW / 2, centreY - 60, cardW, 120);
    hitZone.setInteractive(
      new Phaser.Geom.Rectangle(cx - cardW / 2, centreY - 60, cardW, 120),
      Phaser.Geom.Rectangle.Contains
    );

    const rv = {
      heroId,
      roundsNeeded,
      currentRound: 1,
      zones: [],
      markerT: 0,
      started: false,
      done: false,
      success: false,
      barGfx, markerGfx, barX, barY, BAR_W, BAR_H,
      roundTxt, statusTxt, hitZone,
    };

    hitZone.on('pointerdown', () => this._reviveClick(rv));
    hitZone.on('pointerover', () => {
      if (!rv.done) statusTxt.setColor('#ff6040');
    });
    hitZone.on('pointerout', () => {
      if (!rv.done) statusTxt.setColor('#c05030');
    });

    // Mark as 'none' so scene can advance even if revive isn't attempted
    state.pendingUpgrades[heroId] = 'none';

    // Draw initial bar (no zones yet)
    this._drawReviveBar(rv);
    this._reviveStates[heroId] = rv;
  }

  _reviveZonesForRound() {
    const cfg = REVIVE_MINIGAME_CONFIG;
    const wave = state.wave ?? 1;
    let zoneW = cfg.zoneWidthFraction * Math.pow(cfg.zoneWidthDecayA, wave - 1) - cfg.zoneWidthDecayB * (wave - 1);
    zoneW = Math.max(cfg.zoneWidthMin, zoneW);
    const zones = [];
    const gap = 0.04; // min gap between zones
    for (let attempt = 0; attempt < 50 && zones.length < cfg.zoneCount; attempt++) {
      const start = Math.random() * (1 - zoneW - gap);
      const end   = start + zoneW;
      const overlap = zones.some(z => start < z.end + gap && end > z.start - gap);
      if (!overlap) zones.push({ start, end });
    }
    return zones;
  }

  _startReviveRound(rv) {
    rv.zones    = this._reviveZonesForRound();
    rv.markerT  = 0;
    rv.roundTxt.setText(`ROUND ${rv.currentRound} / ${rv.roundsNeeded}`);
    rv.statusTxt.setText('CLICK IN THE ZONE');
    this._drawReviveBar(rv);
  }

  _drawReviveBar(rv) {
    rv.barGfx.clear();
    // Background
    rv.barGfx.fillStyle(0x1a1008, 1);
    rv.barGfx.fillRect(rv.barX, rv.barY, rv.BAR_W, rv.BAR_H);
    rv.barGfx.lineStyle(1, 0x503020, 1);
    rv.barGfx.strokeRect(rv.barX, rv.barY, rv.BAR_W, rv.BAR_H);
    // Dark zones (success areas)
    for (const z of rv.zones) {
      const zx = rv.barX + z.start * rv.BAR_W;
      const zw = (z.end - z.start) * rv.BAR_W;
      rv.barGfx.fillStyle(0x204010, 1);
      rv.barGfx.fillRect(zx, rv.barY + 2, zw, rv.BAR_H - 4);
      rv.barGfx.lineStyle(1, 0x40a030, 0.7);
      rv.barGfx.strokeRect(zx, rv.barY + 2, zw, rv.BAR_H - 4);
    }
  }

  _reviveClick(rv) {
    if (rv.done || this._ready) return;
    if (!rv.started) {
      // First click: start the marker
      rv.started = true;
      rv.statusTxt.setText('CLICK IN THE ZONE');
      this._startReviveRound(rv);
      return;
    }
    // Subsequent clicks: check if marker is in a dark zone
    const inZone = rv.zones.some(z => rv.markerT >= z.start && rv.markerT <= z.end);
    if (inZone) {
      if (rv.currentRound >= rv.roundsNeeded) {
        this._reviveSuccess(rv);
      } else {
        // Round passed — pause marker briefly and start next round
        rv.markerT = 0;
        rv.currentRound++;
        rv.statusTxt.setColor('#60c040');
        rv.statusTxt.setText('✓ ROUND PASS!');
        this.time.delayedCall(500, () => {
          if (rv.done) return;
          rv.statusTxt.setColor('#c05030');
          this._startReviveRound(rv);
        });
      }
    } else {
      this._reviveFail(rv);
    }
  }

  _reviveSuccess(rv) {
    rv.done = true;
    rv.success = true;
    rv.markerGfx.clear();
    rv.statusTxt.setColor('#60ff40');
    rv.statusTxt.setText('REVIVED!');
    rv.barGfx.clear();

    // Revive the hero
    const unit = state.units?.find(u => u.type === rv.heroId);
    if (unit) {
      unit.dead  = false;
      unit.hp    = Math.ceil(unit.maxHp * REVIVE_MINIGAME_CONFIG.reviveHpFraction);
      unit.hurtFlash = 0;
      // Place near centroid of surviving heroes
      const living = state.units.filter(u => !u.dead && u !== unit);
      if (living.length > 0) {
        const cx = living.reduce((s, u) => s + u.x, 0) / living.length;
        const cy = living.reduce((s, u) => s + u.y, 0) / living.length;
        unit.x = cx + (Math.random() - 0.5) * 40;
        unit.y = cy + (Math.random() - 0.5) * 40;
        unit.tx = unit.x; unit.ty = unit.y;
      }
      // Green healing pulse (via state.particles)
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 40 + Math.random() * 80;
        state.particles.push({
          x: unit.x, y: unit.y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
          life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
          color: i % 2 ? '#40ff40' : '#a0ffa0', size: 2 + Math.random() * 3,
          realtime: true,
        });
      }
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.0);
      state.heroReviveCounts = state.heroReviveCounts || {};
      state.heroReviveCounts[rv.heroId] = (state.heroReviveCounts[rv.heroId] ?? 0) + 1;
    }

    this.time.delayedCall(1000, () => {
      if (this.scene.isActive()) this._resumeGame();
    });
  }

  _reviveFail(rv) {
    if (rv.done) return;
    rv.done = true;
    rv.markerGfx.clear();
    rv.barGfx.clear();
    rv.hitZone.removeInteractive();

    const msgs = REVIVE_MINIGAME_CONFIG.failureMessages;
    const msg  = msgs[Math.floor(Math.random() * msgs.length)];

    rv.statusTxt.setColor('#ff4020');
    rv.statusTxt.setText('FAILED');

    const { width: W, height: H } = this.scale;
    const failTxt = this._txt(W / 2, H / 2 - 30, msg, {
      fontSize: '15px', fontFamily: 'Georgia, serif',
      color: '#ff6040', wordWrap: { width: 480 }, align: 'center',
      stroke: '#0a0604', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: failTxt, alpha: 0, y: H / 2 - 60,
      duration: 2200, ease: 'Sine.easeIn',
      onComplete: () => {
        failTxt.destroy();
        if (this.scene.isActive()) this._resumeGame();
      },
    });
  }

  // ── Per-frame: advance marker for all active revive states ─────────────────

  update(_time, delta) {
    const dt = delta / 1000;
    for (const rv of Object.values(this._reviveStates)) {
      if (rv.done || !rv.started || rv.markerT < 0) continue;
      rv.markerT += dt / REVIVE_MINIGAME_CONFIG.markerSpeed;
      // Draw marker
      rv.markerGfx.clear();
      if (rv.markerT <= 1) {
        rv.markerGfx.lineStyle(2, 0xff2020, 1);
        const mx = rv.barX + rv.markerT * rv.BAR_W;
        rv.markerGfx.beginPath();
        rv.markerGfx.moveTo(mx, rv.barY);
        rv.markerGfx.lineTo(mx, rv.barY + rv.BAR_H);
        rv.markerGfx.strokePath();
      }
      // Marker exited bar — fail
      if (rv.markerT > 1) {
        rv.markerT = -1;
        this._reviveFail(rv);
      }
    }
  }

  _clearSelection() {
    this._hideTooltip();
    this._selected = null;
    this._ready    = false;
    state.pendingUpgrades = { eliott: null, dick: null, habib: null };

    this._reels.forEach(reel => {
      if (!reel) return;
      reel._centreBg?.removeInteractive();
      reel._centreBg?.removeAllListeners();
      reel._centreDrawBg?.(false, false);
      reel._centreBg = null;
    });
  }

  // ── Spin button — visible but permanently disabled ─────────────────────────

  _drawSpinButton(cx, cy) {
    const BW = 38, BH = 82;
    const cnt = this.add.container(cx, cy);
    const bg  = this.add.graphics();

    const icon = this._txt(0, -22, '↻', {
      fontSize: '22px', fontFamily: 'Georgia, serif', color: '#c5a572',
    }).setOrigin(0.5);

    const label = this._txt(0, 10, 'SOON', {
      fontSize: '9px', fontFamily: "'Courier New', monospace",
      color: '#6a5030',
    }).setOrigin(0.5);

    cnt.add([bg, icon, label]);

    // Always disabled
    bg.fillStyle(0x181008, 1);
    bg.fillRect(-BW / 2, -BH / 2, BW, BH);
    bg.lineStyle(1, 0x201510);
    bg.strokeRect(-BW / 2, -BH / 2, BW, BH);
    icon.setAlpha(0.2);
    label.setAlpha(0.3);
  }
}
