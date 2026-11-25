import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Volume2,
  VolumeX,
  Music,
  SlidersHorizontal,
  ScrollText,
  RotateCcw,
  Home,
  X,
  Plus,
  Compass,
  Tv,
  Smartphone,
  Bookmark,
  ShoppingBag,
  Trophy,
  Check,
} from 'lucide-react';
import {
  SplendorEmblem,
  FacetedGemSvg,
  PokerChipStack3D,
  SteamDeckStack3D,
  DevelopmentCard,
  NobleTile,
  OpponentPortraitPlaque,
  GemChip,
} from './components/SplendorVisuals';
import {
  GEM_META,
  GEM_COLORS,
  ALL_GEM_COLORS,
  STEAM_TOKEN_ORDER,
  PORTRAITS,
  getPlayerPortrait,
} from './utils/gemMeta';
import {
  initAudioUnlock,
  setSoundTheme,
  setMasterVolume,
  setBgmEnabled,
  setBgmVolume,
  playCardSelect,
  playChipPick,
  playChipCollect,
  playChipReturn,
  playCardBuy,
  playCardReserve,
  playCardDeal,
  playTurnTransition,
  playNobleFanfare,
  playVictoryFanfare,
  playThemePreview,
  playCountdownTick,
} from './utils/soundFx';
import { safeStorageGet, safeStorageSet } from './utils/safeStorage';
import { getSoundTheme, clampVolume } from './utils/soundThemes';
import { diffGameStates } from './utils/gameEffects';
import {
  VelvetAmbience,
  TabletopEffectsLayer,
  TurnCountdownSlamOverlay,
  PortraitTurnBanner,
} from './components/TabletopEffects';
import { SoundThemePopover } from './components/SoundThemePopover';
import { TurnGlowBorder } from './components/TurnGlowBorder';
import { SetupPortraitCard } from './components/SetupPortraitCard';
import { SetupRenaissanceBackdrop } from './components/SetupRenaissanceBackdrop';
import {
  shouldAcceptStateUpdate,
  shouldPreserveChipSelection,
} from './utils/stateGuard';

const socket = io();

function getCenterRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
}

function canAffordCard(player, card) {
  if (!player || !card || card.id === 'secret') return false;
  let goldNeeded = 0;
  for (const color of GEM_COLORS) {
    const cost = card.cost?.[color] || 0;
    const discount = player.discounts?.[color] || 0;
    const net = Math.max(0, cost - discount);
    const held = player.gems?.[color] || 0;
    if (held < net) {
      goldNeeded += net - held;
    }
  }
  return (player.gems?.gold || 0) >= goldNeeded;
}

function getCardPaymentBreakdown(player, card) {
  if (!player || !card) return { items: [], goldNeeded: 0, affordable: false };
  const items = [];
  let goldNeeded = 0;
  for (const color of GEM_COLORS) {
    const raw = card.cost?.[color] || 0;
    if (raw === 0) continue;
    const discount = player.discounts?.[color] || 0;
    const net = Math.max(0, raw - discount);
    const held = player.gems?.[color] || 0;
    const shortfall = Math.max(0, net - held);
    goldNeeded += shortfall;
    items.push({ color, raw, discount, net, held, shortfall });
  }
  const affordable = (player.gems?.gold || 0) >= goldNeeded;
  return { items, goldNeeded, affordable };
}

function getInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const autostart = params.get('autostart') === '1';
  if (view === 'tv') return { viewMode: 'tv', autostart: false };
  if (view === 'player') return { viewMode: 'player', autostart: false };
  if (view === 'sandbox' || autostart) return { viewMode: 'sandbox', autostart };
  return { viewMode: 'selector', autostart: false };
}

function getOrCreatePlayerId() {
  let id = safeStorageGet('local', 'splendor_player_id');
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2, 10)}`;
    safeStorageSet('local', 'splendor_player_id', id);
  }
  return id;
}

function getOrCreateSandboxRoomId() {
  let id = safeStorageGet('session', 'splendor_sandbox_room_id');
  if (!id) {
    id = `sb_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    safeStorageSet('session', 'splendor_sandbox_room_id', id);
  }
  return id;
}

const EMPTY_RETURN_SELECTION = {
  white: 0,
  blue: 0,
  green: 0,
  red: 0,
  black: 0,
  gold: 0,
};

function recordLocalSfx(ref, kind) {
  ref.current = { kind, at: Date.now() };
}

const SETUP_SPEC_SEATS = [
  {
    name: '로렌초',
    role: 'AI 상인',
    img: PORTRAITS.lorenzo,
    videoSrc: '/videos/portrait_lorenzo_gesture.mp4',
    portraitPos: '50% 40%',
    isHuman: false,
  },
  {
    name: '베아트리체',
    role: 'AI 상인',
    img: PORTRAITS.beatrice,
    videoSrc: '/videos/portrait_beatrice_gesture.mp4?v=3',
    portraitPos: '50% 22%',
    isHuman: false,
  },
  {
    name: '코시모',
    role: 'AI 상인',
    img: PORTRAITS.cosimo,
    videoSrc: '/videos/portrait_cosimo_gesture.mp4',
    portraitPos: '50% 28%',
    isHuman: false,
  },
  {
    name: '이사벨라',
    role: 'AI 상인',
    img: PORTRAITS.duchess,
    videoSrc: null,
    portraitPos: '50% 20%',
    isHuman: false,
  },
];

const SETUP_PVE_SEATS = [
  {
    name: '베네치아 상인',
    role: '플레이어',
    img: PORTRAITS.player,
    videoSrc: '/videos/portrait_player_gesture.mp4',
    portraitPos: '50% 24%',
    isHuman: true,
  },
  {
    name: '로렌초',
    role: 'AI 상인',
    img: PORTRAITS.lorenzo,
    videoSrc: '/videos/portrait_lorenzo_gesture.mp4',
    portraitPos: '50% 40%',
    isHuman: false,
  },
  {
    name: '베아트리체',
    role: 'AI 상인',
    img: PORTRAITS.beatrice,
    videoSrc: '/videos/portrait_beatrice_gesture.mp4?v=3',
    portraitPos: '50% 22%',
    isHuman: false,
  },
  {
    name: '코시모',
    role: 'AI 상인',
    img: PORTRAITS.cosimo,
    videoSrc: '/videos/portrait_cosimo_gesture.mp4',
    portraitPos: '50% 28%',
    isHuman: false,
  },
];

export default function App() {
  const initialRoute = getInitialRoute();
  const [viewMode, setViewMode] = useState(initialRoute.viewMode);
  const [setupTab, setSetupTab] = useState('pve'); // 'pve' | 'spec' | 'local'
  const [setupCount, setSetupCount] = useState(3); // 3 | 4
  const [spotlightSeatIdx, setSpotlightSeatIdx] = useState(null);
  const spotlightRestTimerRef = useRef(null);
  const lastSpotlightSeatRef = useRef(-1);
  const [playerName, setPlayerName] = useState(
    () => safeStorageGet('local', 'splendor_player_name') || '베네치아 상인'
  );
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [sandboxRoomId] = useState(() => getOrCreateSandboxRoomId());
  const [sandboxMode, setSandboxMode] = useState('pve'); // 'pve' | 'spec'

  const [gameState, setGameState] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [muted, setMuted] = useState(() => safeStorageGet('local', 'splendor_sound_muted') === '1');
  const [bgmEnabled, setBgmEnabledState] = useState(
    () => safeStorageGet('local', 'splendor_bgm_enabled') !== '0'
  );
  const [bgmVolume, setBgmVolumeState] = useState(() =>
    clampVolume(safeStorageGet('local', 'splendor_bgm_volume') ?? 0.48)
  );
  const [soundTheme, setSoundThemeState] = useState(() =>
    getSoundTheme(safeStorageGet('local', 'splendor_sound_theme')).id
  );
  const [soundVolume, setSoundVolumeState] = useState(() =>
    clampVolume(safeStorageGet('local', 'splendor_sound_volume') ?? 0.78)
  );
  const [showSoundPanel, setShowSoundPanel] = useState(false);

  // Tabletop interactive state
  const [selectedGems, setSelectedGems] = useState([]);
  const [inspectCard, setInspectCard] = useState(null); // { card, fromReserved }
  const [showChronicle, setShowChronicle] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [inspectedPlayerId, setInspectedPlayerId] = useState(null);

  // Excess gem return state
  const [returnSelection, setReturnSelection] = useState(() => ({ ...EMPTY_RETURN_SELECTION }));

  // Mobile controller tabs
  const [mobileTab, setMobileTab] = useState('gems');

  // Dynamic tabletop FX state
  const [flyingChips, setFlyingChips] = useState([]);
  const [flyingCards, setFlyingCards] = useState([]);
  const [sparkles, setSparkles] = useState([]);
  const [scorePops, setScorePops] = useState([]);
  const [newlyDealtIds, setNewlyDealtIds] = useState([]);
  const [playerWhispers, setPlayerWhispers] = useState({});
  const [scorePulseIds, setScorePulseIds] = useState([]);
  const [fxBanner, setFxBanner] = useState(null);
  const [turnTransition, setTurnTransition] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [serverClockOffset, setServerClockOffset] = useState(0);

  const autostartRanRef = useRef(false);
  const skipNextRegisterSandboxRef = useRef(false);
  const pendingExplicitResetRef = useRef(false);
  const startingSandboxRef = useRef(false);
  const autoCancelSentRef = useRef(false);
  const toastTimerRef = useRef(null);
  const prevStateRef = useRef(null);
  const mutedRef = useRef(muted);
  const playerIdRef = useRef(playerId);
  const sandboxRoomIdRef = useRef(sandboxRoomId);
  const playerNameRef = useRef(playerName);
  const viewModeRef = useRef(viewMode);
  const actionPendingRef = useRef(false);
  const actionPendingTimerRef = useRef(null);
  const lastLocalSfxRef = useRef({ kind: '', at: 0 });
  const lastTickedSecondRef = useRef(null);
  const fxSeqRef = useRef(0);
  const fxTimersRef = useRef(new Set());

  const clearPendingAction = () => {
    actionPendingRef.current = false;
    if (actionPendingTimerRef.current) {
      clearTimeout(actionPendingTimerRef.current);
      actionPendingTimerRef.current = null;
    }
  };

  const beginPendingAction = () => {
    actionPendingRef.current = true;
    if (actionPendingTimerRef.current) clearTimeout(actionPendingTimerRef.current);
    actionPendingTimerRef.current = setTimeout(() => {
      actionPendingRef.current = false;
      actionPendingTimerRef.current = null;
    }, 1500);
  };

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    initAudioUnlock();
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    safeStorageSet('local', 'splendor_sound_muted', muted ? '1' : '0');
  }, [muted]);

  useEffect(() => {
    setBgmEnabled(bgmEnabled);
    safeStorageSet('local', 'splendor_bgm_enabled', bgmEnabled ? '1' : '0');
  }, [bgmEnabled]);

  useEffect(() => {
    setBgmVolume(bgmVolume);
    safeStorageSet('local', 'splendor_bgm_volume', String(bgmVolume));
  }, [bgmVolume]);

  useEffect(() => {
    setSoundTheme(soundTheme);
    safeStorageSet('local', 'splendor_sound_theme', soundTheme);
  }, [soundTheme]);

  useEffect(() => {
    setMasterVolume(soundVolume);
    safeStorageSet('local', 'splendor_sound_volume', String(soundVolume));
  }, [soundVolume]);

  const handleToggleBgm = () => {
    setBgmEnabledState((prev) => {
      const next = !prev;
      setBgmEnabled(next);
      return next;
    });
  };

  const handleBgmVolumeChange = (nextVol) => {
    const clamped = clampVolume(nextVol);
    setBgmVolumeState(clamped);
    setBgmVolume(clamped);
    if (clamped > 0 && !bgmEnabled) {
      setBgmEnabledState(true);
      setBgmEnabled(true);
    } else if (clamped <= 0.001 && bgmEnabled) {
      setBgmEnabledState(false);
      setBgmEnabled(false);
    }
  };

  const handleSelectSoundTheme = (nextThemeId) => {
    const resolved = setSoundTheme(nextThemeId);
    setSoundThemeState(resolved);
    if (!muted) {
      playThemePreview(resolved, false);
    }
  };

  const handleVolumeChange = (nextVol) => {
    const clamped = clampVolume(nextVol);
    setSoundVolumeState(clamped);
    setMasterVolume(clamped);
    if (clamped > 0 && muted) {
      setMuted(false);
    }
  };

  const scheduleFxCleanup = (fn, ms) => {
    const t = setTimeout(() => {
      fxTimersRef.current.delete(t);
      fn();
    }, ms);
    fxTimersRef.current.add(t);
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3200);
  };

  // Socket subscriptions + live state-diff tabletop FX trigger
  useEffect(() => {
    const nextId = () => {
      fxSeqRef.current += 1;
      return `fx_${fxSeqRef.current}`;
    };

    const resolvePlayerTarget = (pid, gemColor = null, forReserved = false) => {
      const dockEl = document.querySelector(`[data-dock-merchant="${pid}"]`);
      if (dockEl) {
        if (forReserved) {
          const res = getCenterRect('[data-dock-reserved="true"]');
          if (res) return res;
        }
        if (gemColor === 'gold') {
          const g = getCenterRect('[data-dock-gold="true"]');
          if (g) return g;
        } else if (gemColor) {
          const c = getCenterRect(`[data-dock-color="${gemColor}"]`);
          if (c) return c;
        }
        const r = dockEl.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
      }
      return getCenterRect(`[data-player-plaque="${pid}"]`);
    };

    const spawnSparkleAt = (x, y, color = 'gold', delayMs = 0, scale = 1) => {
      const spId = nextId();
      const emit = () => {
        setSparkles((prev) => [...prev, { id: spId, x, y, color, scale }]);
        scheduleFxCleanup(() => {
          setSparkles((prev) => prev.filter((s) => s.id !== spId));
        }, 1050);
      };
      if (delayMs > 0) {
        scheduleFxCleanup(emit, delayMs);
      } else {
        emit();
      }
    };

    const onStateUpdate = (state) => {
      clearPendingAction();

      const prev = prevStateRef.current;
      const expectedRoomId =
        viewModeRef.current === 'sandbox' ? `sandbox:${sandboxRoomIdRef.current}` : null;
      const guard = shouldAcceptStateUpdate(prev, state, {
        expectedRoomId,
        allowExplicitReset: pendingExplicitResetRef.current,
      });
      if (!guard.accept) {
        return;
      }

      pendingExplicitResetRef.current = false;
      startingSandboxRef.current = false;

      if (typeof state.serverNow === 'number') {
        setServerClockOffset(state.serverNow - Date.now());
      }
      setClockNow(Date.now());

      const myNextState = state.players?.find((p) => p.id === playerIdRef.current);
      if (!myNextState?.autoMode) {
        autoCancelSentRef.current = false;
      }

      prevStateRef.current = state;

      // Preserve active chip selection during our own active turn (e.g. while canceling AUTO mode);
      // drop stale selections whenever turnSequence advances or turn moves away from us.
      const nextCurrent = state.players?.[state.currentPlayerIndex];
      const turnSeqChanged = Boolean(prev && prev.turnSequence !== state.turnSequence);
      const preserveChipPick = shouldPreserveChipSelection(prev, state, playerIdRef.current);

      if (!preserveChipPick) {
        setSelectedGems((curr) => (curr.length > 0 ? [] : curr));
      }
      if (turnSeqChanged || !nextCurrent?.requiresGemReturn || nextCurrent.id !== playerIdRef.current) {
        setReturnSelection({ ...EMPTY_RETURN_SELECTION });
      }
      if (turnSeqChanged && (!nextCurrent || nextCurrent.id !== playerIdRef.current)) {
        setInspectCard(null);
      }

      if (prev && prev.status === 'playing' && state.status !== 'lobby') {
        const fx = diffGameStates(prev, state);
        const isMuted = mutedRef.current;
        const myId = playerIdRef.current;

        // 1. Flying 3D poker chips: Bank -> Player (longer silky parabolic arc + gem starlight)
        const nowMs = Date.now();
        const recentLocal = lastLocalSfxRef.current;
        const newChips = [];
        fx.takenGems.forEach(({ playerId: pid, colors }) => {
          const playedLocally =
            pid === myId && recentLocal.kind === 'chipCollect' && nowMs - recentLocal.at < 800;
          if (!playedLocally && colors.length > 0) {
            playChipCollect(isMuted, colors, pid === myId ? 0.95 : 0.72);
          }
          colors.forEach((color, idx) => {
            const from = getCenterRect(`[data-gem-bank="${color}"]`);
            const to = resolvePlayerTarget(pid, color, false);
            if (from && to) {
              const id = nextId();
              const delayMs = idx * 115;
              newChips.push({
                id,
                color,
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                arcY: -86 - (idx % 2) * 32,
                delayMs,
              });
              spawnSparkleAt(from.x, from.y, color, delayMs, 0.72);
              spawnSparkleAt(to.x, to.y, color, delayMs + 760, 1.05);
            }
          });
        });

        // 2. Spent / returned chips flying back: Player -> Bank (card purchase payment or >10 return)
        fx.returnedGems.forEach(({ playerId: pid, colors }) => {
          const playedLocally =
            pid === myId && recentLocal.kind === 'chipReturn' && nowMs - recentLocal.at < 800;
          if (!playedLocally && colors.length > 0) {
            scheduleFxCleanup(
              () => playChipReturn(isMuted, colors, pid === myId ? 0.92 : 0.7),
              60
            );
          }
          colors.slice(0, 5).forEach((color, idx) => {
            const from = resolvePlayerTarget(pid, color, false);
            const to = getCenterRect(`[data-gem-bank="${color}"]`);
            if (from && to) {
              const delayMs = idx * 75;
              newChips.push({
                id: nextId(),
                color,
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                arcY: -64,
                delayMs,
              });
              spawnSparkleAt(to.x, to.y, color, delayMs + 760, 0.85);
            }
          });
        });

        if (newChips.length > 0) {
          const ids = new Set(newChips.map((c) => c.id));
          setFlyingChips((curr) => [...curr, ...newChips]);
          scheduleFxCleanup(() => {
            setFlyingChips((curr) => curr.filter((c) => !ids.has(c.id)));
          }, 1350);
        }

        // 3. Flying card clone when bought or reserved from board (smooth 0.92s glide + double starlight)
        const newCards = [];
        const removedOrigins = [];
        fx.boardRemovals.forEach(({ card, actorId, action }) => {
          const from = getCenterRect(`[data-card-id="${card.id}"]`);
          const to = actorId
            ? resolvePlayerTarget(actorId, card.color, action === 'reserve')
            : null;
          if (from && to) {
            const id = nextId();
            newCards.push({
              id,
              card,
              action,
              fromX: from.rect.left,
              fromY: from.rect.top,
              width: from.rect.width,
              height: from.rect.height,
              toX: to.x - from.rect.width / 2,
              toY: to.y - from.rect.height / 2,
            });
            removedOrigins.push({ x: from.x, y: from.y, color: card.color });
            // Origin shimmer burst + lush destination magic burst
            spawnSparkleAt(from.x, from.y, action === 'reserve' ? 'gold' : card.color, 0, 1.0);
            spawnSparkleAt(to.x, to.y, action === 'reserve' ? 'gold' : card.color, 740, 1.25);

            const expectedKind = action === 'reserve' ? 'cardReserve' : 'cardBuy';
            const playedLocally =
              actorId === myId && recentLocal.kind === expectedKind && nowMs - recentLocal.at < 800;
            if (!playedLocally) {
              const vol = actorId === myId ? 0.95 : 0.72;
              if (action === 'reserve') playCardReserve(isMuted, vol);
              else playCardBuy(isMuted, vol);
            }
          }
        });

        if (newCards.length > 0) {
          const ids = new Set(newCards.map((c) => c.id));
          setFlyingCards((curr) => [...curr, ...newCards]);
          scheduleFxCleanup(() => {
            setFlyingCards((curr) => curr.filter((c) => !ids.has(c.id)));
          }, 1080);
        }

        // 4. Newly dealt replacement cards perform long smooth 1.18s 3D card flip from deck
        if (fx.dealtCardIds.length > 0) {
          const dealtSet = new Set(fx.dealtCardIds);
          fx.dealtCardIds.forEach((_, idx) => {
            scheduleFxCleanup(() => playCardDeal(isMuted, 0.92), 180 + idx * 140);
          });
          setNewlyDealtIds((curr) => [...new Set([...curr, ...fx.dealtCardIds])]);
          // Soft champagne starlight burst right as the flipped card lands face-up
          removedOrigins.forEach((orig) => {
            spawnSparkleAt(orig.x, orig.y, 'gold', 960, 0.92);
          });
          scheduleFxCleanup(() => {
            setNewlyDealtIds((curr) => curr.filter((id) => !dealtSet.has(id)));
          }, 1360);
        }

        // 5. Floating golden prestige +N popups & score medal bounce
        if (fx.scoreGains.length > 0) {
          const pops = [];
          const pulsed = [];
          fx.scoreGains.forEach(({ playerId: pid, delta }) => {
            pulsed.push(pid);
            const medalPos =
              getCenterRect(`[data-dock-merchant="${pid}"] .prestige-medal`) ||
              getCenterRect(`[data-player-plaque="${pid}"] .prestige-medal`);
            if (medalPos) {
              pops.push({ id: nextId(), x: medalPos.x, y: medalPos.y - 14, delta });
              spawnSparkleAt(medalPos.x, medalPos.y, 'gold', 60, 1.3);
            }
          });
          if (pops.length > 0) {
            const popIds = new Set(pops.map((p) => p.id));
            setScorePops((curr) => [...curr, ...pops]);
            scheduleFxCleanup(() => {
              setScorePops((curr) => curr.filter((p) => !popIds.has(p.id)));
            }, 1850);
          }
          if (pulsed.length > 0) {
            const pulsedSet = new Set(pulsed);
            setScorePulseIds((curr) => [...new Set([...curr, ...pulsed])]);
            scheduleFxCleanup(() => {
              setScorePulseIds((curr) => curr.filter((id) => !pulsedSet.has(id)));
            }, 1150);
          }
        }

        // 6. Noble Visit Royal Fanfare & Banner + Twin Golden Starbursts
        const hasNobleVisit = fx.nobleVisits.length > 0;
        if (hasNobleVisit) {
          const visit = fx.nobleVisits[0];
          playNobleFanfare(isMuted);
          const bId = nextId();
          const cleanName = (visit.playerName || '').replace(' (AI)', '');
          setFxBanner({
            id: bId,
            kind: 'noble',
            text: `귀족 방문 · ${cleanName} (+${visit.noble.points} 승점)`,
          });
          spawnSparkleAt(window.innerWidth * 0.42, 68, 'gold', 120, 1.35);
          spawnSparkleAt(window.innerWidth * 0.58, 68, 'gold', 260, 1.35);
          scheduleFxCleanup(() => {
            setFxBanner((curr) => (curr?.id === bId ? null : curr));
          }, 2850);
        }

        // 7. Turn-Conclusion Gilded Transition Flourish (signals handoff to the next player)
        if (fx.turnChangedTo) {
          const {
            playerId: toId,
            playerName: rawToName,
            isAi: toIsAi,
            fromPlayerId: fromId,
            fromPlayerName: rawFromName,
          } = fx.turnChangedTo;
          const isSelfTurn = !toIsAi && toId === myId;
          const cleanFrom = (rawFromName || '').replace(' (AI)', '').trim();
          const cleanTo = (rawToName || '').replace(' (AI)', '').trim();
          const tId = nextId();

          setTurnTransition({
            id: tId,
            fromId,
            toId,
            fromName: cleanFrom,
            toName: cleanTo,
            isSelf: isSelfTurn,
            hideCrest: hasNobleVisit,
          });
          playTurnTransition(isMuted, { isSelf: isSelfTurn, subtle: hasNobleVisit });
          scheduleFxCleanup(() => {
            setTurnTransition((curr) => (curr?.id === tId ? null : curr));
          }, 1460);

          if (isSelfTurn) {
            const portraitPos = getCenterRect(`[data-dock-merchant="${myId}"] .dock-avatar-frame`);
            if (portraitPos) {
              spawnSparkleAt(portraitPos.x + 68, portraitPos.rect.top - 28, 'gold', 120, 0.92);
            }
          } else {
            const nextPlaquePos = getCenterRect(`[data-player-plaque="${toId}"] .opponent-avatar-frame`);
            if (nextPlaquePos) {
              spawnSparkleAt(nextPlaquePos.x, nextPlaquePos.y, 'gold', 150, 0.78);
            }
          }
        }

        // 8. Opponent action whisper bubble
        if (fx.actorWhisper && fx.actorWhisper.playerId !== myId) {
          const { playerId: pid, text } = fx.actorWhisper;
          setPlayerWhispers((curr) => ({ ...curr, [pid]: text }));
          scheduleFxCleanup(() => {
            setPlayerWhispers((curr) => {
              if (curr[pid] !== text) return curr;
              const copy = { ...curr };
              delete copy[pid];
              return copy;
            });
          }, 2600);
        }
        // 9. Victory Notification Fanfare when match transitions to finished
        if (state.status === 'finished') {
          const isHumanWinner = Boolean(state.winner && state.winner.id === myId);
          scheduleFxCleanup(() => playVictoryFanfare(isMuted, isHumanWinner), 240);
        }
      }

      setGameState(state);
    };

    const onErrorMessage = (msg) => {
      clearPendingAction();
      showToast(msg);
    };

    const onTurnTimeout = ({ playerId: timedOutId, autoModeEnabled, wasAlreadyAuto }) => {
      clearPendingAction();
      if (timedOutId === playerIdRef.current) {
        setSelectedGems([]);
        setReturnSelection({ ...EMPTY_RETURN_SELECTION });
        setInspectCard(null);
        if (wasAlreadyAuto) {
          showToast('AUTO 모드: 10초 경과로 자동 선택이 진행되었습니다.');
        } else if (autoModeEnabled) {
          showToast('30초 시간 초과로 AUTO 모드로 전환되었습니다. (다음 차례 10초 후 자동 선택 · 터치 시 해제)');
        } else {
          showToast('30초 시간 초과로 자동 선택이 진행되었습니다.');
        }
      }
    };

    const onSandboxSessionMissing = () => {
      clearPendingAction();
      if (viewModeRef.current !== 'sandbox' || startingSandboxRef.current) return;
      setSelectedGems([]);
      setReturnSelection({ ...EMPTY_RETURN_SELECTION });
      setInspectCard(null);
      setGameState(null);
      prevStateRef.current = null;
      setViewMode('selector');
      showToast('대전 세션이 만료되었거나 서버가 새로고침되었습니다. 새 대전을 시작해 주세요.');
    };

    const onConnect = () => {
      clearPendingAction();
      const mode = viewModeRef.current;
      if (mode === 'tv') {
        socket.emit('register-tv');
      } else if (mode === 'sandbox') {
        socket.emit('register-sandbox', {
          playerId: playerIdRef.current,
          roomId: sandboxRoomIdRef.current,
        });
      } else if (mode === 'player') {
        const prevPlayers = prevStateRef.current?.players || [];
        const wasJoined = prevPlayers.some((p) => p.id === playerIdRef.current);
        if (wasJoined) {
          const clean = (playerNameRef.current || '').trim() || '베네치아 상인';
          socket.emit('join-game', { playerId: playerIdRef.current, name: clean, isAi: false });
        }
      }
    };

    socket.on('state-update', onStateUpdate);
    socket.on('error-message', onErrorMessage);
    socket.on('turn-timeout', onTurnTimeout);
    socket.on('sandbox-session-missing', onSandboxSessionMissing);
    socket.on('connect', onConnect);

    const timers = fxTimersRef.current;
    return () => {
      socket.off('state-update', onStateUpdate);
      socket.off('error-message', onErrorMessage);
      socket.off('turn-timeout', onTurnTimeout);
      socket.off('sandbox-session-missing', onSandboxSessionMissing);
      socket.off('connect', onConnect);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (actionPendingTimerRef.current) clearTimeout(actionPendingTimerRef.current);
      if (spotlightRestTimerRef.current) clearTimeout(spotlightRestTimerRef.current);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Title-screen portrait spotlight scheduler: starts static, highlights one card at a time
  useEffect(() => {
    if (spotlightRestTimerRef.current) {
      clearTimeout(spotlightRestTimerRef.current);
      spotlightRestTimerRef.current = null;
    }
    if (viewMode !== 'selector' || setupTab === 'local') {
      return undefined;
    }

    const playableCount = setupTab === 'spec' ? Math.min(setupCount, 3) : setupCount;
    if (spotlightSeatIdx !== null && spotlightSeatIdx < playableCount) {
      return undefined;
    }

    const delayMs = lastSpotlightSeatRef.current < 0 ? 1100 : 1400;
    spotlightRestTimerRef.current = setTimeout(() => {
      const nextIdx = (lastSpotlightSeatRef.current + 1) % playableCount;
      lastSpotlightSeatRef.current = nextIdx;
      setSpotlightSeatIdx(nextIdx);
    }, delayMs);

    return () => {
      if (spotlightRestTimerRef.current) {
        clearTimeout(spotlightRestTimerRef.current);
        spotlightRestTimerRef.current = null;
      }
    };
  }, [viewMode, setupTab, setupCount, spotlightSeatIdx]);

  const handleSpotlightComplete = useCallback((finishedIdx) => {
    lastSpotlightSeatRef.current = finishedIdx;
    setSpotlightSeatIdx((curr) => (curr === finishedIdx ? null : curr));
  }, []);

  const handleRequestSpotlight = useCallback((targetIdx) => {
    if (spotlightRestTimerRef.current) {
      clearTimeout(spotlightRestTimerRef.current);
      spotlightRestTimerRef.current = null;
    }
    lastSpotlightSeatRef.current = targetIdx;
    setSpotlightSeatIdx((curr) => (curr === targetIdx ? curr : targetIdx));
  }, []);

  const handleRemoveFourthSeat = useCallback(() => {
    setSetupCount(3);
    setSpotlightSeatIdx((curr) => (curr === 3 ? null : curr));
  }, []);

  // Register room when viewMode changes (skip redundant register when launchSandboxGame/autostart just started a match)
  useEffect(() => {
    if (viewMode === 'tv') {
      socket.emit('register-tv');
    } else if (viewMode === 'sandbox') {
      if (skipNextRegisterSandboxRef.current || initialRoute.autostart) {
        skipNextRegisterSandboxRef.current = false;
        return;
      }
      socket.emit('register-sandbox', { playerId, roomId: sandboxRoomId });
    }
  }, [viewMode, playerId, sandboxRoomId, initialRoute.autostart]);

  // Smooth 150ms ticker for authoritative 30-second turn countdown
  useEffect(() => {
    if (gameState?.status !== 'playing' || !gameState?.turnDeadlineAt) return undefined;
    const id = setInterval(() => {
      setClockNow(Date.now());
    }, 150);
    return () => clearInterval(id);
  }, [gameState?.status, gameState?.turnDeadlineAt, gameState?.turnSequence]);

  // Launch sandbox match cleanly in this tab's own isolated room
  const launchSandboxGame = (mode = setupTab === 'spec' ? 'spec' : 'pve', count = setupCount) => {
    const cleanName = playerName.trim() || '베네치아 상인';
    safeStorageSet('local', 'splendor_player_name', cleanName);
    clearPendingAction();
    pendingExplicitResetRef.current = true;
    startingSandboxRef.current = true;
    autoCancelSentRef.current = false;
    setSandboxMode(mode);
    setSelectedGems([]);
    setReturnSelection({ ...EMPTY_RETURN_SELECTION });
    setInspectCard(null);
    setConfirmRestart(false);
    setInspectedPlayerId(null);
    setShowSoundPanel(false);
    skipNextRegisterSandboxRef.current = true;
    setViewMode('sandbox');
    socket.emit('start-sandbox', {
      roomId: sandboxRoomId,
      mode,
      count,
      playerId,
      playerName: cleanName,
      trigger: 'new-match-from-lobby',
    });
  };

  // Support ?autostart=1 directly for verification & instant play
  useEffect(() => {
    if (initialRoute.autostart && !autostartRanRef.current) {
      autostartRanRef.current = true;
      pendingExplicitResetRef.current = true;
      startingSandboxRef.current = true;
      socket.emit('start-sandbox', {
        roomId: sandboxRoomId,
        mode: 'pve',
        count: 3,
        playerId,
        playerName: playerName.trim() || '베네치아 상인',
        trigger: 'new-match-from-lobby',
      });
    }
  }, [initialRoute.autostart, playerId, playerName, sandboxRoomId]);

  // Sync document.body.dataset.state for crisp state observability
  useEffect(() => {
    if (viewMode === 'selector') {
      document.body.dataset.state = 'title';
    } else if (gameState?.status === 'finished') {
      document.body.dataset.state = 'gameover';
    } else if (gameState?.status === 'playing') {
      document.body.dataset.state = 'playing';
    } else {
      document.body.dataset.state = 'lobby';
    }
  }, [viewMode, gameState?.status]);

  // Global keyboard shortcuts (M to mute/unmute, Escape to close popovers, Enter/Space to start on title)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (showSoundPanel) setShowSoundPanel(false);
        if (showChronicle) setShowChronicle(false);
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        setMuted((prev) => !prev);
        return;
      }

      if (e.key === 'b' || e.key === 'B') {
        handleToggleBgm();
        return;
      }

      if (viewMode === 'selector' && setupTab !== 'local' && tag !== 'BUTTON') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          launchSandboxGame(setupTab === 'spec' ? 'spec' : 'pve', setupCount);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Identify active player and bottom-dock merchant
  const players = gameState?.players || [];
  const currentPlayer = players[gameState?.currentPlayerIndex] || null;
  const humanPlayer = players.find((p) => p.id === playerId) || null;
  const isHumanTurn =
    gameState?.status === 'playing' &&
    Boolean(humanPlayer) &&
    currentPlayer?.id === humanPlayer.id &&
    !humanPlayer.isAi &&
    !humanPlayer.requiresGemReturn;

  const dockMerchant =
    (viewMode === 'sandbox' && sandboxMode === 'pve' && humanPlayer) ||
    players.find((p) => p.id === inspectedPlayerId) ||
    currentPlayer ||
    players[0] ||
    null;

  const leftOpponents = players.filter((p) => p.id !== dockMerchant?.id);

  // Authoritative 30-second turn countdown (skew-corrected against serverNow)
  const turnDurationMs = gameState?.turnDurationMs || 30000;
  const isTurnClockActive =
    gameState?.status === 'playing' && typeof gameState?.turnDeadlineAt === 'number';
  const turnRemainingMs = isTurnClockActive
    ? Math.max(0, gameState.turnDeadlineAt - (clockNow + serverClockOffset))
    : null;
  const turnRemainingSec =
    turnRemainingMs !== null
      ? Math.max(0, Math.min(Math.ceil(turnDurationMs / 1000), Math.ceil(turnRemainingMs / 1000)))
      : null;
  const turnProgress =
    turnRemainingMs !== null ? Math.max(0, Math.min(1, turnRemainingMs / turnDurationMs)) : 1;
  const isTurnUrgent = turnRemainingSec !== null && turnRemainingSec <= 10 && turnRemainingSec > 0;
  const isHumanActiveClock =
    gameState?.status === 'playing' &&
    Boolean(humanPlayer) &&
    currentPlayer?.id === humanPlayer.id &&
    !humanPlayer.isAi;

  // Trigger tense Renaissance timpani/clock cue once per second during 10..1 on the human player's turn
  useEffect(() => {
    if (!isHumanActiveClock || !isTurnUrgent || turnRemainingSec === null) {
      lastTickedSecondRef.current = null;
      return;
    }
    const tickKey = `${gameState?.turnSequence ?? 0}:${turnRemainingSec}`;
    if (lastTickedSecondRef.current !== tickKey) {
      lastTickedSecondRef.current = tickKey;
      playCountdownTick(mutedRef.current, turnRemainingSec);
    }
  }, [isHumanActiveClock, isTurnUrgent, turnRemainingSec, gameState?.turnSequence]);

  const handleCancelAutoMode = ({ silent = false } = {}) => {
    if (!humanPlayer || humanPlayer.isAi || !humanPlayer.autoMode) return;
    if (autoCancelSentRef.current) return;
    autoCancelSentRef.current = true;
    socket.emit('cancel-auto-mode', { playerId: humanPlayer.id });
    if (!silent) {
      showToast('AUTO 모드가 해제되었습니다. 수동 조작으로 전환합니다.');
    }
  };

  // Card selection inspection with subtle tier-scaled Renaissance audio cue
  const handleInspectCard = (card, fromReserved = false) => {
    if (!card || card.id === 'secret') return;
    handleCancelAutoMode();
    playCardSelect(muted, card.level || card.tier || 1);
    setInspectCard({ card, fromReserved });
  };

  // Gem selection logic (functional update + clear feedback on rule constraints)
  const availableDistinctGems = GEM_COLORS.filter((c) => (gameState?.gems?.[c] || 0) > 0).length;
  const requiredDistinctGems = Math.min(3, availableDistinctGems);

  const handleToggleGemPick = (color) => {
    if (!isHumanTurn) return;
    handleCancelAutoMode();
    if (color === 'gold') {
      showToast('황금 조커 토큰은 카드를 킵(예약)할 때 자동으로 1개 획득합니다.');
      return;
    }
    const bankCount = gameState?.gems?.[color] || 0;
    if (bankCount <= 0) return;

    const alreadyPicked = selectedGems.filter((c) => c === color).length;
    const uniqueCount = new Set(selectedGems).size;

    // Already picked 3 distinct colors and tapping a 4th color: explain clearly instead of silent no-op
    if (alreadyPicked === 0 && selectedGems.length >= 3 && uniqueCount === 3) {
      showToast('이미 3개 색상을 선택했습니다. "보석 가져오기"를 누르거나 선택한 칩을 눌러 해제하세요.');
      return;
    }

    // Tapping a single already-selected color when bank < 4: explain why taking 2 of same color is unavailable
    if (alreadyPicked === 1 && selectedGems.length === 1 && bankCount < 4) {
      showToast('같은 색 2개는 은행에 4개 이상 남았을 때만 가져올 수 있습니다.');
    }

    const willDeselect =
      alreadyPicked === 2 ||
      (alreadyPicked === 1 && !(selectedGems.length === 1 && bankCount >= 4));
    playChipPick(muted, color, willDeselect ? -1 : selectedGems.length);

    // Immediate gem-matched magic starlight burst right on the clicked poker chip stack
    const bankPos = getCenterRect(`[data-gem-bank="${color}"]`);
    if (bankPos) {
      fxSeqRef.current += 1;
      const spId = `fx_click_${fxSeqRef.current}`;
      setSparkles((prev) => [
        ...prev,
        { id: spId, x: bankPos.x + 12, y: bankPos.y - 4, color, scale: 0.82 },
      ]);
      scheduleFxCleanup(() => {
        setSparkles((prev) => prev.filter((s) => s.id !== spId));
      }, 950);
    }

    setSelectedGems((prev) => {
      const sameColorCount = prev.filter((c) => c === color).length;
      const uniqueColors = new Set(prev);

      // If already picked 2 of this color -> clear it
      if (sameColorCount === 2) {
        return prev.filter((c) => c !== color);
      }

      // If picked 1 of this color as the ONLY pick, and bank >= 4 -> upgrade to 2 of same color!
      if (sameColorCount === 1) {
        if (prev.length === 1 && bankCount >= 4) {
          return [color, color];
        }
        // Otherwise deselect this color
        return prev.filter((c) => c !== color);
      }

      // Currently 0 of this color picked:
      // If we already have a pair (e.g., [blue, blue]), switch to picking this new color
      if (prev.length === 2 && uniqueColors.size === 1) {
        return [color];
      }

      // Already 3 different colors picked -> keep current selection
      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, color];
    });
  };

  const removePickedGemAt = (idx) => {
    playChipPick(muted, selectedGems[idx] || 'white', -1);
    setSelectedGems((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmitGemPick = (() => {
    if (!isHumanTurn || selectedGems.length === 0) return false;
    if (selectedGems.length === 2 && selectedGems[0] === selectedGems[1]) {
      return (gameState?.gems?.[selectedGems[0]] || 0) >= 4;
    }
    const unique = new Set(selectedGems);
    if (unique.size !== selectedGems.length) return false;
    if (selectedGems.some((c) => (gameState?.gems?.[c] || 0) <= 0)) return false;
    return requiredDistinctGems > 0 && selectedGems.length === requiredDistinctGems;
  })();

  const handleConfirmGems = () => {
    if (!humanPlayer || !canSubmitGemPick || actionPendingRef.current) return;
    handleCancelAutoMode({ silent: true });
    beginPendingAction();
    recordLocalSfx(lastLocalSfxRef, 'chipCollect');
    playChipCollect(muted, selectedGems);
    if (selectedGems.length === 2 && selectedGems[0] === selectedGems[1]) {
      socket.emit('take-two-gems', { playerId: humanPlayer.id, color: selectedGems[0] });
    } else {
      socket.emit('take-gems', { playerId: humanPlayer.id, colors: selectedGems });
    }
    setSelectedGems([]);
  };

  const handleBuyCard = (card) => {
    if (!humanPlayer || !isHumanTurn || actionPendingRef.current) return;
    handleCancelAutoMode({ silent: true });
    beginPendingAction();
    recordLocalSfx(lastLocalSfxRef, 'cardBuy');
    playCardBuy(muted);
    socket.emit('buy-card', { playerId: humanPlayer.id, cardId: card.id });
    setInspectCard(null);
    setSelectedGems([]);
  };

  const handleReserveCard = (card, tier = null) => {
    if (!humanPlayer || !isHumanTurn || actionPendingRef.current) return;
    handleCancelAutoMode({ silent: true });
    if ((humanPlayer.reserved?.length || 0) >= 3) {
      showToast('킵 슬롯(최대 3장)이 모두 가득 찼습니다.');
      return;
    }
    beginPendingAction();
    recordLocalSfx(lastLocalSfxRef, 'cardReserve');
    playCardReserve(muted);
    socket.emit('reserve-card', {
      playerId: humanPlayer.id,
      cardId: card ? card.id : null,
      tier: card ? null : tier,
    });
    setInspectCard(null);
    setSelectedGems([]);
  };

  // Excess gem return logic
  const mustReturnGems = Boolean(humanPlayer && humanPlayer.requiresGemReturn);
  const humanGemTotal = humanPlayer
    ? Object.values(humanPlayer.gems || {}).reduce((a, b) => a + b, 0)
    : 0;
  const excessToReturn = Math.max(0, humanGemTotal - 10);
  const selectedReturnTotal = Object.values(returnSelection).reduce((a, b) => a + b, 0);

  const adjustReturnColor = (color, delta) => {
    if (!humanPlayer) return;
    handleCancelAutoMode();
    playChipPick(muted, color, delta < 0 ? -1 : 0);
    setReturnSelection((prev) => {
      const current = prev[color] || 0;
      const held = humanPlayer.gems?.[color] || 0;
      const totalNow = Object.values(prev).reduce((a, b) => a + b, 0);
      if (delta > 0 && (current >= held || totalNow >= excessToReturn)) return prev;
      if (delta < 0 && current <= 0) return prev;
      return { ...prev, [color]: current + delta };
    });
  };

  const handleSubmitGemReturn = () => {
    if (!humanPlayer || selectedReturnTotal !== excessToReturn || actionPendingRef.current) return;
    handleCancelAutoMode({ silent: true });
    beginPendingAction();
    const returnedColors = Object.entries(returnSelection)
      .filter(([, cnt]) => cnt > 0)
      .map(([c]) => c);
    recordLocalSfx(lastLocalSfxRef, 'chipReturn');
    playChipReturn(muted, returnedColors, 0.95);
    socket.emit('return-gems', {
      playerId: humanPlayer.id,
      gemCounts: returnSelection,
    });
    setReturnSelection({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
  };

  // =========================================================================
  // VIEW 1: STEAM-STYLE SETUP / TITLE SCREEN
  // =========================================================================
  if (viewMode === 'selector') {
    const nobleRuleCount = setupCount === 4 ? 5 : 4;
    const gemRuleCount = setupCount === 4 ? 7 : 5;

    const seatConfigs = setupTab === 'spec' ? SETUP_SPEC_SEATS : SETUP_PVE_SEATS;

    const activeThemeMeta = getSoundTheme(soundTheme);

    return (
      <main className="setup-stage">
        <SetupRenaissanceBackdrop />
        <VelvetAmbience variant="setup" />
        {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}

        <div className="setup-sound-corner-group">
          <button
            type="button"
            className={`setup-sound-corner-btn is-bgm ${bgmEnabled ? 'is-active' : ''}`}
            onClick={handleToggleBgm}
            data-bgm-toggle="true"
            aria-pressed={bgmEnabled}
            aria-label={bgmEnabled ? '배경음악 끄기' : '배경음악 켜기'}
            title={bgmEnabled ? '배경음악 끄기 (B)' : '배경음악 켜기 (B)'}
          >
            <Music size={15} />
            <span>{bgmEnabled ? 'BGM ON' : 'BGM OFF'}</span>
          </button>

          <button
            type="button"
            className={`setup-sound-corner-btn ${showSoundPanel ? 'is-active' : ''}`}
            onClick={() => setShowSoundPanel((v) => !v)}
            data-sound-settings="true"
            aria-label="르네상스 음향 테마 및 효과음 설정"
            aria-expanded={showSoundPanel}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{muted ? '효과음 꺼짐' : activeThemeMeta.name}</span>
          </button>
        </div>

        {showSoundPanel && (
          <SoundThemePopover
            soundTheme={soundTheme}
            onSelectTheme={handleSelectSoundTheme}
            bgmEnabled={bgmEnabled}
            onToggleBgm={handleToggleBgm}
            bgmVolume={bgmVolume}
            onBgmVolumeChange={handleBgmVolumeChange}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            volume={soundVolume}
            onVolumeChange={handleVolumeChange}
            onClose={() => setShowSoundPanel(false)}
            placement="corner"
          />
        )}

        <div className="setup-top-bar">
          <SplendorEmblem />
          <div className="setup-mode-tabs" role="tablist" aria-label="게임 모드 선택">
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'pve'}
              className={`setup-tab-btn ${setupTab === 'pve' ? 'is-active' : ''}`}
              onClick={() => setSetupTab('pve')}
            >
              솔로 대전 (1인 vs AI)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'spec'}
              className={`setup-tab-btn ${setupTab === 'spec' ? 'is-active' : ''}`}
              onClick={() => setSetupTab('spec')}
            >
              AI 관전
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'local'}
              className={`setup-tab-btn ${setupTab === 'local' ? 'is-active' : ''}`}
              onClick={() => setSetupTab('local')}
            >
              TV · 모바일 로컬
            </button>
          </div>
        </div>

        {setupTab === 'local' ? (
          <section className="local-multi-grid">
            <div className="local-mode-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Tv size={46} color="#e2bd6d" />
                <h3>TV 공용 테이블 보드</h3>
                <p>
                  거실 모니터나 TV에 보석 은행, 개발 카드 시장, 귀족 타일을 크게 띄웁니다.
                  플레이어들은 QR 코드를 스캔해 스마트폰으로 참가합니다.
                </p>
              </div>
              <button
                type="button"
                className="btn-gilded-primary"
                onClick={() => setViewMode('tv')}
              >
                TV 보드 열기
              </button>
            </div>

            <div className="local-mode-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Smartphone size={46} color="#e2bd6d" />
                <h3>모바일 핸드헬드 컨트롤러</h3>
                <p>
                  TV 공용 보드와 실시간으로 연동되는 개인 손패 컨트롤러입니다.
                  보석 채집, 카드 구매, 비공개 킵을 휴대폰에서 조작합니다.
                </p>
              </div>
              <button
                type="button"
                className="btn-gilded-primary"
                onClick={() => setViewMode('player')}
              >
                모바일 참가하기
              </button>
            </div>
          </section>
        ) : (
          <section className="setup-workspace" aria-label="대전 설정">
            {/* Left 2x2 Ornate Portrait Grid */}
            <div className="setup-portrait-grid">
              {seatConfigs.slice(0, 3).map((seat, idx) => (
                <SetupPortraitCard
                  key={`${setupTab}-seat-${idx}`}
                  seat={seat}
                  seatIndex={idx}
                  isSpotlight={spotlightSeatIdx === idx}
                  onSpotlightComplete={handleSpotlightComplete}
                  onRequestSpotlight={handleRequestSpotlight}
                  playerName={seat.isHuman ? playerName : undefined}
                  onPlayerNameChange={seat.isHuman ? setPlayerName : undefined}
                />
              ))}

              {/* 4th Seat: Toggleable between + Add Merchant and 4th AI Portrait */}
              {setupCount === 4 ? (
                <SetupPortraitCard
                  key={`${setupTab}-seat-3`}
                  seat={seatConfigs[3]}
                  seatIndex={3}
                  isSpotlight={spotlightSeatIdx === 3}
                  onSpotlightComplete={handleSpotlightComplete}
                  onRequestSpotlight={handleRequestSpotlight}
                  onRemoveSeat={handleRemoveFourthSeat}
                />
              ) : (
                <button
                  type="button"
                  className="setup-seat-add"
                  onClick={() => setSetupCount(4)}
                  aria-label="4번째 AI 상인 추가하여 4인 대전으로 변경"
                >
                  <div className="setup-add-medallion">
                    <Compass size={42} />
                  </div>
                  <span className="setup-add-label">
                    <Plus size={19} style={{ display: 'inline', verticalAlign: '-3px' }} /> 4번째 상인 추가
                  </span>
                  <span className="setup-add-hint">클릭하여 4인 대전으로 확장</span>
                </button>
              )}
            </div>

            {/* Right Antique Dark-Plum Rulebook Plaque */}
            <aside className="setup-rulebook" aria-label="대전 규칙 요약">
              <span className="setup-card-sheen is-rulebook" aria-hidden="true" />
              <span className="setup-card-glint glint-a" aria-hidden="true" />
              <span className="setup-card-glint glint-b" aria-hidden="true" />
              <div className="setup-rule-header">
                <h2 className="setup-rule-title">{setupCount}인 길드 대전</h2>
                <div className="setup-rule-divider" />
              </div>

              <ul className="setup-rule-list">
                <li>
                  <span className="setup-rule-key">참가 귀족 타일</span>
                  <span className="setup-rule-val numeric">{nobleRuleCount}명</span>
                </li>
                <li>
                  <span className="setup-rule-key">황금 조커 토큰</span>
                  <span className="setup-rule-val numeric">5개</span>
                </li>
                <li>
                  <span className="setup-rule-key">색상별 보석 토큰</span>
                  <span className="setup-rule-val numeric">{gemRuleCount}개</span>
                </li>
              </ul>

              <div className="setup-victory-seal">
                <div className="setup-seal-circle" aria-label="승리 목표 승점 15점">
                  <span className="setup-seal-num">15</span>
                </div>
                <span className="setup-seal-caption">15점 달성 시 승리</span>
              </div>

              <button
                type="button"
                className="btn-gilded-primary"
                data-start="true"
                onClick={() => launchSandboxGame(setupTab === 'spec' ? 'spec' : 'pve', setupCount)}
              >
                {setupTab === 'spec' ? 'AI 대전 관전 시작' : '게임 시작'}
              </button>
            </aside>
          </section>
        )}

        <p className="setup-control-hint">
          {setupTab === 'local'
            ? 'TV 보드의 QR 코드를 스마트폰으로 스캔해 최대 4인 로컬 멀티플레이를 즐기세요'
            : 'Enter · Space 바로 시작  ·  보석 3종 수집 · 개발 카드 구매 · 귀족 후원 15점 선취'}
        </p>
      </main>
    );
  }

  // =========================================================================
  // VIEW 2: TV LOBBY (waiting for phones to join)
  // =========================================================================
  if (viewMode === 'tv' && (!gameState || gameState.status === 'lobby')) {
    const mobileUrl = gameState
      ? `${window.location.protocol}//${gameState.localIp}:${gameState.port}/?view=player`
      : `${window.location.origin}/?view=player`;

    return (
      <main className="tv-lobby-shell">
        {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}
        <SplendorEmblem />
        <div className="tv-lobby-grid">
          <div className="tv-panel" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h2 className="setup-rule-title" style={{ fontSize: '1.25rem' }}>모바일 참가 QR</h2>
            <div className="qr-frame">
              <QRCodeSVG value={mobileUrl} size={188} />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', wordBreak: 'break-all' }}>
              {mobileUrl}
            </p>
          </div>

          <div className="tv-panel" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 className="setup-rule-title" style={{ fontSize: '1.25rem' }}>
                참가 대기 상인 ({players.length} / 4)
              </h2>
              {players.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
                  스마트폰으로 QR 코드를 스캔하거나 새 탭에서 모바일 컨트롤러로 입장하세요.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {players.map((p, idx) => (
                    <div key={p.id} className="victory-row">
                      <span style={{ fontWeight: 700 }}>{idx + 1}. {p.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--gold-primary)' }}>준비 완료</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-gilded-primary"
                disabled={players.length < 2}
                onClick={() => socket.emit('start-game')}
              >
                게임 시작 ({players.length}인)
              </button>
              <button
                type="button"
                className="btn-gilded-secondary"
                onClick={() => setViewMode('selector')}
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // VIEW 3: MOBILE HANDHELD CONTROLLER (?view=player)
  // =========================================================================
  if (viewMode === 'player') {
    const joinedMe = players.find((p) => p.id === playerId);
    const mobileIsMyTurn =
      gameState?.status === 'playing' &&
      Boolean(joinedMe) &&
      currentPlayer?.id === joinedMe.id &&
      !joinedMe.requiresGemReturn;

    if (!joinedMe) {
      return (
        <main className="mobile-shell" style={{ justifyContent: 'center' }}>
          {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <SplendorEmblem compact />
          </div>
          <div className="mobile-panel">
            <h2 className="modal-title">상인 길드 입장</h2>
            <input
              type="text"
              className="setup-name-input"
              value={playerName}
              maxLength={14}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="상인 이름"
              aria-label="상인 이름"
            />
            <button
              type="button"
              className="btn-gilded-primary"
              onClick={() => {
                const clean = playerName.trim() || '베네치아 상인';
                safeStorageSet('local', 'splendor_player_name', clean);
                socket.emit('join-game', { playerId, name: clean, isAi: false });
              }}
            >
              테이블 참가하기
            </button>
            <button
              type="button"
              className="btn-gilded-secondary"
              onClick={() => setViewMode('selector')}
            >
              메인 화면으로
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="mobile-shell">
        {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}
        <header className="mobile-panel" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1rem' }}>
              <span>{joinedMe.name}</span>
              {joinedMe.autoMode && (
                <button
                  type="button"
                  className="auto-mode-badge is-sm"
                  data-auto-mode="true"
                  onClick={() => handleCancelAutoMode()}
                  title="AUTO 모드 해제"
                >
                  <span className="auto-mode-dot" aria-hidden="true" />
                  <span>AUTO</span>
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: mobileIsMyTurn ? 'var(--gold-bright)' : 'var(--ink-muted)' }}>
              {gameState?.status === 'lobby'
                ? 'TV에서 게임 시작 대기 중'
                : joinedMe.autoMode
                  ? mobileIsMyTurn
                    ? `AUTO 모드 · ${turnRemainingSec ?? 10}초 후 자동 선택 (터치 시 해제)`
                    : 'AUTO 모드 활성화 (터치 시 해제)'
                  : mobileIsMyTurn
                    ? '당신의 턴입니다'
                    : `${currentPlayer?.name || ''} 진행 중`}
            </div>
          </div>
          <div className="prestige-medal is-sm">{joinedMe.points}</div>
        </header>

        {gameState?.status === 'playing' && (
          <>
            <div className="setup-mode-tabs" style={{ width: '100%', justifyContent: 'space-between' }}>
              <button
                type="button"
                className={`setup-tab-btn ${mobileTab === 'gems' ? 'is-active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setMobileTab('gems')}
              >
                보석 채집
              </button>
              <button
                type="button"
                className={`setup-tab-btn ${mobileTab === 'cards' ? 'is-active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setMobileTab('cards')}
              >
                시장 카드
              </button>
              <button
                type="button"
                className={`setup-tab-btn ${mobileTab === 'reserved' ? 'is-active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setMobileTab('reserved')}
              >
                킵 ({joinedMe.reserved?.length || 0})
              </button>
            </div>

            {mobileTab === 'gems' && (
              <section className="mobile-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  {GEM_COLORS.map((color) => {
                    const picked = selectedGems.filter((c) => c === color).length;
                    return (
                      <GemChip
                        key={color}
                        color={color}
                        count={gameState.gems?.[color] || 0}
                        selectedCount={picked}
                        interactive={mobileIsMyTurn}
                        disabled={!mobileIsMyTurn || (gameState.gems?.[color] || 0) === 0}
                        onClick={() => handleToggleGemPick(color)}
                      />
                    );
                  })}
                </div>
                {selectedGems.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn-gilded-primary"
                      disabled={!canSubmitGemPick}
                      onClick={handleConfirmGems}
                    >
                      보석 가져오기 ({selectedGems.length})
                    </button>
                    <button
                      type="button"
                      className="btn-gilded-secondary"
                      onClick={() => setSelectedGems([])}
                    >
                      취소
                    </button>
                  </div>
                )}
              </section>
            )}

            {mobileTab === 'cards' && (
              <section className="mobile-panel">
                {[3, 2, 1].map((tier) => (
                  <div key={tier} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gold-primary)', fontWeight: 700 }}>
                      {tier === 3 ? 'III단계' : tier === 2 ? 'II단계' : 'I단계'}
                    </div>
                    <div className="mobile-card-grid">
                      {(gameState.board?.[tier] || []).map((card) => (
                        <DevelopmentCard
                          key={card.id}
                          card={card}
                          affordable={canAffordCard(joinedMe, card)}
                          interactive={mobileIsMyTurn}
                          onClick={mobileIsMyTurn ? () => setInspectCard({ card, fromReserved: false }) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {mobileTab === 'reserved' && (
              <section className="mobile-panel">
                {(joinedMe.reserved?.length || 0) === 0 ? (
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-muted)' }}>보유 중인 킵 카드가 없습니다.</p>
                ) : (
                  <div className="mobile-card-grid">
                    {joinedMe.reserved.map((card) => (
                      <DevelopmentCard
                        key={card.id}
                        card={card}
                        affordable={canAffordCard(joinedMe, card)}
                        interactive={mobileIsMyTurn}
                        onClick={mobileIsMyTurn ? () => setInspectCard({ card, fromReserved: true }) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* Reuse Card Action Modal on Mobile */}
        {inspectCard && joinedMe && (
          <CardActionModal
            card={inspectCard.card}
            fromReserved={inspectCard.fromReserved}
            player={joinedMe}
            canAct={mobileIsMyTurn}
            onBuy={() => handleBuyCard(inspectCard.card)}
            onReserve={() => handleReserveCard(inspectCard.card)}
            onClose={() => setInspectCard(null)}
          />
        )}

        {/* Excess Gem Return Modal (>10 tokens) on Mobile */}
        {mustReturnGems && joinedMe && (
          <div className="steam-modal-backdrop" role="dialog" aria-modal="true" aria-label="초과 보석 반납">
            <div className="steam-modal-card">
              <div className="modal-header-row">
                <h2 className="modal-title">보석 10개 초과 반납</h2>
                <span className="numeric" style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>
                  {selectedReturnTotal} / {excessToReturn}개 선택
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                보유 보석은 최대 10개까지입니다. 반납할 보석 {excessToReturn}개를 선택하세요.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '10px' }}>
                {ALL_GEM_COLORS.map((color) => {
                  const held = joinedMe.gems?.[color] || 0;
                  const picked = returnSelection[color] || 0;
                  if (held === 0) return null;
                  return (
                    <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <GemChip
                        color={color}
                        count={held - picked}
                        selectedCount={picked}
                        interactive
                        onClick={() => adjustReturnColor(color, 1)}
                      />
                      {picked > 0 && (
                        <button
                          type="button"
                          className="floating-cancel-btn"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={() => adjustReturnColor(color, -1)}
                        >
                          -1
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-gilded-primary"
                disabled={selectedReturnTotal !== excessToReturn}
                onClick={handleSubmitGemReturn}
              >
                <Check size={18} /> 선택한 보석 반납하기
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // =========================================================================
  // VIEW 4: FULL-BLEED DIRECT-PLAY STEAM SPLENDOR TABLETOP (sandbox / tv)
  // =========================================================================
  if (!gameState) {
    return (
      <main className="setup-stage">
        <SplendorEmblem />
        <p style={{ color: 'var(--ink-secondary)' }}>르네상스 보석 테이블을 준비하는 중...</p>
      </main>
    );
  }

  const interactiveBoard = viewMode === 'sandbox' && sandboxMode === 'pve' && isHumanTurn;
  const dockGemTotal = dockMerchant
    ? Object.values(dockMerchant.gems || {}).reduce((a, b) => a + b, 0)
    : 0;
  const dockIsCurrent = dockMerchant && currentPlayer?.id === dockMerchant.id;

  return (
    <div className="steam-tabletop">
      <VelvetAmbience />
      <TabletopEffectsLayer
        flyingChips={flyingChips}
        flyingCards={flyingCards}
        sparkles={sparkles}
        scorePops={scorePops}
        banner={fxBanner}
        turnTransition={turnTransition}
      />

      {isHumanActiveClock && isTurnUrgent && (
        <TurnCountdownSlamOverlay
          secondsLeft={turnRemainingSec}
          lifted={selectedGems.length > 0}
          autoMode={Boolean(humanPlayer?.autoMode)}
        />
      )}

      {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}

      {/* MAIN VELVET PLAYMAT: Left Opponents | Center 3x5 Market | Right Poker Chips | Far-Right Nobles */}
      <main className="steam-playmat" aria-label="스플렌더 게임 테이블">
        {/* 1. LEFT EDGE: OPPONENT PORTRAIT PLAQUES */}
        <aside className="steam-opponents-col" aria-label="상대 상인 현황">
          {leftOpponents.map((opp, idx) => {
            const oppIsActive = gameState.status === 'playing' && currentPlayer?.id === opp.id;
            return (
              <OpponentPortraitPlaque
                key={opp.id}
                player={opp}
                index={idx + 1}
                isActive={oppIsActive}
                isInspected={inspectedPlayerId === opp.id}
                actionWhisper={playerWhispers[opp.id] || null}
                scorePulse={scorePulseIds.includes(opp.id)}
                turnRemainingSec={oppIsActive ? turnRemainingSec : null}
                turnProgress={oppIsActive ? turnProgress : 1}
                isTurnUrgent={oppIsActive && isTurnUrgent}
                onClick={
                  sandboxMode === 'spec' || viewMode === 'tv'
                    ? () => setInspectedPlayerId(opp.id)
                    : undefined
                }
              />
            );
          })}
        </aside>

        {/* 2. CENTER: 3x5 DEVELOPMENT CARD MARKET ON OPEN VELVET */}
        <section className="steam-market-zone" aria-label="개발 카드 시장">
          {[3, 2, 1].map((tier) => (
            <div key={tier} className="steam-tier-row" data-tier={tier}>
              <SteamDeckStack3D
                tier={tier}
                count={gameState.deckCounts?.[tier] ?? 0}
                interactive={interactiveBoard}
                disabled={!interactiveBoard || (humanPlayer?.reserved?.length || 0) >= 3}
                onClick={() => handleReserveCard(null, tier)}
              />
              {(gameState.board?.[tier] || []).map((card) => {
                const isFocused = Object.values(gameState.focusMap || {}).includes(card.id);
                const affordable = interactiveBoard && canAffordCard(humanPlayer, card);
                const isNew = newlyDealtIds.includes(card.id);
                return (
                  <DevelopmentCard
                    key={card.id}
                    card={card}
                    affordable={affordable}
                    isFocused={isFocused}
                    isNew={isNew}
                    interactive={viewMode === 'sandbox'}
                    onClick={
                      viewMode === 'sandbox'
                        ? () => handleInspectCard(card, false)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </section>

        {/* 3. RIGHT-CENTER: VERTICAL 3D STACKED POKER CHIP COLUMN (Steam Order) */}
        <section className="steam-chip-bank-col" aria-label="보석 은행 토큰">
          {STEAM_TOKEN_ORDER.map((color) => {
            const count = gameState.gems?.[color] || 0;
            const picked = selectedGems.filter((c) => c === color).length;
            return (
              <PokerChipStack3D
                key={color}
                color={color}
                count={count}
                selectedCount={picked}
                interactive={interactiveBoard}
                disabled={!interactiveBoard}
                onClick={() => handleToggleGemPick(color)}
              />
            );
          })}
        </section>

        {/* 4. FAR-RIGHT: VERTICAL SQUARE NOBLE TILES */}
        <aside className="steam-nobles-col" aria-label="귀족 타일">
          {(gameState.nobles || []).map((noble, idx) => (
            <NobleTile key={noble.id} noble={noble} index={idx} />
          ))}
        </aside>
      </main>

      {/* FLOATING GEM SELECTION CONFIRM BAR (only visible when picking chips) */}
      {interactiveBoard && selectedGems.length > 0 && (
        <div className="floating-gem-bar" role="region" aria-label="선택한 보석 확정">
          <div className="floating-gem-picks">
            {selectedGems.map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                type="button"
                className={`picked-chip-pill cost-${color}`}
                onClick={() => removePickedGemAt(idx)}
                title="클릭하여 선택 해제"
              >
                <FacetedGemSvg color={color} size={15} />
                <span>{GEM_META[color]?.short}</span>
                <X size={12} />
              </button>
            ))}
          </div>

          <span className="floating-gem-hint">
            {selectedGems.length === 2 && selectedGems[0] === selectedGems[1]
              ? '같은 색 2개 채집'
              : `서로 다른 색 ${selectedGems.length}/${requiredDistinctGems}`}
          </span>

          <button
            type="button"
            className="floating-confirm-btn"
            disabled={!canSubmitGemPick}
            onClick={handleConfirmGems}
            data-confirm-gems="true"
          >
            보석 가져오기
          </button>

          <button
            type="button"
            className="floating-cancel-btn"
            onClick={() => setSelectedGems([])}
          >
            취소
          </button>
        </div>
      )}

      {/* CHRONICLE LOG POPOVER (cleanly toggled from bottom dock) */}
      {showChronicle && (
        <aside className="chronicle-popover" aria-label="길드 기록">
          <div className="chronicle-header">
            <span>길드 연대기</span>
            <button
              type="button"
              className="dock-icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={() => setShowChronicle(false)}
              aria-label="길드 기록 닫기"
            >
              <X size={15} />
            </button>
          </div>
          <div className="chronicle-list">
            {(gameState.logs || []).length === 0 ? (
              <div className="chronicle-item">아직 기록이 없습니다.</div>
            ) : (
              gameState.logs.map((entry, idx) => {
                const key = typeof entry === 'object' && entry?.id ? entry.id : idx;
                const time = typeof entry === 'object' ? entry?.time : null;
                const text = typeof entry === 'string' ? entry : entry?.text || '';
                return (
                  <div key={key} className="chronicle-item">
                    {time && (
                      <span style={{ color: 'var(--ink-muted)', marginRight: '6px', fontSize: '0.72rem' }}>
                        [{time}]
                      </span>
                    )}
                    <span>{text}</span>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* SOUND THEME POPOVER (toggled cleanly from bottom dock) */}
      {showSoundPanel && (
        <SoundThemePopover
          soundTheme={soundTheme}
          onSelectTheme={handleSelectSoundTheme}
          bgmEnabled={bgmEnabled}
          onToggleBgm={handleToggleBgm}
          bgmVolume={bgmVolume}
          onBgmVolumeChange={handleBgmVolumeChange}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          volume={soundVolume}
          onVolumeChange={handleVolumeChange}
          onClose={() => setShowSoundPanel(false)}
          placement="dock"
        />
      )}

      {/* BOTTOM HORIZONTAL MERCHANT DOCK */}
      <footer
        className={`steam-bottom-dock ${dockIsCurrent && gameState.status === 'playing' ? 'is-my-turn' : ''} ${dockIsCurrent && isTurnUrgent ? 'is-urgent' : ''} ${dockMerchant?.autoMode && !dockMerchant?.isAi ? 'is-auto-mode' : ''}`}
        aria-label="내 상인 트레이"
        data-dock-merchant={dockMerchant?.id || ''}
        data-dock-auto={dockMerchant?.autoMode && !dockMerchant?.isAi ? 'true' : 'false'}
      >
        <TurnGlowBorder
          active={Boolean(dockIsCurrent && gameState.status === 'playing')}
          rx={10}
          inset={3}
          urgent={Boolean(dockIsCurrent && isTurnUrgent)}
        />

        {/* Dock Left: Merchant Portrait & Prestige Medal */}
        {dockMerchant ? (
          <div className="dock-merchant-identity">
            {viewMode === 'sandbox' &&
              sandboxMode === 'pve' &&
              gameState.status === 'playing' &&
              dockIsCurrent &&
              !dockMerchant.isAi && (
                <PortraitTurnBanner
                  key={`your-turn-${gameState.turnSequence ?? 0}`}
                  turnSequence={gameState.turnSequence}
                  urgent={Boolean(isTurnUrgent)}
                />
              )}
            <div className="dock-avatar-wrap">
              <div className="dock-avatar-frame">
                <img
                  src={getPlayerPortrait(dockMerchant, 0)}
                  alt={dockMerchant.name}
                  className="dock-avatar-img"
                />
              </div>
              {!dockMerchant.isAi && dockMerchant.autoMode && (
                <button
                  type="button"
                  className="auto-mode-badge is-dock-crest"
                  data-auto-mode="true"
                  onClick={
                    dockMerchant.id === humanPlayer?.id
                      ? () => handleCancelAutoMode()
                      : undefined
                  }
                  disabled={dockMerchant.id !== humanPlayer?.id}
                  title="AUTO 모드 활성화 (10초 후 자동 선택 · 클릭하거나 보석/카드 선택 시 해제)"
                  aria-label="AUTO 모드 활성화 중, 클릭하여 자동 모드 해제"
                >
                  <span className="auto-mode-dot" aria-hidden="true" />
                  <span>AUTO</span>
                </button>
              )}
            </div>

            <div className="dock-merchant-info">
              <div className="dock-name-row">
                <span className="dock-merchant-name">
                  {dockMerchant.name.replace(' (AI)', '')}
                </span>
                <div
                  className={`prestige-medal is-sm ${scorePulseIds.includes(dockMerchant.id) ? 'is-score-pop' : ''}`}
                  aria-label={`현재 승점 ${dockMerchant.points}점`}
                >
                  {dockMerchant.points}
                </div>
                {dockIsCurrent && gameState.status === 'playing' && turnRemainingSec !== null && (
                  <span
                    key={isTurnUrgent ? `dock-sec-${turnRemainingSec}` : 'dock-sec'}
                    className={`turn-timer-pill numeric ${isTurnUrgent ? 'is-urgent' : ''}`}
                    data-turn-timer="dock"
                    title={
                      dockMerchant.autoMode && !dockMerchant.isAi
                        ? 'AUTO 모드: 10초 후 자동 선택 (터치 시 해제)'
                        : '턴 제한 시간 30초 (초과 시 AUTO 모드 전환)'
                    }
                  >
                    {turnRemainingSec}s
                  </span>
                )}
              </div>
              <span className={`dock-turn-status ${interactiveBoard ? 'is-turn' : ''} ${!dockMerchant.isAi && dockMerchant.autoMode ? 'is-auto' : ''}`}>
                {gameState.status === 'finished'
                  ? '대전 종료'
                  : !dockMerchant.isAi && dockMerchant.autoMode
                    ? interactiveBoard
                      ? `AUTO 모드 · ${turnRemainingSec ?? 10}초 후 자동 선택 (터치 시 해제)`
                      : mustReturnGems
                        ? 'AUTO 모드 · 초과 보석 반납 대기'
                        : `AUTO 대기 중 · ${currentPlayer?.name?.replace(' (AI)', '') || '상대'} 차례`
                    : interactiveBoard
                      ? isTurnUrgent
                        ? `${turnRemainingSec}초 후 자동 선택!`
                        : '당신의 턴 · 보석·카드 선택'
                      : sandboxMode === 'spec'
                        ? `AI 관전 중 · ${currentPlayer?.name?.replace(' (AI)', '') || ''} 차례`
                        : dockIsCurrent
                          ? mustReturnGems
                            ? '초과 보석 반납 필요'
                            : '진행 중'
                          : `${currentPlayer?.name?.replace(' (AI)', '') || '상대'} 차례`}
              </span>
              {dockIsCurrent && gameState.status === 'playing' && turnRemainingSec !== null && (
                <div className={`turn-timer-track is-dock ${isTurnUrgent ? 'is-urgent' : ''}`} aria-hidden="true">
                  <div
                    className="turn-timer-fill"
                    style={{ width: `${Math.max(0, Math.min(100, turnProgress * 100))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Dock Center: 5 Bonus Card Stacks + Held Chips + Gold Joker */}
        {dockMerchant ? (
          <div className="dock-economy-board">
            {GEM_COLORS.map((color) => {
              const disc = dockMerchant.discounts?.[color] || 0;
              const chip = dockMerchant.gems?.[color] || 0;
              return (
                <div
                  key={color}
                  className="dock-color-slot"
                  data-dock-color={color}
                  title={`${GEM_META[color].label} · 영구 보너스 ${disc}, 보유 보석 ${chip}`}
                >
                  <div className={`dock-bonus-card cost-${color} ${disc === 0 ? 'is-zero' : ''} numeric`}>
                    {disc}
                  </div>
                  <div className="dock-chip-pill">
                    <span className={`dock-chip-circle cost-${color} ${chip === 0 ? 'is-zero' : ''} numeric`}>
                      {chip}
                    </span>
                  </div>
                </div>
              );
            })}

            <div
              className="dock-gold-slot"
              data-dock-gold="true"
              title={`황금 조커 토큰 ${dockMerchant.gems?.gold || 0}개`}
            >
              <span className="dock-gold-label">황금</span>
              <span
                className={`dock-chip-circle cost-gold ${(dockMerchant.gems?.gold || 0) === 0 ? 'is-zero' : ''} numeric`}
              >
                {dockMerchant.gems?.gold || 0}
              </span>
              <span className={`dock-cap-readout numeric ${dockGemTotal > 10 ? 'is-over' : ''}`}>
                보석 {dockGemTotal}/10
              </span>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Dock Right-Center: 3 Reserved Card Mini-Slots */}
        <div className="dock-reserved-tray" data-dock-reserved="true" aria-label="킵한 카드 슬롯">
          {[0, 1, 2].map((slotIdx) => {
            const rCard = dockMerchant?.reserved?.[slotIdx];
            if (!rCard) {
              return (
                <div key={slotIdx} className="dock-reserved-empty" aria-label={`빈 킵 슬롯 ${slotIdx + 1}`}>
                  <Bookmark size={14} />
                  <span>킵 {slotIdx + 1}</span>
                </div>
              );
            }
            const canBuyRes =
              interactiveBoard &&
              dockMerchant?.id === humanPlayer?.id &&
              canAffordCard(humanPlayer, rCard);
            return (
              <DevelopmentCard
                key={rCard.id + slotIdx}
                card={rCard}
                compact
                affordable={canBuyRes}
                interactive={viewMode === 'sandbox' && rCard.id !== 'secret'}
                onClick={
                  viewMode === 'sandbox' && rCard.id !== 'secret'
                    ? () => handleInspectCard(rCard, true)
                    : undefined
                }
              />
            );
          })}
        </div>

        {/* Dock Far-Right: Compact Tabletop Utility Controls */}
        <div className="dock-utils">
          <button
            type="button"
            className={`dock-icon-btn ${bgmEnabled ? 'is-active' : 'is-bgm-off'}`}
            onClick={handleToggleBgm}
            data-bgm-toggle="true"
            aria-pressed={bgmEnabled}
            title={bgmEnabled ? '배경음악 끄기 (B)' : '배경음악 켜기 (B)'}
            aria-label={bgmEnabled ? '배경음악 끄기' : '배경음악 켜기'}
          >
            <Music size={18} />
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${muted ? '' : 'is-active'}`}
            onClick={() => setMuted((m) => !m)}
            data-sfx-toggle="true"
            aria-pressed={!muted}
            title={muted ? '효과음 켜기 (M)' : '효과음 끄기 (M)'}
            aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showSoundPanel ? 'is-active' : ''}`}
            onClick={() => {
              setShowSoundPanel((v) => !v);
              setShowChronicle(false);
            }}
            data-sound-settings="true"
            title={`음향 설정 · 테마 (${getSoundTheme(soundTheme).name})`}
            aria-label="르네상스 음향 테마 및 음량 설정"
            aria-expanded={showSoundPanel}
          >
            <SlidersHorizontal size={17} />
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showChronicle ? 'is-active' : ''}`}
            onClick={() => {
              setShowChronicle((v) => !v);
              setShowSoundPanel(false);
            }}
            title="길드 연대기 (기록)"
            aria-label="길드 기록 열기"
          >
            <ScrollText size={18} />
          </button>

          {confirmRestart ? (
            <div className="dock-confirm-inline">
              <span>재시작?</span>
              <button
                type="button"
                className="dock-confirm-yes"
                onClick={() => {
                  clearPendingAction();
                  pendingExplicitResetRef.current = true;
                  autoCancelSentRef.current = false;
                  setConfirmRestart(false);
                  setSelectedGems([]);
                  setReturnSelection({ ...EMPTY_RETURN_SELECTION });
                  setInspectCard(null);
                  socket.emit('restart-game', {
                    trigger: 'explicit-user-restart',
                    explicitConfirm: true,
                  });
                }}
              >
                확인
              </button>
              <button
                type="button"
                className="dock-confirm-no"
                onClick={() => setConfirmRestart(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="dock-icon-btn"
              onClick={() => setConfirmRestart(true)}
              title="새 게임 다시 시작"
              aria-label="새 게임 다시 시작"
            >
              <RotateCcw size={18} />
            </button>
          )}

          <button
            type="button"
            className="dock-icon-btn"
            onClick={() => {
              setSelectedGems([]);
              setInspectCard(null);
              setShowChronicle(false);
              setConfirmRestart(false);
              socket.emit('leave-sandbox');
              setViewMode('selector');
            }}
            title="설정 화면으로 돌아가기"
            aria-label="설정 화면으로 돌아가기"
          >
            <Home size={18} />
          </button>
        </div>
      </footer>

      {/* CARD DETAIL / ACTION MODAL */}
      {inspectCard && (
        <CardActionModal
          card={inspectCard.card}
          fromReserved={inspectCard.fromReserved}
          player={humanPlayer || dockMerchant}
          canAct={interactiveBoard}
          onBuy={() => handleBuyCard(inspectCard.card)}
          onReserve={() => handleReserveCard(inspectCard.card)}
          onClose={() => setInspectCard(null)}
        />
      )}

      {/* EXCESS GEM RETURN MODAL (>10 TOKENS) */}
      {mustReturnGems && humanPlayer && (
        <div className="steam-modal-backdrop" role="dialog" aria-modal="true" aria-label="초과 보석 반납">
          <div className="steam-modal-card">
            <div className="modal-header-row">
              <h2 className="modal-title">보석 10개 초과 반납</h2>
              <span className="numeric" style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>
                {selectedReturnTotal} / {excessToReturn}개 선택
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              보유 보석은 최대 10개까지입니다. 반납할 보석 {excessToReturn}개를 선택하세요.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '10px' }}>
              {ALL_GEM_COLORS.map((color) => {
                const held = humanPlayer.gems?.[color] || 0;
                const picked = returnSelection[color] || 0;
                if (held === 0) return null;
                return (
                  <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <GemChip
                      color={color}
                      count={held - picked}
                      selectedCount={picked}
                      interactive
                      onClick={() => adjustReturnColor(color, 1)}
                    />
                    {picked > 0 && (
                      <button
                        type="button"
                        className="floating-cancel-btn"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => adjustReturnColor(color, -1)}
                      >
                        -1
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="btn-gilded-primary"
              disabled={selectedReturnTotal !== excessToReturn}
              onClick={handleSubmitGemReturn}
            >
              <Check size={18} /> 선택한 보석 반납하기
            </button>
          </div>
        </div>
      )}

      {/* VICTORY OVERLAY */}
      {gameState.status === 'finished' && (
        <div className="steam-modal-backdrop" role="dialog" aria-modal="true" aria-label="게임 결과">
          <div className="victory-modal-card">
            <Trophy size={44} color="#f5d782" />
            <h2 className="setup-rule-title">
              {gameState.winner?.name?.replace(' (AI)', '') || '승리자'} 승리!
            </h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--ink-secondary)' }}>
              르네상스 최고의 보석 길드 거장이 탄생했습니다.
            </p>

            <div className="victory-standings">
              {[...players]
                .sort((a, b) => b.points - a.points || a.cardCount - b.cardCount)
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className={`victory-row ${p.id === gameState.winner?.id ? 'is-winner' : ''}`}
                  >
                    <span style={{ fontWeight: 700 }}>
                      {idx + 1}위 · {p.name.replace(' (AI)', '')}
                    </span>
                    <span className="numeric" style={{ color: 'var(--gold-bright)', fontWeight: 800 }}>
                      {p.points}점 (카드 {p.cardCount}장)
                    </span>
                  </div>
                ))}
            </div>

            <div className="victory-actions">
              <button
                type="button"
                className="btn-gilded-primary"
                onClick={() => {
                  pendingExplicitResetRef.current = true;
                  autoCancelSentRef.current = false;
                  socket.emit('restart-game', {
                    trigger: 'end-of-game',
                    explicitConfirm: true,
                  });
                }}
              >
                다시 대전하기
              </button>
              <button
                type="button"
                className="btn-gilded-secondary"
                onClick={() => {
                  socket.emit('leave-sandbox');
                  setViewMode('selector');
                }}
              >
                처음으로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardActionModal({
  card,
  fromReserved,
  player,
  canAct,
  onBuy,
  onReserve,
  onClose,
}) {
  const { items, goldNeeded, affordable } = getCardPaymentBreakdown(player, card);
  const canReserveMore = !fromReserved && (player?.reserved?.length || 0) < 3;

  return (
    <div
      className="steam-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="개발 카드 상세"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="steam-modal-card">
        <div className="modal-header-row">
          <h2 className="modal-title">
            {fromReserved ? '킵한 개발 카드' : `${card.level}단계 개발 카드`} · {GEM_META[card.color]?.label}
          </h2>
          <button
            type="button"
            className="dock-icon-btn"
            style={{ width: 30, height: 30 }}
            onClick={onClose}
            aria-label="창 닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-card-preview-row">
          <DevelopmentCard card={card} affordable={affordable} />
          <div className="modal-cost-breakdown">
            <div style={{ fontSize: '0.82rem', color: 'var(--gold-primary)', fontWeight: 700 }}>
              필요 보석 (할인 적용)
            </div>
            {items.map((item) => (
              <div key={item.color} className="modal-cost-line">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <FacetedGemSvg color={item.color} size={16} />
                  <span>{GEM_META[item.color]?.short}</span>
                </span>
                <span className={`numeric ${item.shortfall === 0 ? 'modal-cost-ok' : 'modal-cost-short'}`}>
                  보유 {item.held} / 필요 {item.net}
                  {item.discount > 0 ? ` (-${item.discount})` : ''}
                </span>
              </div>
            ))}
            {goldNeeded > 0 && (
              <div className="modal-cost-line">
                <span style={{ color: 'var(--gold-bright)' }}>필요 황금 조커</span>
                <span className={`numeric ${affordable ? 'modal-cost-ok' : 'modal-cost-short'}`}>
                  {goldNeeded}개 (보유 {player?.gems?.gold || 0})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={`modal-actions-row ${fromReserved ? 'is-single' : ''}`}>
          <button
            type="button"
            className="modal-btn-buy"
            disabled={!canAct || !affordable}
            onClick={onBuy}
            data-action-buy="true"
          >
            <ShoppingBag size={16} />
            {affordable ? '구매하기' : '보석 부족'}
          </button>

          {!fromReserved && (
            <button
              type="button"
              className="modal-btn-reserve"
              disabled={!canAct || !canReserveMore}
              onClick={onReserve}
              data-action-reserve="true"
            >
              <Bookmark size={16} />
              {canReserveMore ? '킵하기 (+황금 1)' : '킵 슬롯 가득 참'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
