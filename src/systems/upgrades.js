import { state } from '../state.js';
import { HERO_DEFS } from '../config/heroes.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';

export const GameData = {
  upgrades: { elliot: [], dick: [], habib: [] }
};

export async function loadUpgrades() {
  try {
    const fetchJson = async (url) => {
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    };
    const [eRes, dRes, hRes] = await Promise.all([
      fetchJson('assets/data/upgrades/elliot_upgrades.json').catch(() => []),
      fetchJson('assets/data/upgrades/dick_upgrades.json').catch(() => []),
      fetchJson('assets/data/upgrades/habib_upgrades.json').catch(() => [])
    ]);
    GameData.upgrades.elliot = eRes;
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
  state.activeUpgrades = { elliot: [], dick: [], habib: [] };
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  for (const hero of state.units) {
    if (!hero) continue;
    const def = HERO_DEFS[hero.type];
    hero.speed = 78;
    hero.abilityMaxCd = (def?.abilityMaxCd || 6) * diff.hero.abilityCdMult;
    hero.upgradeDmgMult = 1;
    hero.upgradeRateMult = 1;
    hero.chainMult = 1;
  }
}
