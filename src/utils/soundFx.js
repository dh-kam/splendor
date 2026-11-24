// Procedural Web Audio API Renaissance sound engine with selectable themes
// Zero external audio dependencies; subtle, non-fatiguing tabletop foley & chimes.

import {
  DEFAULT_SOUND_THEME,
  getSoundTheme,
  clampVolume,
  buildEventNotes,
} from './soundThemes';

let audioCtx = null;
let masterBus = null;
let activeThemeId = DEFAULT_SOUND_THEME;
let masterVolume = 0.75;

function getAudioEngine() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();

    // Gentle dynamics limiter + master gain so overlapping Renaissance chimes stay silky
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, audioCtx.currentTime);
    compressor.knee.setValueAtTime(18, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.004, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.14, audioCtx.currentTime);

    masterBus = audioCtx.createGain();
    masterBus.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
    masterBus.connect(compressor);
    compressor.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return { ctx: audioCtx, out: masterBus };
}

export function setSoundTheme(themeId) {
  activeThemeId = getSoundTheme(themeId).id;
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
  return masterVolume;
}

export function getMasterVolume() {
  return masterVolume;
}

function scheduleNotes(notes, volume = 1, themeId = activeThemeId) {
  const engine = getAudioEngine();
  if (!engine || !notes || notes.length === 0) return;

  const { ctx, out } = engine;
  const theme = getSoundTheme(themeId);
  const now = ctx.currentTime;
  const volScale = clampVolume(volume) * theme.masterGain;
  if (volScale <= 0.001) return;

  notes.forEach((n) => {
    const start = now + (n.delay || 0);
    const dur = Math.max(0.04, n.dur || 0.2);
    const peak = Math.max(0.0005, (n.gain || 0.05) * volScale);

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
    filter.Q.setValueAtTime(0.85, start);

    const attack = Math.min(0.018, dur * 0.14);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc.start(start);
    osc.stop(start + dur + 0.025);
  });
}

function scheduleParchmentBrush(volume = 0.55, durationSec = 0.065, centerHz = 1550) {
  const engine = getAudioEngine();
  if (!engine) return;
  const { ctx, out } = engine;
  const now = ctx.currentTime;

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
  filter.frequency.setValueAtTime(centerHz, now);
  filter.frequency.exponentialRampToValueAtTime(centerHz * 0.62, now + durationSec);
  filter.Q.value = 1.5;

  const gain = ctx.createGain();
  const peak = Math.max(0.0005, 0.042 * clampVolume(volume));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  noise.start(now);
}

/** Subtle parchment brush + tier-aware Renaissance pluck when selecting/inspecting a card */
export function playCardSelect(muted = false, tier = 1, volume = 1, themeId = activeThemeId) {
  if (muted) return;
  scheduleParchmentBrush(0.42 * volume, 0.055, 1750);
  const notes = buildEventNotes(themeId, 'cardSelect', { tier });
  scheduleNotes(notes, volume, themeId);
}

/** Tactile chip tap + subtle modal gem harmonic when picking/toggling a gem chip */
export function playChipPick(
  muted = false,
  color = 'white',
  stepIndex = 0,
  volume = 1,
  themeId = activeThemeId
) {
  if (muted) return;
  const notes = buildEventNotes(themeId, 'chipPick', { color, stepIndex });
  scheduleNotes(notes, volume, themeId);
}

/** Backwards-compatible alias for legacy call sites */
export function playChipClink(muted = false, pitchOffset = 0, volume = 1, color = 'white') {
  playChipPick(muted, color, pitchOffset, volume);
}

/** Harmonious Renaissance cascade when confirming chip collection into merchant pouch */
export function playChipCollect(muted = false, colors = [], volume = 1, themeId = activeThemeId) {
  if (muted) return;
  scheduleParchmentBrush(0.32 * volume, 0.05, 1200);
  const notes = buildEventNotes(themeId, 'chipCollect', { colors });
  scheduleNotes(notes, volume, themeId);
}

export function playCardBuy(muted = false, volume = 1, themeId = activeThemeId) {
  if (muted) return;
  scheduleParchmentBrush(0.48 * volume, 0.06, 1450);
  const notes = buildEventNotes(themeId, 'cardBuy');
  scheduleNotes(notes, volume, themeId);
}

export function playCardReserve(muted = false, volume = 1, themeId = activeThemeId) {
  if (muted) return;
  scheduleParchmentBrush(0.35 * volume, 0.05, 1300);
  const notes = buildEventNotes(themeId, 'cardReserve');
  scheduleNotes(notes, volume, themeId);
}

export function playCardDeal(muted = false, volume = 0.7) {
  if (muted) return;
  scheduleParchmentBrush(0.75 * volume, 0.08, 1600);
}

export function playTurnBell(muted = false, themeId = activeThemeId) {
  if (muted) return;
  const notes = buildEventNotes(themeId, 'turnBell');
  scheduleNotes(notes, 0.9, themeId);
}

export function playNobleFanfare(muted = false, themeId = activeThemeId) {
  if (muted) return;
  const notes = buildEventNotes(themeId, 'nobleFanfare');
  scheduleNotes(notes, 1, themeId);
}

/** Renaissance victory notification cadence (triumphant win vs stately match finish) */
export function playVictoryFanfare(muted = false, isWinner = true, themeId = activeThemeId) {
  if (muted) return;
  const notes = buildEventNotes(themeId, isWinner ? 'victoryWin' : 'victoryFinish');
  scheduleNotes(notes, 1, themeId);
}

/** Short signature chord preview when switching themes */
export function playThemePreview(themeId = activeThemeId, muted = false) {
  if (muted) return;
  const notes = buildEventNotes(themeId, 'cardSelect', { tier: 2 });
  scheduleNotes(notes, 0.95, themeId);
}

/** Dramatic Renaissance timpani + chime pulse for the final 10 seconds of a turn */
export function playCountdownTick(muted = false, secondsLeft = 10, themeId = activeThemeId) {
  if (muted) return;
  const notes = buildEventNotes(themeId, 'countdownTick', { secondsLeft });
  scheduleNotes(notes, secondsLeft <= 5 ? 1.0 : 0.85, themeId);
}
