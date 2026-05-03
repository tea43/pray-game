import Phaser from 'phaser';
import { playMusic } from '../../systems/audio.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  init(data) { this._state = data?.state; }

  create() {
    const { width: W, height: H } = this.scale;
    playMusic('menu');

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0302, 0.9);
    bg.fillRect(0, 0, W, H);

    this.add.text(W / 2, H / 2 - 60, 'ALL SURVIVORS DEAD', {
      fontFamily: 'Georgia, serif', resolution: window.devicePixelRatio, fontSize: '36px', color: '#a83a2a', letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0);

    const s = this._state;
    const statLine = s ? `KILLS: ${s.kills}   SURVIVED: ${Math.floor(s.survivedSeconds)}s` : '';
    this.add.text(W / 2, H / 2 + 10, statLine, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '14px', color: '#d9c7a0', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: this.children.list, alpha: 1, duration: 1200, ease: 'Linear' });

    this._makeBtn(W / 2, H / 2 + 80,  'RETRY',      () => this.scene.start('GameScene', { difficulty: s?.difficulty || 'brood-hunter' }));
    this._makeBtn(W / 2, H / 2 + 132, 'MAIN MENU',  () => this.scene.start('MenuScene'));
  }

  _makeBtn(x, y, label, cb) {
    const w = 200, h = 38;
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x3a2a1a : 0x2a1a0a, 1);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      g.lineStyle(1, hover ? 0xc5a572 : 0x5a3a18, 1);
      g.strokeRect(x - w / 2, y - h / 2, w, h);
    };
    draw(false);
    this.add.text(x, y, label, { fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '13px', color: '#d9c7a0', letterSpacing: 3 }).setOrigin(0.5);
    const zone = this.add.zone(x - w / 2, y - h / 2, w, h).setOrigin(0).setInteractive();
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout',  () => draw(false));
    zone.on('pointerdown', () => cb());
  }
}
