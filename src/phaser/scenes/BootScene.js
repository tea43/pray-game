import Phaser from 'phaser';
import { loadAssets } from '../../config/assets.js';

const SPRITE_MANIFEST = {
  loot: {
    essence: 'assets/icons/items/essence_drop_2.png',
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
