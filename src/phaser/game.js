import Phaser from 'phaser';
import { BootScene }    from './scenes/BootScene.js';
import { MenuScene }    from './scenes/MenuScene.js';
import { GameScene }    from './scenes/GameScene.js';
import { HUDScene }     from './scenes/HUDScene.js';
import { PauseScene }   from './scenes/PauseScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const config = {
  type: Phaser.WEBGL,
  backgroundColor: '#0a0604',
  scene: [BootScene, MenuScene, GameScene, HUDScene, PauseScene, VictoryScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:  window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    mouse: { preventDefaultWheel: false },
  },
  disableContextMenu: true,
};

export default new Phaser.Game(config);
