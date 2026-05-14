import Phaser from 'phaser';
import { playMusic } from '../../systems/audio.js';

const SLIDE_X_RIGHT = 160;  // distance from right edge the panel lands at
const SLIDE_DELAY   = 4000;
const SLIDE_DUR     = 1200;

export class VictoryScene extends Phaser.Scene {
  constructor() { super({ key: 'VictoryScene' }); }

  init(data) { this._state = data?.state; }

  create() {
    const { width: W, height: H } = this.scale;
    playMusic('menu');

    this._videoEl = document.getElementById('victoryBg');
    if (this._videoEl) {
      this._videoEl.src = './assets/video/victory/heli_escape.mp4';
      this._videoEl.load();
      this._videoEl.play().catch(() => {});
      this._videoEl.style.display = 'block';
    }

    // Full-screen vignette
    this.add.graphics().fillStyle(0x000000, 0.5).fillRect(0, 0, W, H);

    // Right-side dark band that fades in as the panel arrives
    const rightBand = this.add.graphics().setAlpha(0);
    rightBand.fillStyle(0x020301, 0.92).fillRect(W - SLIDE_X_RIGHT * 2, 0, SLIDE_X_RIGHT * 2, H);

    const s = this._state;

    // Panel container starts centred, slides right
    const panel = this.add.container(W / 2, 0);
    const items = [];

    const addT = (y, text, style) => {
      const t = this.add.text(0, y, text, { resolution: window.devicePixelRatio, ...style })
        .setOrigin(0.5, 0).setAlpha(0);
      panel.add(t);
      items.push(t);
      return t;
    };

    let cy = H / 2 - 120;

    // Title split across two lines so it fits the narrow side panel
    addT(cy, 'EXTRACTION', {
      fontFamily: 'Georgia, serif', fontSize: '28px', color: '#a0d040', letterSpacing: 5,
    });
    cy += 36;
    addT(cy, 'COMPLETE', {
      fontFamily: 'Georgia, serif', fontSize: '28px', color: '#a0d040', letterSpacing: 5,
    });
    cy += 48;

    if (s) {
      addT(cy, `KILLS: ${s.kills}`, {
        fontFamily: "'Courier New', monospace", fontSize: '13px', color: '#d9c7a0', letterSpacing: 2,
      });
      cy += 22;
      addT(cy, `SURVIVED: ${Math.floor(s.survivedSeconds)}s`, {
        fontFamily: "'Courier New', monospace", fontSize: '13px', color: '#d9c7a0', letterSpacing: 2,
      });
      cy += 28;
    }

    // Fallen heroes
    if (s?.units) {
      const dead = s.units.filter(u => u.dead);
      if (dead.length > 0) {
        dead.forEach(u => {
          const name = u.type.charAt(0).toUpperCase() + u.type.slice(1);
          addT(cy, `†  ${name}  (fallen)`, {
            fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#c04030', letterSpacing: 2,
          });
          cy += 18;
        });
        cy += 6;
      }
    }

    if (s) {
      const div = s.heroesDied > 0 ? `PENALTY ÷${Math.pow(2, s.heroesDied)}` : '';
      if (div) {
        addT(cy, div, {
          fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#8a5040', letterSpacing: 1,
        });
        cy += 18;
      }
      addT(cy, `SCORE: ${s.score}`, {
        fontFamily: "'Courier New', monospace", fontSize: '13px',
        color: s.heroesDied > 0 ? '#8a5040' : '#d9c7a0', letterSpacing: 2,
      });
      cy += 30;
    }

    // MAIN MENU button
    this._addBtn(panel, items, cy + 10, 'MAIN MENU', () => {
      this._stopVideo();
      this.scene.start('MenuScene');
    });

    // Fade in all panel items
    this.tweens.add({ targets: items, alpha: 1, duration: 2000, ease: 'Linear' });

    // Slide to right side after delay
    this.time.delayedCall(SLIDE_DELAY, () => {
      this.tweens.add({ targets: rightBand, alpha: 1, duration: 800 });
      this.tweens.add({
        targets: panel,
        x: W - SLIDE_X_RIGHT,
        duration: SLIDE_DUR,
        ease: 'Cubic.easeInOut',
      });
    });
  }

  _addBtn(panel, items, y, label, cb) {
    const w = 200, h = 36;
    const g = this.add.graphics().setAlpha(0);
    panel.add(g);
    items.push(g);

    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x3a2a1a : 0x2a1a0a, 1).fillRect(-w / 2, y - h / 2, w, h);
      g.lineStyle(1, hover ? 0xc5a572 : 0x5a3a18, 1).strokeRect(-w / 2, y - h / 2, w, h);
    };
    draw(false);

    const t = this.add.text(0, y, label, {
      fontFamily: "'Courier New', monospace", resolution: window.devicePixelRatio,
      fontSize: '13px', color: '#d9c7a0', letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0);
    panel.add(t);
    items.push(t);

    const zone = this.add.zone(-w / 2, y - h / 2, w, h).setOrigin(0).setInteractive();
    panel.add(zone);
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout',  () => draw(false));
    zone.on('pointerdown', () => cb());
  }

  _stopVideo() {
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.src = '';
      this._videoEl.style.display = 'none';
    }
  }

  shutdown() { this._stopVideo(); }
}
