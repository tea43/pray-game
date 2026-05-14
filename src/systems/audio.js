const MANIFEST_URL = './assets/audio/manifest.json';

let audioCtx = null;
let musicVolume = 0.5;
let sfxVolume = 0.5;
let musicEl = null;
let musicBufferNode = null;
let currentMusic = null;
let initialized = false;
let manifestLoaded = false;
let manifestLoadPromise = null;

const audioManifest = { music: {}, sfx: {} };
const buffers = { music: {}, sfx: {} };
const cooldowns = new Map();
const manifestJsonPromise = preloadManifestJson();

export const audioState = {
  muted: false,
  musicVolume: 0.5,
  sfxVolume: 0.5
};

export function isAudioInitialized() {
  return initialized;
}

const SFX_ALIASES = {
  hit: 'alien.hit.default',
  shoot: 'weapon.throw.default',
  death: 'synthetic.death',
  boss_spawn: null,
  explosion: null,
  loot: 'synthetic.loot',
  wave: 'synthetic.wave',
};

const SYNTHETIC_ALIASES = {
  'synthetic.hit': 'hit',
  'synthetic.shoot': 'shoot',
  'synthetic.death': 'death',
  'synthetic.boss_move': null,
  'synthetic.boss_charge': null,
  'synthetic.boss_spawn': null,
  'synthetic.explosion': null,
  'synthetic.loot': 'loot',
  'synthetic.wave': 'wave',
  'synthetic.ability': 'ability'
};

async function preloadManifestJson() {
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Missing audio manifest: ${MANIFEST_URL}`);
    const manifest = await response.json();
    audioManifest.music = manifest.music || {};
    audioManifest.sfx = manifest.sfx || {};
    manifestLoaded = true;
    if (currentMusic && !musicEl) playMusic(currentMusic);
    return manifest;
  } catch (e) {
    manifestLoaded = true;
    console.warn('Audio manifest preload failed; synthetic fallbacks remain available.', e);
    return null;
  }
}

export function initAudio() {
  if (initialized) return;

  try {
    const savedMusic = localStorage.getItem('pray_music_volume');
    if (savedMusic !== null) {
      audioState.musicVolume = parseFloat(savedMusic);
      musicVolume = audioState.musicVolume;
    }

    const savedSfx = localStorage.getItem('pray_sfx_volume');
    if (savedSfx !== null) {
      audioState.sfxVolume = parseFloat(savedSfx);
      sfxVolume = audioState.sfxVolume;
    }

    const savedMute = localStorage.getItem('pray_muted');
    if (savedMute !== null) {
      audioState.muted = savedMute === 'true';
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    // Some browsers suspend the context even with a user gesture; resume immediately.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    manifestLoadPromise = loadAudioManifest();
    initialized = true;
  } catch (e) {
    console.warn('Audio initialization failed or not supported:', e);
  }
}

async function loadAudioManifest() {
  if (!audioCtx) return;

  try {
    const manifest = await manifestJsonPromise;
    if (!manifest) return;
    await loadSection('sfx', audioManifest.sfx);
  } catch (e) {
    manifestLoaded = true;
    console.warn('Audio manifest load failed; synthetic fallbacks remain available.', e);
  }
}

async function loadSection(sectionName, section) {
  await Promise.all(Object.entries(section).map(async ([id, entry]) => {
    const variants = Array.isArray(entry.variants) ? entry.variants : [];
    const decoded = [];

    await Promise.all(variants.map(async url => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Missing audio: ${url}`);
        const data = await response.arrayBuffer();
        decoded.push(await audioCtx.decodeAudioData(data));
      } catch {
        // Missing or undecodable files are treated the same as absent optional assets.
      }
    }));

    buffers[sectionName][id] = decoded;
  }));
}

function ensureAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function setMusicVolume(vol) {
  audioState.musicVolume = Math.max(0, Math.min(1, vol));
  musicVolume = audioState.musicVolume;
  localStorage.setItem('pray_music_volume', musicVolume.toString());

  if (musicEl) {
    musicEl.volume = audioState.muted ? 0 : musicVolume * (musicEl.dataset.volume ?? 0.4);
  }
  if (musicBufferNode) {
    musicBufferNode.gain.gain.value = audioState.muted ? 0 : musicVolume * (musicBufferNode.volume ?? 0.4);
  }
}

export function setSfxVolume(vol) {
  audioState.sfxVolume = Math.max(0, Math.min(1, vol));
  sfxVolume = audioState.sfxVolume;
  localStorage.setItem('pray_sfx_volume', sfxVolume.toString());
}

export function toggleMute() {
  audioState.muted = !audioState.muted;
  localStorage.setItem('pray_muted', audioState.muted.toString());
  setMusicVolume(audioState.musicVolume);
  return audioState.muted;
}

function playSyntheticSfx(type) {
  if (!audioCtx || audioState.muted || sfxVolume <= 0) return;
  ensureAudioContext();

  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const vol = sfxVolume * 0.3;

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

function resolveSfxId(id) {
  return SFX_ALIASES[id] || id;
}

function getSyntheticType(id, options = {}) {
  if (options.synthetic) return options.synthetic;
  return SYNTHETIC_ALIASES[id] || null;
}

function applyCooldown(id, entry, options = {}) {
  const cooldown = options.cooldown ?? entry?.cooldown ?? 0;
  if (!cooldown || !audioCtx) return false;

  const key = options.cooldownKey || id;
  const now = audioCtx.currentTime;
  const last = cooldowns.get(key) ?? -Infinity;
  if (now - last < cooldown) return true;
  cooldowns.set(key, now);
  return false;
}

export function playSfx(id, options = {}, visited = new Set()) {
  if (!audioCtx || audioState.muted || sfxVolume <= 0) return;
  ensureAudioContext();

  const resolvedId = resolveSfxId(id);
  if (visited.has(resolvedId)) return;
  visited.add(resolvedId);

  if (resolvedId.startsWith('synthetic.')) {
    const syntheticType = getSyntheticType(resolvedId, options);
    if (syntheticType) playSyntheticSfx(syntheticType);
    return;
  }

  const entry = audioManifest.sfx[resolvedId];
  const entryBuffers = buffers.sfx[resolvedId] || [];
  if (applyCooldown(resolvedId, entry, options)) return;

  if (entryBuffers.length > 0) {
    const source = audioCtx.createBufferSource();
    source.buffer = entryBuffers[Math.floor(Math.random() * entryBuffers.length)];

    const pitchJitter = options.pitchJitter ?? entry?.pitchJitter ?? 0;
    if (pitchJitter > 0) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchJitter;
    }

    const gain = audioCtx.createGain();
    gain.gain.value = sfxVolume * (options.volume ?? entry?.volume ?? 1);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
    return createSoundHandle(source, gain);
  }

  const fallback = options.fallback ?? entry?.fallback;
  if (fallback) {
    playSfx(fallback, options, visited);
    return;
  }

  const syntheticType = getSyntheticType(resolvedId, options);
  if (syntheticType) playSyntheticSfx(syntheticType);
}

function createSoundHandle(source, gain) {
  let stopped = false;
  return {
    stop(fade = 0.08) {
      if (stopped || !audioCtx) return;
      stopped = true;
      const t = audioCtx.currentTime;
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + fade);
        source.stop(t + fade + 0.01);
      } catch {}
    }
  };
}

export function playMusic(id) {
  if (audioCtx) ensureAudioContext();

  const requestedId = id === 'combat' ? 'game' : id;
  if (currentMusic === requestedId && ((musicEl && !musicEl.paused) || musicBufferNode)) return;
  currentMusic = requestedId;

  if (!manifestLoaded) return;

  if (musicEl) {
    musicEl.pause();
    musicEl.removeAttribute('src');
    musicEl.load();
    musicEl = null;
  }
  if (musicBufferNode) {
    try { musicBufferNode.source.stop(); } catch {}
    musicBufferNode = null;
  }

  const entry = audioManifest.music[requestedId];
  const variants = Array.isArray(entry?.variants) ? entry.variants : [];
  if (variants.length > 0) {
    const url = variants[Math.floor(Math.random() * variants.length)];
    const volume = entry?.volume ?? 0.4;
    const audio = new Audio(url);
    audio.loop = entry?.loop !== false;
    audio.preload = 'auto';
    audio.dataset.volume = String(volume);
    audio.volume = audioState.muted ? 0 : musicVolume * volume;
    musicEl = audio;
    audio.play().catch(() => {
      if (initialized) {
        musicEl = null;
        playBufferedMusic(requestedId, url, entry);
      }
      // else: musicEl stays set but paused; playMusic() will retry it on first user gesture
    });
  } else if (entry?.fallback && entry.fallback !== id && entry.fallback !== requestedId) {
    playMusic(entry.fallback);
  }
}

async function playBufferedMusic(id, url, entry) {
  if (!audioCtx || audioState.muted || musicVolume <= 0) return;
  ensureAudioContext();

  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(data);
    if (currentMusic !== id || musicBufferNode) return;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = entry?.loop !== false;

    const gain = audioCtx.createGain();
    const volume = entry?.volume ?? 0.4;
    gain.gain.value = musicVolume * volume;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
    musicBufferNode = { source, gain, volume };
  } catch {
    // Optional music remains optional.
  }
}
