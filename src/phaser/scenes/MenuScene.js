import Phaser from 'phaser';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';

const PAL = {
  bg:        0x0a0604,
  panel:     0x0c0702,
  border:    0x5a3a18,
  gold:      0xc5a050,
  goldDim:   0x8a6b3a,
  text:      0xd9c7a0,
  textDim:   0xa89470,
  textFaint: 0x5a4020,
  btnBg:     0x2a1a0a,
  btnBorder: 0x8a6b3a,
  devRed:    0xc04040,
};

const DIFF_ORDER = ['cavity-cadet', 'brood-hunter', 'crack-knight', 'rear-admiral', 'dev-mode'];
const DIFF_HINTS = {
  'cavity-cadet':  'fewer enemies · generous loot',
  'brood-hunter':  'balanced · intended experience',
  'crack-knight':  'faster · harder · scarcer loot',
  'rear-admiral':  'brutal · multiple bosses · barely any healing',
  'dev-mode':      'wave 21 only · all enemies · for testing end-game',
};

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this._selectedDiff = 'brood-hunter';
    this._screen = 'title'; // 'title' | 'difficulty'
  }

  create() {
    const { width: W, height: H } = this.scale;

    this._bg = this.add.graphics();
    this._panels = this.add.graphics();
    this._diffBtns = [];

    this._buildTitle(W, H);

    this.scale.on('resize', this._onResize, this);
  }

  _onResize(gameSize) {
    this._panels.clear();
    this._bg.clear();
    this._diffBtns.forEach(b => b.destroy());
    this._diffBtns = [];
    this.children.list.slice().forEach(c => c.destroy());
    this._bg = this.add.graphics();
    this._panels = this.add.graphics();
    this._diffBtns = [];
    if (this._screen === 'title') {
      this._buildTitle(gameSize.width, gameSize.height);
    } else {
      this._buildDifficulty(gameSize.width, gameSize.height);
    }
  }

  _buildTitle(W, H) {
    this._screen = 'title';
    const g = this._bg;
    g.fillStyle(PAL.bg, 1);
    g.fillRect(0, 0, W, H);

    // Left panel
    const panelW = Math.min(400, W * 0.45);
    const panelX = W * 0.06;
    const panelY = H * 0.18;

    this._addText(panelX, panelY,        'P-RAY',                 { fontSize: '42px', color: '#c5a050', fontFamily: 'Georgia, serif', letterSpacing: 12 });
    this._addText(panelX, panelY + 60,   'T H E   G A M E',       { fontSize: '11px', color: '#5a4020', letterSpacing: 6 });
    this._addText(panelX, panelY + 96,   'Endoserpents at your door.', { fontSize: '11px', color: '#7a5a30', fontStyle: 'italic' });
    this._addText(panelX, panelY + 118,  'P-RAY is all that can save your world.', { fontSize: '11px', color: '#7a5a30', fontStyle: 'italic' });

    const btnY = panelY + 170;
    this._makeBtn(panelX, btnY,      panelW, 42, 'PLAY',     () => this._buildDifficulty(W, H));
    this._makeBtn(panelX, btnY + 56, panelW, 42, 'SETTINGS', null, true);
    this._makeBtn(panelX, btnY + 112, panelW, 42, 'CREDITS', null, true);

    this._addText(panelX, btnY + 168, 'prototype build · phase 5', { fontSize: '9px', color: '#2a1a0a', letterSpacing: 3 });
  }

  _buildDifficulty(W, H) {
    this._screen = 'difficulty';
    const g = this._bg;
    g.fillStyle(PAL.bg, 1);
    g.fillRect(0, 0, W, H);

    const panelW = Math.min(400, W * 0.45);
    const panelX = W * 0.06;
    const panelY = H * 0.1;

    this._addText(panelX, panelY, 'SELECT DIFFICULTY', { fontSize: '20px', color: '#c5a050', fontFamily: 'Georgia, serif', letterSpacing: 8 });

    let btnY = panelY + 60;
    DIFF_ORDER.forEach(id => {
      const def = DIFFICULTY_DEFS[id];
      const isDev = id === 'dev-mode';
      const isSelected = id === this._selectedDiff;
      const labelColor = isDev ? '#c04040' : (isSelected ? '#ffffff' : '#7a6040');
      const borderColor = isDev ? '#5a1010' : (isSelected ? '#c5a572' : '#2a1c10');
      const bgColor     = isDev ? 0x1a0808   : (isSelected ? 0x2a1a0a   : 0x140e08);

      const g2 = this.add.graphics();
      this._diffBtns.push(g2);
      g2.fillStyle(bgColor, 1);
      g2.fillRect(panelX, btnY, panelW, 48);
      g2.lineStyle(1, Phaser.Display.Color.HexStringToColor(borderColor).color, 1);
      g2.strokeRect(panelX, btnY, panelW, 48);

      this._addText(panelX + 14, btnY + 8,  (def?.label || id).toUpperCase(), { fontSize: '11px', color: labelColor, letterSpacing: 3, fontStyle: 'bold' });
      this._addText(panelX + 14, btnY + 28, DIFF_HINTS[id] || '', { fontSize: '9px', color: isDev ? '#6a2020' : (isSelected ? '#a89060' : '#5a4020'), letterSpacing: 1 });

      // Invisible hit zone
      const zone = this.add.zone(panelX, btnY, panelW, 48).setOrigin(0, 0).setInteractive();
      this._diffBtns.push(zone);
      zone.on('pointerup', () => {
        this._selectedDiff = id;
        this._buildDifficulty(W, H);
      });

      btnY += 58;
    });

    btnY += 8;
    this._makeBtn(panelX,             btnY, panelW * 0.45, 42, 'BACK',  () => this._buildTitle(W, H));
    this._makeBtn(panelX + panelW * 0.55, btnY, panelW * 0.45, 42, 'START', () => {
      this.scene.start('GameScene', { difficulty: this._selectedDiff });
    });
  }

  _addText(x, y, str, style) {
    const t = this.add.text(x, y, str, {
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      color: '#d9c7a0',
      ...style,
    });
    return t;
  }

  _makeBtn(x, y, w, h, label, cb, disabled = false) {
    const g = this.add.graphics();
    const drawBtn = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x3a2a1a : PAL.btnBg, 1);
      g.fillRect(x, y, w, h);
      g.lineStyle(1, hover ? 0xc5a572 : PAL.btnBorder, disabled ? 0.3 : 1);
      g.strokeRect(x, y, w, h);
    };
    drawBtn(false);

    const alpha = disabled ? 0.3 : 1;
    const txt = this._addText(x + w / 2, y + h / 2, label, {
      fontSize: '13px', color: '#d9c7a0', letterSpacing: 3,
    }).setOrigin(0.5, 0.5).setAlpha(alpha);

    if (!disabled && cb) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
      zone.on('pointerover',  () => drawBtn(true));
      zone.on('pointerout',   () => drawBtn(false));
      zone.on('pointerup',    () => cb());
    }

    return { g, txt };
  }
}
