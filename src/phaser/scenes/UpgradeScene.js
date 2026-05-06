import Phaser from 'phaser';
import { state } from '../../state.js';
import { GameData } from '../../systems/upgrades.js';
import { playSfx } from '../../systems/audio.js';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';

const DPR  = window.devicePixelRatio || 1;
const CARD_H   = 76;
const CARD_GAP = 8;
const STRIDE   = CARD_H + CARD_GAP;  // one full step of the reel

const RARITY = {
  Common:    { tint: 0x888888, alpha: 0.10 },
  Rare:      { tint: 0x4080ff, alpha: 0.16 },
  Epic:      { tint: 0xb040f0, alpha: 0.16 },
  Legendary: { tint: 0xffaa18, alpha: 0.22 },
};

const HERO_ICON = { eliott: 'upg-alchemy', dick: 'upg-weapon', habib: 'upg-armor' };

const HEROES = [
  { id: 'eliott', label: 'ELIOTT' },
  { id: 'dick',   label: 'DICK'   },
  { id: 'habib',  label: 'HABIB'  },
];

// ─────────────────────────────────────────────────────────────────────────────
export class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  // Capture init data fresh each launch so stale data never bleeds between runs
  init(data) { this._initData = data || {}; }

  // ── Asset loading ──────────────────────────────────────────────────────────
  preload() {
    const px = Math.ceil(20 * DPR * 2);   // load at 2x render size for crispness
    const svgCfg = { width: px, height: px };
    const tryLoad = (key, path) => {
      if (!this.textures.exists(key)) this.load.svg(key, path, svgCfg);
    };
    tryLoad('upg-alchemy', 'assets/tbd/icons/fizzing-flask.svg');
    tryLoad('upg-weapon',  'assets/tbd/icons/hockey.svg');
    tryLoad('upg-armor',   'assets/tbd/icons/round-shield.svg');
  }

  // ── Scene entry ────────────────────────────────────────────────────────────
  create() {
    const { width: W, height: H } = this.scale;

    state.upgradeSpinCredits = Math.min(state.upgradeSpinCredits + 1, 3);
    state.pendingUpgrades = { eliott: null, dick: null, habib: null };

    // Dim the frozen GameScene behind
    this.add.graphics().fillStyle(0x000000, 0.62).fillRect(0, 0, W, H);

    // ── Frame geometry ────────────────────────────────────────────────────────
    const FW = Math.min(W * 0.82, 720);
    const FH = Math.min(H * 0.70, 490);
    const FX = Math.round((W - FW) / 2);
    const FY = Math.round((H - FH) / 2);
    const PAD     = 16;
    const SIDEBAR = 50;   // right strip for spin button

    // Frame background
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

    this._txt(FX + (FW - SIDEBAR) / 2, FY + 11, 'WAVE CLEARED', {
      fontSize: '20px', fontFamily: 'Georgia, serif',
      color: '#d9c7a0', letterSpacing: 5,
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
      this._txt(this._colCX[i], LABEL_Y, h.label, {
        fontSize: '13px', fontFamily: "'Courier New', monospace",
        fontStyle: 'bold', color: '#e8d8b0', letterSpacing: 3,
      }).setOrigin(0.5, 0);
    });

    const HR1 = LABEL_Y + 22;
    fg.lineStyle(1, 0x2a1e12);
    fg.beginPath().moveTo(FX + PAD, HR1).lineTo(FX + FW - SIDEBAR - PAD, HR1).strokePath();

    // ── Reel band ─────────────────────────────────────────────────────────────
    // 3 visible cards per column: top (dim) | centre (active) | bottom (dim)
    const reelAreaTop = HR1 + 8;
    const reelAreaBot = FY + FH - 40;
    this._reelCY = Math.round(reelAreaTop + (reelAreaBot - reelAreaTop) / 2);

    // Highlight strip behind the centre slot
    fg.fillStyle(0xffffff, 0.025);
    fg.fillRect(FX + PAD, this._reelCY - CARD_H / 2 - 1, colAreaW, CARD_H + 2);
    fg.lineStyle(1, 0x3a2814, 0.6);
    fg.strokeRect(FX + PAD, this._reelCY - CARD_H / 2 - 1, colAreaW, CARD_H + 2);

    // Fade-out strips at top/bottom of reel area (cheap "mask" effect)
    // drawn AFTER reels so they sit on top
    this._fadeTop = reelAreaTop;
    this._fadeBot = FY + FH - 40;
    this._fadeFX  = FX + PAD;
    this._fadeW   = colAreaW;

    // Sidebar divider
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

    HEROES.forEach((h, i) => this._buildReel(h, i));

    // Fade strips go on top of the cards
    this._drawFadeStrips();

    this._drawSpinButton(FX + FW - SIDEBAR / 2, FY + FH / 2);

    // ESC opens settings panel — use addKey so the event is tied to this scene's
    // lifecycle and doesn't conflict with UpgradeTestScene's own ESC handler
    this.input.keyboard.addKey('ESC').on('down', () => {
      if (!this.scene.isActive('PauseScene')) {
        this.scene.launch('PauseScene', { fromUpgrade: true });
      }
    });

    // Initial spin
    this._doSpin(true);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Shorthand: add.text with auto DPR resolution */
  _txt(x, y, str, style) {
    return this.add.text(x, y, str, { ...style, resolution: DPR });
  }

  _drawFadeStrips() {
    // Top fade: from frame background colour (opaque) down to transparent
    const steps = 5;
    const fadeH = 26;
    for (let s = 0; s < steps; s++) {
      const alpha = (1 - s / steps) * 0.92;
      const g = this.add.graphics();
      g.fillStyle(0x0d0a07, alpha);
      g.fillRect(this._fadeFX, this._fadeTop + (s * fadeH / steps), this._fadeW, fadeH / steps);
    }
    // Bottom fade
    for (let s = 0; s < steps; s++) {
      const alpha = (s / steps) * 0.92;
      const g = this.add.graphics();
      g.fillStyle(0x0d0a07, alpha);
      g.fillRect(this._fadeFX, this._fadeBot - fadeH + (s * fadeH / steps), this._fadeW, fadeH / steps);
    }
  }

  // ── Reel building (3 card objects, no mask) ────────────────────────────────

  _buildReel(hero, colIdx) {
    const cx      = this._colCX[colIdx];
    const centreY = this._reelCY;
    const cardW   = this._cardW;

    const history = state.selectedUpgradeHistory[hero.id] || [];
    // Filter out already-selected upgrades; also filter active upgrades if slots are full
    const unit = state.units?.find(u => u.type === hero.id);
    const activeCount = unit ? unit.activeSkillSlots.filter(Boolean).length : 0;
    const pool    = (GameData.upgrades[hero.id] || []).filter(u => {
      if (history.includes(u.id)) return false;
      if (u.upgradeClass === 'active' && activeCount >= 2) return false;
      return true;
    });

    if (pool.length === 0) {
      this._txt(cx, centreY, 'EXHAUSTED', {
        fontSize: '10px', fontFamily: "'Courier New', monospace", color: '#5a3a2a',
      }).setOrigin(0.5);
      state.pendingUpgrades[hero.id] = 'none';
      this._reels.push(null);
      return;
    }

    // Shuffle once per scene; tag each item with its hero so icon lookup works
    const pool2 = [...pool].sort(() => Math.random() - 0.5).map(u => ({ ...u, _heroId: hero.id }));
    const n     = pool2.length;

    // Starting indices: centre = 0, top = n-1 (wraps), bottom = 1
    const p = { top: n - 1, centre: 0, bot: 1 % n };

    // baseY is the TOP edge of the centre card so it's centred on _reelCY
    const baseY = centreY - Math.round(CARD_H / 2);
    const makeCard = (poolIdx, yOff, dim) =>
      this._makeCardObj(pool2[poolIdx], cx, baseY + yOff, cardW, dim);

    const reel = {
      heroId: hero.id,
      pool: pool2,
      n,
      p,                                // current pool indices {top, centre, bot}
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
    const rar = RARITY[upg?.rarity] || RARITY.Common;
    const ICON_SZ = 18;

    const cc  = this.add.container(cx, cy);
    const bg  = this.add.graphics();

    const drawBg = (hovered, selected) => {
      bg.clear();
      // rarity tinted background
      bg.fillStyle(rar.tint, selected ? rar.alpha * 2.4 : hovered ? rar.alpha * 1.7 : rar.alpha);
      bg.fillRect(-cardW / 2, 0, cardW, CARD_H);
      // dark body
      bg.fillStyle(0x110d09, selected ? 0.70 : 0.91);
      bg.fillRect(-cardW / 2 + 3, 0, cardW - 3, CARD_H);
      // left rarity stripe
      bg.fillStyle(rar.tint, selected ? 1 : 0.60);
      bg.fillRect(-cardW / 2, 0, 3, CARD_H);
      // border
      bg.lineStyle(1, selected ? 0xa0d040 : hovered ? rar.tint : 0x251d14);
      bg.strokeRect(-cardW / 2, 0, cardW, CARD_H);
    };

    drawBg(false, false);
    cc.add(bg);

    // Icon
    const iconKey = HERO_ICON[upg?._heroId] || upg?._iconKey;
    const iconX = -cardW / 2 + 7 + ICON_SZ / 2;
    const iconY = CARD_H / 2;
    if (iconKey && this.textures.exists(iconKey)) {
      const img = this.add.image(iconX, iconY, iconKey)
        .setDisplaySize(ICON_SZ, ICON_SZ)
        .setTint(rar.tint)
        .setAlpha(0.65);
      cc.add(img);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(rar.tint, 0.35);
      ph.fillRect(iconX - ICON_SZ / 2, iconY - ICON_SZ / 2, ICON_SZ, ICON_SZ);
      cc.add(ph);
    }

    const textX  = -cardW / 2 + 7 + ICON_SZ + 5;
    const textW  = cardW - 7 - ICON_SZ - 14;

    cc.add(this._txt(textX, 6, upg?.name || '', {
      fontSize: '10px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: '#e8d8b0', wordWrap: { width: textW },
    }));
    cc.add(this._txt(-cardW / 2 + 7, 30, upg?.description || '', {
      fontSize: '9px', fontFamily: "'Courier New', monospace",
      color: '#9a8060', wordWrap: { width: cardW - 14 },
    }));

    cc.setAlpha(dim ? 0.25 : 1);

    return { cc, bg, drawBg, upg };
  }

  // ── Update card content in-place ───────────────────────────────────────────

  _updateCardContent(cardObj, upg) {
    // Destroy old container children and rebuild in-place
    const { cc, bg } = cardObj;
    const cx  = cc.x;
    const cy  = cc.y;
    const dim = cc.alpha < 0.5;
    const cardW = this._cardW;

    cc.removeAll(true); // destroy all children

    // Recreate bg graphics
    const rar = RARITY[upg?.rarity] || RARITY.Common;
    const newBg = this.add.graphics();
    const drawBg = (hovered, selected) => {
      newBg.clear();
      newBg.fillStyle(rar.tint, selected ? rar.alpha * 2.4 : hovered ? rar.alpha * 1.7 : rar.alpha);
      newBg.fillRect(-cardW / 2, 0, cardW, CARD_H);
      newBg.fillStyle(0x110d09, selected ? 0.70 : 0.91);
      newBg.fillRect(-cardW / 2 + 3, 0, cardW - 3, CARD_H);
      newBg.fillStyle(rar.tint, selected ? 1 : 0.60);
      newBg.fillRect(-cardW / 2, 0, 3, CARD_H);
      newBg.lineStyle(1, selected ? 0xa0d040 : hovered ? rar.tint : 0x251d14);
      newBg.strokeRect(-cardW / 2, 0, cardW, CARD_H);
    };
    drawBg(false, false);
    cc.add(newBg);

    const ICON_SZ = 18;
    const iconX   = 0  ;
    const iconY   = CARD_H * 4 / 5;
    const iconKey = HERO_ICON[upg?._heroId];
    if (iconKey && this.textures.exists(iconKey)) {
      const img = this.add.image(iconX, iconY, iconKey)
        .setDisplaySize(ICON_SZ, ICON_SZ)
        .setTint(rar.tint)
        .setAlpha(0.65);
      cc.add(img);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(rar.tint, 0.35);
      ph.fillRect(iconX - ICON_SZ / 2, iconY - ICON_SZ / 2, ICON_SZ, ICON_SZ);
      cc.add(ph);
    }

    const textX = -cardW / 2 + 7 + ICON_SZ + 5;
    const textW = cardW - 7 - ICON_SZ - 14;
    cc.add(this._txt(textX, 6, upg?.name || '', {
      fontSize: '10px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: '#e8d8b0', wordWrap: { width: textW },
    }));
    cc.add(this._txt(-cardW / 2 + 7, 30, upg?.description || '', {
      fontSize: '9px', fontFamily: "'Courier New', monospace",
      color: '#9a8060', wordWrap: { width: cardW - 14 },
    }));

    // Update cardObj references
    cardObj.bg = newBg;
    cardObj.drawBg = drawBg;
    cardObj.upg = upg;
  }

  // ── Spin logic (3-card cycling, upward scroll) ─────────────────────────────

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
        this._refreshSpinButton?.();
      }
    };

    if (initial) {
      // Initial spin: pick base 0.2–1 s; each column deviates ±0.8 s, hard-capped to [0.2, 1] s
      const baseMs = 300 + Math.random() * 400;
      validReels.forEach(reel => {
        const colMs = Math.max(400, Math.min(1000, baseMs + (Math.random() * 2 - 1) * 300));
        this._spinReel(reel, colMs, 0, true, () => onColDone(reel));
      });
    } else {
      // Pick base 0.5–3.5 s; each column deviates ±1 s, hard-capped to [0.5, 4] s
      const baseMs = 500 + Math.random() * 3000;
      validReels.forEach(reel => {
        const colMs = Math.max(500, Math.min(4000, baseMs + (Math.random() * 2 - 1) * 1000));
        this._spinReel(reel, colMs, 0, true, () => onColDone(reel));
      });
    }
  }

  // Time-based reel spin.
  // duration: total spin time in ms.
  // easeOut:  if true, decelerate over the last DECEL_MS before stopping.
  _spinReel(reel, duration, startDelay, easeOut, onDone) {
    reel._spinning = true;
    let elapsed = 0;
    const TWEEN_MS  = 45;
    const BASE_MS   = 55;   // inter-step delay during fast phase
    const DECEL_MS  = 800;  // length of slowdown window

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
          const decelProgress = easeOut
            ? Math.max(0, 1 - timeLeft / DECEL_MS)
            : 0;
          // If this tween already consumed the remaining budget, wrap up immediately
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

    // Remove any previous interactive state
    bg.removeInteractive();
    bg.removeAllListeners();

    bg.setInteractive(
      new Phaser.Geom.Rectangle(-this._cardW / 2, 0, this._cardW, CARD_H),
      Phaser.Geom.Rectangle.Contains
    );

    bg.on('pointerover', () => {
      if (this._selected?.heroId !== reel.heroId) drawBg(true, false);
    });
    bg.on('pointerout', () => {
      if (this._selected?.heroId !== reel.heroId) drawBg(false, false);
    });
    bg.on('pointerdown', () => {
      playSfx('upgrade_card_select');
      this._selectCard(reel);
    });
  }

  _selectCard(reel) {
    if (this._ready) return;   // already selected, waiting for advance

    // Deselect previous column highlight if switching
    if (this._selected && this._selected.heroId !== reel.heroId) {
      const prev = this._reels.find(r => r?.heroId === this._selected.heroId);
      prev?._centreDrawBg?.(false, false);
    }

    this._selected = { heroId: reel.heroId, upg: reel._centreUpg };
    state.pendingUpgrades[reel.heroId] = reel._centreUpg;
    reel._centreDrawBg(false, true);
    this._ready = true;

    // Auto-advance after a brief moment so the selection highlight is visible
    this.time.delayedCall(380, () => this._advance());
  }

  _advance() {
    const { heroId, upg } = this._selected;
    if (upg.upgradeClass === 'active') {
      // Route to unit's active skill slot
      const unit = state.units?.find(u => u.type === heroId);
      if (unit) {
        unit.pushActiveSkill(upg.id, upg.baseDurability ?? 3);
      }
    } else {
      state.activeUpgrades[heroId].push(upg);
    }
    state.selectedUpgradeHistory[heroId].push(upg.id);

    const initData = this._initData || {};
    this.scene.stop();
    if (initData.returnScene) {
      this.scene.start(initData.returnScene, { cycle: (initData.cycle || 0) + 1 });
    } else {
      this.scene.resume('GameScene');
      this.scene.get('GameScene').advanceWave();
    }
  }

  _clearSelection() {
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

  // ── Buttons ────────────────────────────────────────────────────────────────

  _drawSpinButton(cx, cy) {
    const BW = 38, BH = 82;
    const cnt = this.add.container(cx, cy);
    const bg  = this.add.graphics();

    const icon = this._txt(0, -22, '↻', {
      fontSize: '22px', fontFamily: 'Georgia, serif', color: '#c5a572',
    }).setOrigin(0.5);

    this._spinCountTxt = this._txt(0, 14, `${state.upgradeSpinCredits}`, {
      fontSize: '15px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: '#d9c7a0',
    }).setOrigin(0.5);

    cnt.add([bg, icon, this._spinCountTxt]);

    const draw = (enabled, hovered) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x3a2818 : 0x181008, 1);
      bg.fillRect(-BW / 2, -BH / 2, BW, BH);
      bg.lineStyle(1, enabled ? (hovered ? 0xc5a572 : 0x503820) : 0x201510);
      bg.strokeRect(-BW / 2, -BH / 2, BW, BH);
      const a = enabled ? 1 : 0.28;
      icon.setAlpha(a);
      this._spinCountTxt.setAlpha(a);
      this._spinCountTxt.setText(`${state.upgradeSpinCredits}`);
    };

    this._refreshSpinButton = () => draw(!this._spinning && state.upgradeSpinCredits > 0, false);
    draw(state.upgradeSpinCredits > 0, false);

    const zone = this.add.zone(0, 0, BW, BH).setInteractive({ cursor: 'pointer' });
    cnt.add(zone);

    const canSpin = () => !this._spinning && state.upgradeSpinCredits > 0;
    zone.on('pointerover', () => { if (canSpin()) draw(true, true); });
    zone.on('pointerout',  () => { draw(canSpin(), false); });
    zone.on('pointerdown', () => {
      if (!canSpin()) return;
      playSfx('upgrade_spin_trigger');
      state.upgradeSpinCredits--;
      draw(false, false);
      this._doSpin(false);
    });
  }

}
