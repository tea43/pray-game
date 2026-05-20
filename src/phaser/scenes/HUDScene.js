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

    const S = { resolution: window.devicePixelRatio, stroke: '#000000', strokeThickness: 3 };

    // ── Ability XP (top-right) ───────────────────────────────────────────────
    this._lvText = this.add.text(xpRightX, topY, 'ABILITY XP', {
      ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e8b848',
    }).setOrigin(1, 0);

    this._xpBar = this.add.graphics();
    this._xpBarBounds = { x: xpRightX - xpBarW, y: topY + 17, w: xpBarW, h: xpBarH };

    // ── Wave / kill / time labels ─────────────────────────────────────────────
    const labelY = topY + 36;
    this._waveText  = this.add.text(W / 2, topY, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0e4c0', letterSpacing: 2 }).setOrigin(0.5, 0);
    this._killText  = this.add.text(xpRightX, labelY, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8b080' }).setOrigin(1, 0);
    this._timeText  = this.add.text(14, topY, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8b080' }).setOrigin(0, 0);
    this._pauseText = this.add.text(W / 2, topY + 19, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '12px', color: '#a0d050', letterSpacing: 2 }).setOrigin(0.5, 0);
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

    // ── Ability XP bar ───────────────────────────────────────────────────────
    const abilityXp = s.abilityXp || 0;
    const abilityThreshold = s.abilityXpThreshold || 100;
    const picks = s.abilityXpPicks || 0;
    this._lvText.setText(`ABILITY XP  ·  ${picks} picks`);

    const xpFill = Math.min(1, abilityXp / abilityThreshold);
    const { x: bx, y: by, w: bw, h: bh } = this._xpBarBounds;
    const g = this._xpBar;
    g.clear();

    // Background
    g.fillStyle(0x0a121a, 1);
    g.fillRect(bx, by, bw, bh);

    // Fill — teal/blue for ability XP
    if (xpFill > 0) {
      g.fillStyle(0x40a8d8, 1);
      g.fillRect(bx, by, bw * xpFill, bh);
    }

    // Frame
    g.lineStyle(1, 0x304a5a, 1);
    g.strokeRect(bx, by, bw, bh);
  }
}
