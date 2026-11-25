// Safe browser storage wrapper that falls back to in-memory storage when
// third-party cookies/storage are blocked inside cross-origin preview iframes.

const memoryLocal = new Map();
const memorySession = new Map();

export function safeStorageGet(storageKind, key, storageOverride) {
  const fallbackMap = storageKind === 'session' ? memorySession : memoryLocal;
  try {
    const store =
      storageOverride !== undefined
        ? storageOverride
        : typeof window !== 'undefined'
          ? storageKind === 'session'
            ? window.sessionStorage
            : window.localStorage
          : null;
    if (store && typeof store.getItem === 'function') {
      const val = store.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch {
    // Ignore SecurityError / QuotaExceededError in restricted iframes
  }
  return fallbackMap.has(key) ? fallbackMap.get(key) : null;
}

export function safeStorageSet(storageKind, key, value, storageOverride) {
  const fallbackMap = storageKind === 'session' ? memorySession : memoryLocal;
  const strValue = String(value);
  fallbackMap.set(key, strValue);
  try {
    const store =
      storageOverride !== undefined
        ? storageOverride
        : typeof window !== 'undefined'
          ? storageKind === 'session'
            ? window.sessionStorage
            : window.localStorage
          : null;
    if (store && typeof store.setItem === 'function') {
      store.setItem(key, strValue);
    }
  } catch {
    // Ignore SecurityError / QuotaExceededError in restricted iframes
  }
}
