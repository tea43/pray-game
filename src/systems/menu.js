import { state } from '../state.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { initAudio, setVolume, toggleMute, audioState } from './audio.js';

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
}

function showDifficultyScreen() {
  document.getElementById('titleScreen').style.display      = 'none';
  document.getElementById('difficultyScreen').classList.add('active');
}

// ── public API ────────────────────────────────────────────────────────────────

export function showMainMenu() {
  state.menuPhase = 'main';
  document.getElementById('mainMenu').classList.add('show');
  document.getElementById('pauseMenu').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  showTitleScreen();
}

export function showPause() {
  if (state.menuPhase !== 'playing' || state.gameOver) return;
  state.menuPhase = 'paused';
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  document.getElementById('pauseDiffLabel').textContent = diff.label;
  document.getElementById('pauseMenu').classList.add('show');
  
  // Update Audio UI state
  initAudio();
  updateAudioUI();
}

export function hidePause() {
  if (state.menuPhase !== 'paused') return;
  state.menuPhase = 'playing';
  document.getElementById('pauseMenu').classList.remove('show');
}

// ── init ──────────────────────────────────────────────────────────────────────

export function initMenu() {
  // Title screen: PLAY → difficulty screen
  document.getElementById('menuPlay').addEventListener('click', showDifficultyScreen);

  // Difficulty screen: BACK → title screen
  document.getElementById('menuBack').addEventListener('click', showTitleScreen);

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.diff;
    });
  });

  // Difficulty screen: START → begin game
  document.getElementById('menuStart').addEventListener('click', () => {
    initAudio(); // Initialize audio context on first user interaction
    document.getElementById('mainMenu').classList.remove('show');
    _startGame && _startGame();
  });

  // Pause menu buttons
  document.getElementById('pauseResume').addEventListener('click', hidePause);
  document.getElementById('pauseRestart').addEventListener('click', () => {
    document.getElementById('pauseMenu').classList.remove('show');
    state.menuPhase = 'playing';
    _newGame && _newGame();
  });
  document.getElementById('pauseMainMenu').addEventListener('click', showMainMenu);

  // Game over overlay: Main Menu button
  document.getElementById('overlayMainMenu').addEventListener('click', showMainMenu);

  // ESC: toggle pause
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.menuPhase === 'playing') showPause();
      else if (state.menuPhase === 'paused') hidePause();
    }
  });

  // Show title screen on boot (mainMenu overlay already has class "show" in HTML)
  showTitleScreen();

  // Audio controls
  const volSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  
  if (volSlider && muteBtn) {
    // Initial UI state setup will happen when paused (so audioState is loaded)
    volSlider.addEventListener('input', (e) => {
      initAudio();
      setVolume(parseFloat(e.target.value));
      if (audioState.muted && parseFloat(e.target.value) > 0) {
        toggleMute(); // un-mute if user changes volume
        muteBtn.textContent = 'MUTE';
      }
    });

    muteBtn.addEventListener('click', () => {
      initAudio();
      const isMuted = toggleMute();
      muteBtn.textContent = isMuted ? 'UNMUTE' : 'MUTE';
    });
  }
}

export function updateAudioUI() {
  const volSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  if (volSlider && muteBtn) {
    volSlider.value = audioState.volume;
    muteBtn.textContent = audioState.muted ? 'UNMUTE' : 'MUTE';
  }
}
