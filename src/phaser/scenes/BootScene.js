import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Phase 6: load audio variants here from manifest
    // Phase 8: load sprite atlases here
  }

  create() {
    this.scene.start('MenuScene');
  }
}
