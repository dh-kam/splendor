// Pure URL/origin resolution & Android/Chromecast Web Receiver bridge helpers (unit-testable)

export const CAST_NAMESPACE = 'urn:x-cast:com.splendor.guild';
export const MAX_PARTY_PLAYERS = 4;

/**
 * Normalizes a room code from URL query params, user input, or Cast messages.
 */
export function normalizeClientRoomCode(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < 4 || cleaned.length > 10) return '';
  return cleaned;
}

/**
 * Strips trailing slashes and validates http/https origin strings.
 */
export function sanitizeHttpOrigin(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/i.test(trimmed)) return '';
  return trimmed;
}

/**
 * Resolves the authoritative HTTPS/WSS game server origin for Web, Android WebView, and Chromecast.
 * Priority: ?server= query param -> Android native bridge -> VITE_SERVER_URL -> window.location.origin
 */
export function resolveServerOrigin({
  search = typeof window !== 'undefined' ? window.location.search : '',
  envServerUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SERVER_URL || '' : '',
  bridgeServerUrl = typeof window !== 'undefined' ? window.SplendorAndroid?.getServerUrl?.() || '' : '',
  windowOrigin = typeof window !== 'undefined' ? window.location.origin : '',
} = {}) {
  try {
    const params = new URLSearchParams(search || '');
    const fromQuery = sanitizeHttpOrigin(params.get('server') || '');
    if (fromQuery) return fromQuery;
  } catch {
    // Ignore malformed query strings
  }

  const fromBridge = sanitizeHttpOrigin(bridgeServerUrl);
  if (fromBridge) return fromBridge;

  const fromEnv = sanitizeHttpOrigin(envServerUrl);
  if (fromEnv) return fromEnv;

  const fromWindow = sanitizeHttpOrigin(windowOrigin);
  if (fromWindow) return fromWindow;

  return '';
}

/**
 * Resolves the public HTTPS base URL embedded inside QR codes (so guests on mobile scan the real k8s domain).
 */
export function resolvePublicShareOrigin({
  serverPublicBaseUrl = '',
  serverOrigin = '',
  windowOrigin = typeof window !== 'undefined' ? window.location.origin : '',
} = {}) {
  return (
    sanitizeHttpOrigin(serverPublicBaseUrl) ||
    sanitizeHttpOrigin(serverOrigin) ||
    sanitizeHttpOrigin(windowOrigin) ||
    ''
  );
}

/**
 * Builds the guest phone QR join URL (`/?view=player&room=CODE`).
 */
export function buildPartyJoinUrl(baseOrigin, roomCode) {
  const origin = sanitizeHttpOrigin(baseOrigin);
  const code = normalizeClientRoomCode(roomCode);
  if (!origin) return code ? `/?view=player&room=${code}` : '/?view=player';
  return code ? `${origin}/?view=player&room=${code}` : `${origin}/?view=player`;
}

/**
 * Builds the Chromecast / TV full-screen board URL (`/?view=tv&room=CODE&cast=1`).
 */
export function buildCastReceiverUrl(baseOrigin, roomCode) {
  const origin = sanitizeHttpOrigin(baseOrigin);
  const code = normalizeClientRoomCode(roomCode);
  if (!origin) return code ? `/?view=tv&room=${code}&cast=1` : '/?view=tv&cast=1';
  return code ? `${origin}/?view=tv&room=${code}&cast=1` : `${origin}/?view=tv&cast=1`;
}

/**
 * Parses an incoming Chromecast custom-channel message payload safely.
 */
export function parseCastMessage(rawData) {
  if (!rawData) return null;
  let parsed = rawData;
  if (typeof rawData === 'string') {
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.type === 'ATTACH_ROOM') {
    const roomCode = normalizeClientRoomCode(parsed.roomCode || '');
    if (!roomCode) return null;
    return { type: 'ATTACH_ROOM', roomCode };
  }
  return null;
}

/**
 * Reads the optional Android Kotlin WebView JavascriptInterface (`window.SplendorAndroid`).
 * Returns a safe wrapper in both browser and Android WebView environments.
 */
export function getAndroidBridge() {
  const native = typeof window !== 'undefined' ? window.SplendorAndroid : null;
  const available = Boolean(native && typeof native === 'object');

  return {
    available,
    getServerUrl: () => {
      try {
        return available && typeof native.getServerUrl === 'function'
          ? sanitizeHttpOrigin(native.getServerUrl())
          : '';
      } catch {
        return '';
      }
    },
    isCastConnected: () => {
      try {
        return Boolean(available && typeof native.isCastConnected === 'function' && native.isCastConnected());
      } catch {
        return false;
      }
    },
    openCastPicker: () => {
      try {
        if (available && typeof native.openCastPicker === 'function') {
          native.openCastPicker();
          return true;
        }
      } catch {
        // Ignore bridge call error
      }
      return false;
    },
    castRoom: (roomCode, tvUrl) => {
      const code = normalizeClientRoomCode(roomCode);
      if (!code) return false;
      try {
        if (available && typeof native.castRoom === 'function') {
          native.castRoom(code, tvUrl || '');
          return true;
        }
      } catch {
        // Ignore bridge call error
      }
      return false;
    },
    notifyRoomChanged: (roomCode, tvUrl) => {
      const code = normalizeClientRoomCode(roomCode);
      try {
        if (available && typeof native.onRoomChanged === 'function') {
          native.onRoomChanged(code, tvUrl || '');
          return true;
        }
      } catch {
        // Ignore bridge call error
      }
      return false;
    },
  };
}

/**
 * Registers Google Cast Web Receiver (CAF) custom namespace listener + window hook
 * so a Chromecast TV Receiver can attach to a room dynamically when cast from Android.
 */
export function initCastReceiverListener(onAttachRoom) {
  if (typeof window === 'undefined' || typeof onAttachRoom !== 'function') {
    return () => {};
  }

  const handlePayload = (payload) => {
    const msg = parseCastMessage(payload);
    if (msg && msg.type === 'ATTACH_ROOM') {
      onAttachRoom(msg.roomCode);
    }
  };

  window.__SPLENDOR_ATTACH_CAST_ROOM__ = (roomCode) => {
    const clean = normalizeClientRoomCode(roomCode);
    if (clean) onAttachRoom(clean);
  };

  let castContext = null;
  const castListener = (event) => {
    handlePayload(event?.data);
  };

  try {
    const caf = window.cast?.framework;
    if (caf?.CastReceiverContext) {
      castContext = caf.CastReceiverContext.getInstance();
      castContext.addCustomMessageListener(CAST_NAMESPACE, castListener);
      if (typeof castContext.start === 'function' && !window.__SPLENDOR_CAST_STARTED__) {
        window.__SPLENDOR_CAST_STARTED__ = true;
        castContext.start({ disableIdleTimeout: true });
      }
    }
  } catch {
    // Non-Chromecast browser environment; ignore safely
  }

  return () => {
    delete window.__SPLENDOR_ATTACH_CAST_ROOM__;
    try {
      if (castContext && typeof castContext.removeCustomMessageListener === 'function') {
        castContext.removeCustomMessageListener(CAST_NAMESPACE, castListener);
      }
    } catch {
      // Ignore cleanup error
    }
  };
}
