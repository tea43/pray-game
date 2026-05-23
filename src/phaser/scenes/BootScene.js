import Phaser from 'phaser';
import { loadAssets } from '../../config/assets.js';
import FULL_SPRITE_MANIFEST from '../../config/manifest.json';

const SPRITE_MANIFEST = {
  loot: {
    essence: 'assets/icons/items/essence_drop_2.png',
  },
  heroes: FULL_SPRITE_MANIFEST.heroes,
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
