import Phaser from 'phaser';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';
import { playMusic, setMusicVolume, setSfxVolume, audioState } from '../../systems/audio.js';
import { state } from '../../state.js';
import { COLORS as W_COLORS, TC, txt as wTxt, btn as wBtn, slider as wSlider, toggle as wToggle } from '../ui/widgets.js';

// ── Per-screen panel geometry ─────────────────────────────────────────────────
// Each screen declares where its panel starts and how wide it is.
// To add a new screen: add an entry here and a _show<Name>() method.
const SCREENS = {
  title: {
    panel: { xFrac: 0.03, maxWidth: 250, wFrac: 0.45 },
    yFrac: 0.18,
  },
  difficulty: {
    panel: { xFrac: 0.03, maxWidth: 300, wFrac: 0.45 },
    yFrac: 0.10,
  },
  settings: {
    panel: { xFrac: 0.03, maxWidth: 380, wFrac: 0.40 },
    yFrac: 0.10,
  },
};

// ── Shared widget metrics ─────────────────────────────────────────────────────
const LAYOUT = {
  btn: {
    height: 42,
    gap:    56,   // vertical distance between consecutive button tops
  },
  diffRow: {
    height: 48,
    gap:    58,
  },
  slider: {
    maxWidth:     260,
    wFrac:        0.32,
    trackH:       3,
    thumbR:       6,
    rowH:         60,   // vertical space consumed per slider row
    labelAbove:   16,   // px above thumb centre for the label
    valueRight:   10,   // px right of track end for the value readout
  },
  toggle: {
    width:      52,
    height:     26,
    btnOffsetX: 160,  // x from row-left to the ON/OFF button
    rowH:       44,
  },
  videoBg: {
    coverWidth: 400,          // fixed px width of the solid dark panel
    fadeStep:   20,           // px width of each fade strip
    panelAlpha: 0.60,
    fadeAlphas: [0.45, 0.30, 0.15],  // one entry = one fade strip
  },
};

// ── Colour palette ────────────────────────────────────────────────────────────
// Widget colours live in ui/widgets.js; only scene-specific colours here.
const COLORS = {
  ...W_COLORS,
  videoBgPanel:   0x060301,
  diffSelectedBg: 0x2a1a0a,
  diffDefaultBg:  0x140e08,
  diffDevBg:      0x1a0808,
};

// ── Difficulty content ────────────────────────────────────────────────────────
const DIFF_ORDER = ['cavity-cadet', 'brood-hunter', 'crack-knight', 'rear-admiral', 'dev-mode'];
const DIFF_HINTS = {
  'cavity-cadet': 'fewer enemies · generous loot',
  'brood-hunter': 'balanced · intended experience',
  'crack-knight': 'faster · harder · scarcer loot',
  'rear-admiral': 'brutal · multiple bosses · barely any healing',
  'dev-mode':     'a single wave only · all enemies · for testing end-game',
};

// ─────────────────────────────────────────────────────────────────────────────

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this._selectedDiff = 'brood-hunter';
    this._screen = 'title';
    this._devExpanded  = false;
    this._devSub       = null;   // 'level' | 'slot' | null
  }

  create() {
    this._videoEl = document.getElementById('menuVideo');
    if (this._videoEl) {
      if (!this._videoEl.src) {
        this._videoEl.src = './assets/video/menu/pray.menu.mp4';
        this._videoEl.load();
      }
      this._videoEl.style.display = 'block';
      this._videoEl.play().catch(() => {});
    }

    this._initHockeyCursor();

    this.events.on('shutdown', () => {
      if (this._videoEl) this._videoEl.style.display = 'none';
      this._destroyHockeyCursor();
    }, this);

    this._showTitle();
    this.scale.on('resize', () => {
      if      (this._screen === 'title')      this._showTitle();
      else if (this._screen === 'difficulty') this._showDifficulty();
      else if (this._screen === 'settings')   this._showSettings();
    }, this);
  }

  // ── Screen helpers ────────────────────────────────────────────────────────

  // Returns { x, w, y } for the current (or named) screen's panel.
  _panelDims(screen = this._screen) {
    const { width: W, height: H } = this.scale;
    const cfg = SCREENS[screen];
    return {
      x: Math.round(W * cfg.panel.xFrac),
      w: Math.min(cfg.panel.maxWidth, Math.round(W * cfg.panel.wFrac)),
      y: Math.round(H * cfg.yFrac),
    };
  }

  _clearScreen() {
    this.children.removeAll(true);
    this._bg = this.add.graphics();
  }

  // Fixed-width dark panel on the left, then pixel-width fade strips.
  // Adjust LAYOUT.videoBg.coverWidth to widen or narrow the dark area.
  _drawVideoBg() {
    const H = this.scale.height;
    const { coverWidth, fadeStep, panelAlpha, fadeAlphas } = LAYOUT.videoBg;

    this._bg.fillStyle(COLORS.videoBgPanel, panelAlpha).fillRect(0, 0, coverWidth, H);
    fadeAlphas.forEach((alpha, i) =>
      this._bg.fillStyle(COLORS.videoBgPanel, alpha)
        .fillRect(coverWidth + i * fadeStep, 0, fadeStep, H)
    );
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  _showTitle() {
    this._screen = 'title';
    this._clearScreen();
    playMusic('menu');

    const { x: panelX, w: panelW, y: panelY } = this._panelDims();
    this._drawVideoBg();

    this._txt(panelX, panelY,       'P-RAY',                                { fontSize: '42px', color: TC.gold, fontFamily: 'Georgia, serif' });
    this._txt(panelX, panelY + 60,  'T H E   G A M E',                     { fontSize: '20px', color: TC.dark });
    this._txt(panelX, panelY + 96,  'Endoserpents at your door.',           { fontSize: '15px', color: TC.dim });
    this._txt(panelX, panelY + 118, 'P-RAY is all that can save the world.',{ fontSize: '15px', color: TC.dim });

    // ── To add a title-screen button: append an entry to this array ───────
    const buttons = [
      { label: 'PLAY',     cb: () => this._showDifficulty() },
      { label: 'SETTINGS', cb: () => this._showSettings() },
      { label: 'CREDITS',  disabled: true },
    ];
    const btnStartY = panelY + 170;
    this._renderButtonList(panelX, btnStartY, panelW, buttons);
    this._txt(panelX, btnStartY + buttons.length * LAYOUT.btn.gap + 14,
      'prototype build · phase 5', { fontSize: '9px', color: TC.faint });

    const devY = btnStartY + buttons.length * LAYOUT.btn.gap + 38;
    this._renderDevSection(panelX, devY, panelW);
  }

  _showDifficulty() {
    this._screen = 'difficulty';
    this._clearScreen();

    const { x: panelX, w: panelW, y: panelY } = this._panelDims();
    this._drawVideoBg();

    this._txt(panelX, panelY, 'SELECT DIFFICULTY',
      { fontSize: '20px', color: TC.gold, fontFamily: 'Georgia, serif' });

    // ── To add a difficulty mode: add to DIFF_ORDER + DIFF_HINTS above ────
    let rowY = panelY + 60;
    for (const id of DIFF_ORDER) {
      this._diffRow(panelX, rowY, panelW, id);
      rowY += LAYOUT.diffRow.gap;
    }

    const halfW = panelW * 0.45;
    const footerY = rowY + 8;
    this._btn(panelX,                footerY, halfW, LAYOUT.btn.height, 'BACK',  () => this._showTitle());
    this._btn(panelX + panelW * 0.55, footerY, halfW, LAYOUT.btn.height, 'START', () => {
      this.scene.start('GameScene', { difficulty: this._selectedDiff });
    });
  }

  _showSettings() {
    this._screen = 'settings';
    this._clearScreen();

    const { x: panelX, w: panelW, y: panelY } = this._panelDims();
    const sliderW = Math.min(LAYOUT.slider.maxWidth, Math.round(this.scale.width * LAYOUT.slider.wFrac));
    this._drawVideoBg();

    this._txt(panelX, panelY, 'SETTINGS',
      { fontSize: '20px', color: TC.gold, fontFamily: 'Georgia, serif' });

    // ── To add a volume control: append an entry to this array ────────────
    const sliders = [
      { label: 'MUSIC VOLUME',   getValue: () => audioState.musicVolume, onChange: v => setMusicVolume(v) },
      { label: 'EFFECTS VOLUME', getValue: () => audioState.sfxVolume,   onChange: v => setSfxVolume(v) },
    ];

    // ── To add a gameplay toggle: append an entry to this array ───────────
    const toggles = [
      {
        label:    'SCREEN SHAKE',
        getState: () => !state.settings.noShake,
        onToggle: on => { state.settings.noShake = !on; this._saveSettings(); },
      },
      {
        label:    'LIGHTNING EFFECTS',
        getState: () => !state.settings.noLightning,
        onToggle: on => { state.settings.noLightning = !on; this._saveSettings(); },
      },
    ];

    let y = panelY + 58;
    for (const s of sliders) { this._slider(panelX, y, sliderW, s.label, s.getValue, s.onChange); y += LAYOUT.slider.rowH; }
    y += 12;
    for (const t of toggles) { this._toggle(panelX, y, t.label, t.getState, t.onToggle); y += LAYOUT.toggle.rowH; }
    y += 16;
    this._btn(panelX, y, Math.min(200, Math.round(this.scale.width * 0.24)), LAYOUT.btn.height, 'BACK',
      () => this._showTitle());
  }

  _saveSettings() {
    try { localStorage.setItem('praySettings', JSON.stringify(state.settings)); } catch {}
  }

  // ── Dev section ───────────────────────────────────────────────────────────

  _renderDevSection(x, y, w) {
    const TOG_H = 24;
    const arrow = this._devExpanded ? '▼' : '▶';

    // Disclosure bar
    const togBg = this.add.graphics();
    const drawTogBg = (hov) => {
      togBg.clear();
      togBg.fillStyle(hov ? 0x2a0e0e : 0x190808, 1).fillRect(x, y, w, TOG_H);
      togBg.lineStyle(1, 0x5a1818).strokeRect(x, y, w, TOG_H);
    };
    drawTogBg(false);
    this._txt(x + 10, y + 6, `${arrow} DEV TOOLS`, {
      fontSize: '10px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: '#cc5555',
    });

    this.add.zone(x, y, w, TOG_H).setOrigin(0, 0).setInteractive()
      .on('pointerover', () => drawTogBg(true))
      .on('pointerout',  () => drawTogBg(false))
      .on('pointerdown', () => { this._devExpanded = !this._devExpanded; this._showTitle(); });

    if (!this._devExpanded) return;

    // Two sub-menus
    const SUB_H = 28, SUB_GAP = 32, INDENT = 12;
    const subW = w - INDENT;
    const items = [
      { label: 'LEVEL TESTING', sub: 'level', hint: 'start game · dev-mode difficulty' },
      { label: 'SLOT MACHINE',  sub: 'slot',  hint: 'test upgrade reels in isolation'  },
    ];

    items.forEach(({ label, sub, hint }, i) => {
      const sy = y + TOG_H + 6 + i * SUB_GAP;
      const sx = x + INDENT;
      const isOpen = this._devSub === sub;

      const sbg = this.add.graphics();
      const drawSub = (hov) => {
        sbg.clear();
        sbg.fillStyle(hov || isOpen ? 0x261010 : 0x140808, 1).fillRect(sx, sy, subW, SUB_H);
        sbg.lineStyle(1, isOpen ? 0x8a2020 : 0x421414).strokeRect(sx, sy, subW, SUB_H);
      };
      drawSub(false);

      this._txt(sx + 8, sy + 4, label, {
        fontSize: '10px', fontFamily: "'Courier New', monospace",
        fontStyle: 'bold', color: isOpen ? '#ff8888' : '#cc6666',
      });
      this._txt(sx + 8, sy + 15, hint, {
        fontSize: '8px', fontFamily: "'Courier New', monospace", color: '#907070',
      });

      this.add.zone(sx, sy, subW, SUB_H).setOrigin(0, 0).setInteractive()
        .on('pointerover', () => drawSub(true))
        .on('pointerout',  () => drawSub(false))
        .on('pointerdown', () => this._launchDevSub(sub));
    });

    // Content area for whichever sub is open
    const contentY = y + TOG_H + 6 + items.length * SUB_GAP + 6;
    if (this._devSub === 'level') this._renderDevLevel(x + INDENT, contentY, subW);
    if (this._devSub === 'slot')  this._renderDevSlot(x + INDENT, contentY, subW);
  }

  _launchDevSub(sub) {
    if (this._devSub === sub) { this._devSub = null; this._showTitle(); return; }
    if (sub === 'slot') {
      this.scene.start('UpgradeTestScene');
      return;
    }
    this._devSub = sub;
    this._showTitle();
  }

  _renderDevLevel(x, y, w) {
    const H = 28;
    const self = this;

    const launchDev = () => self.scene.start('GameScene', { difficulty: 'dev-mode' });

    const bg = this.add.graphics();
    const drawBg = (hov) => {
      bg.clear();
      bg.fillStyle(hov ? 0x1e1a10 : 0x141008, 1).fillRect(x, y, w, H);
      bg.lineStyle(1, hov ? 0xc5a572 : 0x4a3818).strokeRect(x, y, w, H);
    };
    drawBg(false);
    this._txt(x + 10, y + 8, 'START GAME (dev-mode difficulty)', {
      fontSize: '10px', fontFamily: "'Courier New', monospace", color: '#d4b880',
    });
    this.add.zone(x, y, w, H).setOrigin(0, 0).setInteractive()
      .on('pointerover', () => drawBg(true))
      .on('pointerout',  () => drawBg(false))
      .on('pointerdown', launchDev);
  }

  _renderDevSlot(x, y, w) {
    // Slot machine goes directly — no extra sub-content
  }

  // ── Component renderers ───────────────────────────────────────────────────

  // Renders an array of { label, cb?, disabled? } as evenly-spaced buttons.
  _renderButtonList(x, startY, w, buttons) {
    buttons.forEach(({ label, cb, disabled = false }, i) =>
      this._btn(x, startY + i * LAYOUT.btn.gap, w, LAYOUT.btn.height, label, cb ?? null, disabled)
    );
  }

  // One row in the difficulty selector.
  _diffRow(x, y, w, id) {
    const isDev      = id === 'dev-mode';
    const isSelected = id === this._selectedDiff;

    const bgColor  = isDev ? COLORS.diffDevBg      : (isSelected ? COLORS.diffSelectedBg : COLORS.diffDefaultBg);
    const border   = isDev ? '#5a1010'              : (isSelected ? '#c5a572'              : '#2a1c10');
    const labelClr = isDev ? TC.red                 : (isSelected ? '#ffffff'               : TC.dark);
    const hintClr  = isDev ? '#6a2020'              : (isSelected ? '#a89060'               : TC.dark);

    this.add.graphics()
      .fillStyle(bgColor, 1).fillRect(x, y, w, LAYOUT.diffRow.height)
      .lineStyle(1, Phaser.Display.Color.HexStringToColor(border).color, 1)
      .strokeRect(x, y, w, LAYOUT.diffRow.height);

    this._txt(x + 14, y + 8,  (DIFFICULTY_DEFS[id]?.label || id).toUpperCase(), { fontSize: '11px', color: labelClr, fontStyle: 'bold' });
    this._txt(x + 14, y + 28, DIFF_HINTS[id] ?? '',                              { fontSize: '9px',  color: hintClr });

    this.add.zone(x, y, w, LAYOUT.diffRow.height).setOrigin(0, 0).setInteractive()
      .on('pointerdown', () => { this._selectedDiff = id; this._showDifficulty(); });
  }

  // ── Primitive widgets — delegate to shared ui/widgets.js ─────────────────

  _txt(x, y, str, style = {})                           { return wTxt(this, x, y, str, style); }
  _btn(x, y, w, h, label, cb, disabled = false)         { return wBtn(this, x, y, w, h, label, cb, disabled); }
  _slider(x, y, w, label, getValue, onChange)           { return wSlider(this, x, y, w, label, getValue, onChange); }
  _toggle(x, y, label, getState, onToggle)              { return wToggle(this, x, y, label, getState, onToggle); }

  // ── Hockey club cursor ────────────────────────────────────────────────────

  _initHockeyCursor() {
    this.sys.game.canvas.style.cursor = 'none';
    this._clubG = this.add.graphics().setDepth(9999);
    this._drawClub(this.input.activePointer.x, this.input.activePointer.y);
    this.input.on('pointermove', (ptr) => this._drawClub(ptr.x, ptr.y));
  }

  _drawClub(px, py) {
    const g = this._clubG;
    if (!g) return;
    g.clear();
    g.x = px; g.y = py;

    // Blade — thick curved piece at origin
    g.lineStyle(5, 0xd4b070, 1);
    g.beginPath();
    g.moveTo(-2, 3);
    g.lineTo(14, 0);
    g.strokePath();
    // Blade tip cap
    g.fillStyle(0xd4b070, 1);
    g.fillCircle(-2, 3, 2.5);

    // Handle — tapered stick going up-right
    g.lineStyle(4, 0xb88c4a, 1);
    g.beginPath();
    g.moveTo(4, -1);
    g.lineTo(22, -30);
    g.strokePath();
    g.lineStyle(2, 0x8a6030, 1);
    g.beginPath();
    g.moveTo(5, -2);
    g.lineTo(23, -31);
    g.strokePath();

    // Knob at top of handle
    g.fillStyle(0x8a6030, 1);
    g.fillCircle(23, -31, 3);
  }

  _destroyHockeyCursor() {
    this.sys.game.canvas.style.cursor = 'default';
    if (this._clubG) { this._clubG.destroy(); this._clubG = null; }
    this.input.off('pointermove');
  }
}
