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

export function drawWeaponSprite(ctx, key, x, y, scale = 1, rotation = 0) {
  const sprite = WEAPON_SPRITES[key];
  if (!sprite) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  // Center the 16x16 sprite
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
    scene.textures.addImage('weapon_' + key, canvas);
  }
}
