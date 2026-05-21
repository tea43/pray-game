import Phaser from 'phaser';
import { setMusicVolume, setSfxVolume, audioState } from '../../systems/audio.js';
import { state } from '../../state.js';
import { TC, txt, btn, slider, toggle } from '../ui/widgets.js';

// ── Box geometry ──────────────────────────────────────────────────────────────
const BOX = {
  width:   340,
  padding: 24,   // inner horizontal margin
};

// Row heights for each settings control type
const ROW = {
  title:    44,
  btn:      50,   // button + gap below
  slider:   62,   // label + track + gap below
  toggle:   44,
  divider:  18,   // gap between sections
};

const BTN_H       = 36;
const SLIDER_W    = 200;
const TOGGLE_OFFX = 170;  // x from row-left to the ON/OFF button

// Derived: total box height from all rows
const SECTIONS = [
  { kind: 'title' },
  { kind: 'btn' },          // RESUME
  { kind: 'divider' },
  { kind: 'slider' },       // MUSIC VOLUME
  { kind: 'slider' },       // EFFECTS VOLUME
  { kind: 'divider' },
  { kind: 'toggle' },       // SCREEN SHAKE
  { kind: 'toggle' },       // LIGHTNING EFFECTS
  { kind: 'divider' },
  { kind: 'btn' },          // MAIN MENU
];
const BOX_H = SECTIONS.reduce((sum, s) => sum + ROW[s.kind], 0) + BOX.padding;

// ─────────────────────────────────────────────────────────────────────────────

export class PauseScene extends Phaser.Scene {
  constructor() { super({ key: 'PauseScene' }); }

  create(data) {
    const { width: W, height: H } = this.scale;
    const fromUpgrade  = !!data?.fromUpgrade;
    const fromLevelUp  = !!data?.fromLevelUp;
    this._fromLevelUp  = fromLevelUp;

    // Dim the game behind the panel
    this.add.graphics()
      .fillStyle(0x000000, 0.55)
      .fillRect(0, 0, W, H);

    // Centred panel
    const bx = Math.round((W - BOX.width) / 2);
    const by = Math.round((H - BOX_H) / 2);

    this.add.graphics()
      .fillStyle(0x0c0702, 0.97)
      .fillRoundedRect(bx, by, BOX.width, BOX_H, 6)
      .lineStyle(1, 0x5a3a18, 1)
      .strokeRoundedRect(bx, by, BOX.width, BOX_H, 6);

    const cx  = bx + BOX.padding;           // content left edge
    const mid = bx + BOX.width / 2;         // centre x for centred elements
    let y     = by + BOX.padding / 2;

    // ── Title ─────────────────────────────────────────────────────────────
    txt(this, mid, y + 10, 'PAUSED', {
      fontSize: '20px', color: TC.gold, fontFamily: 'Georgia, serif',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5, 0);
    y += ROW.title;

    // ── Resume ────────────────────────────────────────────────────────────
    // fromUpgrade / fromLevelUp: the GameScene is already paused by the
    // overlay scene — just close the pause panel and let the overlay resume.
    const resume = (fromUpgrade || fromLevelUp)
      ? () => this.scene.stop('PauseScene')
      : () => { this.scene.stop('PauseScene'); this.scene.resume('GameScene'); };
    btn(this, cx, y, BOX.width - BOX.padding * 2, BTN_H, 'RESUME', resume);
    y += ROW.btn;

    // ── Audio ─────────────────────────────────────────────────────────────
    y += ROW.divider;

    // To add a volume control: append a call here
    slider(this, cx, y, SLIDER_W, 'MUSIC VOLUME',
      () => audioState.musicVolume, v => setMusicVolume(v));
    y += ROW.slider;

    slider(this, cx, y, SLIDER_W, 'EFFECTS VOLUME',
      () => audioState.sfxVolume, v => setSfxVolume(v));
    y += ROW.slider;

    // ── Game toggles ──────────────────────────────────────────────────────
    y += ROW.divider;

    // To add a toggle: append a call here
    const saveSettings = () => {
      try { localStorage.setItem('praySettings', JSON.stringify(state.settings)); } catch {}
    };

    toggle(this, cx, y, 'SCREEN SHAKE',
      () => !state.settings.noShake,
      on => { state.settings.noShake = !on; saveSettings(); },
      { btnOffsetX: TOGGLE_OFFX });
    y += ROW.toggle;

    toggle(this, cx, y, 'LIGHTNING EFFECTS',
      () => !state.settings.noLightning,
      on => { state.settings.noLightning = !on; saveSettings(); },
      { btnOffsetX: TOGGLE_OFFX });
    y += ROW.toggle;

    // ── Main menu ─────────────────────────────────────────────────────────
    y += ROW.divider;

    this._addMainMenuArea(cx, y);

    this.input.keyboard.on('keydown-ESC', resume);
  }

  // Draws the MAIN MENU button. Clears _mainMenuObjs first if they exist.
  _addMainMenuArea(cx, y) {
    if (this._mainMenuObjs) {
      for (const o of this._mainMenuObjs) o.destroy();
    }
    this._mainMenuObjs = [];

    const btnW  = BOX.width - BOX.padding * 2;

    // Graphics background
    const g = this.add.graphics();
    g.fillStyle(0x2a1a0a, 1).fillRect(cx, y, btnW, BTN_H);
    g.lineStyle(1, 0x8a6b3a, 1).strokeRect(cx, y, btnW, BTN_H);
    this._mainMenuObjs.push(g);

    const label = this.add.text(cx + btnW / 2, y + BTN_H / 2, 'MAIN MENU', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: TC.primary,
      resolution: window.devicePixelRatio, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this._mainMenuObjs.push(label);

    const zone = this.add.zone(cx, y, btnW, BTN_H).setOrigin(0, 0).setInteractive();
    zone.on('pointerover',  () => { g.clear(); g.fillStyle(0x3a2a1a, 1).fillRect(cx, y, btnW, BTN_H); g.lineStyle(1, 0xc5a572, 1).strokeRect(cx, y, btnW, BTN_H); });
    zone.on('pointerout',   () => { g.clear(); g.fillStyle(0x2a1a0a, 1).fillRect(cx, y, btnW, BTN_H); g.lineStyle(1, 0x8a6b3a, 1).strokeRect(cx, y, btnW, BTN_H); });
    zone.on('pointerdown',  () => this._showConfirmPanel(cx, y));
    this._mainMenuObjs.push(zone);
  }

  _showConfirmPanel(cx, y) {
    // Hide main menu button objects
    for (const o of this._mainMenuObjs) o.setVisible(false);

    const confirmObjs = [];
    const btnW = BOX.width - BOX.padding * 2;

    // Background overlay for confirm area
    const g = this.add.graphics();
    g.fillStyle(0x0c0702, 1).fillRect(cx - 2, y - 6, btnW + 4, BTN_H + 24);
    confirmObjs.push(g);

    // Prompt text
    const label = this.add.text(cx + btnW / 2, y - 2, 'RETURN TO MAIN MENU?', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d0c090',
      resolution: window.devicePixelRatio, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0);
    confirmObjs.push(label);

    const halfW = (btnW - 6) / 2;
    const btnY  = y + 14;

    // YES button
    const yesG = this.add.graphics();
    yesG.fillStyle(0x2a1a0a, 1).fillRect(cx, btnY, halfW, BTN_H - 14);
    yesG.lineStyle(1, 0x8a6b3a, 1).strokeRect(cx, btnY, halfW, BTN_H - 14);
    confirmObjs.push(yesG);
    const yesLbl = this.add.text(cx + halfW / 2, btnY + (BTN_H - 14) / 2, 'YES', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#d9c7a0',
      resolution: window.devicePixelRatio, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    confirmObjs.push(yesLbl);
    const yesZone = this.add.zone(cx, btnY, halfW, BTN_H - 14).setOrigin(0, 0).setInteractive();
    yesZone.on('pointerdown', () => {
      window.__prayInGame = false;
      this.scene.stop('PauseScene');
      this.scene.stop('UpgradeScene');
      this.scene.stop('UpgradeTestScene');
      this.scene.stop('WeaponLevelUpScene');
      this.scene.stop('HUDScene');
      this.scene.stop('GameScene');
      // Clear weapon level-up state so it doesn't replay after the next game starts
      state.isLevelUpScreen = false;
      state.pendingWeaponUpgrades = [];
      state.currentWeaponLevelUpHero = null;
      this.scene.start('MenuScene');
    });
    confirmObjs.push(yesZone);

    // CANCEL button
    const cancelX = cx + halfW + 6;
    const cancelG = this.add.graphics();
    cancelG.fillStyle(0x2a1a0a, 1).fillRect(cancelX, btnY, halfW, BTN_H - 14);
    cancelG.lineStyle(1, 0x8a6b3a, 1).strokeRect(cancelX, btnY, halfW, BTN_H - 14);
    confirmObjs.push(cancelG);
    const cancelLbl = this.add.text(cancelX + halfW / 2, btnY + (BTN_H - 14) / 2, 'CANCEL', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#d9c7a0',
      resolution: window.devicePixelRatio, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    confirmObjs.push(cancelLbl);
    const cancelZone = this.add.zone(cancelX, btnY, halfW, BTN_H - 14).setOrigin(0, 0).setInteractive();
    cancelZone.on('pointerdown', () => {
      for (const o of confirmObjs) o.destroy();
      for (const o of this._mainMenuObjs) o.setVisible(true);
    });
    confirmObjs.push(cancelZone);
  }
}
