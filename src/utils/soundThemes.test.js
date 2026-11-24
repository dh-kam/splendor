import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOUND_THEME,
  SOUND_THEMES,
  SOUND_THEME_LIST,
  getSoundTheme,
  clampVolume,
  getGemPitchRatio,
  buildEventNotes,
} from './soundThemes';

test('resolves all three Renaissance sound themes and falls back safely', () => {
  assert.equal(SOUND_THEME_LIST.length, 3);
  assert.equal(getSoundTheme('court').id, 'court');
  assert.equal(getSoundTheme('cathedral').id, 'cathedral');
  assert.equal(getSoundTheme('guild').id, 'guild');
  assert.equal(getSoundTheme('unknown-theme').id, DEFAULT_SOUND_THEME);
});

test('clamps volume safely within 0..1 with sensible default on NaN', () => {
  assert.equal(clampVolume(-0.4), 0);
  assert.equal(clampVolume(1.8), 1);
  assert.equal(clampVolume(0.6), 0.6);
  assert.equal(clampVolume('not-a-number'), 0.75);
});

test('assigns distinct harmonious gem pitch ratios across colors and steps', () => {
  const white0 = getGemPitchRatio('white', 0);
  const gold0 = getGemPitchRatio('gold', 0);
  const black0 = getGemPitchRatio('black', 0);
  const whiteStep2 = getGemPitchRatio('white', 2);
  const deselect = getGemPitchRatio('white', -1);

  assert.ok(gold0 > white0);
  assert.ok(black0 < white0);
  assert.ok(whiteStep2 > white0);
  assert.ok(deselect < white0);
});

test('builds subtle themed note schedules for card selection, chip collecting, and victory', () => {
  const events = [
    ['cardSelect', { tier: 2 }],
    ['chipPick', { color: 'blue', stepIndex: 1 }],
    ['chipCollect', { colors: ['white', 'blue', 'red'] }],
    ['victoryWin', {}],
    ['victoryFinish', {}],
  ];

  for (const theme of Object.values(SOUND_THEMES)) {
    for (const [eventType, opts] of events) {
      const notes = buildEventNotes(theme.id, eventType, opts);
      assert.ok(notes.length >= 2, `${theme.id}:${eventType} should schedule notes`);
      for (const note of notes) {
        assert.ok(note.freq > 100 && note.freq < 12000, 'frequency in audible range');
        assert.ok(note.dur > 0 && note.dur <= 1.6, 'reasonable subtle duration');
        assert.ok(note.gain > 0 && note.gain <= 0.1, 'subtle non-harsh gain ceiling');
      }
    }
  }
});

test('higher card tiers produce higher cardSelect root pitch across themes', () => {
  for (const theme of SOUND_THEME_LIST) {
    const t1 = buildEventNotes(theme.id, 'cardSelect', { tier: 1 })[0].freq;
    const t2 = buildEventNotes(theme.id, 'cardSelect', { tier: 2 })[0].freq;
    const t3 = buildEventNotes(theme.id, 'cardSelect', { tier: 3 })[0].freq;
    assert.ok(t1 < t2 && t2 < t3, `${theme.id} tier pitches should ascend`);
  }
});
