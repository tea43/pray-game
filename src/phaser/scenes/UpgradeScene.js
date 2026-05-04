import Phaser from 'phaser';
import { state } from '../../state.js';
import { GameData } from '../../systems/upgrades.js';
import { playSfx } from '../../systems/audio.js';

export class UpgradeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UpgradeScene' });
  }

  create() {
    const { width: W, height: H } = this.scale;

    // Dark overlay
    this.add.graphics()
      .fillStyle(0x0a0502, 0.95)
      .fillRect(0, 0, W, H);

    this.add.text(W / 2, H * 0.15, 'WAVE CLEARED', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      color: '#d9c7a0',
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.15 + 40, 'SELECT AN UPGRADE FOR EACH SURVIVOR', {
      fontFamily: "'Courier New', monospace",
      fontSize: '14px',
      color: '#8a6b3a',
      letterSpacing: 2,
    }).setOrigin(0.5);

    state.pendingUpgrades = { elliot: null, dick: null, habib: null };

    this._cards = [];
    this._nextBtn = null;

    const cols = [
      { id: 'elliot', title: 'ELLIOT', data: GameData.upgrades.elliot, x: W / 2 - 240 },
      { id: 'dick',   title: 'DICK',   data: GameData.upgrades.dick,   x: W / 2 },
      { id: 'habib',  title: 'HABIB',  data: GameData.upgrades.habib,  x: W / 2 + 240 },
    ];

    cols.forEach(col => this._drawColumn(col.x, H * 0.3, col));

    this._drawNextButton(W / 2, H * 0.85);

    // Escape or tab to close if needed (not usually allowed until selected)
    // Here we force selection.
  }

  _drawColumn(cx, startY, col) {
    this.add.text(cx, startY, col.title, {
      fontFamily: "'Courier New', monospace",
      fontSize: '16px',
      color: '#c5a572',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    this.add.graphics()
      .lineStyle(1, 0x3a2a18)
      .beginPath()
      .moveTo(cx - 80, startY + 15)
      .lineTo(cx + 80, startY + 15)
      .strokePath();

    if (!col.data || col.data.length === 0) {
      this.add.text(cx, startY + 40, 'No data', { color: '#a83a2a', fontSize: '12px' }).setOrigin(0.5);
      state.pendingUpgrades[col.id] = 'none';
      return;
    }

    const shuffled = [...col.data].sort(() => 0.5 - Math.random());
    const draft = shuffled.slice(0, 3);

    let cy = startY + 60;
    const cardH = 80;

    const columnCards = [];

    draft.forEach((upg) => {
      const container = this.add.container(cx, cy);
      const bg = this.add.graphics();
      
      const updateStyle = (selected, hovered) => {
        bg.clear();
        const fill = selected ? 0x1e280a : hovered ? 0x1e140a : 0x140c06;
        const line = selected ? 0xa0d040 : hovered ? 0x8a6b3a : 0x3a2a18;
        bg.fillStyle(fill, 0.9);
        bg.fillRect(-110, -cardH/2, 220, cardH);
        bg.lineStyle(2, line);
        bg.strokeRect(-110, -cardH/2, 220, cardH);
      };

      updateStyle(false, false);
      container.add(bg);

      const rarityColor = upg.rarity === 'Common' ? '#a0a0a0' : upg.rarity === 'Rare' ? '#4080ff' : upg.rarity === 'Epic' ? '#c040ff' : '#ffb020';
      container.add(this.add.text(-100, -cardH/2 + 8, upg.rarity.toUpperCase(), { fontSize: '10px', fontStyle: 'bold', color: rarityColor }));
      container.add(this.add.text(-100, -cardH/2 + 22, upg.name, { fontSize: '14px', fontStyle: 'bold', color: '#e8d8b0' }));
      container.add(this.add.text(-100, -cardH/2 + 40, upg.description, { fontSize: '11px', color: '#a89470', wordWrap: { width: 200 } }));

      // Hit area
      const zone = this.add.zone(0, 0, 220, cardH).setInteractive({ cursor: 'pointer' });
      container.add(zone);

      zone.on('pointerover', () => { if (state.pendingUpgrades[col.id] !== upg) updateStyle(false, true); });
      zone.on('pointerout', () => { if (state.pendingUpgrades[col.id] !== upg) updateStyle(false, false); });
      zone.on('pointerdown', () => {
        playSfx('ui.click', { synthetic: 'click' });
        columnCards.forEach(c => c.updateStyle(false, false));
        updateStyle(true, false);
        state.pendingUpgrades[col.id] = upg;
        this._checkReady();
      });

      columnCards.push({ updateStyle });
      this._cards.push(container);

      cy += cardH + 10;
    });
  }

  _drawNextButton(cx, cy) {
    this._nextBtn = this.add.container(cx, cy);
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, 'NEXT WAVE', {
      fontFamily: "'Courier New', monospace",
      fontSize: '16px', fontStyle: 'bold', letterSpacing: 3,
      color: '#d9c7a0'
    }).setOrigin(0.5);

    this._nextBtn.add([bg, text]);

    this._updateBtnStyle = (enabled, hovered) => {
      bg.clear();
      const fill = !enabled ? 0x1a100a : hovered ? 0x3a2a1a : 0x2a1a0a;
      const line = !enabled ? 0x3a2a1a : hovered ? 0xc5a572 : 0x8a6b3a;
      bg.fillStyle(fill, 1);
      bg.fillRect(-80, -25, 160, 50);
      bg.lineStyle(2, line);
      bg.strokeRect(-80, -25, 160, 50);
      text.setAlpha(enabled ? 1 : 0.5);
    };

    this._updateBtnStyle(false, false);

    const zone = this.add.zone(0, 0, 160, 50).setInteractive({ cursor: 'pointer' });
    this._nextBtn.add(zone);

    zone.on('pointerover', () => { if (this._ready) this._updateBtnStyle(true, true); });
    zone.on('pointerout', () => { if (this._ready) this._updateBtnStyle(true, false); });
    zone.on('pointerdown', () => {
      if (!this._ready) return;
      playSfx('ui.click', { synthetic: 'click' });
      
      if (state.pendingUpgrades.elliot !== 'none') state.activeUpgrades.elliot.push(state.pendingUpgrades.elliot);
      if (state.pendingUpgrades.dick !== 'none') state.activeUpgrades.dick.push(state.pendingUpgrades.dick);
      if (state.pendingUpgrades.habib !== 'none') state.activeUpgrades.habib.push(state.pendingUpgrades.habib);
      
      this.scene.stop();
      this.scene.resume('GameScene');
      this.scene.get('GameScene').advanceWave();
    });

    this._ready = false;
    this._checkReady(); // check immediately in case some pools are empty
  }

  _checkReady() {
    const p = state.pendingUpgrades;
    this._ready = (p.elliot !== null && p.dick !== null && p.habib !== null);
    if (this._updateBtnStyle) this._updateBtnStyle(this._ready, false);
  }
}
