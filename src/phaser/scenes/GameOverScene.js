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

// x the panel slides to (left-side position matching MenuScene layout)
const SLIDE_X      = 150;
const SLIDE_DELAY  = 4000;
const SLIDE_DUR    = 1200;

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  init(data) { this._state = data?.state; }

  create() {
    const { width: W, height: H } = this.scale;
    playMusic('menu');

    this.add.graphics().fillStyle(0x0a0302, 1).fillRect(0, 0, W, H);

    // Dark band that appears on the left as the panel slides over
    const leftBand = this.add.graphics().setAlpha(0);
    leftBand.fillStyle(0x050201, 0.92).fillRect(0, 0, SLIDE_X * 2, H);

    const s = this._state;
    const msg = GAME_OVER_MESSAGES[Math.floor(Math.random() * GAME_OVER_MESSAGES.length)];

    // Container starts centred, slides left
    const panel = this.add.container(W / 2, 0);
    const items = [];

    const addT = (y, text, style) => {
      const t = this.add.text(0, y, text, { resolution: window.devicePixelRatio, ...style })
        .setOrigin(0.5, 0).setAlpha(0);
      panel.add(t);
      items.push(t);
      return t;
    };

    let cy = H / 2 - 96;

    addT(cy, 'ALL SURVIVORS DEAD', {
      fontFamily: 'Georgia, serif', fontSize: '36px', color: '#a83a2a', letterSpacing: 6,
    });
    cy += 54;

    addT(cy, msg, {
      fontFamily: "'Courier New', monospace", fontSize: '12px', color: '#8a6a4a',
      letterSpacing: 1, wordWrap: { width: 380 }, align: 'center',
    });
    cy += 46;

    // Fallen heroes
    if (s?.units) {
      const dead = s.units.filter(u => u.dead);
      if (dead.length > 0) {
        const names = dead.map(u => u.type.charAt(0).toUpperCase() + u.type.slice(1)).join('   ');
        addT(cy, `†  ${names}`, {
          fontFamily: "'Courier New', monospace", fontSize: '12px', color: '#c04030', letterSpacing: 3,
        });
        cy += 22;
      }
    }

    // Kill + time stats
    if (s) {
      addT(cy, `KILLS: ${s.kills}   SURVIVED: ${Math.floor(s.survivedSeconds)}s   WAVE: ${s.wave}`, {
        fontFamily: "'Courier New', monospace", fontSize: '13px', color: '#d9c7a0', letterSpacing: 2,
      });
      cy += 20;
    }

    // Score with penalty breakdown
    if (s) {
      if (s.heroesDied > 0) {
        const div = Math.pow(2, s.heroesDied);
        addT(cy, `SCORE: ${s.score}  ·  PENALTY ÷${div}  (${s.heroesDied} hero${s.heroesDied > 1 ? 'es' : ''} lost)`, {
          fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#8a5040', letterSpacing: 1,
        });
      } else {
        addT(cy, `SCORE: ${s.score}`, {
          fontFamily: "'Courier New', monospace", fontSize: '13px', color: '#d9c7a0', letterSpacing: 2,
        });
      }
      cy += 28;
    }

    // Buttons
    const diff     = s?.difficulty || 'brood-hunter';
    const diffIdx  = DIFFICULTY_ORDER.indexOf(diff);
    const easierDiff = diffIdx > 0 ? DIFFICULTY_ORDER[diffIdx - 1] : null;

    this._addBtn(panel, items, cy + 10,  'RETRY',
      () => this.scene.start('GameScene', { difficulty: diff }));
    this._addBtn(panel, items, cy + 58,  'MAIN MENU',
      () => this.scene.start('MenuScene'));
    this._addBtn(panel, items, cy + 106,
      easierDiff ? `EASIER  (${easierDiff.replace(/-/g, ' ').toUpperCase()})` : 'EASIEST ALREADY',
      easierDiff ? () => this.scene.start('GameScene', { difficulty: easierDiff }) : null,
      !easierDiff);

    // Fade in all panel items
    this.tweens.add({ targets: items, alpha: 1, duration: 1200, ease: 'Linear' });

    // Slide to left after delay
    this.time.delayedCall(SLIDE_DELAY, () => {
      this.tweens.add({ targets: leftBand, alpha: 1, duration: 800 });
      this.tweens.add({ targets: panel, x: SLIDE_X, duration: SLIDE_DUR, ease: 'Cubic.easeInOut' });
    });
  }

  _addBtn(panel, items, y, label, cb, disabled = false) {
    const w = 260, h = 38;
    const g = this.add.graphics().setAlpha(0);
    panel.add(g);
    items.push(g);

    const draw = (hover) => {
      g.clear();
      const bgCol  = disabled ? 0x1a1010 : hover ? 0x3a2a1a : 0x2a1a0a;
      const border = disabled ? 0x2a1818 : hover ? 0xc5a572 : 0x5a3a18;
      g.fillStyle(bgCol,  1).fillRect(-w / 2, y - h / 2, w, h);
      g.lineStyle(1, border, 1).strokeRect(-w / 2, y - h / 2, w, h);
    };
    draw(false);

    const t = this.add.text(0, y, label, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio,
      fontSize: '12px', color: disabled ? '#5a4030' : '#d9c7a0', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);
    panel.add(t);
    items.push(t);

    if (!disabled && cb) {
      const zone = this.add.zone(-w / 2, y - h / 2, w, h).setOrigin(0).setInteractive();
      panel.add(zone);
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout',  () => draw(false));
      zone.on('pointerdown', () => cb());
    }
  }
}
