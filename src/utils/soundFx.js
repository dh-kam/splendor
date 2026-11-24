// Procedural Web Audio API tactile tabletop foley (zero external audio assets required)
let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playChipClink(muted = false, pitchOffset = 0, volume = 1) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Dual high-Q ceramic chip click resonance
  [2150, 3420].forEach((baseFreq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq * (1 + pitchOffset * 0.06), now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.065);

    const peak = (i === 0 ? 0.085 : 0.045) * volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  });
}

export function playCardBuy(muted = false, volume = 1) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Crisp parchment snap + warm Renaissance harp fifth
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const start = now + idx * 0.055;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.08 * volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

export function playCardReserve(muted = false, volume = 1) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Metallic gold ducat chime
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1174.66, now);
  osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.14);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.075 * volume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.34);
}

export function playCardDeal(muted = false, volume = 0.7) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Short filtered noise burst simulating crisp linen card slide
  const bufferSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1600, now);
  filter.frequency.exponentialRampToValueAtTime(900, now + 0.075);
  filter.Q.value = 1.6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.055 * volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
}

export function playTurnBell(muted = false) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Gentle warm double chime signaling player's turn
  [659.25, 987.77].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const start = now + i * 0.08;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.045, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  });
}

export function playNobleFanfare(muted = false) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Regal Renaissance major arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const start = now + idx * 0.075;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.58);
  });
}
