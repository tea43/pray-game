import Phaser from 'phaser';
import { loadAssets } from '../../config/assets.js';

const SPRITE_MANIFEST = {
  loot: {
    essence: 'assets/tbd/icons/essence_drop.png',
  },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    loadAssets(SPRITE_MANIFEST);
    this.scene.start('SplashScene');
  }
}
