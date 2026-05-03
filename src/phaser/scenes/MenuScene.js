import Phaser from 'phaser';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';
import { initAudio, playMusic, setMusicVolume, setSfxVolume, audioState } from '../../systems/audio.js';
import { state } from '../../state.js';

// ── Per-screen panel geometry ─────────────────────────────────────────────────
// Each screen declares where its panel starts and how wide it is.
// To add a new screen: add an entry here and a _show<Name>() method.
const SCREENS = {
  title: {
    panel: { xFrac: 0.03, maxWidth: 250, wFrac: 0.45 },
    yFrac: 0.18,
  },
  difficulty: {
    panel: { xFrac: 0.06, maxWidth: 400, wFrac: 0.45 },
    yFrac: 0.10,
  },
  settings: {
    panel: { xFrac: 0.06, maxWidth: 380, wFrac: 0.40 },
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
    fadeStep:   20,           // px width of each fade strip
    panelAlpha: 0.85,
    fadeAlphas: [0.55, 0.30, 0.12],  // one entry = one fade strip
  },
};

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  videoBgPanel:      0x060301,

  btnBg:             0x2a1a0a,
  btnBgHover:        0x3a2a1a,
  btnBorder:         0x8a6b3a,
  btnBorderHover:    0xc5a572,

  sliderTrack:       0x2a1a0a,
  sliderFill:        0xc5a050,
  sliderThumb:       0xd9c7a0,
  sliderThumbBorder: 0x8a6b3a,

  toggleOnBg:        0x1a2a0a,
  toggleOffBg:       0x1a0a0a,
  toggleOnBorder:    0x6a9a30,
  toggleOffBorder:   0x5a1010,

  diffSelectedBg:    0x2a1a0a,
  diffDefaultBg:     0x140e08,
  diffDevBg:         0x1a0808,
};

// ── Text colours ──────────────────────────────────────────────────────────────
const TC = {
  primary: '#d9c7a0',
  gold:    '#c5a050',
  muted:   '#a89470',
  dim:     '#7a5a30',
  dark:    '#5a4020',
  faint:   '#2a1a0a',
  green:   '#8bc34a',
  red:     '#c04040',
};

// ── Difficulty content ────────────────────────────────────────────────────────
const DIFF_ORDER = ['cavity-cadet', 'brood-hunter', 'crack-knight', 'rear-admiral', 'dev-mode'];
const DIFF_HINTS = {
  'cavity-cadet': 'fewer enemies · generous loot',
  'brood-hunter': 'balanced · intended experience',
  'crack-knight': 'faster · harder · scarcer loot',
  'rear-admiral': 'brutal · multiple bosses · barely any healing',
  'dev-mode':     'wave 21 only · all enemies · for testing end-game',
};

// ─────────────────────────────────────────────────────────────────────────────

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this._selectedDiff = 'brood-hunter';
    this._screen = 'title';
  }

  create() {
    this._videoEl = document.getElementById('menuVideo');
    if (this._videoEl) {
      if (!this._videoEl.src) {
        this._videoEl.src = '/heavy/pray.menu.2.mp4';
        this._videoEl.load();
      }
      this._videoEl.style.display = 'block';
      this._videoEl.play().catch(() => {});
    }

    this.events.on('shutdown', () => {
      if (this._videoEl) this._videoEl.style.display = 'none';
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

  // Dark panel exactly over the button column, then pixel-width fade strips.
  _drawVideoBg(panelX, panelW) {
    const H = this.scale.height;
    const { fadeStep, panelAlpha, fadeAlphas } = LAYOUT.videoBg;
    const edge = panelX + panelW;

    this._bg.fillStyle(COLORS.videoBgPanel, panelAlpha).fillRect(0, 0, edge, H);
    fadeAlphas.forEach((alpha, i) =>
      this._bg.fillStyle(COLORS.videoBgPanel, alpha)
        .fillRect(edge + i * fadeStep, 0, fadeStep, H)
    );
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  _showTitle() {
    this._screen = 'title';
    this._clearScreen();
    initAudio();
    playMusic('menu');

    const { x: panelX, w: panelW, y: panelY } = this._panelDims();
    this._drawVideoBg(panelX, panelW);

    this._txt(panelX, panelY,       'P-RAY',                                { fontSize: '42px', color: TC.gold, fontFamily: 'Georgia, serif' });
    this._txt(panelX, panelY + 60,  'T H E   G A M E',                     { fontSize: '11px', color: TC.dark });
    this._txt(panelX, panelY + 96,  'Endoserpents at your door.',           { fontSize: '11px', color: TC.dim });
    this._txt(panelX, panelY + 118, 'P-RAY is all that can save the world.',{ fontSize: '11px', color: TC.dim });

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
  }

  _showDifficulty() {
    this._screen = 'difficulty';
    this._clearScreen();

    const { x: panelX, w: panelW, y: panelY } = this._panelDims();
    this._drawVideoBg(panelX, panelW);

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
    this._drawVideoBg(panelX, panelW);

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

  // ── Primitive widgets ─────────────────────────────────────────────────────

  _txt(x, y, str, style = {}) {
    return this.add.text(Math.round(x), Math.round(y), str, {
      fontFamily: "'Courier New', monospace",
      fontSize:   '12px',
      color:      TC.primary,
      resolution: window.devicePixelRatio,
      ...style,
    });
  }

  _btn(x, y, w, h, label, cb, disabled = false) {
    const g = this.add.graphics();
    const redraw = hover => {
      g.clear();
      g.fillStyle(hover ? COLORS.btnBgHover : COLORS.btnBg, 1).fillRect(x, y, w, h);
      g.lineStyle(1, hover ? COLORS.btnBorderHover : COLORS.btnBorder, disabled ? 0.3 : 1).strokeRect(x, y, w, h);
    };
    redraw(false);

    this._txt(x + w / 2, y + h / 2, label, { fontSize: '13px', color: TC.primary })
      .setOrigin(0.5, 0.5)
      .setAlpha(disabled ? 0.3 : 1);

    if (!disabled && cb) {
      this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive()
        .on('pointerover',  () => redraw(true))
        .on('pointerout',   () => redraw(false))
        .on('pointerdown',  () => cb());
    }
  }

  _slider(x, y, w, label, getValue, onChange) {
    const { trackH, thumbR, labelAbove, valueRight } = LAYOUT.slider;
    const cy = Math.round(y + thumbR);
    const g  = this.add.graphics();
    let valTxt;

    const redraw = v => {
      const fillW = Math.round(w * v);
      g.clear();
      g.fillStyle(COLORS.sliderTrack, 1)
        .fillRect(x, cy - Math.ceil(trackH / 2), w, trackH);
      if (v > 0) g.fillStyle(COLORS.sliderFill, 1)
        .fillRect(x, cy - Math.ceil(trackH / 2), fillW, trackH);
      g.fillStyle(COLORS.sliderThumb, 1).fillCircle(x + fillW, cy, thumbR);
      g.lineStyle(1, COLORS.sliderThumbBorder, 1).strokeCircle(x + fillW, cy, thumbR);
      if (valTxt) valTxt.setText(Math.round(v * 100) + '%');
    };

    this._txt(x, y - labelAbove, label, { fontSize: '9px', color: TC.muted, letterSpacing: 2 });
    valTxt = this._txt(x + w + valueRight, cy - 6, '', { fontSize: '10px', color: TC.primary });
    redraw(getValue());

    const apply = ptr => {
      const v = Math.max(0, Math.min(1, (ptr.x - x) / w));
      onChange(v);
      redraw(v);
    };
    this.add.zone(x - thumbR, cy - thumbR - 2, w + thumbR * 2, thumbR * 2 + 4)
      .setOrigin(0, 0).setInteractive()
      .on('pointerdown', apply)
      .on('pointermove', ptr => { if (ptr.isDown) apply(ptr); });
  }

  _toggle(x, y, label, getState, onToggle) {
    const { width: btnW, height: btnH, btnOffsetX } = LAYOUT.toggle;
    const g = this.add.graphics();

    const redraw = () => {
      const on = getState();
      g.clear();
      g.fillStyle(on ? COLORS.toggleOnBg : COLORS.toggleOffBg, 1)
        .fillRect(x + btnOffsetX, y, btnW, btnH);
      g.lineStyle(1, on ? COLORS.toggleOnBorder : COLORS.toggleOffBorder, 1)
        .strokeRect(x + btnOffsetX, y, btnW, btnH);
    };

    this._txt(x, y + Math.round(btnH / 2) - 6, label,
      { fontSize: '10px', color: TC.muted, letterSpacing: 2 });

    const stateTxt = this._txt(x + btnOffsetX + btnW / 2, y + btnH / 2, '',
      { fontSize: '10px', color: TC.primary }).setOrigin(0.5, 0.5);

    const refresh = () => {
      redraw();
      const on = getState();
      stateTxt.setText(on ? 'ON' : 'OFF').setColor(on ? TC.green : TC.red);
    };
    refresh();

    this.add.zone(x + btnOffsetX, y, btnW, btnH).setOrigin(0, 0).setInteractive()
      .on('pointerdown', () => { onToggle(!getState()); refresh(); });
  }
}
