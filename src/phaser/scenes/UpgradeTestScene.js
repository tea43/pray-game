import Phaser from 'phaser';
import { state } from '../../state.js';

const DPR = window.devicePixelRatio || 1;

export class UpgradeTestScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeTestScene' }); }

  create(data) {
    const { width: W, height: H } = this.scale;
    const cycle = data?.cycle ?? 0;

    if (cycle === 0) {
      state.selectedUpgradeHistory = { elliot: [], dick: [], habib: [] };
      state.activeUpgrades         = { elliot: [], dick: [], habib: [] };
      state.pendingUpgrades        = { elliot: null, dick: null, habib: null };
    }

    state.upgradeSpinCredits = 3;
    state.wave = cycle + 1;

    // ── Background ──────────────────────────────────────────────────────────
    this.add.graphics().fillStyle(0x0d0a07, 1).fillRect(0, 0, W, H);

    const t = (x, y, str, style) => this.add.text(x, y, str, { ...style, resolution: DPR });

    t(W / 2, H / 2 - 70, 'UPGRADE TEST MODE', {
      fontSize: '24px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: '#cc4444',
    }).setOrigin(0.5);

    t(W / 2, H / 2 - 36, `wave ${state.wave}  ·  spin credits: 3`, {
      fontSize: '13px', fontFamily: "'Courier New', monospace", color: '#c8a878',
    }).setOrigin(0.5);

    // History summary — one line per hero
    const histLines = Object.entries(state.selectedUpgradeHistory)
      .map(([hero, ids]) => `${hero.padEnd(7)} ${ids.length} picked`)
      .join('    ');
    t(W / 2, H / 2 - 12, histLines || 'no history yet', {
      fontSize: '11px', fontFamily: "'Courier New', monospace", color: '#907060',
    }).setOrigin(0.5);

    // ESC exits to menu when the slot machine overlay is not open
    this.input.keyboard.addKey('ESC').on('down', () => {
      if (!this.scene.isActive('UpgradeScene')) {
        this.scene.start('MenuScene');
      }
    });

    // ── Buttons — row 1: OPEN + BACK, row 2: RESET ──────────────────────────
    const ROW1_Y = H / 2 + 16;
    const ROW2_Y = H / 2 + 62;
    const GAP = 10;
    const W1 = 160, W2 = 140;   // OPEN + BACK widths
    const ROW1_X = Math.round(W / 2 - (W1 + GAP + W2) / 2);

    this._addBtn(ROW1_X, ROW1_Y, W1, 36, 'OPEN SLOT MACHINE', 0x0c1808, 0x406030, '#70b050', () => {
      this.scene.launch('UpgradeScene', { returnScene: 'UpgradeTestScene', cycle });
    });

    this._addBtn(ROW1_X + W1 + GAP, ROW1_Y, W2, 36, '← BACK TO MENU', 0x0e0e18, 0x4050a0, '#8090d0', () => {
      this.scene.stop('UpgradeScene');
      this.scene.start('MenuScene');
    });

    const W3 = 160;
    this._addBtn(Math.round(W / 2 - W3 / 2), ROW2_Y, W3, 28, 'RESET HISTORY', 0x1e0e08, 0xaa5030, '#e07040', () => {
      state.selectedUpgradeHistory = { elliot: [], dick: [], habib: [] };
      state.activeUpgrades         = { elliot: [], dick: [], habib: [] };
      this.scene.start('UpgradeTestScene', { cycle: 0 });
    });
  }

  _addBtn(x, y, w, h, label, bgCol, borderCol, textCol, cb) {
    const bg = this.add.graphics();
    const draw = (hov) => {
      bg.clear();
      bg.fillStyle(hov ? bgCol + 0x101010 : bgCol, 1).fillRect(x, y, w, h);
      bg.lineStyle(1, borderCol).strokeRect(x, y, w, h);
    };
    draw(false);
    this.add.text(x + w / 2, y + h / 2, label, {
      fontSize: '11px', fontFamily: "'Courier New', monospace",
      fontStyle: 'bold', color: textCol, resolution: DPR,
    }).setOrigin(0.5);
    this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive()
      .on('pointerover', () => draw(true))
      .on('pointerout',  () => draw(false))
      .on('pointerdown', cb);
  }
}
