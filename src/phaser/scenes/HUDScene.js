import Phaser from 'phaser';
import { state } from '../../state.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HUDScene' });
    this._surplusAnimT  = 0;   // 0 = idle, >0 = animating (counts down from 1)
    this._prevSurplus   = 0;
  }

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

    // ── Surplus essence display (shown instead of XP bar when all trees maxed) ─
    this._surplusIcon = this.add.graphics();
    this._surplusText = this.add.text(xpRightX, topY, '', {
      ...S, fontFamily: 'Georgia, serif', fontSize: '14px', color: '#60e890',
    }).setOrigin(1, 0).setVisible(false);

    // ── Wave / kill / time labels ─────────────────────────────────────────────
    const labelY = topY + 36;
    this._waveText  = this.add.text(W / 2, topY, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0e4c0', letterSpacing: 2 }).setOrigin(0.5, 0);
    this._killText  = this.add.text(xpRightX, labelY, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8b080' }).setOrigin(1, 0);
    this._timeText  = this.add.text(14, topY, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8b080' }).setOrigin(0, 0);
    this._pauseText = this.add.text(W / 2, topY + 19, '', { ...S, fontFamily: 'Georgia, serif', fontSize: '12px', color: '#a0d050', letterSpacing: 2 }).setOrigin(0.5, 0);
  }

  _allAbilitiesMaxed() {
    return state.units?.length > 0 &&
      state.units.every(u => [1, 2, 3].every(t => (u.abilityTrees?.[t] ?? 0) >= 3));
  }

  // Returns true when the surplus counter should pulse for this pickup count.
  _shouldAnimate(surplus) {
    if (surplus <= 0) return false;
    if (surplus < 10)   return true;           // every pickup
    if (surplus < 100)  return surplus % 10  === 0;
    if (surplus < 1000) return surplus % 100 === 0;
    return surplus % 1000 === 0;
  }

  update(time, delta) {
    if (!this._waveText) return;
    const s = state;
    const W = this.scale.width;
    const dt = delta / 1000;

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

    const maxed = this._allAbilitiesMaxed();

    if (maxed) {
      // ── Surplus essence display ───────────────────────────────────────────
      const surplus = s.essenceSurplus || 0;

      // Detect new pickups and trigger animation when threshold is met.
      if (surplus > this._prevSurplus && this._shouldAnimate(surplus)) {
        this._surplusAnimT = 1;
      }
      this._prevSurplus = surplus;

      // Advance animation.
      if (this._surplusAnimT > 0) this._surplusAnimT = Math.max(0, this._surplusAnimT - dt / 0.35);
      const pulse = this._surplusAnimT > 0
        ? 1 + 0.45 * Math.sin(this._surplusAnimT * Math.PI)
        : 1;

      // Hide XP elements.
      this._lvText.setVisible(false);
      this._xpBar.clear();

      // Draw surplus icon (glowing essence orb).
      const xpRightX = this.scale.width - 14;
      const topY = 14;
      const iconR = 7 * pulse;
      const iconX = xpRightX - 140 - iconR;
      const iconY = topY + 7;
      const g = this._surplusIcon;
      g.clear();
      // Outer glow
      g.fillStyle(0x40ff90, Math.max(0, 0.25 * pulse));
      g.fillCircle(iconX, iconY, iconR * 2.2);
      // Core
      g.fillStyle(0x60e890, 1);
      g.fillCircle(iconX, iconY, iconR);
      // Bright centre
      g.fillStyle(0xc0ffd0, 0.8);
      g.fillCircle(iconX, iconY, iconR * 0.45);

      // Counter text.
      this._surplusText
        .setText(`× ${surplus}`)
        .setScale(pulse)
        .setVisible(true)
        .setPosition(xpRightX, topY);

    } else {
      // ── Normal ability XP bar ─────────────────────────────────────────────
      this._lvText.setVisible(true);
      this._surplusText.setVisible(false);
      this._surplusIcon.clear();
      this._prevSurplus = 0;
      this._surplusAnimT = 0;

      const abilityXp = s.abilityXp || 0;
      const abilityThreshold = s.abilityXpThreshold || 100;
      const picks = s.abilityXpPicks || 0;
      this._lvText.setText(`ABILITY XP  ·  ${picks} picks`);

      const xpFill = Math.min(1, abilityXp / abilityThreshold);
      const { x: bx, y: by, w: bw, h: bh } = this._xpBarBounds;
      const g = this._xpBar;
      g.clear();

      g.fillStyle(0x0a121a, 1);
      g.fillRect(bx, by, bw, bh);

      if (xpFill > 0) {
        g.fillStyle(0x40a8d8, 1);
        g.fillRect(bx, by, bw * xpFill, bh);
      }

      g.lineStyle(1, 0x304a5a, 1);
      g.strokeRect(bx, by, bw, bh);
    }
  }
}
