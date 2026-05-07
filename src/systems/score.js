import { state } from '../state.js';

const KILL_POINTS = {
  raider:   10,
  runner:    8,
  ghoul:    20,
  blinker:  30,
  mutant:   40,
  miniboss: 200,
  bigboss:  500,
};

const DEATH_PENALTY   = 50;
const WAVE_BONUS_MULT = 50;
const HS_KEY          = 'pray_highscore';
const HS_KILLS_KEY    = 'pray_highscore_kills';

export function addKillScore(kind) {
  state.score += KILL_POINTS[kind] ?? 10;
}

export function addDeathPenalty() {
  state.score = Math.max(0, state.score - DEATH_PENALTY);
}

export function addWaveClearBonus(wave) {
  state.score += wave * WAVE_BONUS_MULT;
}

export function resetScore() {
  state.score = 0;
}

export function getHighScore() {
  return parseInt(localStorage.getItem(HS_KEY) ?? '0', 10);
}

export function applyDeathPenalties() {
  const deaths = state.heroesDied || 0;
  if (deaths > 0) state.score = Math.floor(state.score / Math.pow(2, deaths));
}

export function saveHighScore() {
  if (state.score > getHighScore()) {
    localStorage.setItem(HS_KEY, String(state.score));
    localStorage.setItem(HS_KILLS_KEY, String(state.kills ?? 0));
  }
}

export function getHighScoreData() {
  return {
    score: parseInt(localStorage.getItem(HS_KEY)       ?? '0', 10),
    kills: parseInt(localStorage.getItem(HS_KILLS_KEY) ?? '0', 10),
  };
}
