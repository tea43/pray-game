import Phaser from 'phaser';
import { state } from '../../state.js';
import { playSfx } from '../../systems/audio.js';

const DPR = window.devicePixelRatio || 1;

const RARITY_COLORS = {
  Common:    0x888888,
  Rare:      0x4080ff,
  Epic:      0xb040f0,
  Legendary: 0xffaa18,
};

// ─────────────────────────────────────────────────────────────────────────────
export class WeaponLevelUpScene extends Phaser.Scene {
  constructor() { super({ key: 'WeaponLevelUpScene' }); }

  create() {
    const { width: W, height: H } = this.scale;

    if (state.units && state.units.every(u => u.dead)) {
      this._close();
      return;
    }

    if (WeaponLevelUpScene._generateWeaponTextures) {
      WeaponLevelUpScene._generateWeaponTextures(this);
    }

    // Dim frozen GameScene
    this.add.graphics().fillStyle(0x000000, 0.62).fillRect(0, 0, W, H);

    const FW = Math.min(W * 0.88, 760);
    const FH = Math.min(H * 0.60, 380);
    const FX = Math.round((W - FW) / 2);
    const FY = Math.round((H - FH) / 2);

    // Frame background
    const fg = this.add.graphics();
    fg.fillStyle(0x0d0a07, 1);
    fg.fillRect(FX, FY, FW, FH);
    fg.lineStyle(1, 0x4a3420);
    fg.strokeRect(FX, FY, FW, FH);
    fg.lineStyle(1, 0x1e1510);
    fg.strokeRect(FX + 3, FY + 3, FW - 6, FH - 6);

    // Header
    const HDR_H = 40;
    fg.fillStyle(0x171008, 1);
    fg.fillRect(FX + 1, FY + 1, FW - 2, HDR_H);
    fg.lineStyle(1, 0x3a2818);
    fg.beginPath().moveTo(FX + 1, FY + HDR_H).lineTo(FX + FW - 1, FY + HDR_H).strokePath();

    const heroName = (state.currentWeaponLevelUpHero || 'hero').toUpperCase();
    this._txt(W / 2, FY + 10, `WEAPON UPGRADE  —  ${heroName}`, {
      fontSize: '20px', fontFamily: 'Georgia, serif',
      color: '#f0e4c0', letterSpacing: 5,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this._txt(W / 2, FY + 30, 'Choose one upgrade for this hero', {
      fontSize: '13px', fontFamily: 'Georgia, serif',
      color: '#a89470', letterSpacing: 1,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0);

    // Generate and draw the 3 offer cards (with a reserved button row at the bottom)
    this._offers       = this._generateOffers();
    this._selectedIdx  = -1;
    this._cardRedraws  = [];
    const BTN_ROW_H    = 56;
    this._drawCards(FX, FY + HDR_H, FW, FH - HDR_H - BTN_ROW_H);
    this._drawConfirmButton(FX, FY + FH - BTN_ROW_H, FW, BTN_ROW_H);

    // ESC → pause menu
    this.input.keyboard.addKey('ESC').on('down', () => {
      if (!this.scene.isActive('PauseScene')) {
        this.scene.launch('PauseScene', { fromLevelUp: true });
        this.scene.bringToTop('PauseScene');
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _txt(x, y, str, style) {
    return this.add.text(x, y, str, { ...style, resolution: DPR });
  }

  _close() {
    state.isLevelUpScreen = false;
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  // ── Offer generation (real logic lands in commit 4) ───────────────────────

  _generateOffers() {
    const { WEAPON_DEFS, resolveWeaponStats } = this._getWeaponImports();
    const { HERO_DEFS } = this._getHeroImports();
    const candidates = [];
    const targetHero = state.currentWeaponLevelUpHero;

    for (const unit of state.units) {
      if (unit.dead) continue;
      if (targetHero && unit.type !== targetHero) continue;
      const heroDef = HERO_DEFS[unit.type];

      // Upgrade offers: filled slots below level 5
      for (let i = 0; i < unit.weaponSlots.length; i++) {
        const slot = unit.weaponSlots[i];
        if (!slot || slot.level >= 5) continue;
        const def = WEAPON_DEFS[slot.key];
        if (!def) continue;
        const fromStats = resolveWeaponStats(slot);
        const toStats   = resolveWeaponStats({ ...slot, level: slot.level + 1 });
        candidates.push({
          kind: 'upgrade', heroId: unit.type, slotIdx: i,
          weaponKey: slot.key,
          fromLevel: slot.level, toLevel: slot.level + 1,
          rarity: def.rarity || 'Common',
          statDelta: _buildStatDelta(fromStats, toStats),
        });
      }

      // New-weapon offers: empty slots + weapons not already owned
      const ownedKeys = unit.weaponSlots.filter(Boolean).map(s => s.key);
      const hasEmpty  = unit.weaponSlots.some(s => s === null);
      if (hasEmpty && heroDef?.weaponPool) {
        for (const key of heroDef.weaponPool) {
          if (ownedKeys.includes(key)) continue;
          const def = WEAPON_DEFS[key];
          if (!def) continue;
          candidates.push({
            kind: 'new', heroId: unit.type, weaponKey: key,
            rarity: def.rarity || 'Common',
          });
        }
      }
    }

    // Weighted sample of 3 distinct offers
    const WEIGHT = { Common: 1, Rare: 2, Epic: 3, Legendary: 4 };
    const picks = [];
    const pool = [...candidates];
    while (picks.length < 3 && pool.length > 0) {
      const total = pool.reduce((s, c) => s + (WEIGHT[c.rarity] || 1), 0);
      let r = Math.random() * total;
      let chosen = pool[pool.length - 1];
      for (const c of pool) {
        r -= WEIGHT[c.rarity] || 1;
        if (r <= 0) { chosen = c; break; }
      }
      picks.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    }

    // Fill remaining slots with heal fallback for the target hero
    while (picks.length < 3) {
      picks.push({ kind: 'heal', heroId: targetHero || 'eliott', rarity: 'Common' });
    }
    return picks;
  }

  _getWeaponImports() {
    // Dynamic import via static cached reference populated at module evaluation
    return WeaponLevelUpScene._weaponImports;
  }
  _getHeroImports() {
    return WeaponLevelUpScene._heroImports;
  }

  // ── Card rendering ────────────────────────────────────────────────────────

  _drawCards(fx, fy, fw, fh) {
    const PAD   = 16;
    const GAP   = 12;
    const CARD_W = Math.floor((fw - PAD * 2 - GAP * 2) / 3);
    const CARD_H = fh - PAD * 2;
    const cardY = fy + PAD;

    for (let i = 0; i < 3; i++) {
      const offer  = this._offers[i];
      const cardX  = fx + PAD + i * (CARD_W + GAP);
      this._buildCard(offer, cardX, cardY, CARD_W, CARD_H, i);
    }
  }

  _buildCard(offer, cx, cy, cw, ch, idx) {
    const rarityColor = RARITY_COLORS[offer.rarity] || RARITY_COLORS.Common;
    const cc = this.add.container(0, 0);

    const bg = this.add.graphics();
    const drawBg = (hovered, selected) => {
      bg.clear();
      const fillAlpha = selected ? 0.32 : hovered ? 0.20 : 0.10;
      bg.fillStyle(rarityColor, fillAlpha);
      bg.fillRect(cx, cy, cw, ch);
      bg.fillStyle(0x110d09, selected ? 0.62 : hovered ? 0.78 : 0.88);
      bg.fillRect(cx + 3, cy, cw - 3, ch);
      bg.fillStyle(rarityColor, selected ? 1.0 : hovered ? 1.0 : 0.55);
      bg.fillRect(cx, cy, 3, ch);
      bg.lineStyle(selected ? 2 : 1, selected ? 0xffd870 : hovered ? rarityColor : 0x251d14);
      bg.strokeRect(cx, cy, cw, ch);
      if (selected) {
        bg.lineStyle(1, 0xffd870, 0.5);
        bg.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);
      }
    };
    drawBg(false, false);
    cc.add(bg);
    this._cardRedraws[idx] = drawBg;

    // Hero name chip
    const unit = state.units?.find(u => u.type === offer.heroId);
    const heroLabel = unit ? unit.name.toUpperCase() : offer.heroId.toUpperCase();
    cc.add(this._txt(cx + 8, cy + 7, heroLabel, {
      fontSize: '12px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: '#c8b080', letterSpacing: 1,
      stroke: '#000000', strokeThickness: 2,
    }));

    // Card type badge
    const badgeStr = offer.kind === 'upgrade' ? '↑ UPGRADE' : offer.kind === 'new' ? '+ NEW' : '♥ HEAL';
    const badgeColor = offer.kind === 'upgrade' ? '#6090ff' : offer.kind === 'new' ? '#e8b848' : '#60d890';
    cc.add(this._txt(cx + cw - 8, cy + 7, badgeStr, {
      fontSize: '12px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: badgeColor,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0));

    // Weapon icon
    const iconSz = 52;
    const iconX = cx + cw / 2;
    const iconY = cy + 24 + iconSz / 2;
    const iconPh = this.add.graphics();
    iconPh.fillStyle(rarityColor, 0.35);
    iconPh.fillRect(cx + (cw - iconSz) / 2, cy + 24, iconSz, iconSz);
    cc.add(iconPh);

    if (offer.kind !== 'heal') {
       const img = this.add.image(iconX, iconY, 'weapon_' + offer.weaponKey);
       img.setScale(3);
       img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
       cc.add(img);
    } else {
       const healImg = this.add.graphics();
       healImg.fillStyle(0x50c880, 1);
       healImg.fillRect(iconX - 12, iconY - 4, 24, 8);
       healImg.fillRect(iconX - 4, iconY - 12, 8, 24);
       cc.add(healImg);
    }

    // Title line
    let titleStr = '';
    if (offer.kind === 'upgrade') {
      const { WEAPON_DEFS } = this._getWeaponImports();
      titleStr = (WEAPON_DEFS[offer.weaponKey]?.displayName || offer.weaponKey).toUpperCase();
    } else if (offer.kind === 'new') {
      const { WEAPON_DEFS } = this._getWeaponImports();
      titleStr = (WEAPON_DEFS[offer.weaponKey]?.displayName || offer.weaponKey).toUpperCase();
    } else {
      titleStr = 'HEAL +25%';
    }
    cc.add(this._txt(cx + cw / 2, iconY + iconSz + 6, titleStr, {
      fontSize: '14px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: '#f0e4c0', wordWrap: { width: cw - 16 }, align: 'center',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0));

    // Sub-label (level or stat delta)
    let subStr = '';
    if (offer.kind === 'upgrade') {
      subStr = `Lv ${offer.fromLevel} → ${offer.toLevel}`;
      if (offer.statDelta?.length) subStr += '\n' + offer.statDelta.slice(0, 2).join('  ');
    } else if (offer.kind === 'new') {
      subStr = offer.rarity;
    }
    if (subStr) {
      cc.add(this._txt(cx + cw / 2, iconY + iconSz + 24, subStr, {
        fontSize: '11px', fontFamily: 'Georgia, serif',
        color: '#a89468', wordWrap: { width: cw - 16 }, align: 'center',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0));
    }

    // Click zone
    const zone = this.add.zone(cx, cy, cw, ch).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });
    cc.add(zone);

    zone.on('pointerover', () => { playSfx('upgrade_card_select'); drawBg(true, this._selectedIdx === idx); });
    zone.on('pointerout',  () => { drawBg(false, this._selectedIdx === idx); });
    zone.on('pointerdown', () => { this._selectCard(idx); });

    this.add.existing(cc);
  }

  _selectCard(idx) {
    if (this._selectedIdx === idx) return;
    const prev = this._selectedIdx;
    this._selectedIdx = idx;
    if (prev >= 0 && this._cardRedraws[prev]) this._cardRedraws[prev](false, false);
    if (this._cardRedraws[idx]) this._cardRedraws[idx](true, true);
    playSfx('upgrade_card_select');
    this._refreshConfirmButton();
  }

  _drawConfirmButton(fx, fy, fw, fh) {
    const BW = 240;
    const BH = 36;
    const BX = Math.round(fx + (fw - BW) / 2);
    const BY = Math.round(fy + (fh - BH) / 2);
    this._btn = { x: BX, y: BY, w: BW, h: BH };

    const g = this.add.graphics();
    this._btnGfx = g;

    const label = this._txt(BX + BW / 2, BY + BH / 2, 'CHOOSE UPGRADE', {
      fontSize: '15px', fontFamily: 'Georgia, serif',
      fontStyle: 'bold', color: '#3a2010', letterSpacing: 2,
    }).setOrigin(0.5, 0.5);
    this._btnLabel = label;

    const zone = this.add.zone(BX, BY, BW, BH).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });
    this._btnZone = zone;
    zone.on('pointerover', () => { this._btnHovered = true; this._refreshConfirmButton(); });
    zone.on('pointerout',  () => { this._btnHovered = false; this._refreshConfirmButton(); });
    zone.on('pointerdown', () => { this._confirm(); });

    this._refreshConfirmButton();
  }

  _refreshConfirmButton() {
    const enabled = this._selectedIdx >= 0;
    const hovered = !!this._btnHovered && enabled;
    const { x, y, w, h } = this._btn;
    const g = this._btnGfx;
    g.clear();

    const fillColor = !enabled ? 0x2a2218 : hovered ? 0xffd870 : 0xd9b860;
    const borderColor = !enabled ? 0x3a2e1f : 0xffe890;
    const labelColor = !enabled ? '#5a4a30' : '#3a2818';

    g.fillStyle(fillColor, !enabled ? 0.55 : 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, borderColor, !enabled ? 0.4 : 1);
    g.strokeRect(x, y, w, h);
    if (hovered) {
      g.lineStyle(1, 0xffffff, 0.45);
      g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    }
    this._btnLabel.setColor(labelColor);
  }

  _confirm() {
    if (this._selectedIdx < 0) return;
    const offer = this._offers[this._selectedIdx];
    this._applyOffer(offer);
    playSfx('upgrade_card_select');
    this._btnZone.disableInteractive();
    this.time.delayedCall(120, () => this._close());
  }

  _applyOffer(offer) {
    const unit = state.units?.find(u => u.type === offer.heroId);
    if (!unit || unit.dead) return;
    if (offer.kind === 'new') {
      unit.grantWeapon(offer.weaponKey);
    } else if (offer.kind === 'upgrade') {
      unit.upgradeWeapon(offer.slotIdx);
    } else if (offer.kind === 'heal') {
      unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.25);
    }
  }
}

// ── Static imports resolved at module load time ───────────────────────────────
import { WEAPON_DEFS, resolveWeaponStats } from '../../config/weapons.js';
import { HERO_DEFS } from '../../config/heroes.js';
import { generateWeaponTextures } from '../../render/weaponSprites.js';
WeaponLevelUpScene._weaponImports = { WEAPON_DEFS, resolveWeaponStats };
WeaponLevelUpScene._heroImports   = { HERO_DEFS };
WeaponLevelUpScene._generateWeaponTextures = generateWeaponTextures;

// Returns human-readable delta lines for stat changes between two resolved stat objects.
function _buildStatDelta(from, to) {
  const lines = [];
  const fmt = (key, label, fmt) => {
    if (to[key] === undefined) return;
    const delta = to[key] - (from[key] ?? to[key]);
    if (Math.abs(delta) < 0.001) return;
    lines.push(fmt(delta));
  };
  fmt('atkDmg',   'dmg',  d => `${d > 0 ? '+' : ''}${Math.round(d)} dmg`);
  fmt('atkRate',  'rate', d => d < 0 ? `${Math.abs(d).toFixed(2)}s faster` : `${d.toFixed(2)}s slower`);
  fmt('knockback','kb',   d => `${d > 0 ? '+' : ''}${Math.round(d)} kb`);
  if (to.bulletCount !== undefined && to.bulletCount !== from.bulletCount) {
    lines.push(`+${to.bulletCount - (from.bulletCount || 0)} bullet`);
  }
  if (to.piercing && !from.piercing) lines.push('piercing');
  return lines;
}
