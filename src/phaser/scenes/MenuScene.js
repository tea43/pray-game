import Phaser from 'phaser';
import { DIFFICULTY_DEFS } from '../../config/difficulty.js';
import { initAudio, playMusic, setMusicVolume, setSfxVolume, audioState } from '../../systems/audio.js';
import { state } from '../../state.js';

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

  _clearScreen() {
    this.children.removeAll(true);
    this._bg = this.add.graphics();
  }

  // Dark-left gradient: heavy cover over the panel column, fades to transparent
  _drawVideoBg() {
    const W = this.scale.width, H = this.scale.height;
    // Three stacked strips; combined alpha approximates the legacy CSS gradient:
    // rgba(6,3,1,0.88) at 0% → rgba(6,3,1,0.20) at ~45% → transparent at ~60%
    this._bg.fillStyle(0x060301, 0.18).fillRect(0, 0, W * 0.55, H);  // faint base
    this._bg.fillStyle(0x060301, 0.50).fillRect(0, 0, W * 0.38, H);  // medium
    this._bg.fillStyle(0x060301, 0.22).fillRect(0, 0, W * 0.24, H);  // darkest on far left
  }

  _showTitle() {
    this._screen = 'title';
    this._clearScreen();
    initAudio();
    playMusic('menu');
    const W = this.scale.width, H = this.scale.height;

    this._drawVideoBg();

    const panelW = Math.min(400, W * 0.45);
    const panelX = Math.round(W * 0.06);
    const panelY = Math.round(H * 0.18);

    this._txt(panelX, panelY,       'P-RAY',                               { fontSize: '42px', color: '#c5a050', fontFamily: 'Georgia, serif' });
    this._txt(panelX, panelY + 60,  'T H E   G A M E',                    { fontSize: '11px', color: '#5a4020' });
    this._txt(panelX, panelY + 96,  'Endoserpents at your door.',          { fontSize: '11px', color: '#7a5a30' });
    this._txt(panelX, panelY + 118, 'P-RAY is all that can save the world.', { fontSize: '11px', color: '#7a5a30' });

    const btnY = panelY + 170;
    this._btn(panelX, btnY,        panelW, 42, 'PLAY',     () => this._showDifficulty());
    this._btn(panelX, btnY + 56,   panelW, 42, 'SETTINGS', () => this._showSettings());
    this._btn(panelX, btnY + 112,  panelW, 42, 'CREDITS',  null, true);
    this._txt(panelX, btnY + 168, 'prototype build · phase 5', { fontSize: '9px', color: '#2a1a0a' });
  }

  _showDifficulty() {
    this._screen = 'difficulty';
    this._clearScreen();
    const W = this.scale.width, H = this.scale.height;

    this._drawVideoBg();

    const panelW = Math.min(400, W * 0.45);
    const panelX = Math.round(W * 0.06);
    const panelY = Math.round(H * 0.1);

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

  _showSettings() {
    this._screen = 'settings';
    this._clearScreen();
    const W = this.scale.width, H = this.scale.height;

    this._drawVideoBg();

    const panelX = Math.round(W * 0.06);
    const panelY = Math.round(H * 0.10);
    const sliderW = Math.min(260, Math.round(W * 0.32));

    this._txt(panelX, panelY, 'SETTINGS', { fontSize: '20px', color: '#c5a050', fontFamily: 'Georgia, serif' });

    let y = panelY + 58;

    // ── Volume sliders ────────────────────────────────────────────────────
    this._slider(panelX, y, sliderW, 'MUSIC VOLUME',
      () => audioState.musicVolume,
      (v) => setMusicVolume(v));

    y += 60;

    this._slider(panelX, y, sliderW, 'EFFECTS VOLUME',
      () => audioState.sfxVolume,
      (v) => setSfxVolume(v));

    // ── Game toggles ──────────────────────────────────────────────────────
    y += 72;
    this._toggle(panelX, y, 'SCREEN SHAKE',
      () => !state.settings.noShake,
      (on) => {
        state.settings.noShake = !on;
        this._saveSettings();
      });

    y += 44;
    this._toggle(panelX, y, 'LIGHTNING EFFECTS',
      () => !state.settings.noLightning,
      (on) => {
        state.settings.noLightning = !on;
        this._saveSettings();
      });

    // ── Back ──────────────────────────────────────────────────────────────
    y += 60;
    this._btn(panelX, y, Math.min(200, Math.round(W * 0.24)), 42, 'BACK', () => this._showTitle());
  }

  _saveSettings() {
    try { localStorage.setItem('praySettings', JSON.stringify(state.settings)); } catch {}
  }

  // ── Primitives ────────────────────────────────────────────────────────────

  _txt(x, y, str, style = {}) {
    return this.add.text(Math.round(x), Math.round(y), str, {
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      color: '#d9c7a0',
      resolution: window.devicePixelRatio,
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
      zone.on('pointerdown',  () => cb());
    }
  }

  // Horizontal drag slider. getValue() → 0–1, onChange(v) called on change.
  _slider(x, y, w, label, getValue, onChange) {
    const trackH = 3, thumbR = 6;
    const cy = Math.round(y + thumbR);

    const g = this.add.graphics();
    let valTxt;

    const redraw = (v) => {
      g.clear();
      g.fillStyle(0x2a1a0a, 1).fillRect(x, cy - Math.ceil(trackH / 2), w, trackH);
      if (v > 0) g.fillStyle(0xc5a050, 1).fillRect(x, cy - Math.ceil(trackH / 2), Math.round(w * v), trackH);
      g.fillStyle(0xd9c7a0, 1).fillCircle(x + Math.round(w * v), cy, thumbR);
      g.lineStyle(1, 0x8a6b3a, 1).strokeCircle(x + Math.round(w * v), cy, thumbR);
      if (valTxt) valTxt.setText(Math.round(v * 100) + '%');
    };

    this._txt(x, y - 16, label, { fontSize: '9px', color: '#a89470', letterSpacing: 2 });
    valTxt = this._txt(x + w + 10, cy - 6, '', { fontSize: '10px', color: '#d9c7a0' });

    redraw(getValue());

    const zone = this.add.zone(x - thumbR, cy - thumbR - 2, w + thumbR * 2, thumbR * 2 + 4)
      .setOrigin(0, 0).setInteractive();

    const apply = (ptr) => {
      const v = Math.max(0, Math.min(1, (ptr.x - x) / w));
      onChange(v);
      redraw(v);
    };
    zone.on('pointerdown', apply);
    zone.on('pointermove', (ptr) => { if (ptr.isDown) apply(ptr); });
  }

  // Two-state toggle button (ON / OFF label).
  _toggle(x, y, label, getState, onToggle) {
    const btnW = 52, btnH = 26;
    const g = this.add.graphics();

    const redraw = () => {
      const on = getState();
      g.clear();
      g.fillStyle(on ? 0x1a2a0a : 0x1a0a0a, 1).fillRect(x + 160, y, btnW, btnH);
      g.lineStyle(1, on ? 0x6a9a30 : 0x5a1010, 1).strokeRect(x + 160, y, btnW, btnH);
    };

    this._txt(x, y + 7, label, { fontSize: '10px', color: '#a89470', letterSpacing: 2 });

    const stateTxt = this._txt(x + 160 + btnW / 2, y + btnH / 2, '', { fontSize: '10px', color: '#d9c7a0' })
      .setOrigin(0.5, 0.5);

    const refresh = () => {
      redraw();
      stateTxt.setText(getState() ? 'ON' : 'OFF').setColor(getState() ? '#8bc34a' : '#c04040');
    };
    refresh();

    const zone = this.add.zone(x + 160, y, btnW, btnH).setOrigin(0, 0).setInteractive();
    zone.on('pointerdown', () => { onToggle(!getState()); refresh(); });
  }
}
