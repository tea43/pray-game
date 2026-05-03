import Phaser from 'phaser';

const PAL = { bg: 0x0c0702, border: 0x5a3a18, gold: 0xc5a050, text: '#d9c7a0', textDim: '#a89470' };

export class PauseScene extends Phaser.Scene {
  constructor() { super({ key: 'PauseScene' }); }

  create() {
    const { width: W, height: H } = this.scale;

    // Dim overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55);
    overlay.fillRect(0, 0, W, H);

    const boxW = 300, boxH = 240;
    const bx = (W - boxW) / 2, by = (H - boxH) / 2;

    const box = this.add.graphics();
    box.fillStyle(PAL.bg, 0.97);
    box.fillRoundedRect(bx, by, boxW, boxH, 6);
    box.lineStyle(1, PAL.border, 1);
    box.strokeRoundedRect(bx, by, boxW, boxH, 6);

    this.add.text(W / 2, by + 28, 'PAUSED', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#c5a050', letterSpacing: 8,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);

    this._makeBtn(W / 2, by + 90, 'RESUME', () => {
      this.scene.stop('PauseScene');
      this.scene.resume('GameScene');
    });
    this._makeBtn(W / 2, by + 144, 'MAIN MENU', () => {
      this.scene.stop('PauseScene');
      this.scene.stop('HUDScene');
      this.scene.stop('GameScene');
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.stop('PauseScene');
      this.scene.resume('GameScene');
    });
  }

  _makeBtn(x, y, label, cb) {
    const w = 200, h = 38;
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x3a2a1a : 0x2a1a0a, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
      g.lineStyle(1, hover ? 0xc5a572 : PAL.border, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    };
    draw(false);
    const txt = this.add.text(x, y, label, {
      fontFamily: "'Courier New', monospace", fontSize: '13px', color: '#d9c7a0', letterSpacing: 3,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    const zone = this.add.zone(x - w / 2, y - h / 2, w, h).setOrigin(0).setInteractive();
    zone.on('pointerover',  () => draw(true));
    zone.on('pointerout',   () => draw(false));
    zone.on('pointerdown',  () => cb());
  }
}
