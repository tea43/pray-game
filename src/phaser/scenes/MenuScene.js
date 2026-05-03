import Phaser from 'phaser';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';

const PAL = {
  bg:        0x0a0604,
  btnBg:     0x2a1a0a,
  btnBorder: 0x8a6b3a,
};

const DIFF_ORDER = ['cavity-cadet', 'brood-hunter', 'crack-knight', 'rear-admiral', 'dev-mode'];
const DIFF_HINTS = {
  'cavity-cadet': 'fewer enemies · generous loot',
  'brood-hunter': 'balanced · intended experience',
  'crack-knight': 'faster · harder · scarcer loot',
  'rear-admiral': 'brutal · multiple bosses · barely any healing',
  'dev-mode':     'wave 21 only · all enemies · for testing end-game',
};

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this._selectedDiff = 'brood-hunter';
    this._screen = 'title';
  }

  create() {
    this._showTitle();
    this.scale.on('resize', () => {
      if (this._screen === 'title') this._showTitle();
      else this._showDifficulty();
    }, this);
  }

  // ── Screen helpers ────────────────────────────────────────────────────────

  _clearScreen() {
    this.children.removeAll(true);
    this._bg = this.add.graphics();
  }

  _showTitle() {
    this._screen = 'title';
    this._clearScreen();
    const W = this.scale.width, H = this.scale.height;

    this._bg.fillStyle(PAL.bg, 1).fillRect(0, 0, W, H);

    const panelW = Math.min(400, W * 0.45);
    const panelX = W * 0.06;
    const panelY = H * 0.18;

    this._txt(panelX, panelY,       'P-RAY',                              { fontSize: '42px', color: '#c5a050', fontFamily: 'Georgia, serif' });
    this._txt(panelX, panelY + 60,  'T H E   G A M E',                   { fontSize: '11px', color: '#5a4020' });
    this._txt(panelX, panelY + 96,  'Endoserpents at your door.',         { fontSize: '11px', color: '#7a5a30', fontStyle: 'italic' });
    this._txt(panelX, panelY + 118, 'P-RAY is all that can save your world.', { fontSize: '11px', color: '#7a5a30', fontStyle: 'italic' });

    const btnY = panelY + 170;
    this._btn(panelX, btnY,        panelW, 42, 'PLAY',     () => this._showDifficulty());
    this._btn(panelX, btnY + 56,   panelW, 42, 'SETTINGS', null, true);
    this._btn(panelX, btnY + 112,  panelW, 42, 'CREDITS',  null, true);
    this._txt(panelX, btnY + 168, 'prototype build · phase 5', { fontSize: '9px', color: '#2a1a0a' });
  }

  _showDifficulty() {
    this._screen = 'difficulty';
    this._clearScreen();
    const W = this.scale.width, H = this.scale.height;

    this._bg.fillStyle(PAL.bg, 1).fillRect(0, 0, W, H);

    const panelW = Math.min(400, W * 0.45);
    const panelX = W * 0.06;
    const panelY = H * 0.1;

    this._txt(panelX, panelY, 'SELECT DIFFICULTY', { fontSize: '20px', color: '#c5a050', fontFamily: 'Georgia, serif' });

    let y = panelY + 60;
    for (const id of DIFF_ORDER) {
      const isDev      = id === 'dev-mode';
      const isSelected = id === this._selectedDiff;
      const bgColor    = isDev ? 0x1a0808 : (isSelected ? 0x2a1a0a : 0x140e08);
      const borderHex  = isDev ? '#5a1010' : (isSelected ? '#c5a572' : '#2a1c10');
      const labelColor = isDev ? '#c04040' : (isSelected ? '#ffffff'  : '#7a6040');
      const hintColor  = isDev ? '#6a2020' : (isSelected ? '#a89060'  : '#5a4020');

      const g = this.add.graphics();
      g.fillStyle(bgColor, 1).fillRect(panelX, y, panelW, 48);
      g.lineStyle(1, Phaser.Display.Color.HexStringToColor(borderHex).color, 1).strokeRect(panelX, y, panelW, 48);

      const label = (DIFFICULTY_DEFS[id]?.label || id).toUpperCase();
      this._txt(panelX + 14, y + 8,  label,               { fontSize: '11px', color: labelColor, fontStyle: 'bold' });
      this._txt(panelX + 14, y + 28, DIFF_HINTS[id] || '', { fontSize: '9px',  color: hintColor });

      const zone = this.add.zone(panelX, y, panelW, 48).setOrigin(0, 0).setInteractive();
      zone.on('pointerdown', () => { this._selectedDiff = id; this._showDifficulty(); });

      y += 58;
    }

    y += 8;
    this._btn(panelX,                    y, panelW * 0.45, 42, 'BACK',  () => this._showTitle());
    this._btn(panelX + panelW * 0.55,    y, panelW * 0.45, 42, 'START', () => {
      this.scene.start('GameScene', { difficulty: this._selectedDiff });
    });
  }

  // ── Primitives ────────────────────────────────────────────────────────────

  _txt(x, y, str, style = {}) {
    return this.add.text(x, y, str, {
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      color: '#d9c7a0',
      ...style,
    });
  }

  _btn(x, y, w, h, label, cb, disabled = false) {
    const g = this.add.graphics();
    const redraw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x3a2a1a : PAL.btnBg, 1).fillRect(x, y, w, h);
      g.lineStyle(1, hover ? 0xc5a572 : PAL.btnBorder, disabled ? 0.3 : 1).strokeRect(x, y, w, h);
    };
    redraw(false);

    this._txt(x + w / 2, y + h / 2, label, { fontSize: '13px', color: '#d9c7a0' })
      .setOrigin(0.5, 0.5)
      .setAlpha(disabled ? 0.3 : 1);

    if (!disabled && cb) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
      zone.on('pointerover',  () => redraw(true));
      zone.on('pointerout',   () => redraw(false));
      zone.on('pointerdown',  () => cb());           // instant response on press
    }
  }
}
