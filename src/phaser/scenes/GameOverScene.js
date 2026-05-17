import Phaser from 'phaser';
import { playMusic } from '../../systems/audio.js';
import { DIFFICULTY_ORDER } from '../../config/difficulty.js';

const GAME_OVER_MESSAGES = [
  'The Endoserpents won this round.',
  'Your squad fell. Humanity fights on.',
  'They gave everything — it was not enough.',
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

// panel lands at x = SLIDE_X from the left edge
const SLIDE_X     = 150;
const SLIDE_DELAY = 4000;
const SLIDE_DUR   = 1200;

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  init(data) { this._state = data?.state; }

  create() {
    const { width: W, height: H } = this.scale;
    playMusic('menu');

    // Faint overlay — intentionally light so the dead heroes remain visible
    this.add.graphics().fillStyle(0x080202, 0.28).fillRect(0, 0, W, H);

    // Dark band on the left that fades in as the panel slides over
    const leftBand = this.add.graphics().setAlpha(0);
    leftBand.fillStyle(0x050101, 0.94).fillRect(0, 0, SLIDE_X * 2, H);

    const s    = this._state;
    const diff = s?.difficulty || 'brood-hunter';
    const msg  = GAME_OVER_MESSAGES[Math.floor(Math.random() * GAME_OVER_MESSAGES.length)];

    // Container starts centred then slides left — all children centred at x=0
    const panel = this.add.container(W / 2, 0);
    const items = [];

    const addT = (y, text, style) => {
      const t = this.add.text(0, y, text, {
        resolution: window.devicePixelRatio,
        align: 'center',
        ...style,
      }).setOrigin(0.5, 0).setAlpha(0);
      panel.add(t);
      items.push(t);
      return t;
    };

    let cy = H / 2 - 120;

    // Title — two lines so it fits the narrow left band after sliding
    addT(cy, 'ENDOSERPENTS', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#c83020', letterSpacing: 4,
    });
    cy += 30;
    addT(cy, 'REACHED YOU', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#a82818', letterSpacing: 3,
    });
    cy += 18;
    addT(cy, 'WHERE YOU DID NOT EXPECT', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#7a2010', letterSpacing: 2,
    });
    cy += 36;

    const S = { stroke: '#000000', strokeThickness: 3 };

    // Flavour message — narrow word-wrap to stay in column
    addT(cy, msg, {
      ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#a88a60',
      wordWrap: { width: 240 },
    });
    cy += 56;

    // Fallen heroes — one per line
    if (s?.units) {
      const dead = s.units.filter(u => u.dead);
      dead.forEach(u => {
        const name = u.type.charAt(0).toUpperCase() + u.type.slice(1);
        addT(cy, `†  ${name}`, {
          ...S, fontFamily: 'Georgia, serif', fontSize: '14px', color: '#d05040', letterSpacing: 2,
        });
        cy += 22;
      });
      if (dead.length) cy += 6;
    }

    // Stats — split across two lines
    if (s) {
      addT(cy, `KILLS: ${s.kills}`, {
        ...S, fontFamily: 'Georgia, serif', fontSize: '14px', color: '#e0d0a0', letterSpacing: 1,
      });
      cy += 22;
      addT(cy, `SURVIVED: ${Math.floor(s.survivedSeconds)}s  ·  WAVE: ${s.wave}`, {
        ...S, fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c0b080', letterSpacing: 0,
      });
      cy += 26;
    }

    // Score with optional penalty
    if (s) {
      if (s.heroesDied > 0) {
        const div = Math.pow(2, s.heroesDied);
        addT(cy, `PENALTY ÷${div}`, {
          ...S, fontFamily: 'Georgia, serif', fontSize: '12px', color: '#a06050', letterSpacing: 1,
        });
        cy += 20;
      }
      addT(cy, `SCORE: ${s.score}`, {
        ...S, fontFamily: 'Georgia, serif', fontSize: '15px',
        color: s.heroesDied > 0 ? '#a06050' : '#e0d0a0', letterSpacing: 1,
      });
      cy += 32;
    }

    // Buttons — narrower to stay within column
    const diffIdx    = DIFFICULTY_ORDER.indexOf(diff);
    const easierDiff = diffIdx > 0 ? DIFFICULTY_ORDER[diffIdx - 1] : null;

    const stopAll = () => {
      this.scene.stop('GameScene');
      this.scene.stop('GameOverScene');
    };

    this._addBtn(panel, items, cy + 10,  'RETRY',
      () => { stopAll(); this.scene.start('GameScene', { difficulty: diff }); });
    this._addBtn(panel, items, cy + 56,  'MAIN MENU',
      () => { stopAll(); this.scene.start('MenuScene'); });
    this._addBtn(panel, items, cy + 102,
      easierDiff ? `EASIER  (${easierDiff.replace(/-/g, ' ').toUpperCase()})` : 'EASIEST ALREADY',
      easierDiff ? () => { stopAll(); this.scene.start('GameScene', { difficulty: easierDiff }); } : null,
      !easierDiff);

    // Fade in
    this.tweens.add({ targets: items, alpha: 1, duration: 1200, ease: 'Linear' });

    // Slide left after delay
    this.time.delayedCall(SLIDE_DELAY, () => {
      this.tweens.add({ targets: leftBand, alpha: 1, duration: 800 });
      this.tweens.add({ targets: panel, x: SLIDE_X, duration: SLIDE_DUR, ease: 'Cubic.easeInOut' });
    });
  }

  _addBtn(panel, items, y, label, cb, disabled = false) {
    const w = 210, h = 36;
    const g = this.add.graphics().setAlpha(0);
    panel.add(g);
    items.push(g);

    const draw = (hover) => {
      g.clear();
      const bgCol  = disabled ? 0x1a1010 : hover ? 0x3a2a1a : 0x2a1a0a;
      const border = disabled ? 0x2a1818 : hover ? 0xc5a572 : 0x5a3a18;
      g.fillStyle(bgCol, 1).fillRect(-w / 2, y - h / 2, w, h);
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
