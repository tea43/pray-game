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
    const fromUpgrade = !!data?.fromUpgrade;

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
    const resume = fromUpgrade
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

    btn(this, cx, y, BOX.width - BOX.padding * 2, BTN_H, 'MAIN MENU', () => {
      this.scene.stop('PauseScene');
      this.scene.stop('UpgradeScene');
      this.scene.stop('UpgradeTestScene');
      this.scene.stop('HUDScene');
      this.scene.stop('GameScene');
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on('keydown-ESC', resume);
  }
}
