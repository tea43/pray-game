import { state } from '../state.js';
import { HERO_DEFS } from '../config/heroes.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { ACTIVE_SKILL_DEFS } from './activeSkills.js';

export const GameData = {
  upgrades: { eliott: [], dick: [], habib: [] }
};

export async function loadUpgrades() {
  try {
    const fetchJson = async (url) => {
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    };
    const [eRes, dRes, hRes] = await Promise.all([
      fetchJson('assets/data/upgrades/eliott_upgrades.json').catch(() => []),
      fetchJson('assets/data/upgrades/dick_upgrades.json').catch(() => []),
      fetchJson('assets/data/upgrades/habib_upgrades.json').catch(() => [])
    ]);
    GameData.upgrades.eliott = eRes;
    GameData.upgrades.dick = dRes;
    GameData.upgrades.habib = hRes;
  } catch (e) {
    console.error("Failed to load upgrades", e);
  }
}

export function applyWaveUpgrades() {
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  for (const hero of state.units) {
    if (hero.dead) continue;
    const upgrades = state.activeUpgrades[hero.type] || [];
    let speedMult = 1;
    let dmgMult = 1;
    let cdMult = 1;
    let rateMult = 1;
    let chainMult = 1;

    for (const upg of upgrades) {
      if (upg.effectType === 'heal_start') {
        hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * upg.effectValue);
      } else if (upg.effectType === 'speed_mult') speedMult += (upg.effectValue - 1);
      else if (upg.effectType === 'base_dmg_mult') dmgMult += (upg.effectValue - 1);
      else if (upg.effectType === 'ability_cd_mult') cdMult *= upg.effectValue;
      else if (upg.effectType === 'atk_rate_mult') rateMult *= upg.effectValue;
      else if (upg.effectType === 'chain_dmg_mult') chainMult *= upg.effectValue;
      // Passive upgrade handlers
      else if (upg.effectType === 'residual_haze') hero.residualHaze = true;
      else if (upg.effectType === 'extended_formula') hero.extendedFormula = true;
      else if (upg.effectType === 'quick_brew') cdMult *= 0.8;
      else if (upg.effectType === 'smokescreen') hero.smokescreen = true;
      else if (upg.effectType === 'backdoor_armor_fire') hero.backdoorArmorFire = true;
      else if (upg.effectType === 'backdoor_armor_lightning') hero.backdoorArmorLightning = true;
      else if (upg.effectType === 'backdoor_armor_spikes') hero.backdoorArmorSpikes = true;
      else if (upg.effectType === 'dense_plating') hero.densePlating = (hero.densePlating || 0) + 0.10;
      else if (upg.effectType === 'hp_max_bonus') {
        const bonus = Math.round(upg.effectValue);
        if (!hero._maxHpBonusApplied || hero._maxHpBonusApplied < bonus) {
          const prev = hero._maxHpBonusApplied || 0;
          hero.maxHp += bonus - prev;
          hero.hp += bonus - prev;
          hero._maxHpBonusApplied = bonus;
        }
      }
    }

    // Apply active-skill passive upgrades too
    for (const slot of hero.activeSkillSlots) {
      if (!slot) continue;
      const def = ACTIVE_SKILL_DEFS[slot.id];
      if (def?.passive) def.passive(hero);
    }

    const def = HERO_DEFS[hero.type];
    hero.speed = 78 * speedMult;
    hero.abilityMaxCd = (def?.abilityMaxCd || 6) * diff.hero.abilityCdMult * cdMult;
    hero.upgradeDmgMult = dmgMult;
    hero.upgradeRateMult = rateMult;
    hero.chainMult = chainMult;
  }
}

export function removeWaveUpgrades() {
  state.activeUpgrades = { eliott: [], dick: [], habib: [] };
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  for (const hero of state.units) {
    if (!hero) continue;
    const def = HERO_DEFS[hero.type];
    hero.speed = 78;
    hero.abilityMaxCd = (def?.abilityMaxCd || 6) * diff.hero.abilityCdMult;
    hero.upgradeDmgMult = 1;
    hero.upgradeRateMult = 1;
    hero.chainMult = 1;
    // Clear per-wave passive flags
    hero.residualHaze = false;
    hero.extendedFormula = false;
    hero.smokescreen = false;
    hero.backdoorArmorFire = false;
    hero.backdoorArmorLightning = false;
    hero.backdoorArmorSpikes = false;
    hero.densePlating = 0;
    hero._maxHpBonusApplied = 0;
  }
}

// Tick active skill durability at wave end; expire dead ones.
export function tickActiveSkillDurability() {
  for (const hero of state.units) {
    if (!hero) continue;
    hero.tickSkillDurability();
  }
}

// Returns how many active skill slots a hero has filled.
export function activeSkillCount(heroType) {
  const unit = state.units.find(u => u.type === heroType);
  if (!unit) return 0;
  return unit.activeSkillSlots.filter(Boolean).length;
}
