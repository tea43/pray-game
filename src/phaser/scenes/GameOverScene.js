import Phaser from 'phaser';
import { playMusic } from '../../systems/audio.js';
import { DIFFICULTY_ORDER } from '../../config/difficulty.js';

const GAME_OVER_MESSAGES = [
  'The Endoserpents won this round.',
  'Your squad fell, but humanity fights on.',
  'They gave everything — it was not enough this time.',
  'The worms devoured the last of your crew.',
  'P-RAY could not save them now.',
  'Humanity lost this battle. Do you have strength for another?',
  'They paid the ultimate price. Your move.',
  'Silence fell over the wastes. For now.',
  'The swarm consumed them whole.',
  'No survivors. No mercy. Try harder.',
  'The Endoserpents are relentless. Are you?',
  'Your squad\'s courage was not enough this time.',
  'The wasteland claims another crew.',
  'Darkness won this round. Dawn awaits the brave.',
  'The worms burrow deeper. Will you stop them?',
  'Their sacrifice will not be forgotten.',
  'Every defeat makes the next victory sweeter.',
  'The horde overwhelmed them. Regroup and return.',
  'P-RAY is still out there. Fight for it again.',
  'The wasteland is unforgiving. So are you.',
];

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  init(data) { this._state = data?.state; }

  create() {
    const { width: W, height: H } = this.scale;
    playMusic('menu');

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0302, 1);
    bg.fillRect(0, 0, W, H);

    const msg = GAME_OVER_MESSAGES[Math.floor(Math.random() * GAME_OVER_MESSAGES.length)];

    this.add.text(W / 2, H / 2 - 70, 'ALL SURVIVORS DEAD', {
      fontFamily: 'Georgia, serif', resolution: window.devicePixelRatio, fontSize: '36px', color: '#a83a2a', letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(W / 2, H / 2 - 22, msg, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '12px', color: '#8a6a4a', letterSpacing: 1,
      wordWrap: { width: 460 }, align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    const s = this._state;
    const statLine = s ? `KILLS: ${s.kills}   SURVIVED: ${Math.floor(s.survivedSeconds)}s` : '';
    this.add.text(W / 2, H / 2 + 12, statLine, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio, fontSize: '14px', color: '#d9c7a0', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: this.children.list, alpha: 1, duration: 1200, ease: 'Linear' });

    const diff = s?.difficulty || 'brood-hunter';
    const diffIdx = DIFFICULTY_ORDER.indexOf(diff);
    const easierDiff = diffIdx > 0 ? DIFFICULTY_ORDER[diffIdx - 1] : null;

    this._makeBtn(W / 2, H / 2 + 68, 'RETRY',
      () => this.scene.start('GameScene', { difficulty: diff }));
    this._makeBtn(W / 2, H / 2 + 118, 'MAIN MENU',
      () => this.scene.start('MenuScene'));
    this._makeBtn(W / 2, H / 2 + 168, easierDiff ? `EASIER  (${easierDiff.replace(/-/g, ' ').toUpperCase()})` : 'EASIEST ALREADY',
      easierDiff ? () => this.scene.start('GameScene', { difficulty: easierDiff }) : null,
      !easierDiff);
  }

  _makeBtn(x, y, label, cb, disabled = false) {
    const w = 260, h = 38;
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      const bg = disabled ? 0x1a1010 : hover ? 0x3a2a1a : 0x2a1a0a;
      const border = disabled ? 0x2a1818 : hover ? 0xc5a572 : 0x5a3a18;
      g.fillStyle(bg, 1);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      g.lineStyle(1, border, 1);
      g.strokeRect(x - w / 2, y - h / 2, w, h);
    };
    draw(false);
    this.add.text(x, y, label, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio,
      fontSize: '12px', color: disabled ? '#5a4030' : '#d9c7a0', letterSpacing: 2,
    }).setOrigin(0.5);
    if (!disabled) {
      const zone = this.add.zone(x - w / 2, y - h / 2, w, h).setOrigin(0).setInteractive();
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout',  () => draw(false));
      zone.on('pointerdown', () => cb());
    }
  }
}
