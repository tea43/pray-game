const AUDIO_FILES = {
  // music
  music_menu: '/assets/audio/music_menu.mp3',
  music_combat: '/assets/audio/music_combat.mp3',
  music_boss: '/assets/audio/music_boss.mp3',
  
  // sfx
  sfx_hit: '/assets/audio/hit.mp3',
  sfx_ability_blink: '/assets/audio/blink.mp3',
  sfx_ability_rage: '/assets/audio/rage.mp3',
  sfx_ability_lightning: '/assets/audio/lightning.mp3',
  sfx_shoot: '/assets/audio/shoot.mp3',
  sfx_explosion: '/assets/audio/explosion.mp3',
  sfx_wave: '/assets/audio/wave.mp3',
  sfx_boss_spawn: '/assets/audio/boss_spawn.mp3',
  sfx_loot: '/assets/audio/loot.mp3',
  sfx_death: '/assets/audio/death.mp3'
};

let audioCtx = null;
let masterVolume = 0.5;
let musicNode = null;
let currentMusic = null;
const buffers = {};
let initialized = false;

export const audioState = {
  muted: false,
  volume: 0.5
};

export function initAudio() {
  if (initialized) return;
  
  try {
    const savedVol = localStorage.getItem('pray_volume');
    if (savedVol !== null) {
      audioState.volume = parseFloat(savedVol);
      masterVolume = audioState.volume;
    }
    
    const savedMute = localStorage.getItem('pray_muted');
    if (savedMute !== null) {
      audioState.muted = savedMute === 'true';
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    // Attempt to load files (silently fail if missing)
    for (const [key, url] of Object.entries(AUDIO_FILES)) {
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`Missing audio: ${url}`);
          return response.arrayBuffer();
        })
        .then(data => audioCtx.decodeAudioData(data))
        .then(buffer => { buffers[key] = buffer; })
        .catch(() => { /* silent failure for missing assets */ });
    }
    
    initialized = true;
  } catch (e) {
    console.warn("Audio initialization failed or not supported:", e);
  }
}

function ensureAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function setVolume(vol) {
  audioState.volume = Math.max(0, Math.min(1, vol));
  masterVolume = audioState.volume;
  localStorage.setItem('pray_volume', masterVolume.toString());
  
  if (musicNode) {
    musicNode.gain.value = audioState.muted ? 0 : masterVolume * 0.4;
  }
}

export function toggleMute() {
  audioState.muted = !audioState.muted;
  localStorage.setItem('pray_muted', audioState.muted.toString());
  setVolume(audioState.volume); // apply changes to current playing
  return audioState.muted;
}

// ---- SYNTHETIC FALLBACKS ----

function playSyntheticSfx(type) {
  if (!audioCtx || audioState.muted || masterVolume <= 0) return;
  ensureAudioContext();
  
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const vol = masterVolume * 0.3;

  if (type === 'hit') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  } else if (type === 'shoot') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
    gain.gain.setValueAtTime(vol * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  } else if (type === 'explosion') {
    // Fake noise using a fast changing oscillator
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.4);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.4);
  } else if (type === 'ability') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.2);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  } else if (type === 'wave') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.setValueAtTime(330, t + 0.2);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
    osc.start(t);
    osc.stop(t + 1.0);
  } else if (type === 'boss_spawn') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(40, t + 1.5);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
    osc.start(t);
    osc.stop(t + 1.5);
  } else if (type === 'loot') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(800, t + 0.1);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  } else if (type === 'death') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}

// ---- API ----

export function playSfx(id) {
  if (!audioCtx || audioState.muted || masterVolume <= 0) return;
  ensureAudioContext();
  
  const buffer = buffers['sfx_' + id];
  if (buffer) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = masterVolume;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
  } else {
    // Map id to synthetic fallback
    const synMap = {
      hit: 'hit',
      shoot: 'shoot',
      explosion: 'explosion',
      ability_blink: 'ability',
      ability_rage: 'ability',
      ability_lightning: 'ability',
      wave: 'wave',
      boss_spawn: 'boss_spawn',
      loot: 'loot',
      death: 'death'
    };
    if (synMap[id]) playSyntheticSfx(synMap[id]);
  }
}

export function playMusic(id) {
  if (!audioCtx) return;
  ensureAudioContext();
  
  if (currentMusic === id) return;
  currentMusic = id;
  
  if (musicNode) {
    // Fade out current
    musicNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
    setTimeout(() => {
      if (musicNode && musicNode.source) musicNode.source.stop();
    }, 1000);
  }
  
  const buffer = buffers['music_' + id];
  if (buffer) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.01;
    if (!audioState.muted && masterVolume > 0) {
      gain.gain.linearRampToValueAtTime(masterVolume * 0.4, audioCtx.currentTime + 1);
    }
    
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
    
    musicNode = { source, gain };
  } else {
    // No synthetic music to keep it simple, just silent failure
    musicNode = null;
  }
}
