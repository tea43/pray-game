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
    const H = this.scale.height;

    // Wave / kill / time labels sit above the canvas panel area
    const topY = 14;
    this._waveText  = this.add.text(W / 2, topY, '',  { fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#d9c7a0', letterSpacing: 3 }).setOrigin(0.5, 0);
    this._killText  = this.add.text(W - 14, topY, '', { fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#a89470' }).setOrigin(1, 0);
    this._timeText  = this.add.text(14, topY, '',     { fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#a89470' }).setOrigin(0, 0);
    this._pauseText = this.add.text(W / 2, topY + 18, '', { fontFamily: "'Courier New', monospace", fontSize: '10px', color: '#8bc34a', letterSpacing: 4 }).setOrigin(0.5, 0);
  }

  update() {
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
  }
}
