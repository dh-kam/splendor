// Procedural Web Audio API Renaissance Sound Engine:
// - Lush looping Renaissance chamber BGM sequencer (switchable per theme, smooth fade ON/OFF)
// - Crisp, clearly audible tabletop foley & musical chimes (chip clacks, collects, returns,
//   card selects, buys, reserves, 3D card flips, noble & victory fanfares)
// - Zero external audio assets; auto-unlocks cleanly on first user gesture.

import {
  DEFAULT_SOUND_THEME,
  getSoundTheme,
  getBgmScore,
  clampVolume,
  buildEventNotes,
  getGemPitchRatio,
} from './soundThemes';

const SFX_BUS_BOOST = 3.8; // Calibrates subtle 0.04..0.08 note schedules into crisp audible tabletop foley
const BGM_LOOKAHEAD_MS = 100;
const BGM_SCHEDULE_AHEAD_SEC = 0.28;

let audioCtx = null;
let masterBus = null;
let sfxBus = null;
let bgmBus = null;

let activeThemeId = DEFAULT_SOUND_THEME;
let masterVolume = 0.78;
let bgmVolume = 0.48;
let bgmEnabled = false;
let bgmRunning = false;
let bgmTimerId = null;
let bgmNextStepTime = 0;
let bgmStepIndex = 0;
let unlockListenersAttached = false;
let hasUserGesture = false;

const sfxCounts = {
  chipPick: 0,
  chipCollect: 0,
  chipReturn: 0,
  cardSelect: 0,
  cardBuy: 0,
  cardReserve: 0,
  cardDeal: 0,
  turnBell: 0,
  turnTransition: 0,
  nobleFanfare: 0,
  victoryFanfare: 0,
  countdownTick: 0,
};

function syncDebugHook() {
  if (typeof window === 'undefined') return;
  window.__SPLENDOR_AUDIO__ = {
    contextState: audioCtx ? audioCtx.state : 'uninitialized',
    theme: activeThemeId,
    masterVolume,
    bgmEnabled,
    bgmRunning,
    bgmVolume,
    sfxCounts: { ...sfxCounts },
  };
}

function getAudioEngine() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();

    // Soft studio limiter so overlapping chimes & BGM stay warm and never clip
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
    compressor.knee.setValueAtTime(16, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.14, audioCtx.currentTime);

    masterBus = audioCtx.createGain();
    masterBus.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

    sfxBus = audioCtx.createGain();
    sfxBus.gain.setValueAtTime(SFX_BUS_BOOST, audioCtx.currentTime);

    bgmBus = audioCtx.createGain();
    bgmBus.gain.setValueAtTime(bgmEnabled ? bgmVolume : 0.0001, audioCtx.currentTime);

    sfxBus.connect(masterBus);
    bgmBus.connect(masterBus);
    masterBus.connect(compressor);
    compressor.connect(audioCtx.destination);
  }
  syncDebugHook();
  return { ctx: audioCtx, sfxOut: sfxBus, bgmOut: bgmBus };
}

function withUnlockedAudio(callback) {
  const engine = getAudioEngine();
  if (!engine) return;
  const { ctx } = engine;
  if (ctx.state === 'running') {
    callback(engine);
    return;
  }
  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        syncDebugHook();
        if (ctx.state === 'running') {
          callback(engine);
          if (bgmEnabled && !bgmRunning) {
            startBgmLoop();
          }
        }
      })
      .catch(() => {});
  }
}

export function unlockAudio() {
  hasUserGesture = true;
  const engine = getAudioEngine();
  if (!engine) return;
  const { ctx } = engine;
  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        syncDebugHook();
        if (bgmEnabled && !bgmRunning) {
          startBgmLoop();
        }
      })
      .catch(() => {});
  } else if (ctx.state === 'running' && bgmEnabled && !bgmRunning) {
    startBgmLoop();
  }
}

export function initAudioUnlock() {
  if (typeof window === 'undefined' || unlockListenersAttached) return;
  unlockListenersAttached = true;

  const onFirstGesture = () => {
    unlockAudio();
  };

  window.addEventListener('pointerdown', onFirstGesture, { passive: true });
  window.addEventListener('keydown', onFirstGesture, { passive: true });
  window.addEventListener('touchstart', onFirstGesture, { passive: true });
  syncDebugHook();
}

// =========================================================================
// RENAISSANCE CHAMBER BGM SEQUENCER
// =========================================================================

function scheduleBgmVoice(ctx, dest, { freq, start, dur, peak, wave, lowpassHz, attack = 0.02 }) {
  if (!freq || freq < 40) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = wave || 'triangle';
  osc.frequency.setValueAtTime(freq, start);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(lowpassHz || 1800, start);
  filter.Q.setValueAtTime(0.7, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(start);
  osc.stop(start + dur + 0.03);
}

function tickBgmScheduler() {
  if (!bgmEnabled || !audioCtx || audioCtx.state !== 'running' || !bgmBus) return;
  const score = getBgmScore(activeThemeId);
  const stepSec = score.stepSec || 0.38;

  if (bgmNextStepTime < audioCtx.currentTime - 0.15) {
    bgmNextStepTime = audioCtx.currentTime + 0.05;
  }

  while (bgmNextStepTime < audioCtx.currentTime + BGM_SCHEDULE_AHEAD_SEC) {
    const step = score.steps[bgmStepIndex % score.steps.length];
    const t = bgmNextStepTime;

    if (step.bass) {
      scheduleBgmVoice(audioCtx, bgmBus, {
        freq: step.bass,
        start: t,
        dur: stepSec * 3.6,
        peak: 0.14,
        wave: score.bassWave,
        lowpassHz: 680,
        attack: 0.045,
      });
    }
    if (step.arp) {
      scheduleBgmVoice(audioCtx, bgmBus, {
        freq: step.arp,
        start: t,
        dur: stepSec * 1.45,
        peak: 0.095,
        wave: score.arpWave,
        lowpassHz: score.lowpassHz,
        attack: 0.014,
      });
    }
    if (step.lead) {
      scheduleBgmVoice(audioCtx, bgmBus, {
        freq: step.lead,
        start: t + 0.012,
        dur: stepSec * 1.85,
        peak: 0.11,
        wave: score.leadWave,
        lowpassHz: score.lowpassHz * 1.15,
        attack: 0.018,
      });
      // Soft octave/fifth air shimmer
      scheduleBgmVoice(audioCtx, bgmBus, {
        freq: step.lead * 1.5,
        start: t + 0.02,
        dur: stepSec * 1.1,
        peak: 0.025,
        wave: 'sine',
        lowpassHz: score.lowpassHz * 1.3,
        attack: 0.025,
      });
    }

    bgmNextStepTime += stepSec;
    bgmStepIndex = (bgmStepIndex + 1) % score.steps.length;
  }
}

function startBgmLoop() {
  const engine = getAudioEngine();
  if (!engine || !bgmEnabled) return;
  const { ctx, bgmOut } = engine;
  if (ctx.state !== 'running') return;

  if (!bgmRunning) {
    bgmRunning = true;
    bgmNextStepTime = ctx.currentTime + 0.04;
    if (bgmTimerId) clearInterval(bgmTimerId);
    bgmTimerId = setInterval(tickBgmScheduler, BGM_LOOKAHEAD_MS);
  }

  bgmOut.gain.cancelScheduledValues(ctx.currentTime);
  bgmOut.gain.setTargetAtTime(Math.max(0.0001, bgmVolume), ctx.currentTime, 0.14);
  tickBgmScheduler();
  syncDebugHook();
}

function stopBgmLoop() {
  bgmRunning = false;
  if (bgmTimerId) {
    clearInterval(bgmTimerId);
    bgmTimerId = null;
  }
  if (audioCtx && bgmBus) {
    bgmBus.gain.cancelScheduledValues(audioCtx.currentTime);
    bgmBus.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.08);
  }
  syncDebugHook();
}

export function setBgmEnabled(enabled) {
  bgmEnabled = Boolean(enabled);
  if (bgmEnabled) {
    // Avoid triggering browser autoplay warnings before the first user gesture;
    // unlockAudio() will immediately start BGM on the first pointerdown/keydown/touchstart.
    if (hasUserGesture || audioCtx) {
      const engine = getAudioEngine();
      if (engine) {
        if (engine.ctx.state === 'running') {
          startBgmLoop();
        } else {
          engine.ctx
            .resume()
            .then(() => {
              if (bgmEnabled && engine.ctx.state === 'running') {
                startBgmLoop();
              }
              syncDebugHook();
            })
            .catch(() => {});
        }
      }
    }
  } else {
    stopBgmLoop();
  }
  syncDebugHook();
  return bgmEnabled;
}

export function isBgmEnabled() {
  return bgmEnabled;
}

export function isBgmPlaying() {
  return bgmEnabled && bgmRunning && Boolean(audioCtx && audioCtx.state === 'running');
}

export function setBgmVolume(vol) {
  bgmVolume = clampVolume(vol);
  if (bgmBus && audioCtx && bgmEnabled) {
    bgmBus.gain.setTargetAtTime(Math.max(0.0001, bgmVolume), audioCtx.currentTime, 0.04);
  }
  syncDebugHook();
  return bgmVolume;
}

export function getBgmVolume() {
  return bgmVolume;
}

export function setSoundTheme(themeId) {
  activeThemeId = getSoundTheme(themeId).id;
  syncDebugHook();
  return activeThemeId;
}

export function getActiveSoundTheme() {
  return activeThemeId;
}

export function setMasterVolume(vol) {
  masterVolume = clampVolume(vol);
  if (masterBus && audioCtx) {
    masterBus.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.02);
  }
  syncDebugHook();
  return masterVolume;
}

export function getMasterVolume() {
  return masterVolume;
}

export function getAudioDebugState() {
  return {
    contextState: audioCtx ? audioCtx.state : 'uninitialized',
    theme: activeThemeId,
    masterVolume,
    bgmEnabled,
    bgmRunning,
    bgmVolume,
    sfxCounts: { ...sfxCounts },
  };
}

// =========================================================================
// TACTILE FOLEY & THEMED MUSICAL SFX SYNTHESIS
// =========================================================================

function scheduleNotesOnEngine(engine, notes, volume = 1, themeId = activeThemeId, baseDelay = 0) {
  if (!engine || !notes || notes.length === 0) return;
  const { ctx, sfxOut } = engine;
  const theme = getSoundTheme(themeId);
  const now = ctx.currentTime + baseDelay;
  const volScale = clampVolume(volume) * theme.masterGain;
  if (volScale <= 0.001) return;

  notes.forEach((n) => {
    const start = now + (n.delay || 0);
    const dur = Math.max(0.045, n.dur || 0.2);
    const peak = Math.max(0.001, (n.gain || 0.05) * volScale);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = n.wave || 'triangle';
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.endFreq && n.endFreq > 20) {
      osc.frequency.exponentialRampToValueAtTime(n.endFreq, start + dur * 0.85);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(n.filterHz || theme.lowpassHz, start);
    filter.Q.setValueAtTime(0.9, start);

    const attack = Math.min(0.015, dur * 0.14);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxOut);

    osc.start(start);
    osc.stop(start + dur + 0.03);
  });
}

function scheduleNoiseBurst(engine, {
  volume = 0.65,
  durationSec = 0.07,
  startHz = 1800,
  endHz = 1100,
  q = 1.4,
  delaySec = 0,
}) {
  if (!engine) return;
  const { ctx, sfxOut } = engine;
  const now = ctx.currentTime + delaySec;

  const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    const env = Math.sin((i / bufferSize) * Math.PI);
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(startHz, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, endHz), now + durationSec);
  filter.Q.value = q;

  const gain = ctx.createGain();
  const peak = Math.max(0.001, 0.085 * clampVolume(volume));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.012, durationSec * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxOut);
  noise.start(now);
}

/** Realistic ceramic/clay poker-chip clack transient */
function scheduleClayChipClack(engine, { volume = 0.9, pitchRatio = 1, delaySec = 0, descending = false }) {
  const { ctx, sfxOut } = engine;
  const t = ctx.currentTime + delaySec;
  const v = clampVolume(volume);

  // 1. Crisp ceramic edge snap (filtered noise transient)
  scheduleNoiseBurst(engine, {
    volume: v * 0.72,
    durationSec: 0.026,
    startHz: 3200 * pitchRatio,
    endHz: 1500 * pitchRatio,
    q: 2.6,
    delaySec,
  });

  // 2. Resonant clay chip body clink
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  const startFreq = (descending ? 1320 : 1680) * pitchRatio;
  const endFreq = (descending ? 760 : 1120) * pitchRatio;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.045);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.075 * v, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

  osc.connect(gain);
  gain.connect(sfxOut);
  osc.start(t);
  osc.stop(t + 0.065);
}

/** Tactile linen card snap + velvet placement tap */
function scheduleCardFlipFoley(engine, { volume = 0.85, delaySec = 0 }) {
  const { ctx, sfxOut } = engine;
  const v = clampVolume(volume);

  // 1. Crisp card edge flick / rising air whoosh as it flips
  scheduleNoiseBurst(engine, {
    volume: v * 0.95,
    durationSec: 0.085,
    startHz: 1400,
    endHz: 3200,
    q: 1.3,
    delaySec,
  });

  // 2. Soft linen snap settling onto the velvet tabletop
  scheduleNoiseBurst(engine, {
    volume: v * 0.65,
    durationSec: 0.042,
    startHz: 2400,
    endHz: 900,
    q: 1.8,
    delaySec: delaySec + 0.078,
  });

  // 3. Subtle warm wooden table placement thock
  const t = ctx.currentTime + delaySec + 0.078;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(108, t + 0.055);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.055 * v, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain);
  gain.connect(sfxOut);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Subtle parchment brush + tier-aware Renaissance pluck when selecting/inspecting a card */
export function playCardSelect(muted = false, tier = 1, volume = 1, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.cardSelect += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    scheduleNoiseBurst(engine, {
      volume: 0.58 * volume,
      durationSec: 0.055,
      startHz: 1950,
      endHz: 1150,
    });
    const notes = buildEventNotes(themeId, 'cardSelect', { tier });
    scheduleNotesOnEngine(engine, notes, volume, themeId);
  });
}

/** Tactile clay chip clack + modal gem harmonic when picking/toggling a gem chip */
export function playChipPick(
  muted = false,
  color = 'white',
  stepIndex = 0,
  volume = 1,
  themeId = activeThemeId
) {
  if (muted) return;
  sfxCounts.chipPick += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const ratio = getGemPitchRatio(color, stepIndex);
    scheduleClayChipClack(engine, {
      volume: 0.92 * volume,
      pitchRatio: ratio,
      descending: stepIndex < 0,
    });
    const notes = buildEventNotes(themeId, 'chipPick', { color, stepIndex });
    scheduleNotesOnEngine(engine, notes, volume, themeId);
  });
}

/** Backwards-compatible alias for legacy call sites */
export function playChipClink(muted = false, pitchOffset = 0, volume = 1, color = 'white') {
  playChipPick(muted, color, pitchOffset, volume);
}

/** Staggered clay-chip cascade + Renaissance chord when collecting gems into pouch */
export function playChipCollect(muted = false, colors = [], volume = 1, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.chipCollect += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const list = Array.isArray(colors) && colors.length > 0 ? colors.slice(0, 3) : ['white', 'blue', 'green'];
    list.forEach((col, idx) => {
      scheduleClayChipClack(engine, {
        volume: 0.82 * volume,
        pitchRatio: getGemPitchRatio(col, idx),
        delaySec: idx * 0.055,
      });
    });
    const notes = buildEventNotes(themeId, 'chipCollect', { colors: list });
    scheduleNotesOnEngine(engine, notes, volume, themeId);
  });
}

/** Descending ceramic stack-return clacks when returning excess or spent chips to bank */
export function playChipReturn(muted = false, colors = [], volume = 1, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.chipReturn += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const list = Array.isArray(colors) && colors.length > 0 ? colors.slice(0, 4) : ['white', 'blue'];
    list.forEach((col, idx) => {
      scheduleClayChipClack(engine, {
        volume: 0.78 * volume,
        pitchRatio: getGemPitchRatio(col, -1) * Math.pow(0.95, idx),
        delaySec: idx * 0.065,
        descending: true,
      });
    });
    const notes = buildEventNotes(themeId, 'chipReturn', { colors: list });
    scheduleNotesOnEngine(engine, notes, volume, themeId);
  });
}

/** Crisp card pull + gilded Renaissance arpeggio when purchasing a development card */
export function playCardBuy(muted = false, volume = 1, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.cardBuy += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    scheduleCardFlipFoley(engine, { volume: 0.72 * volume });
    const notes = buildEventNotes(themeId, 'cardBuy');
    scheduleNotesOnEngine(engine, notes, volume, themeId);
  });
}

/** Card tuck + golden joker chime when reserving a card or blind deck top */
export function playCardReserve(muted = false, volume = 1, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.cardReserve += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    scheduleNoiseBurst(engine, {
      volume: 0.62 * volume,
      durationSec: 0.06,
      startHz: 1650,
      endHz: 950,
    });
    scheduleClayChipClack(engine, {
      volume: 0.75 * volume,
      pitchRatio: getGemPitchRatio('gold', 1),
      delaySec: 0.045,
    });
    const notes = buildEventNotes(themeId, 'cardReserve');
    scheduleNotesOnEngine(engine, notes, volume, themeId);
  });
}

/** Tactile 3D card-flip snap + velvet placement tap when dealing a replacement card */
export function playCardDeal(muted = false, volume = 0.88, delaySec = 0, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.cardDeal += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    scheduleCardFlipFoley(engine, { volume, delaySec });
    const notes = buildEventNotes(themeId, 'cardFlip');
    scheduleNotesOnEngine(engine, notes, volume * 0.72, themeId, delaySec);
  });
}

export function playTurnBell(muted = false, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.turnBell += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const notes = buildEventNotes(themeId, 'turnBell');
    scheduleNotesOnEngine(engine, notes, 0.9, themeId);
  });
}

/**
 * Distinct gilded Renaissance flourish paired with the visual turn-transition veil & crest.
 * Combines a silk-gold shimmer sweep with a themed ascending harp/celesta glissando.
 */
export function playTurnTransition(
  muted = false,
  { isSelf = false, subtle = false } = {},
  themeId = activeThemeId
) {
  if (muted) return;
  sfxCounts.turnTransition += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const scale = subtle ? 0.48 : isSelf ? 0.96 : 0.78;

    // 1. Velvet-gold shimmer sweep synced with the diagonal light sheen
    scheduleNoiseBurst(engine, {
      volume: 0.56 * scale,
      durationSec: 0.17,
      startHz: 1150,
      endHz: isSelf ? 3200 : 2500,
      q: 1.9,
      delaySec: 0,
    });

    // 2. Subtle high gold-leaf sparkle tail as the filigree crest illuminates
    scheduleNoiseBurst(engine, {
      volume: 0.34 * scale,
      durationSec: 0.12,
      startHz: 3400,
      endHz: 4800,
      q: 3.1,
      delaySec: 0.14,
    });

    // 3. Themed ascending gilded harp/carillon/harpsichord flourish
    const notes = buildEventNotes(themeId, 'turnTransition', { isSelf });
    scheduleNotesOnEngine(engine, notes, scale, themeId);
  });
}

export function playNobleFanfare(muted = false, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.nobleFanfare += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const notes = buildEventNotes(themeId, 'nobleFanfare');
    scheduleNotesOnEngine(engine, notes, 1, themeId);
  });
}

/** Renaissance victory notification cadence (triumphant win vs stately match finish) */
export function playVictoryFanfare(muted = false, isWinner = true, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.victoryFanfare += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const notes = buildEventNotes(themeId, isWinner ? 'victoryWin' : 'victoryFinish');
    scheduleNotesOnEngine(engine, notes, 1, themeId);
  });
}

/** Short signature chord preview when switching themes */
export function playThemePreview(themeId = activeThemeId, muted = false) {
  if (muted) return;
  withUnlockedAudio((engine) => {
    const notes = buildEventNotes(themeId, 'cardSelect', { tier: 2 });
    scheduleNotesOnEngine(engine, notes, 0.95, themeId);
  });
}

/** Dramatic Renaissance timpani + chime pulse for the final 10 seconds of a turn */
export function playCountdownTick(muted = false, secondsLeft = 10, themeId = activeThemeId) {
  if (muted) return;
  sfxCounts.countdownTick += 1;
  syncDebugHook();
  withUnlockedAudio((engine) => {
    const notes = buildEventNotes(themeId, 'countdownTick', { secondsLeft });
    scheduleNotesOnEngine(engine, notes, secondsLeft <= 5 ? 1.0 : 0.85, themeId);
  });
}
