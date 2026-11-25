import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOUND_THEME,
  SOUND_THEMES,
  SOUND_THEME_LIST,
  getSoundTheme,
  getBgmScore,
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

test('builds chipReturn and cardFlip note schedules across all themes', () => {
  for (const theme of SOUND_THEME_LIST) {
    const retNotes = buildEventNotes(theme.id, 'chipReturn', { colors: ['red', 'blue'] });
    assert.ok(retNotes.length >= 2, `${theme.id}:chipReturn should schedule notes`);
    for (const note of retNotes) {
      assert.ok(note.freq > 100 && note.freq < 12000);
      assert.ok(note.gain > 0 && note.gain <= 0.1);
    }

    const flipNotes = buildEventNotes(theme.id, 'cardFlip', { tier: 3 });
    assert.ok(flipNotes.length >= 2, `${theme.id}:cardFlip should schedule notes`);
    for (const note of flipNotes) {
      assert.ok(note.freq > 100 && note.freq < 12000);
      assert.ok(note.gain > 0 && note.gain <= 0.1);
    }
  }
});

test('provides valid 16-step Renaissance BGM chamber scores for all themes', () => {
  for (const theme of SOUND_THEME_LIST) {
    const score = getBgmScore(theme.id);
    assert.ok(score.stepSec >= 0.2 && score.stepSec <= 0.7, `${theme.id} BGM stepSec should be stately`);
    assert.ok(score.lowpassHz >= 1000 && score.lowpassHz <= 4000, `${theme.id} BGM lowpass should be warm`);
    assert.equal(score.steps.length, 16, `${theme.id} BGM should have 16 steps`);
    const leadCount = score.steps.filter((s) => typeof s.lead === 'number').length;
    const bassCount = score.steps.filter((s) => typeof s.bass === 'number').length;
    const arpCount = score.steps.filter((s) => typeof s.arp === 'number').length;
    assert.ok(leadCount >= 8, `${theme.id} should have audible lead melody notes`);
    assert.ok(bassCount >= 4, `${theme.id} should have harmonic bass anchors`);
    assert.equal(arpCount, 16, `${theme.id} should have steady chamber arpeggio`);
  }
  // Safe fallback for unknown theme ID
  assert.deepEqual(getBgmScore('nonexistent'), getBgmScore(DEFAULT_SOUND_THEME));
});

test('builds distinct ascending gilded flourish notes for turnTransition across all themes', () => {
  for (const theme of SOUND_THEME_LIST) {
    const bellNotes = buildEventNotes(theme.id, 'turnBell');
    const oppFlourish = buildEventNotes(theme.id, 'turnTransition', { isSelf: false });
    const selfFlourish = buildEventNotes(theme.id, 'turnTransition', { isSelf: true });

    assert.ok(oppFlourish.length >= 5, `${theme.id} opponent flourish should have ascending sweep + shimmer`);
    assert.ok(selfFlourish.length > oppFlourish.length, `${theme.id} self flourish should add gilded crown chime`);
    assert.ok(selfFlourish.length > bellNotes.length, `${theme.id} turnTransition should be distinct from turnBell`);

    // Verify ascending melodic contour across the 4 primary flourish notes
    for (let i = 1; i < 4; i += 1) {
      assert.ok(
        oppFlourish[i].freq > oppFlourish[i - 1].freq,
        `${theme.id} flourish note ${i} should ascend`
      );
      assert.ok(
        oppFlourish[i].delay > oppFlourish[i - 1].delay,
        `${theme.id} flourish note ${i} should stagger forward`
      );
    }

    for (const note of [...oppFlourish, ...selfFlourish]) {
      assert.ok(note.freq > 100 && note.freq < 12000, 'frequency in audible range');
      assert.ok(note.dur > 0 && note.dur <= 1.6, 'graceful flourish duration');
      assert.ok(note.gain > 0 && note.gain <= 0.1, 'subtle non-harsh gain ceiling');
    }
  }
});

test('builds ascending victoryTallyTick notes and grand victoryTallyComplete chord across all themes', () => {
  for (const theme of SOUND_THEME_LIST) {
    const tick1 = buildEventNotes(theme.id, 'victoryTallyTick', { step: 1, total: 16 });
    const tickMid = buildEventNotes(theme.id, 'victoryTallyTick', { step: 8, total: 16 });
    const tickEnd = buildEventNotes(theme.id, 'victoryTallyTick', { step: 16, total: 16 });

    assert.ok(tick1.length >= 2 && tickMid.length >= 2 && tickEnd.length >= 2);
    assert.ok(
      tick1[0].freq < tickMid[0].freq && tickMid[0].freq < tickEnd[0].freq,
      `${theme.id} tally tick pitch should climb as points increase`
    );

    const completeWin = buildEventNotes(theme.id, 'victoryTallyComplete', { isWinner: true });
    assert.ok(completeWin.length >= 5, `${theme.id} tally complete should schedule lush chord + crown shimmer`);

    for (const note of [...tick1, ...tickMid, ...tickEnd, ...completeWin]) {
      assert.ok(note.freq > 100 && note.freq < 12000, 'frequency in audible range');
      assert.ok(note.dur > 0 && note.dur <= 1.6, 'reasonable duration');
      assert.ok(note.gain > 0 && note.gain <= 0.1, 'subtle non-harsh gain ceiling');
    }
  }
});

