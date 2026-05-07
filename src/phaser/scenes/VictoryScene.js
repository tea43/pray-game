import Phaser from 'phaser';
import { playMusic } from '../../systems/audio.js';

export class VictoryScene extends Phaser.Scene {
  constructor() { super({ key: 'VictoryScene' }); }

  init(data) { this._state = data?.state; }

  create() {
    const { width: W, height: H } = this.scale;
    playMusic('menu');

    this._videoEl = document.getElementById('victoryBg');
    if (this._videoEl) {
      this._videoEl.src = './assets/video/victory/heli_escape.mp4';
      this._videoEl.load();
      this._videoEl.play().catch(() => {});
      this._videoEl.style.display = 'block';
    }

    // Semi-transparent dark vignette so text is legible over the video
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRect(0, 0, W, H);
    // Darker band behind the text
    bg.fillStyle(0x020602, 0.55);
    bg.fillRect(W / 2 - 320, H / 2 - 90, 640, 200);

    this.add.text(W / 2, H / 2 - 60, 'EXTRACTION COMPLETE', {
      fontFamily: 'Georgia, serif', resolution: window.devicePixelRatio, fontSize: '36px', color: '#a0d040', letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0);

    const s = this._state;
    const statLine = s ? `KILLS: ${s.kills}   SURVIVED: ${Math.floor(s.survivedSeconds)}s` : '';
    this.add.text(W / 2, H / 2 + 10, statLine, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '14px', color: '#d9c7a0', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    // Fade in text (skip bg graphics which are already opaque)
    const fadeTargets = this.children.list.filter(c => c !== bg);
    this.tweens.add({ targets: fadeTargets, alpha: 1, duration: 3500, ease: 'Linear' });

    this._makeBtn(W / 2, H / 2 + 80, 'MAIN MENU', () => {
      this._stopVideo();
      this.scene.start('MenuScene');
    });
  }

  _stopVideo() {
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.src = '';
      this._videoEl.style.display = 'none';
    }
  }

  shutdown() { this._stopVideo(); }

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
