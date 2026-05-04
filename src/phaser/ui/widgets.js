// Shared palette and widget primitives used by MenuScene and PauseScene.
// Pass the Phaser Scene instance as the first argument to each function.

export const COLORS = {
  btnBg:             0x2a1a0a,
  btnBgHover:        0x3a2a1a,
  btnBorder:         0x8a6b3a,
  btnBorderHover:    0xc5a572,

  sliderTrack:       0x2a1a0a,
  sliderFill:        0xc5a050,
  sliderThumb:       0xd9c7a0,
  sliderThumbBorder: 0x8a6b3a,

  toggleOnBg:        0x1a2a0a,
  toggleOffBg:       0x1a0a0a,
  toggleOnBorder:    0x6a9a30,
  toggleOffBorder:   0x5a1010,
};

export const TC = {
  primary: '#d9c7a0',
  gold:    '#c5a050',
  muted:   '#a89470',
  dim:     '#7a5a30',
  dark:    '#5a4020',
  faint:   '#2a1a0a',
  green:   '#8bc34a',
  red:     '#c04040',
};

const DPR = () => window.devicePixelRatio || 1;

export function txt(scene, x, y, str, style = {}) {
  return scene.add.text(Math.round(x), Math.round(y), str, {
    fontFamily: "'Courier New', monospace",
    fontSize:   '12px',
    color:      TC.primary,
    resolution: DPR(),
    ...style,
  });
}

export function btn(scene, x, y, w, h, label, cb, disabled = false) {
  const g = scene.add.graphics();
  const redraw = hover => {
    g.clear();
    g.fillStyle(hover ? COLORS.btnBgHover : COLORS.btnBg, 1).fillRect(x, y, w, h);
    g.lineStyle(1, hover ? COLORS.btnBorderHover : COLORS.btnBorder, disabled ? 0.3 : 1)
      .strokeRect(x, y, w, h);
  };
  redraw(false);

  txt(scene, x + w / 2, y + h / 2, label, { fontSize: '13px', color: TC.primary })
    .setOrigin(0.5, 0.5)
    .setAlpha(disabled ? 0.3 : 1);

  if (!disabled && cb) {
    scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive()
      .on('pointerover',  () => redraw(true))
      .on('pointerout',   () => redraw(false))
      .on('pointerdown',  () => cb());
  }
}

// Horizontal drag slider. trackH/thumbR are optional overrides.
export function slider(scene, x, y, w, label, getValue, onChange, opts = {}) {
  const trackH = opts.trackH ?? 3;
  const thumbR = opts.thumbR ?? 6;
  const cy     = Math.round(y + thumbR);
  const g      = scene.add.graphics();
  let valTxt;

  const redraw = v => {
    const fillW = Math.round(w * v);
    g.clear();
    g.fillStyle(COLORS.sliderTrack, 1)
      .fillRect(x, cy - Math.ceil(trackH / 2), w, trackH);
    if (v > 0) g.fillStyle(COLORS.sliderFill, 1)
      .fillRect(x, cy - Math.ceil(trackH / 2), fillW, trackH);
    g.fillStyle(COLORS.sliderThumb, 1).fillCircle(x + fillW, cy, thumbR);
    g.lineStyle(1, COLORS.sliderThumbBorder, 1).strokeCircle(x + fillW, cy, thumbR);
    if (valTxt) valTxt.setText(Math.round(v * 100) + '%');
  };

  txt(scene, x, y - 16, label, { fontSize: '9px', color: TC.muted, letterSpacing: 2 });
  valTxt = txt(scene, x + w + 10, cy - 6, '', { fontSize: '10px', color: TC.primary });
  redraw(getValue());

  const apply = ptr => {
    const v = Math.max(0, Math.min(1, (ptr.x - x) / w));
    onChange(v);
    redraw(v);
  };
  scene.add.zone(x - thumbR, cy - thumbR - 2, w + thumbR * 2, thumbR * 2 + 4)
    .setOrigin(0, 0).setInteractive()
    .on('pointerdown', apply)
    .on('pointermove', ptr => { if (ptr.isDown) apply(ptr); });
}

// Two-state ON/OFF toggle. btnOffsetX is the x distance from row-left to the button.
export function toggle(scene, x, y, label, getState, onToggle, opts = {}) {
  const btnW      = opts.btnW      ?? 52;
  const btnH      = opts.btnH      ?? 26;
  const offsetX   = opts.btnOffsetX ?? 160;
  const g         = scene.add.graphics();

  const redraw = () => {
    const on = getState();
    g.clear();
    g.fillStyle(on ? COLORS.toggleOnBg : COLORS.toggleOffBg, 1)
      .fillRect(x + offsetX, y, btnW, btnH);
    g.lineStyle(1, on ? COLORS.toggleOnBorder : COLORS.toggleOffBorder, 1)
      .strokeRect(x + offsetX, y, btnW, btnH);
  };

  txt(scene, x, y + Math.round(btnH / 2) - 6, label,
    { fontSize: '10px', color: TC.muted, letterSpacing: 2 });

  const stateTxt = txt(scene, x + offsetX + btnW / 2, y + btnH / 2, '',
    { fontSize: '10px', color: TC.primary }).setOrigin(0.5, 0.5);

  const refresh = () => {
    redraw();
    const on = getState();
    stateTxt.setText(on ? 'ON' : 'OFF').setColor(on ? TC.green : TC.red);
  };
  refresh();

  scene.add.zone(x + offsetX, y, btnW, btnH).setOrigin(0, 0).setInteractive()
    .on('pointerdown', () => { onToggle(!getState()); refresh(); });
}
