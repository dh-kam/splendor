import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStorageGet, safeStorageSet } from './safeStorage';

test('safeStorage reads and writes normally when browser storage works', () => {
  const backing = new Map();
  const mockStore = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, v),
  };

  safeStorageSet('local', 'test_normal_key', 'venice', mockStore);
  assert.equal(safeStorageGet('local', 'test_normal_key', mockStore), 'venice');
});

test('safeStorage falls back cleanly to memory when iframe blocks storage with SecurityError', () => {
  const blockedStore = {
    getItem: () => {
      throw new Error('SecurityError: Access is denied for this document.');
    },
    setItem: () => {
      throw new Error('SecurityError: Access is denied for this document.');
    },
  };

  assert.equal(safeStorageGet('session', 'blocked_room_key', blockedStore), null);
  assert.doesNotThrow(() => {
    safeStorageSet('session', 'blocked_room_key', 'sb_fallback_123', blockedStore);
  });
  assert.equal(safeStorageGet('session', 'blocked_room_key', blockedStore), 'sb_fallback_123');
});
