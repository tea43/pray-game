import { state } from '../state.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { initAudio, isAudioInitialized, playMusic, playSfx, setMusicVolume, setSfxVolume, toggleMute, audioState } from './audio.js';

let _newGame = null;
let _startGame = null;

export function setMenuCallbacks(startGameFn, newGameFn) {
  _startGame = startGameFn;
  _newGame = newGameFn;
}

// ── screen helpers ────────────────────────────────────────────────────────────

function showTitleScreen() {
  document.getElementById('titleScreen').style.display      = '';
  document.getElementById('difficultyScreen').classList.remove('active');
  document.getElementById('settingsScreen').classList.remove('active');
}

function unlockMenuAudio() {
  // Whichever listener fires first (pointerdown or keydown), remove the other
  // so a key press during gameplay never re-triggers this.
  document.removeEventListener('pointerdown', unlockMenuAudio, { capture: true });
  document.removeEventListener('keydown',     unlockMenuAudio, { capture: true });

  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.add('hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
  const wasInitialized = isAudioInitialized();
  initAudio();
  playMusic('menu');
  if (wasInitialized) playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
}

function showDifficultyScreen() {
  document.getElementById('titleScreen').style.display      = 'none';
  document.getElementById('difficultyScreen').classList.add('active');
  document.getElementById('settingsScreen').classList.remove('active');
}

function showSettingsScreen() {
  document.getElementById('titleScreen').style.display      = 'none';
  document.getElementById('difficultyScreen').classList.remove('active');
  document.getElementById('settingsScreen').classList.add('active');
  syncSettingsUI();
  updateAudioUI();
}

function syncSettingsUI() {
  const on = !state.settings.noShake;
  const onL = !state.settings.noLightning;
  for (const id of ['toggleShake', 'pauseToggleShake']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.textContent = on ? 'ON' : 'OFF';
    btn.classList.toggle('on', on);
  }
  for (const id of ['toggleLightning', 'pauseToggleLightning']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.textContent = onL ? 'ON' : 'OFF';
    btn.classList.toggle('on', onL);
  }
}

function saveSettings() {
  try { localStorage.setItem('praySettings', JSON.stringify(state.settings)); } catch {}
}

// ── public API ────────────────────────────────────────────────────────────────

export function showMainMenu() {
  state.menuPhase = 'main';
  document.getElementById('mainMenu').classList.add('show');
  document.getElementById('pauseMenu').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  playMusic('menu');
  showTitleScreen();
}

export function showPause() {
  if (state.menuPhase !== 'playing' || state.gameOver) return;
  state.menuPhase = 'paused';
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  document.getElementById('pauseDiffLabel').textContent = diff.label;
  document.getElementById('pauseMenu').classList.add('show');
  
  // Update Audio and Settings UI state
  initAudio();
  updateAudioUI();
  syncSettingsUI();
}

export function hidePause() {
  if (state.menuPhase !== 'paused') return;
  state.menuPhase = 'playing';
  document.getElementById('pauseMenu').classList.remove('show');
}

// ── init ──────────────────────────────────────────────────────────────────────

export function initMenu() {
  // Capture on document so the very first mouse/touch/key press unlocks audio,
  // regardless of which element the user interacts with first.
  document.addEventListener('pointerdown', unlockMenuAudio, { once: true, capture: true });
  document.addEventListener('keydown',     unlockMenuAudio, { once: true, capture: true });

  // Title screen: PLAY → difficulty screen
  document.getElementById('menuPlay').addEventListener('click', () => {
    unlockMenuAudio();
    showDifficultyScreen();
  });

  // Title screen: SETTINGS → settings screen
  document.getElementById('menuSettings').addEventListener('click', () => {
    unlockMenuAudio();
    showSettingsScreen();
  });

  // Settings screen: BACK → title screen
  document.getElementById('settingsBack').addEventListener('click', () => {
    unlockMenuAudio();
    showTitleScreen();
  });

  // Settings toggles
  document.getElementById('toggleShake').addEventListener('click', () => {
    unlockMenuAudio();
    state.settings.noShake = !state.settings.noShake;
    saveSettings();
    syncSettingsUI();
  });
  document.getElementById('toggleLightning').addEventListener('click', () => {
    unlockMenuAudio();
    state.settings.noLightning = !state.settings.noLightning;
    saveSettings();
    syncSettingsUI();
  });

  // Pause menu settings toggles (in-game)
  document.getElementById('pauseToggleShake').addEventListener('click', () => {
    playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
    state.settings.noShake = !state.settings.noShake;
    saveSettings();
    syncSettingsUI();
  });
  document.getElementById('pauseToggleLightning').addEventListener('click', () => {
    playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
    state.settings.noLightning = !state.settings.noLightning;
    saveSettings();
    syncSettingsUI();
  });

  // Difficulty screen: BACK → title screen
  document.getElementById('menuBack').addEventListener('click', () => {
    unlockMenuAudio();
    showTitleScreen();
  });

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      unlockMenuAudio();
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.diff;
    });
  });

  // Difficulty screen: START → begin game
  document.getElementById('menuStart').addEventListener('click', () => {
    unlockMenuAudio();
    document.getElementById('mainMenu').classList.remove('show');
    _startGame && _startGame();
  });

  // Pause menu buttons
  document.getElementById('pauseResume').addEventListener('click', () => {
    playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
    hidePause();
  });
  document.getElementById('pauseRestart').addEventListener('click', () => {
    playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
    document.getElementById('pauseMenu').classList.remove('show');
    state.menuPhase = 'playing';
    _newGame && _newGame();
  });
  document.getElementById('pauseMainMenu').addEventListener('click', () => {
    playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
    showMainMenu();
  });

  // Game over overlay: Main Menu button
  document.getElementById('overlayMainMenu').addEventListener('click', () => {
    playSfx('ui.click', { synthetic: 'loot', volume: 0.35 });
    showMainMenu();
  });

  // ESC: toggle pause
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.menuPhase === 'playing') showPause();
      else if (state.menuPhase === 'paused') hidePause();
    }
  });

  // Show title screen on boot (mainMenu overlay already has class "show" in HTML)
  showTitleScreen();
  playMusic('menu');

  // Audio sliders — menu settings screen
  const menuMusicSlider = document.getElementById('menuMusicSlider');
  const menuSfxSlider   = document.getElementById('menuSfxSlider');
  if (menuMusicSlider) {
    menuMusicSlider.addEventListener('input', (e) => {
      initAudio();
      setMusicVolume(parseFloat(e.target.value));
    });
  }
  if (menuSfxSlider) {
    menuSfxSlider.addEventListener('input', (e) => {
      initAudio();
      setSfxVolume(parseFloat(e.target.value));
    });
  }

  // Audio sliders — pause menu
  const pauseMusicSlider = document.getElementById('pauseMusicSlider');
  const pauseSfxSlider   = document.getElementById('pauseSfxSlider');
  if (pauseMusicSlider) {
    pauseMusicSlider.addEventListener('input', (e) => {
      setMusicVolume(parseFloat(e.target.value));
    });
  }
  if (pauseSfxSlider) {
    pauseSfxSlider.addEventListener('input', (e) => {
      setSfxVolume(parseFloat(e.target.value));
    });
  }
}

export function updateAudioUI() {
  for (const id of ['menuMusicSlider', 'pauseMusicSlider']) {
    const el = document.getElementById(id);
    if (el) el.value = audioState.musicVolume;
  }
  for (const id of ['menuSfxSlider', 'pauseSfxSlider']) {
    const el = document.getElementById(id);
    if (el) el.value = audioState.sfxVolume;
  }
}
