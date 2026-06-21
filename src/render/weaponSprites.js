export const PALETTE = {
  "0": null,
  "1": "#0a0a0a",
  "2": "#5a3510",
  "3": "#9a6530",
  "4": "#cfd6dc",
  "5": "#8a95a5",
  "6": "#8a1a1a",
  "7": "#3a4a5a",
  "8": "#e8e060",
  "9": "#ffffff",
  "a": "#3a2410",
  "b": "#6b7585",
  "c": "#4a5568",
  "d": "#b0b8c0"
};

export const WEAPON_RENDER_SCALE = 1.25;
export const WEAPON_RENDER = {
  car_antenna:           { scale: 1.0 },
  toilet_lid:            { scale: 1.0 },
  bus_stop_pole:         { scale: 1.0 },
  shower_hose:           { scale: 1.0 },
  chain_with_padlock:    { scale: 1.0 },
  extension_cord:        { scale: 1.0 },
  frozen_cutlet:         { scale: 1.0 },
  pickle_jar:            { scale: 1.0 },
  bottle_cap_shuriken:   { scale: 1.0 },
  bed_spring_arbalest:   { scale: 1.0 },
  bike_spoke_slingshot:  { scale: 1.0 },
  courtyard_railgun:     { scale: 1.0 },
  contraceptive_catapult:{ scale: 1.0 },
  catapult_pouch:        { scale: 1.0 },
  fence_wire_bow:        { scale: 1.0 },
  richards_megaphone:    { scale: 1.0 },
  spring_bolt:           { scale: 1.0 },
  spoke_ball:            { scale: 0.9 },
  wire_arrow:            { scale: 1.0 },
};

export function getWeaponRender(key) {
  return Object.assign({ scale: 1.0, reachMult: 1.0 }, WEAPON_RENDER[key] || {});
}
export const WEAPON_SPRITES = {
  car_antenna: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                   11   ",
    "                  141   ",
    "                  141   ",
    "                11911   ",
    "                141     ",
    "              1111      ",
    "             141        ",
    "             141        ",
    "           11b11        ",
    "          1441          ",
    "          1b41          ",
    "         1411           ",
    "        141             ",
    "      1191              ",
    "     1941               ",
    "     1441               ",
    "   11b11                ",
    "  1111                  ",
    "                        ",
    "                        "
  ],
  toilet_lid: [
    "                        ",
    "                        ",
    "                        ",
    "        111111111       ",
    "     111949994449111    ",
    "     111444444444111    ",
    "   119494444444449941   ",
    "  14944444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "  14444444444444444441  ",
    "   114444444444444441   ",
    "   1144b444444444bb41   ",
    "     111bb4b4b4bb111    ",
    "        111111111       ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  bus_stop_pole: [
    "                        ",
    "                        ",
    "        1111111         ",
    "        1111111         ",
    "        1888881         ",
    "        1881181         ",
    "        1881181         ",
    "        1888881         ",
    "        1888881         ",
    "        1111111         ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           151          ",
    "           111          ",
    "                        ",
    "                        "
  ],
  richards_megaphone: [
    "                        ",
    "                        ",
    "         1111           ",
    "        118811          ",
    "       1188881          ",
    "      118888811111      ",
    "     11888888888811     ",
    "    118888888888881     ",
    "   1188888888888881     ",
    "   1188888888888881     ",
    "  11888888888888881     ",
    "  11888888888888881     ",
    "   1188888888888881     ",
    "   1188888888888881     ",
    "    118888888888881     ",
    "     11888888888811     ",
    "      118888811111      ",
    "       1188881  111     ",
    "        118811  111     ",
    "         1111   111     ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  shower_hose: [
    "                        ",
    "                        ",
    "          1111          ",
    "        11944911        ",
    "        1144b411        ",
    "          111171        ",
    "             171        ",
    "             171        ",
    "             171        ",
    "           11711        ",
    "           11711        ",
    "          1771          ",
    "        11711           ",
    "       1771             ",
    "       1771             ",
    "       1771             ",
    "        11711           ",
    "          1771          ",
    "          1771          ",
    "           11111        ",
    "          194911        ",
    "          111111        ",
    "                        ",
    "                        "
  ],
  chain_with_padlock: [
    "                        ",
    "                        ",
    "                        ",
    "         111111         ",
    "        15555551        ",
    "        155  551        ",
    "        155  551        ",
    "        155  551        ",
    "     11111111111111     ",
    "     18888888888881     ",
    "     18899888888881     ",
    "     18888888888881     ",
    "     18888811888881     ",
    "     18888811888881     ",
    "     18888811888881     ",
    "     18888888888881     ",
    "     18888888888881     ",
    "     18888888888881     ",
    "     11111111111111     ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  extension_cord: [
    "                        ",
    "                        ",
    "      111111            ",
    "      111111            ",
    "     188111811          ",
    "   11811   1881         ",
    "   11811   1881         ",
    "   11811   1881         ",
    "   11811   1881         ",
    "   11811   1881         ",
    "   11811   1881         ",
    "     188111811          ",
    "     188888811          ",
    "      111111            ",
    "           1111         ",
    "           1881         ",
    "            11811       ",
    "              1881      ",
    "              1881      ",
    "              111111    ",
    "              111111    ",
    "              111111    ",
    "                        ",
    "                        "
  ],
  frozen_cutlet: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "        111111111       ",
    "        111111111       ",
    "     111222333222111    ",
    "   112333222333223331   ",
    "   112333222333223331   ",
    "  12223332223332223331  ",
    "  13332223332223332221  ",
    "  13332223332223332221  ",
    "  12223332223332223331  ",
    "   113332223332223331   ",
    "   11aaa222333222a3a1   ",
    "     1112223a3222111    ",
    "        111111111       ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  pickle_jar: [
    "                        ",
    "                        ",
    "        1111111111      ",
    "        1111111111      ",
    "        1111111111      ",
    "        1888888811      ",
    "     11177777777771     ",
    "     11177777777771     ",
    "     11177777777771     ",
    "     11177777777771     ",
    "     11178888888771     ",
    "     11178888888771     ",
    "     11178888888771     ",
    "     11178888888771     ",
    "     11178888888771     ",
    "     11177777777771     ",
    "     11177777777771     ",
    "     11177777777771     ",
    "     11177777777771     ",
    "     11177777777771     ",
    "        1111111111      ",
    "        1111111111      ",
    "                        ",
    "                        "
  ],
  bottle_cap_shuriken: [
    "                        ",
    "                        ",
    "                        ",
    "        111111111       ",
    "        111111111       ",
    "      1144441449911     ",
    "      1144441444411     ",
    "      1144441444411     ",
    "      1144441444411     ",
    "  11111144444444411111  ",
    "  11111144444444411111  ",
    "  11119944444444499111  ",
    "  11114444444444444111  ",
    "  1111b4444444444b4111  ",
    "  11111144444444411111  ",
    "  1111114444b444411111  ",
    "      1144441444411     ",
    "      1144441444411     ",
    "      1144441444411     ",
    "      114bbb144bb11     ",
    "        111111111       ",
    "                        ",
    "                        ",
    "                        "
  ],
  bed_spring_arbalest: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "         111111         ",
    "         111111         ",
    "        199b44911       ",
    "     111411111194111    ",
    "     111411111144111    ",
    "   119111  111 111b91   ",
    "  1991     111    1141  ",
    "  1bb1     111    11b1  ",
    "  111      111      11  ",
    "           111          ",
    "           111          ",
    "        111555111       ",
    "      115555555551      ",
    "      115111111551      ",
    "     1551      11511    ",
    "     111         111    ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  bike_spoke_slingshot: [
    "                        ",
    "                        ",
    "                        ",
    "     111          111   ",
    "     111          111   ",
    "  111511   1111   1551  ",
    "  111511   1111   1551  ",
    "  111511 1166661  1551  ",
    "     1551661111611511   ",
    "     1551661111611511   ",
    "      11511    1551     ",
    "        1551111511      ",
    "        1551111511      ",
    "         1155551        ",
    "         1155551        ",
    "           15551        ",
    "           15551        ",
    "           15551        ",
    "           15551        ",
    "           11111        ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  courtyard_railgun: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "     111111111111111    ",
    "     111111111111111    ",
    "    177777777777888811  ",
    "  117777777777888881    ",
    "  117777777777888881    ",
    "  11177111111111111     ",
    "    1771                ",
    "    1771                ",
    "    1771                ",
    "    1111                ",
    "    1111                ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  contraceptive_catapult: [
    "                        ",
    "                        ",
    "         11111          ",
    "         11111          ",
    "       1133333111       ",
    "       1133333111       ",
    "       11aaa33111       ",
    "    111331111133311     ",
    "    111aa111113aa11     ",
    "  1133311     11133111  ",
    "  1133311     11133111  ",
    "  11a3a11     111aa111  ",
    "  11111          11111  ",
    "  11111          11111  ",
    "    111111111111111     ",
    "    111666666666611     ",
    "    111666666666611     ",
    "    111661111166611     ",
    "    111661111166611     ",
    "       1166666111       ",
    "       1166666111       ",
    "       1111111111       ",
    "                        ",
    "                        "
  ],
  catapult_pouch: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "           11           ",
    "          1441          ",
    "         144441         ",
    "        14999941        ",
    "        49999994        ",
    "       1499999941       ",
    "       1499999941       ",
    "        49999994        ",
    "        14999941        ",
    "         144441         ",
    "          1441          ",
    "           11           ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        "
  ],
  fence_wire_bow: [
    "                        ",
    "                        ",
    "            111         ",
    "            111         ",
    "          115551        ",
    "        1151155511      ",
    "        1151155511      ",
    "       1551  11551      ",
    "     11511     1551     ",
    "    1551       1551     ",
    "    1551       1551     ",
    "    1551       1551     ",
    "    1551       1661     ",
    "    1551       1551     ",
    "    1551       1551     ",
    "    1551       1551     ",
    "     11511     1551     ",
    "       1551  11551      ",
    "        1151155511      ",
    "        1151155511      ",
    "          115551        ",
    "            111         ",
    "                        ",
    "                        "
  ],
  spring_bolt: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "   6           14       ",
    "   66          1444     ",
    "   666333333333149444   ",
    "   666333333333149444   ",
    "   66          1444     ",
    "   6           14       ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  spoke_ball: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "         115511         ",
    "        15555551        ",
    "        15955551        ",
    "        55555555        ",
    "        55555555        ",
    "        15555551        ",
    "        15555551        ",
    "         115511         ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  wire_arrow: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "             55         ",
    "               55       ",
    "                 55     ",
    "    555655555555   54   ",
    "    555555655555   54   ",
    "                 55     ",
    "               55       ",
    "             55         ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
};

// ── Real sprite definitions ───────────────────────────────────────────────────
//
const WEAPON_IMAGE_DEFS = {};

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
  const rows = sprite.length;
  const cols = sprite[0].length;
  ctx.translate(-cols / 2, -rows / 2);

  for (let r = 0; r < rows; r++) {
    const row = sprite[r];
    for (let c = 0; c < cols; c++) {
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
    const rows = sprite.length;
    const cols = sprite[0].length;
    canvas.width = cols;
    canvas.height = rows;
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
      for (let r = 0; r < rows; r++) {
        const row = sprite[r];
        for (let c = 0; c < cols; c++) {
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
