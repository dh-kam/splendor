// Pure Renaissance sound theme definitions & musical schedule builders (unit-testable)

export const DEFAULT_SOUND_THEME = 'court';

export const SOUND_THEMES = {
  court: {
    id: 'court',
    name: '베네치아 궁정',
    subtitle: '따뜻한 류트·하프와 도자기 칩 울림',
    masterGain: 0.85,
    cardWave: 'triangle',
    chipWave: 'triangle',
    fanfareWave: 'triangle',
    harmonicWave: 'sine',
    lowpassHz: 3200,
    decayScale: 1.0,
    chipBaseHz: 2050,
    chipOvertoneRatio: 1.58,
    cardSelectNotes: [392.0, 493.88, 587.33], // G4 - B4 - D5 (warm lute arpeggio)
    cardBuyChord: [523.25, 659.25, 783.99, 1046.5], // C5 major lute roll
    chipCollectChord: [587.33, 739.99, 880.0], // D5 major sunlit triad
    victoryWinFanfare: [
      { freq: 523.25, delay: 0, dur: 0.24, gain: 0.068 },
      { freq: 659.25, delay: 0.11, dur: 0.26, gain: 0.072 },
      { freq: 783.99, delay: 0.22, dur: 0.28, gain: 0.078 },
      { freq: 1046.5, delay: 0.34, dur: 0.68, gain: 0.088 },
      { freq: 783.99, delay: 0.34, dur: 0.62, gain: 0.048 },
      { freq: 659.25, delay: 0.34, dur: 0.6, gain: 0.042 },
    ],
    victoryFinishFanfare: [
      { freq: 440.0, delay: 0, dur: 0.26, gain: 0.058 },
      { freq: 523.25, delay: 0.14, dur: 0.28, gain: 0.062 },
      { freq: 659.25, delay: 0.28, dur: 0.56, gain: 0.068 },
      { freq: 587.33, delay: 0.44, dur: 0.62, gain: 0.054 },
    ],
  },
  cathedral: {
    id: 'cathedral',
    name: '피렌체 대성당',
    subtitle: '맑은 수정 종소리와 성당 오르간 화음',
    masterGain: 0.8,
    cardWave: 'sine',
    chipWave: 'sine',
    fanfareWave: 'sine',
    harmonicWave: 'sine',
    lowpassHz: 4600,
    decayScale: 1.35,
    chipBaseHz: 2560,
    chipOvertoneRatio: 2.0,
    cardSelectNotes: [523.25, 659.25, 987.77], // C5 - E5 - B5 crystalline chime
    cardBuyChord: [587.33, 880.0, 1174.66, 1479.98], // D5 radiant fifths
    chipCollectChord: [659.25, 987.77, 1318.51], // E5 glass carillon
    victoryWinFanfare: [
      { freq: 587.33, delay: 0, dur: 0.34, gain: 0.062 },
      { freq: 880.0, delay: 0.12, dur: 0.38, gain: 0.068 },
      { freq: 1108.73, delay: 0.24, dur: 0.42, gain: 0.07 },
      { freq: 1174.66, delay: 0.38, dur: 0.88, gain: 0.082 },
      { freq: 880.0, delay: 0.38, dur: 0.82, gain: 0.046 },
      { freq: 587.33, delay: 0.38, dur: 0.78, gain: 0.044 },
    ],
    victoryFinishFanfare: [
      { freq: 493.88, delay: 0, dur: 0.34, gain: 0.055 },
      { freq: 659.25, delay: 0.16, dur: 0.38, gain: 0.058 },
      { freq: 739.99, delay: 0.32, dur: 0.74, gain: 0.062 },
      { freq: 587.33, delay: 0.5, dur: 0.76, gain: 0.05 },
    ],
  },
  guild: {
    id: 'guild',
    name: '장인의 공방',
    subtitle: '산뜻한 쳄발로와 묵직한 목재 테이블 촉감',
    masterGain: 0.82,
    cardWave: 'sawtooth',
    chipWave: 'triangle',
    fanfareWave: 'sawtooth',
    harmonicWave: 'triangle',
    lowpassHz: 2400,
    decayScale: 0.86,
    chipBaseHz: 1640,
    chipOvertoneRatio: 1.498,
    cardSelectNotes: [329.63, 440.0, 523.25], // E4 - A4 - C5 crisp harpsichord pluck
    cardBuyChord: [440.0, 554.37, 659.25, 880.0], // A4 baroque cadence
    chipCollectChord: [493.88, 659.25, 783.99], // B4/G5 artisan flourish
    victoryWinFanfare: [
      { freq: 440.0, delay: 0, dur: 0.18, gain: 0.058 },
      { freq: 554.37, delay: 0.09, dur: 0.2, gain: 0.062 },
      { freq: 659.25, delay: 0.18, dur: 0.22, gain: 0.068 },
      { freq: 880.0, delay: 0.29, dur: 0.62, gain: 0.076 },
      { freq: 659.25, delay: 0.29, dur: 0.56, gain: 0.044 },
      { freq: 554.37, delay: 0.29, dur: 0.54, gain: 0.038 },
    ],
    victoryFinishFanfare: [
      { freq: 392.0, delay: 0, dur: 0.22, gain: 0.052 },
      { freq: 493.88, delay: 0.12, dur: 0.24, gain: 0.055 },
      { freq: 587.33, delay: 0.24, dur: 0.5, gain: 0.06 },
      { freq: 440.0, delay: 0.38, dur: 0.54, gain: 0.048 },
    ],
  },
};

export const SOUND_THEME_LIST = [
  SOUND_THEMES.court,
  SOUND_THEMES.cathedral,
  SOUND_THEMES.guild,
];

// Harmonious Renaissance modal intervals per gem color (subtle tonal identity)
const GEM_INTERVAL_RATIOS = {
  white: 1.0,       // Unison (Diamond - bright clear)
  blue: 1.12246,    // Major 2nd (Sapphire)
  green: 1.25992,   // Major 3rd (Emerald)
  red: 1.33484,     // Perfect 4th (Ruby)
  black: 0.8909,    // Low Major 2nd below (Onyx - deeper warm tone)
  gold: 1.49831,    // Perfect 5th (Gold Joker - luminous)
};

export function getSoundTheme(themeId) {
  return SOUND_THEMES[themeId] || SOUND_THEMES[DEFAULT_SOUND_THEME];
}

export function clampVolume(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0.75;
  return Math.max(0, Math.min(1, num));
}

export function getGemPitchRatio(color = 'white', stepIndex = 0) {
  const base = GEM_INTERVAL_RATIOS[color] || 1.0;
  // Gentle pentatonic step lift as user picks 1st -> 2nd -> 3rd chip
  const stepFactors = [1.0, 1.06, 1.12246, 1.1892];
  const clampedIdx = Math.max(0, Math.min(stepFactors.length - 1, Math.round(stepIndex)));
  const negativeDrop = stepIndex < 0 ? 0.92 : 1.0;
  return Number((base * stepFactors[clampedIdx] * negativeDrop).toFixed(4));
}

/**
 * Pure note-schedule builder for themed Renaissance audio cues.
 * Every peakGain is calibrated for subtle, non-fatiguing tabletop listening (<= 0.10).
 */
export function buildEventNotes(themeId, eventType, options = {}) {
  const theme = getSoundTheme(themeId);
  const decay = theme.decayScale;

  switch (eventType) {
    case 'cardSelect': {
      const tier = Math.max(1, Math.min(3, Number(options.tier) || 1));
      const rootFreq = theme.cardSelectNotes[tier - 1] || theme.cardSelectNotes[0];
      return [
        {
          freq: rootFreq,
          delay: 0,
          dur: 0.16 * decay,
          gain: 0.048,
          wave: theme.cardWave,
          filterHz: theme.lowpassHz,
        },
        {
          freq: rootFreq * 1.4983, // soft perfect fifth shimmer
          delay: 0.032,
          dur: 0.19 * decay,
          gain: 0.028,
          wave: theme.harmonicWave,
          filterHz: theme.lowpassHz * 1.15,
        },
      ];
    }

    case 'cardBuy': {
      return theme.cardBuyChord.map((freq, idx) => ({
        freq,
        delay: idx * 0.048,
        dur: (0.26 + idx * 0.04) * decay,
        gain: idx === theme.cardBuyChord.length - 1 ? 0.064 : 0.056,
        wave: theme.cardWave,
        filterHz: theme.lowpassHz,
      }));
    }

    case 'cardReserve': {
      const base = theme.cardSelectNotes[2] || 587.33;
      return [
        {
          freq: base * 1.5,
          delay: 0,
          dur: 0.22 * decay,
          gain: 0.054,
          wave: theme.harmonicWave,
          filterHz: theme.lowpassHz * 1.25,
        },
        {
          freq: base * 2.0,
          delay: 0.055,
          dur: 0.28 * decay,
          gain: 0.046,
          wave: 'sine',
          filterHz: theme.lowpassHz * 1.35,
        },
      ];
    }

    case 'chipPick': {
      const ratio = getGemPitchRatio(options.color || 'white', options.stepIndex ?? 0);
      const primaryHz = theme.chipBaseHz * ratio;
      const harmonicHz = primaryHz * theme.chipOvertoneRatio;
      return [
        {
          freq: primaryHz,
          endFreq: primaryHz * 0.87,
          delay: 0,
          dur: 0.072 * decay,
          gain: 0.068,
          wave: theme.chipWave,
          filterHz: theme.lowpassHz * 1.3,
        },
        {
          freq: harmonicHz,
          endFreq: harmonicHz * 0.91,
          delay: 0.004,
          dur: 0.088 * decay,
          gain: 0.034,
          wave: theme.harmonicWave,
          filterHz: theme.lowpassHz * 1.45,
        },
      ];
    }

    case 'chipCollect': {
      const colors = Array.isArray(options.colors) && options.colors.length > 0
        ? options.colors.slice(0, 3)
        : ['white', 'blue', 'green'];
      const notes = [];
      colors.forEach((col, idx) => {
        const ratio = getGemPitchRatio(col, idx);
        const chordNote = theme.chipCollectChord[idx % theme.chipCollectChord.length];
        notes.push({
          freq: chordNote * (0.94 + (ratio - 1) * 0.35),
          delay: idx * 0.055,
          dur: 0.22 * decay,
          gain: 0.052,
          wave: theme.cardWave,
          filterHz: theme.lowpassHz,
        });
      });
      // Soft closing fifth resonance
      notes.push({
        freq: theme.chipCollectChord[theme.chipCollectChord.length - 1] * 1.25,
        delay: colors.length * 0.055 + 0.02,
        dur: 0.3 * decay,
        gain: 0.042,
        wave: theme.harmonicWave,
        filterHz: theme.lowpassHz * 1.1,
      });
      return notes;
    }

    case 'turnBell': {
      const base = theme.cardSelectNotes[1] || 493.88;
      return [
        {
          freq: base,
          delay: 0,
          dur: 0.28 * decay,
          gain: 0.038,
          wave: 'sine',
          filterHz: theme.lowpassHz,
        },
        {
          freq: base * 1.4983,
          delay: 0.085,
          dur: 0.34 * decay,
          gain: 0.042,
          wave: theme.harmonicWave,
          filterHz: theme.lowpassHz * 1.15,
        },
      ];
    }

    case 'nobleFanfare': {
      return theme.cardBuyChord.map((freq, idx) => ({
        freq: freq * 1.12246,
        delay: idx * 0.072,
        dur: 0.48 * decay,
        gain: 0.068,
        wave: theme.fanfareWave,
        filterHz: theme.lowpassHz * 1.1,
      }));
    }

    case 'victoryWin': {
      return theme.victoryWinFanfare.map((n) => ({
        ...n,
        dur: n.dur * decay,
        wave: theme.fanfareWave,
        filterHz: theme.lowpassHz * 1.15,
      }));
    }

    case 'victoryFinish': {
      return theme.victoryFinishFanfare.map((n) => ({
        ...n,
        dur: n.dur * decay,
        wave: theme.cardWave,
        filterHz: theme.lowpassHz,
      }));
    }

    case 'countdownTick': {
      const sec = Math.max(1, Math.min(10, Number(options.secondsLeft) || 10));
      const urgency = (11 - sec) / 10; // 0.1 at 10s -> 1.0 at 1s
      const thudFreq = 168 + urgency * 48;
      const tickFreq = 720 + urgency * 340;
      const isCritical = sec <= 5;
      return [
        {
          freq: thudFreq,
          endFreq: thudFreq * 0.62,
          delay: 0,
          dur: 0.14,
          gain: isCritical ? 0.082 : 0.062,
          wave: 'triangle',
          filterHz: 820,
        },
        {
          freq: tickFreq,
          endFreq: tickFreq * 0.92,
          delay: 0.008,
          dur: 0.085,
          gain: isCritical ? 0.056 : 0.038,
          wave: theme.harmonicWave,
          filterHz: theme.lowpassHz,
        },
      ];
    }

    default:
      return [];
  }
}
