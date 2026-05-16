import Phaser from 'phaser';
import { state } from '../../state.js';

export class HUDScene extends Phaser.Scene {
  constructor() { super({ key: 'HUDScene' }); }

  create() {
    this._build();
    this.scale.on('resize', () => {
      this.children.removeAll(true);
      this._build();
    });
  }

  _build() {
    const W = this.scale.width;
    const topY = 14;
    const xpBarW = 180;
    const xpBarH = 8;
    const xpRightX = W - 14;

    // ── XP / Level (top-right) ────────────────────────────────────────────────
    this._lvText = this.add.text(xpRightX, topY, 'LV 1', {
      fontFamily: "'Courier New', monospace",
      resolution: window.devicePixelRatio,
      fontSize: '11px',
      color: '#d8a040',
    }).setOrigin(1, 0);

    this._xpBar = this.add.graphics();
    this._xpBarBounds = { x: xpRightX - xpBarW, y: topY + 16, w: xpBarW, h: xpBarH };

    // ── Wave / kill / time labels — move kill/score below the XP bar ─────────
    const labelY = topY + 36;
    this._waveText  = this.add.text(W / 2, topY, '', { fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '11px', color: '#d9c7a0', letterSpacing: 3 }).setOrigin(0.5, 0);
    this._killText  = this.add.text(xpRightX, labelY, '', { fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '11px', color: '#a89470' }).setOrigin(1, 0);
    this._timeText  = this.add.text(14, topY, '', { fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '11px', color: '#a89470' }).setOrigin(0, 0);
    this._pauseText = this.add.text(W / 2, topY + 18, '', { fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '10px', color: '#8bc34a', letterSpacing: 4 }).setOrigin(0.5, 0);
  }

  update(time, delta) {
    if (!this._waveText) return;
    const s = state;
    const W = this.scale.width;

    this._waveText.setText(`WAVE ${s.wave} / 21  ·  KILLS ${s.kills}  ·  SCORE ${s.score ?? 0}`);
    this._timeText.setText(`${Math.floor(s.survivedSeconds)}s`);

    const spaceHoldDriving = s.spaceHeld && s.spaceHoldDuration >= 1.0;
    if (spaceHoldDriving) {
      this._pauseText.setText(`TIME ×${s.timeSpeed} — HOLDING`).setColor('#8bc34a');
    } else if (s.spaceHeld) {
      this._pauseText.setText('HOLD SPACE TO ADVANCE…').setColor('#a89470');
    } else if (s.manualPause) {
      this._pauseText.setText(`TIME ×0 — SPACE TO RESUME`).setColor('#a89470');
    } else if (s.timeFlow < 0.5) {
      this._pauseText.setText(`TIME ×0 — MOVE UNITS`).setColor('#a89470');
    } else {
      this._pauseText.setText(`TIME ×${s.timeSpeed}`).setColor('#8bc34a');
    }

    // ── XP bar ────────────────────────────────────────────────────────────────
    const { xp, level, xpToNext, _levelUpFlash } = s;
    this._lvText.setText(`LV ${level}`);

    const xpFill = Math.min(1, xp / (xpToNext || 100));
    const { x: bx, y: by, w: bw, h: bh } = this._xpBarBounds;
    const g = this._xpBar;
    g.clear();

    // Background
    g.fillStyle(0x1a120a, 1);
    g.fillRect(bx, by, bw, bh);

    // XP fill — brighter amber during level-up flash
    const flash = _levelUpFlash || 0;
    const fillHex = flash > 0 ? 0xffe070 : 0xd8a040;
    if (xpFill > 0) {
      g.fillStyle(fillHex, 1);
      g.fillRect(bx, by, bw * xpFill, bh);
    }

    // Frame
    g.lineStyle(1, 0x5a4a30, 1);
    g.strokeRect(bx, by, bw, bh);

    // Decay flash in real time (delta is ms)
    if (s._levelUpFlash > 0) {
      s._levelUpFlash = Math.max(0, s._levelUpFlash - delta / 1000);
    }
  }
}
