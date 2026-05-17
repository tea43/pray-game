export const PALETTE = {
  '0': null,
  '1': '#0a0a0a', // outline
  '2': '#5a3510', // dark wood
  '3': '#9a6530', // light wood
  '4': '#cfd6dc', // light metal
  '5': '#8a95a5', // dark metal
  '6': '#8a1a1a', // red wrap
  '7': '#3a4a5a', // dark blue/grey
  '8': '#e8e060', // gold/yellow
};

export const WEAPON_SPRITES = {
  samurai_sword: [
    "               4",
    "              44",
    "             441",
    "            441 ",
    "           441  ",
    "          441   ",
    "         441    ",
    "        441     ",
    "       441      ",
    "      441       ",
    "     441        ",
    "  11441         ",
    "  6111          ",
    " 661            ",
    " 61             ",
    "1               "
  ],
  hockey_club: [
    "           111  ",
    "          11111 ",
    "          13331 ",
    "          13331 ",
    "         11331  ",
    "        11331   ",
    "       13331    ",
    "      13331     ",
    "     13331      ",
    "    13331       ",
    "   11111        ",
    "  16661         ",
    " 16661          ",
    " 1661           ",
    " 111            ",
    "                "
  ],
  short_hockey_club: [
    "                ",
    "                ",
    "                ",
    "        111     ",
    "       11111    ",
    "       13331    ",
    "      11331     ",
    "     13331      ",
    "    13331       ",
    "   13331        ",
    "  11111         ",
    " 16661          ",
    " 1661           ",
    " 111            ",
    "                ",
    "                "
  ],
  long_club: [
    "              11",
    "             131",
    "            1331",
    "           1331 ",
    "          1331  ",
    "         1331   ",
    "        1331    ",
    "       1331     ",
    "      1331      ",
    "     1331       ",
    "    1331        ",
    "   1331         ",
    "  1331          ",
    " 1331           ",
    " 111            ",
    "                "
  ],
  dual_clubs: [
    "           111  ",
    "          13331 ",
    "         13331  ",
    "        13331   ",
    "       13331    ",
    "      13331     ",
    "     11111      ",
    "    16661 111   ",
    "   1661  13331  ",
    "   111  13331   ",
    "       13331    ",
    "      13331     ",
    "     11111      ",
    "    16661       ",
    "   1661         ",
    "   111          "
  ],
  thrown_club: [
    "      111       ",
    "     13331      ",
    "    13331       ",
    "   13331        ",
    "  13331         ",
    " 13331          ",
    " 1331           ",
    " 111            ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                "
  ],
  boomerang: [
    "       11       ",
    "      1331      ",
    "     13331      ",
    "    13331       ",
    "   1333111      ",
    "  133311331     ",
    "  1331  1331    ",
    "  111    1331   ",
    "          1331  ",
    "           1331 ",
    "            11  ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                "
  ],
  throwing_stone: [
    "                ",
    "                ",
    "                ",
    "    1111        ",
    "   1555511      ",
    "  155555551     ",
    "  154455551     ",
    " 15444555551    ",
    " 15555555551    ",
    " 1555555551     ",
    "  15555511      ",
    "   11111        ",
    "                ",
    "                ",
    "                ",
    "                "
  ],
  shotgun: [
    "                ",
    "                ",
    "                ",
    "                ",
    "         111111 ",
    "   1111114444441",
    "  15555555555551",
    " 15555555111111 ",
    " 12211111       ",
    "1221            ",
    "121             ",
    " 1              ",
    "                ",
    "                ",
    "                ",
    "                "
  ],
  bow: [
    "         11     ",
    "       11331    ",
    "      1411331   ",
    "     141  1331  ",
    "    141    1331 ",
    "   141     1331 ",
    "   141     1331 ",
    "   141     1661 ",
    "   141     1331 ",
    "   141     1331 ",
    "    141    1331 ",
    "     141  1331  ",
    "      1411331   ",
    "       11331    ",
    "         11     ",
    "                "
  ],
  crossbow: [
    "          1     ",
    "         131    ",
    "    1   13331   ",
    "   141  13331   ",
    "   141  13331   ",
    "   141 113331   ",
    "  14411333111   ",
    " 1444133314441  ",
    "  11113331111   ",
    "     13331      ",
    "     13331      ",
    "     12221      ",
    "     12221      ",
    "      111       ",
    "                ",
    "                "
  ]
};

// ── Real sprite definitions ───────────────────────────────────────────────────
// drawW / drawH are the in-game render dimensions (world-space pixels) when
// scale = 1.  The images fire from left → right, so rotation = 0 aligns with
// facing angle 0 (rightward) — same convention as the pixel-art sprites.
//
// Bow is portrait (limbs top/bottom, depth left/right) so drawW < drawH.
const WEAPON_IMAGE_DEFS = {
  shotgun:  { src: './assets/sprites/weapons/shotgun_1.png',  drawW: 30, drawH: 10 },
  crossbow: { src: './assets/sprites/weapons/crossbow_1.png', drawW: 28, drawH:  9 },
  bow:      { src: './assets/sprites/weapons/bow_1.png',      drawW: 10, drawH: 30 },
};

const _weaponImages = {};

// Scale factor for the working bitmap — 4× the max in-game render size gives
// plenty of resolution even on HiDPI displays without keeping the full master.
const BITMAP_SCALE = 4;

// Call once from GameScene.create() — safe to call multiple times (idempotent).
export function preloadWeaponImages() {
  for (const [key, def] of Object.entries(WEAPON_IMAGE_DEFS)) {
    if (_weaponImages[key]) continue;

    const entry = { img: null, drawW: def.drawW, drawH: def.drawH };
    _weaponImages[key] = entry;

    const raw = new Image();
    raw.onload = () => {
      // Downscale to a working bitmap; the full master is then GC-eligible.
      createImageBitmap(raw, {
        resizeWidth:   Math.round(def.drawW * BITMAP_SCALE),
        resizeHeight:  Math.round(def.drawH * BITMAP_SCALE),
        resizeQuality: 'high',
      }).then(bmp => { entry.img = bmp; });
    };
    raw.src = def.src;
  }
}

export function drawWeaponSprite(ctx, key, x, y, scale = 1, rotation = 0) {
  // ── Real sprite path ───────────────────────────────────────────────────────
  const entry = _weaponImages[key];
  if (entry && entry.img) {  // img is null until createImageBitmap resolves
    const w = entry.drawW * scale;
    const h = entry.drawH * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(entry.img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return;
  }

  // ── Pixel-art fallback ─────────────────────────────────────────────────────
  const sprite = WEAPON_SPRITES[key];
  if (!sprite) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.translate(-8, -8);

  for (let r = 0; r < 16; r++) {
    const row = sprite[r];
    for (let c = 0; c < 16; c++) {
      const char = row[c];
      if (char !== ' ') {
        ctx.fillStyle = PALETTE[char];
        ctx.fillRect(c, r, 1, 1);
      }
    }
  }

  ctx.restore();
}

export function generateWeaponTextures(scene) {
  for (const [key, sprite] of Object.entries(WEAPON_SPRITES)) {
    if (scene.textures.exists('weapon_' + key)) continue;

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // Use real image thumbnail when loaded, pixel art otherwise.
    const entry = _weaponImages[key];
    if (entry && entry.img) {
      // Fit into 16×16 preserving aspect ratio, centred.
      const aspect = entry.drawW / entry.drawH;
      const tw = aspect >= 1 ? 16 : Math.round(16 * aspect);
      const th = aspect >= 1 ? Math.round(16 / aspect) : 16;
      ctx.drawImage(entry.img, (16 - tw) / 2, (16 - th) / 2, tw, th);
    } else {
      for (let r = 0; r < 16; r++) {
        const row = sprite[r];
        for (let c = 0; c < 16; c++) {
          const char = row[c];
          if (char !== ' ') {
            ctx.fillStyle = PALETTE[char];
            ctx.fillRect(c, r, 1, 1);
          }
        }
      }
    }

    scene.textures.addImage('weapon_' + key, canvas);
  }
}
