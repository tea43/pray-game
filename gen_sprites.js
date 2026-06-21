const fs = require('fs');

const PALETTE = {
  '0': null,
  '1': '#0a0a0a', // outline
  '2': '#5a3510', // dark wood
  '3': '#9a6530', // light wood
  '4': '#cfd6dc', // light metal
  '5': '#8a95a5', // dark metal
  '6': '#8a1a1a', // red wrap
  '7': '#3a4a5a', // dark blue/grey
  '8': '#e8e060', // gold/yellow
  '9': '#ffffff', // hot highlight
  'a': '#3a2410', // wood shadow
  'b': '#6b7585', // metal shadow
  'c': '#4a5568', // metal darker shadow
  'd': '#b0b8c0', // metal light shadow
};

const oldContent = fs.readFileSync('src/render/weaponSprites.js', 'utf8');

const regex = /export const WEAPON_SPRITES = (\{[\s\S]*?\n\});/m;
const match = oldContent.match(regex);
let oldSprites = {};
if (match) {
  oldSprites = eval('(' + match[1] + ')');
}

function scaleSprite(sprite) {
  const scaled = [];
  for (let r = 0; r < 24; r++) {
    let row = '';
    for (let c = 0; c < 24; c++) {
      const origR = Math.floor(r * 16 / 24);
      const origC = Math.floor(c * 16 / 24);
      row += sprite[origR][origC];
    }
    scaled.push(row);
  }
  
  let minR = 24, maxR = -1, minC = 24, maxC = -1;
  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 24; c++) {
      if (scaled[r][c] !== ' ') {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  
  if (minR > maxR) {
     return Array(24).fill('                        ');
  }
  
  const w = maxC - minC + 1;
  const h = maxR - minR + 1;
  
  const targetW = 20;
  const targetH = 20;
  const scaleX = targetW / w;
  const scaleY = targetH / h;
  const scale = Math.min(scaleX, scaleY);
  
  const finalW = Math.max(1, Math.floor(w * scale));
  const finalH = Math.max(1, Math.floor(h * scale));
  
  const offsetX = Math.floor((24 - finalW) / 2);
  const offsetY = Math.floor((24 - finalH) / 2);
  
  const finalSprite = Array.from({length: 24}, () => Array(24).fill(' '));
  
  for (let r = 0; r < finalH; r++) {
    for (let c = 0; c < finalW; c++) {
      const origR = minR + Math.floor(r / scale);
      const origC = minC + Math.floor(c / scale);
      if (origR <= maxR && origC <= maxC) {
        finalSprite[offsetY + r][offsetX + c] = scaled[origR][origC];
      }
    }
  }
  
  for (let r = 0; r < 24; r++) {
    for (let c = 0; c < 24; c++) {
      if (finalSprite[r][c] !== ' ' && finalSprite[r][c] !== '1') {
         let isEdge = false;
         if (r===0 || finalSprite[r-1][c]===' ') isEdge = true;
         if (r===23 || finalSprite[r+1][c]===' ') isEdge = true;
         if (c===0 || finalSprite[r][c-1]===' ') isEdge = true;
         if (c===23 || finalSprite[r][c+1]===' ') isEdge = true;
         
         if (isEdge) {
            finalSprite[r][c] = '1';
         } else {
            if (r > 0 && finalSprite[r-1][c] === '1' && Math.random() < 0.5) {
               if (finalSprite[r][c] === '4') finalSprite[r][c] = '9';
            }
            if (r < 23 && finalSprite[r+1][c] === '1' && Math.random() < 0.5) {
               if (finalSprite[r][c] === '4') finalSprite[r][c] = 'b';
               if (finalSprite[r][c] === '3') finalSprite[r][c] = 'a';
            }
         }
      }
    }
  }

  return finalSprite.map(row => "    \"" + row.join('') + "\"");
}

let newSpritesText = 'export const WEAPON_SPRITES = {\n';
for (const [key, sprite] of Object.entries(oldSprites)) {
  newSpritesText += '  ' + key + ': [\n';
  newSpritesText += scaleSprite(sprite).join(',\n');
  newSpritesText += '\n  ],\n';
}
newSpritesText += '};\n';

let newPaletteText = 'export const PALETTE = ' + JSON.stringify(PALETTE, null, 2) + ';\n';
let newConfigText = `
export const WEAPON_RENDER_SCALE = 1.0;
export const WEAPON_RENDER = {
  car_antenna:           { scale: 1.0 },
  toilet_lid:            { scale: 1.0 },
  bus_stop_pole:         { scale: 1.0 },
  radiator_rib:          { scale: 1.0 },
  plastic_chair:         { scale: 1.0 },
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
  fence_wire_bow:        { scale: 1.0 },
};

export function getWeaponRender(key) {
  return Object.assign({ scale: 1.0, reachMult: 1.0 }, WEAPON_RENDER[key] || {});
}
`;

fs.writeFileSync('new_sprites.js', newPaletteText + newConfigText + newSpritesText);
console.log('Saved to new_sprites.js');
