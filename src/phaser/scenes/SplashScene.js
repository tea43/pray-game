import Phaser from 'phaser';
import { initAudio } from '../../systems/audio.js';

export class SplashScene extends Phaser.Scene {
  constructor() { super({ key: 'SplashScene' }); }

  create() {
    const { width: W, height: H } = this.scale;

    this.add.graphics()
      .fillStyle(0x080402, 1)
      .fillRect(0, 0, W, H);

    this.add.text(W / 2, H / 2 - 18, 'P-RAY', {
      fontFamily: 'Georgia, serif',
      fontSize: '52px',
      color: '#c5a050',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);

    const prompt = this.add.text(W / 2, H / 2 + 48, 'PRESS ANY KEY TO CONTINUE', {
      fontFamily: "'Courier New', monospace",
      fontSize: '13px',
      color: '#7a5a30',
      letterSpacing: 3,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);

    // Slow blink on the prompt
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.2 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const advance = () => {
      initAudio();
      this.scene.start('MenuScene');
    };

    this.input.keyboard.once('keydown', advance);
    this.input.once('pointerdown', advance);
  }
}
