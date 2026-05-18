import { state } from '../state.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { pushDamageNumber } from '../render/effects.js';
import { playSfx } from './audio.js';

// ── Combo definitions ────────────────────────────────────────────────────────
// Each key maps hero types to the combo they share (keyed by sorted pair/trio).
// Activation: when all listed heroes are ready AND their keys are held simultaneously
// AND pairwise distance rules are satisfied.

const COMBOS = {
  // Eliott (key 1) + Dick (key 2)
  '1+2': {
    id: 'chochoTrain',
    heroes: ['eliott', 'dick'],
    keys: ['1', '2'],
    label: 'CHOCHO TRAIN',
    minDist: 100,
    maxDist: 500,
    colors: { primary: '#4080ff', secondary: '#ff6040' },
  },
  // Dick (key 2) + Habib (key 3)
  '2+3': {
    id: 'highFive',
    heroes: ['dick', 'habib'],
    keys: ['2', '3'],
    label: 'HIGH FIVE MY BRO',
    minDist: 100,
    maxDist: 500,
    colors: { primary: '#ffe060', secondary: '#80d0ff' },
  },
  // Eliott (key 1) + Habib (key 3)
  '1+3': {
    id: 'vietnamMemories',
    heroes: ['eliott', 'habib'],
    keys: ['1', '3'],
    label: 'VIETNAM MEMORIES',
    minDist: 100,
    maxDist: 500,
    colors: { primary: '#60ff80', secondary: '#ff8030' },
  },
  // All three
  '1+2+3': {
    id: 'triangle',
    heroes: ['eliott', 'dick', 'habib'],
    keys: ['1', '2', '3'],
    label: 'YOU SHOULD STAY IN THE GROUND',
    minDist: 100,
    maxDist: 500, 
    colors: { primary: '#ffe060', secondary: '#a060ff' },
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

// Called from InputSystem on F key press.
// Finds the combo that matches the selected heroes, validates conditions, and fires it.
// Returns true if a combo was launched, false if conditions were not met.
export function tryFireComboForSelection(selected) {
  if (state.groupAbility) return false;

  const alive = (selected || []).filter(u => !u.dead);
  if (alive.length < 2) return false;

  const selectedTypes = alive.map(u => u.type).sort().join(',');

  for (const def of Object.values(COMBOS)) {
    if ([...def.heroes].sort().join(',') !== selectedTypes) continue;

    const participants = def.heroes.map(type => alive.find(u => u.type === type));
    if (participants.some(u => !u)) continue;
    if (!participants.every(u => u.superboostCharge >= 1)) return false;
    if (!_checkDistance(def, participants)) return false;

    _startCombo(def.id, participants, def);
    return true;
  }
  return false;
}

// Main update — called each frame from GameScene with gameDt (scaled) and realDt.
export function updateGroupAbility(gameDt, realDt) {
  const ga = state.groupAbility;
  if (!ga) return;

  ga.phaseTimer -= realDt;

  switch (ga.id) {
    case 'chochoTrain':   _updateChochoTrain(ga, gameDt, realDt); break;
    case 'highFive':      _updateHighFive(ga, gameDt, realDt); break;
    case 'vietnamMemories': _updateVietnam(ga, gameDt, realDt); break;
    case 'triangle':      _updateTriangle(ga, gameDt, realDt); break;
  }
}

// Renderer — called from GameScene._draw() while camera transform is active (world space).
export function renderGroupAbility(ctx) {
  // "Ready" indicator: when selected heroes have a valid combo available, show a
  // pulsing link between them so the player knows F will fire.
  if (!state.groupAbility) {
    _renderReadyIndicator(ctx);
    return;
  }

  const ga = state.groupAbility;
  ctx.save();
  switch (ga.id) {
    case 'chochoTrain':     _renderChochoTrain(ctx, ga); break;
    case 'highFive':        _renderHighFive(ctx, ga); break;
    case 'vietnamMemories': _renderVietnam(ctx, ga); break;
    case 'triangle':        _renderTriangle(ctx, ga); break;
  }
  ctx.restore();
}

function _renderReadyIndicator(ctx) {
  const alive = (state.selected || []).filter(u => !u.dead);
  if (alive.length < 2) return;

  const selectedTypes = alive.map(u => u.type).sort().join(',');
  let matchDef = null;
  for (const def of Object.values(COMBOS)) {
    if ([...def.heroes].sort().join(',') === selectedTypes) { matchDef = def; break; }
  }
  if (!matchDef) return;

  // Check all conditions quietly — only render if fully ready
  const participants = matchDef.heroes.map(type => alive.find(u => u.type === type));
  if (participants.some(u => !u)) return;
  if (!participants.every(u => u.superboostCharge >= 1)) return;
  if (!_checkDistance(matchDef, participants)) return;

  // Draw a soft pulsing link to signal "press F"
  const pulse = 0.55 + 0.45 * Math.sin(state.time * 5);
  ctx.save();
  ctx.globalAlpha = 0.35 * pulse;
  ctx.strokeStyle = matchDef.colors.primary;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(participants[0].x, participants[0].y);
  for (let i = 1; i < participants.length; i++) ctx.lineTo(participants[i].x, participants[i].y);
  if (participants.length > 2) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Small pulse ring on each hero
  for (const u of participants) {
    ctx.globalAlpha = 0.5 * pulse;
    ctx.strokeStyle = matchDef.colors.primary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // "F" label above midpoint
  const mx = participants.reduce((s, u) => s + u.x, 0) / participants.length;
  const my = Math.min(...participants.map(u => u.y)) - 22;
  ctx.globalAlpha = 0.7 * pulse;
  _renderLabel(ctx, '[F] ' + matchDef.label, mx, my, matchDef.colors.primary);
  ctx.restore();
}

// ── Combo: Chocho Train ──────────────────────────────────────────────────────
// Eliott (anchor) + Dick (rusher)
// Phase 'tether' (0.35s): freeze both, draw line, slow-mo
// Phase 'rush'   (0.55s): Dick lerps to Eliott, damage along path
// Phase 'burst'  (0.25s): explosion at Eliott, knockback

function _startChochoTrain(participants, def) {
  const [eliott, dick] = participants;
  state.groupAbility = {
    id: 'chochoTrain',
    phase: 'tether',
    phaseTimer: 0.35,
    participants,
    def,
    // Snap target position at start
    targetX: eliott.x, targetY: eliott.y,
    rushStartX: dick.x, rushStartY: dick.y,
    rushProgress: 0,
    tetherPulse: 0,
    burstDone: false,
  };
  state.cinematicSlowdown = 0.3;
  _makeImmortal(participants);
  _freezeParticipants(participants);
  _flashScreen('#4080ff', 0.15);
  playSfx('combo.chocho_train');
}

function _updateChochoTrain(ga, gameDt, realDt) {
  const [eliott, dick] = ga.participants;
  ga.tetherPulse += realDt * 6;

  if (ga.phase === 'tether') {
    if (ga.phaseTimer <= 0) {
      ga.phase = 'rush';
      ga.phaseTimer = 0.55;
      ga.rushProgress = 0;
      state.cinematicSlowdown = 0.4;
      // Sparks from Dick
      _burst(dick.x, dick.y, 18, '#4080ff', '#80b0ff');
    }
    return;
  }

  if (ga.phase === 'rush') {
    const t = 1 - Math.max(0, ga.phaseTimer) / 0.55;
    ga.rushProgress = t;
    dick.x = ga.rushStartX + (ga.targetX - ga.rushStartX) * t;
    dick.y = ga.rushStartY + (ga.targetY - ga.rushStartY) * t;
    dick.tx = dick.x; dick.ty = dick.y;
    // Trail
    if (Math.random() < realDt * 30) {
      state.particles.push({ x: dick.x + rand(-4,4), y: dick.y + rand(-4,4), vx: rand(-30,30), vy: rand(-40,-10), life: rand(0.2,0.5), maxLife:0.5, color: '#6090ff', size: rand(2,4), realtime:true });
      state.particles.push({ x: dick.x + rand(-4,4), y: dick.y + rand(-4,4), vx: rand(-20,20), vy: rand(-20, 10), life: rand(0.15,0.4), maxLife:0.4, color: '#ffcc80', size: rand(1,3), realtime:true });
    }
    // Damage enemies near Dick
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(dick.x, dick.y, e.x, e.y) < 45) {
        const dmg = Math.round(50 + rand(-10, 10));
        e.hp -= dmg;
        e.hurtFlash = 1;
        const ang = Math.atan2(e.y - dick.y, e.x - dick.x);
        e.knockX += Math.cos(ang) * 120;
        e.knockY += Math.sin(ang) * 120;
        pushDamageNumber(e.x, e.y - e.r - 4, dmg, { rgb: [100, 150, 255] });
        _burst(e.x, e.y, 6, '#4080ff', '#80b0ff');
      }
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'burst';
      ga.phaseTimer = 0.25;
      state.cinematicSlowdown = 0;
      _arrivedBurst(ga.targetX, ga.targetY, 80, 60);
    }
    return;
  }

  if (ga.phase === 'burst') {
    if (ga.phaseTimer <= 0) _endCombo(ga);
    return;
  }
}

function _renderChochoTrain(ctx, ga) {
  const [eliott, dick] = ga.participants;
  if (ga.phase === 'tether' || ga.phase === 'rush') {
    const pulse = 0.5 + 0.5 * Math.sin(ga.tetherPulse);
    ctx.globalAlpha = (ga.phase === 'tether' ? 0.7 : 0.4) * pulse;
    ctx.strokeStyle = '#4080ff';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(dick.x, dick.y);
    ctx.lineTo(ga.targetX, ga.targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  _renderLabel(ctx, ga.def.label, (dick.x + ga.targetX) / 2, Math.min(dick.y, ga.targetY) - 24, '#80a0ff');
}

// ── Combo: High Five My Bro ──────────────────────────────────────────────────
// Dick + Habib
// Phase 'charge_up' (0.35s): electric arcs, midpoint marker
// Phase 'rush'      (0.5s):  both lerp to midpoint
// Phase 'nova'      (0.3s):  electrical nova at midpoint

function _startHighFive(participants, def) {
  const [dick, habib] = participants;
  const midX = (dick.x + habib.x) / 2;
  const midY = (dick.y + habib.y) / 2;
  state.groupAbility = {
    id: 'highFive',
    phase: 'charge_up',
    phaseTimer: 0.35,
    participants,
    def,
    midX, midY,
    dickStartX: dick.x, dickStartY: dick.y,
    habibStartX: habib.x, habibStartY: habib.y,
    tetherPulse: 0,
    novaDone: false,
  };
  state.cinematicSlowdown = 0.3;
  _makeImmortal(participants);
  _freezeParticipants(participants);
  _flashScreen('#ffe060', 0.15);
  playSfx('combo.high_five');
}

function _updateHighFive(ga, gameDt, realDt) {
  const [dick, habib] = ga.participants;
  ga.tetherPulse += realDt * 8;

  if (ga.phase === 'charge_up') {
    // Spark particles building between them
    if (Math.random() < realDt * 12) {
      const t = Math.random();
      const px = dick.x + (habib.x - dick.x) * t + rand(-6, 6);
      const py = dick.y + (habib.y - dick.y) * t + rand(-6, 6);
      state.particles.push({ x: px, y: py, vx: rand(-40,40), vy: rand(-50,-5), life: rand(0.1,0.3), maxLife:0.3, color: '#ffe060', size: rand(1.5,3), realtime:true, additive:true });
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'rush';
      ga.phaseTimer = 0.5;
      state.cinematicSlowdown = 0.4;
      _burst(dick.x, dick.y, 10, '#ffe060', '#fff0a0');
      _burst(habib.x, habib.y, 10, '#ffe060', '#fff0a0');
    }
    return;
  }

  if (ga.phase === 'rush') {
    const t = 1 - Math.max(0, ga.phaseTimer) / 0.5;
    dick.x = ga.dickStartX + (ga.midX - ga.dickStartX) * t;
    dick.y = ga.dickStartY + (ga.midY - ga.dickStartY) * t;
    dick.tx = dick.x; dick.ty = dick.y;
    habib.x = ga.habibStartX + (ga.midX - ga.habibStartX) * t;
    habib.y = ga.habibStartY + (ga.midY - ga.habibStartY) * t;
    habib.tx = habib.x; habib.ty = habib.y;
    // Trails
    if (Math.random() < realDt * 25) {
      state.particles.push({ x: dick.x, y: dick.y, vx: rand(-20,20), vy: rand(-30,10), life: rand(0.2,0.4), maxLife:0.4, color: '#ff8030', size: rand(2,4), realtime:true });
      state.particles.push({ x: habib.x, y: habib.y, vx: rand(-20,20), vy: rand(-30,10), life: rand(0.2,0.4), maxLife:0.4, color: '#c8a0ff', size: rand(2,4), realtime:true });
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'nova';
      ga.phaseTimer = 0.3;
      state.cinematicSlowdown = 0;
      state.hitStop = Math.max(state.hitStop, 0.07);
      _electricNova(ga.midX, ga.midY, 110, 80, 2.0);
      _flashScreen('#ffe060', 0.35);
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 10);
    }
    return;
  }

  if (ga.phase === 'nova') {
    if (ga.phaseTimer <= 0) _endCombo(ga);
    return;
  }
}

function _renderHighFive(ctx, ga) {
  const [dick, habib] = ga.participants;
  if (ga.phase === 'charge_up') {
    // Midpoint marker
    const pulse = 0.5 + 0.5 * Math.sin(ga.tetherPulse * 1.5);
    ctx.globalAlpha = 0.5 + 0.3 * pulse;
    ctx.beginPath();
    ctx.arc(ga.midX, ga.midY, 10 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffe060';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Arc between them
    ctx.globalAlpha = (0.4 + 0.4 * pulse);
    ctx.strokeStyle = '#ffe060';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(dick.x, dick.y);
    ctx.lineTo(habib.x, habib.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  _renderLabel(ctx, ga.def.label, ga.midX, Math.min(dick.y, habib.y) - 24, '#ffe080');
}

// ── Combo: Vietnam Memories ──────────────────────────────────────────────────
// Eliott (anchor/puller) + Habib (pulled)
// Phase 'build' (0.35s): green pull energy from Eliott to Habib
// Phase 'pull'  (0.6s):  Habib moves toward Eliott, fire lane ignites
// Phase 'burn'  (0.4s):  fire lingers, burst at Eliott

function _startVietnam(participants, def) {
  const [eliott, habib] = participants;
  state.groupAbility = {
    id: 'vietnamMemories',
    phase: 'build',
    phaseTimer: 0.35,
    participants,
    def,
    targetX: eliott.x, targetY: eliott.y,
    habibStartX: habib.x, habibStartY: habib.y,
    tetherPulse: 0,
    fireEmitTimer: 0,
    burntLane: [],  // { x, y, life, maxLife } fire patches
  };
  state.cinematicSlowdown = 0.3;
  _makeImmortal(participants);
  _freezeParticipants(participants);
  _flashScreen('#60ff80', 0.15);
  playSfx('combo.vietnam_memories');
}

function _updateVietnam(ga, gameDt, realDt) {
  const [eliott, habib] = ga.participants;
  ga.tetherPulse += realDt * 6;

  // Tick existing fire patches
  for (const f of ga.burntLane) f.life -= realDt;
  ga.burntLane = ga.burntLane.filter(f => f.life > 0);

  if (ga.phase === 'build') {
    if (Math.random() < realDt * 10) {
      const t = Math.random();
      state.particles.push({ x: eliott.x + (habib.x - eliott.x)*t, y: eliott.y + (habib.y - eliott.y)*t, vx: rand(-20,20), vy: rand(-40,-5), life: rand(0.15,0.35), maxLife:0.35, color: '#60ff80', size: rand(2,4), realtime:true, additive:true });
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'pull';
      ga.phaseTimer = 0.6;
      state.cinematicSlowdown = 0.4;
      _burst(habib.x, habib.y, 12, '#60ff80', '#ffb040');
    }
    return;
  }

  if (ga.phase === 'pull') {
    const t = 1 - Math.max(0, ga.phaseTimer) / 0.6;
    habib.x = ga.habibStartX + (ga.targetX - ga.habibStartX) * t;
    habib.y = ga.habibStartY + (ga.targetY - ga.habibStartY) * t;
    habib.tx = habib.x; habib.ty = habib.y;

    // Fire lane particles along path
    if (Math.random() < realDt * 30) {
      const t2 = Math.random();
      const fx = ga.habibStartX + (ga.targetX - ga.habibStartX) * t2 + rand(-12,12);
      const fy = ga.habibStartY + (ga.targetY - ga.habibStartY) * t2 + rand(-12,12);
      state.particles.push({ x: fx, y: fy, vx: rand(-15,15), vy: rand(-60,-10), life: rand(0.3,0.7), maxLife:0.7, color: '#ff8030', size: rand(3,7), realtime:true });
      state.particles.push({ x: fx, y: fy, vx: rand(-10,10), vy: rand(-30,-5), life: rand(0.2,0.45), maxLife:0.45, color: '#ffe060', size: rand(1.5,3), realtime:true, additive:true });
    }
    // Damage enemies in fire lane
    for (const e of state.enemies) {
      if (e.dead) continue;
      const ex = e.x, ey = e.y;
      // Distance to line segment
      const dx = ga.targetX - ga.habibStartX, dy = ga.targetY - ga.habibStartY;
      const len2 = dx*dx + dy*dy;
      const tt = len2 > 0 ? clamp(((ex - ga.habibStartX)*dx + (ey - ga.habibStartY)*dy) / len2, 0, 1) : 0;
      const closestX = ga.habibStartX + tt*dx, closestY = ga.habibStartY + tt*dy;
      if (Math.hypot(ex - closestX, ey - closestY) < 28) {
        const dmg = Math.round(18 * realDt * 30); // ~18 dmg per second sustained
        if (dmg > 0) {
          e.hp -= dmg;
          e.hurtFlash = Math.max(e.hurtFlash, 0.3);
        }
      }
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'burn';
      ga.phaseTimer = 0.4;
      state.cinematicSlowdown = 0;
      _arrivedBurst(ga.targetX, ga.targetY, 60, 40);
      _flashScreen('#ff8030', 0.2);
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 6);
    }
    return;
  }

  if (ga.phase === 'burn') {
    if (ga.phaseTimer <= 0) _endCombo(ga);
    return;
  }
}

function _renderVietnam(ctx, ga) {
  const [eliott, habib] = ga.participants;
  const pulse = 0.5 + 0.5 * Math.sin(ga.tetherPulse);

  if (ga.phase === 'build') {
    ctx.globalAlpha = 0.5 + 0.3 * pulse;
    ctx.strokeStyle = '#60ff80';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(eliott.x, eliott.y);
    ctx.lineTo(habib.x, habib.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  if (ga.phase === 'pull' || ga.phase === 'burn') {
    // Draw fire lane
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const fx = ga.habibStartX + (ga.targetX - ga.habibStartX) * t;
      const fy = ga.habibStartY + (ga.targetY - ga.habibStartY) * t;
      ctx.globalAlpha = (0.15 + 0.1 * pulse) * (ga.phase === 'burn' ? ga.phaseTimer / 0.4 : 1);
      ctx.fillStyle = '#ff6010';
      ctx.beginPath();
      ctx.arc(fx, fy, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  _renderLabel(ctx, ga.def.label, (eliott.x + habib.x) / 2, Math.min(eliott.y, habib.y) - 24, '#60ff80');
}

// ── Combo: You Should Stay In The Ground ────────────────────────────────────
// All 3 heroes
// Phase 'triangle' (0.5s): electric triangle, stun enemies inside
// Phase 'pull'     (0.5s): enemies inside pulled to centroid
// Phase 'slam'     (0.4s): Dick leaps to centroid, colossal damage
// Phase 'blink'    (0.3s): Eliott + Habib blink to centroid

function _startTriangle(participants, def) {
  const [eliott, dick, habib] = participants;
  const cx = (eliott.x + dick.x + habib.x) / 3;
  const cy = (eliott.y + dick.y + habib.y) / 3;
  state.groupAbility = {
    id: 'triangle',
    phase: 'triangle',
    phaseTimer: 0.5,
    participants,
    def,
    cx, cy,
    dickStartX: dick.x, dickStartY: dick.y,
    tetherPulse: 0,
    stunned: new Set(),
  };
  state.cinematicSlowdown = 0.25;
  _makeImmortal(participants, 2.5);
  _freezeParticipants(participants);
  _flashScreen('#ffe060', 0.2);
  playSfx('combo.stay_in_ground');

  // Immediately stun enemies inside triangle
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (_inTriangle(e.x, e.y, eliott, dick, habib)) {
      e.stunTimer = Math.max(e.stunTimer, 3.5);
      e.hurtFlash = 1;
    }
  }
}

function _updateTriangle(ga, gameDt, realDt) {
  const [eliott, dick, habib] = ga.participants;
  ga.tetherPulse += realDt * 8;

  if (ga.phase === 'triangle') {
    // Electric edge particles
    if (Math.random() < realDt * 20) {
      const pairs = [[eliott, dick], [dick, habib], [habib, eliott]];
      const [a, b] = pairs[Math.floor(Math.random() * 3)];
      const t = Math.random();
      state.particles.push({ x: a.x + (b.x - a.x)*t + rand(-4,4), y: a.y + (b.y - a.y)*t + rand(-4,4), vx: rand(-30,30), vy: rand(-40,-5), life: rand(0.1,0.3), maxLife:0.3, color: '#ffe060', size: rand(1.5,3), realtime:true, additive:true });
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'pull';
      ga.phaseTimer = 0.5;
      state.cinematicSlowdown = 0.35;
    }
    return;
  }

  if (ga.phase === 'pull') {
    // Pull enemies inside triangle toward centroid
    for (const e of state.enemies) {
      if (e.dead || !_inTriangle(e.x, e.y, eliott, dick, habib)) continue;
      const ang = Math.atan2(ga.cy - e.y, ga.cx - e.x);
      const pullF = 240 * realDt;
      e.x += Math.cos(ang) * pullF; e.y += Math.sin(ang) * pullF;
      e.knockX = 0; e.knockY = 0;
      if (Math.random() < realDt * 10) {
        state.particles.push({ x: e.x, y: e.y, vx: rand(-20,20), vy: rand(-30,0), life: rand(0.1,0.25), maxLife:0.25, color: '#ffe060', size: rand(1,2), realtime:true });
      }
    }
    if (ga.phaseTimer <= 0) {
      ga.phase = 'slam';
      ga.phaseTimer = 0.4;
      state.cinematicSlowdown = 0;
      state.hitStop = Math.max(state.hitStop, 0.09);
      // Dick leaps to centroid
      dick.x = ga.cx; dick.y = ga.cy;
      dick.tx = ga.cx; dick.ty = ga.cy;
      dick.vz = 220; dick.z = 0;
      _colossalSlam(ga.cx, ga.cy, 130, 130);
      _flashScreen('#ffe060', 0.45);
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 14);
    }
    return;
  }

  if (ga.phase === 'slam') {
    if (ga.phaseTimer <= 0) {
      ga.phase = 'blink';
      ga.phaseTimer = 0.3;
      // Eliott and Habib blink in
      eliott.x = ga.cx + rand(-18,18); eliott.y = ga.cy + rand(-18,18);
      eliott.tx = eliott.x; eliott.ty = eliott.y;
      eliott.blinkFlash = 1;
      habib.x  = ga.cx + rand(-18,18); habib.y  = ga.cy + rand(-18,18);
      habib.tx = habib.x; habib.ty = habib.y;
      habib.blinkFlash = 1;
      _burst(ga.cx, ga.cy, 22, '#a060ff', '#ffe060');
      playSfx('ability.blink');
    }
    return;
  }

  if (ga.phase === 'blink') {
    if (ga.phaseTimer <= 0) _endCombo(ga);
    return;
  }
}

function _renderTriangle(ctx, ga) {
  const [eliott, dick, habib] = ga.participants;
  const pulse = 0.5 + 0.5 * Math.sin(ga.tetherPulse);
  const alpha = ga.phase === 'slam' || ga.phase === 'blink' ? 0 : (0.45 + 0.3 * pulse);

  if (alpha > 0) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffe060';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(eliott.x, eliott.y);
    ctx.lineTo(dick.x, dick.y);
    ctx.lineTo(habib.x, habib.y);
    ctx.closePath();
    ctx.stroke();
    // Fill with faint gold
    ctx.fillStyle = '#ffe060';
    ctx.globalAlpha = 0.04 + 0.03 * pulse;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  _renderLabel(ctx, ga.def.label, ga.cx, Math.min(eliott.y, dick.y, habib.y) - 28, '#ffe080');
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

function _startCombo(id, participants, def) {
  // Consume charge for all participants
  for (const u of participants) u.superboostCharge = 0;
  // In ability test mode: immediately refill (restored after combo ends)
  switch (id) {
    case 'chochoTrain':     _startChochoTrain(participants, def); break;
    case 'highFive':        _startHighFive(participants, def); break;
    case 'vietnamMemories': _startVietnam(participants, def); break;
    case 'triangle':        _startTriangle(participants, def); break;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _checkDistance(def, participants) {
  for (let i = 0; i < participants.length - 1; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const d = Math.hypot(participants[i].x - participants[j].x, participants[i].y - participants[j].y);
      if (d < def.minDist || d > def.maxDist) return false;
    }
  }
  return true;
}

function _makeImmortal(participants, secs = 1.5) {
  for (const u of participants) u.immortalTimer = Math.max(u.immortalTimer, secs);
}

function _freezeParticipants(participants) {
  for (const u of participants) {
    u.tx = u.x; u.ty = u.y;
  }
}

function _endCombo(ga) {
  state.groupAbility = null;
  state.cinematicSlowdown = 0;
  // Restore charge in ability-test mode
  if (state.devAbilityTest) {
    for (const u of ga.participants) u.superboostCharge = 1;
  }
}

function _burst(x, y, n, col1, col2) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(60, 160);
    state.particles.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 30, life: rand(0.3,0.7), maxLife:0.7, color: i%2 ? col1 : col2, size: rand(2,4), realtime:true });
  }
}

function _flashScreen(color, alpha) {
  if (!state.settings.noLightning) {
    state.flashAlpha = Math.max(state.flashAlpha, alpha);
    state.flashColor = color;
  }
}

function _arrivedBurst(x, y, radius, dmg) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius) {
      const actualDmg = Math.round(dmg * (1 - d / radius));
      e.hp -= actualDmg;
      e.hurtFlash = 1;
      const ang = Math.atan2(e.y - y, e.x - x);
      e.knockX += Math.cos(ang) * 180;
      e.knockY += Math.sin(ang) * 180;
      pushDamageNumber(e.x, e.y - e.r - 4, actualDmg, { rgb: [100, 150, 255] });
    }
  }
  _burst(x, y, 24, '#80a0ff', '#ffffff');
  if (!state.settings.noShake) state.shake = Math.max(state.shake, 8);
}

function _electricNova(x, y, radius, dmg, stunSecs) {
  const chains = [];
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius) {
      const actualDmg = Math.round(dmg * (1 - d / radius * 0.5));
      e.hp -= actualDmg;
      e.hurtFlash = 1;
      e.stunTimer = Math.max(e.stunTimer, stunSecs);
      const ang = Math.atan2(e.y - y, e.x - x);
      e.knockX += Math.cos(ang) * 160;
      e.knockY += Math.sin(ang) * 160;
      pushDamageNumber(e.x, e.y - e.r - 4, actualDmg, { rgb: [255, 220, 80] });
      chains.push({ x: e.x, y: e.y });
    }
  }
  // Lightning bolts outward
  const pts = [{ x, y }, ...chains.slice(0, 5)];
  if (pts.length > 1) state.bolts.push({ points: pts, life: 0.5, maxLife: 0.5 });
  _burst(x, y, 28, '#ffe060', '#ffffff');
}

function _colossalSlam(x, y, radius, dmg) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius) {
      e.hp -= dmg;
      e.hurtFlash = 1;
      const ang = Math.atan2(e.y - y, e.x - x);
      e.knockX += Math.cos(ang) * 300;
      e.knockY += Math.sin(ang) * 300;
      pushDamageNumber(e.x, e.y - e.r - 4, dmg, { crit: true, rgb: [255, 200, 60] });
    }
  }
  state.shockwaves.push({ x, y, r: 0, speed: radius * 1.4 / 0.5, maxR: radius * 1.4, life: 0.5, maxLife: 0.5, dmg: 0, hit: new Set() });
  _burst(x, y, 34, '#ffe060', '#ffffff');
}

// Point-in-triangle test (uses sign of cross products)
function _inTriangle(px, py, a, b, c) {
  const sign = (p1x, p1y, p2x, p2y, p3x, p3y) =>
    (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
  const d1 = sign(px, py, a.x, a.y, b.x, b.y);
  const d2 = sign(px, py, b.x, b.y, c.x, c.y);
  const d3 = sign(px, py, c.x, c.y, a.x, a.y);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function _renderLabel(ctx, text, x, y, color) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.6;
  ctx.fillText(text, x + 1, y + 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}
