import Phaser from 'phaser';
import { BootScene }        from './scenes/BootScene.js';
import { SplashScene }      from './scenes/SplashScene.js';
import { MenuScene }        from './scenes/MenuScene.js';
import { GameScene }        from './scenes/GameScene.js';
import { HUDScene }         from './scenes/HUDScene.js';
import { PauseScene }       from './scenes/PauseScene.js';
import { VictoryScene }     from './scenes/VictoryScene.js';
import { GameOverScene }    from './scenes/GameOverScene.js';
import { UpgradeScene }     from './scenes/UpgradeScene.js';
import { UpgradeTestScene } from './scenes/UpgradeTestScene.js';

const config = {
  type: Phaser.WEBGL,
  transparent: true,
  scene: [BootScene, SplashScene, MenuScene, GameScene, HUDScene, PauseScene, VictoryScene, GameOverScene, UpgradeTestScene, UpgradeScene],
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
