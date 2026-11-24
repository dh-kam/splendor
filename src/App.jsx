import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Volume2,
  VolumeX,
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
  playChipClink,
  playCardBuy,
  playCardReserve,
  playCardDeal,
  playTurnBell,
  playNobleFanfare,
} from './utils/soundFx';
import { diffGameStates } from './utils/gameEffects';
import { VelvetAmbience, TabletopEffectsLayer } from './components/TabletopEffects';

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
  let id = localStorage.getItem('splendor_player_id');
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('splendor_player_id', id);
  }
  return id;
}

export default function App() {
  const initialRoute = getInitialRoute();
  const [viewMode, setViewMode] = useState(initialRoute.viewMode);
  const [setupTab, setSetupTab] = useState('pve'); // 'pve' | 'spec' | 'local'
  const [setupCount, setSetupCount] = useState(3); // 3 | 4
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem('splendor_player_name') || '베네치아 상인'
  );
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [sandboxMode, setSandboxMode] = useState('pve'); // 'pve' | 'spec'

  const [gameState, setGameState] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [muted, setMuted] = useState(false);

  // Tabletop interactive state
  const [selectedGems, setSelectedGems] = useState([]);
  const [inspectCard, setInspectCard] = useState(null); // { card, fromReserved }
  const [showChronicle, setShowChronicle] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [inspectedPlayerId, setInspectedPlayerId] = useState(null);

  // Excess gem return state
  const [returnSelection, setReturnSelection] = useState({
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
    gold: 0,
  });

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

  const autostartRanRef = useRef(false);
  const toastTimerRef = useRef(null);
  const prevStateRef = useRef(null);
  const mutedRef = useRef(muted);
  const playerIdRef = useRef(playerId);
  const fxSeqRef = useRef(0);
  const fxTimersRef = useRef(new Set());

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

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
      const prev = prevStateRef.current;
      prevStateRef.current = state;

      if (prev && prev.status === 'playing' && state.status !== 'lobby') {
        const fx = diffGameStates(prev, state);
        const isMuted = mutedRef.current;
        const myId = playerIdRef.current;

        // 1. Flying 3D poker chips: Bank -> Player (longer silky parabolic arc + gem starlight)
        const newChips = [];
        fx.takenGems.forEach(({ playerId: pid, colors }) => {
          const isAiActor = state.players?.find((p) => p.id === pid)?.isAi;
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
              if (isAiActor) {
                scheduleFxCleanup(() => playChipClink(isMuted, idx, 0.44), delayMs + 50);
              }
            }
          });
        });

        // 2. Spent chips flying back: Player -> Bank (when purchasing a card)
        fx.returnedGems.forEach(({ playerId: pid, colors }) => {
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

            const isAiActor = state.players?.find((p) => p.id === actorId)?.isAi;
            if (isAiActor) {
              if (action === 'reserve') playCardReserve(isMuted, 0.52);
              else playCardBuy(isMuted, 0.52);
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
          scheduleFxCleanup(() => playCardDeal(isMuted, 0.72), 180);
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
        if (fx.nobleVisits.length > 0) {
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
        } else if (
          fx.turnChangedTo &&
          !fx.turnChangedTo.isAi &&
          fx.turnChangedTo.playerId === myId
        ) {
          // 7. Gentle Your Turn calligraphic ribbon & bell + warm starlight flourish
          playTurnBell(isMuted);
          const bId = nextId();
          setFxBanner({
            id: bId,
            kind: 'turn',
            text: '당신의 차례',
          });
          spawnSparkleAt(window.innerWidth * 0.5, 52, 'gold', 120, 1.05);
          scheduleFxCleanup(() => {
            setFxBanner((curr) => (curr?.id === bId ? null : curr));
          }, 1950);
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
      }

      setGameState(state);
    };

    const onErrorMessage = (msg) => {
      showToast(msg);
    };
    socket.on('state-update', onStateUpdate);
    socket.on('error-message', onErrorMessage);

    const timers = fxTimersRef.current;
    return () => {
      socket.off('state-update', onStateUpdate);
      socket.off('error-message', onErrorMessage);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Register room when viewMode changes
  useEffect(() => {
    if (viewMode === 'tv') {
      socket.emit('register-tv');
    } else if (viewMode === 'sandbox') {
      socket.emit('register-sandbox');
    }
  }, [viewMode]);

  // Launch sandbox match cleanly (single atomic event)
  const launchSandboxGame = (mode = setupTab === 'spec' ? 'spec' : 'pve', count = setupCount) => {
    const cleanName = playerName.trim() || '베네치아 상인';
    localStorage.setItem('splendor_player_name', cleanName);
    setSandboxMode(mode);
    setSelectedGems([]);
    setInspectCard(null);
    setConfirmRestart(false);
    setInspectedPlayerId(null);
    setViewMode('sandbox');
    socket.emit('start-sandbox', {
      mode,
      count,
      playerId,
      playerName: cleanName,
    });
  };

  // Support ?autostart=1 directly for verification & instant play
  useEffect(() => {
    if (initialRoute.autostart && !autostartRanRef.current) {
      autostartRanRef.current = true;
      socket.emit('start-sandbox', {
        mode: 'pve',
        count: 3,
        playerId,
        playerName: playerName.trim() || '베네치아 상인',
      });
    }
  }, [initialRoute.autostart, playerId, playerName]);

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

  // Keyboard shortcut on Setup screen (Enter/Space launches match when not typing in input)
  useEffect(() => {
    if (viewMode !== 'selector' || setupTab === 'local') return;
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        launchSandboxGame(setupTab === 'spec' ? 'spec' : 'pve', setupCount);
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

  // Gem selection logic (functional update so rapid clicks never race)
  const handleToggleGemPick = (color) => {
    if (!isHumanTurn || color === 'gold') return;
    const bankCount = gameState?.gems?.[color] || 0;
    if (bankCount <= 0) return;

    playChipClink(muted, selectedGems.length);

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

      // Already 3 different colors picked -> ignore (or user can deselect one)
      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, color];
    });
  };

  const removePickedGemAt = (idx) => {
    playChipClink(muted, -1);
    setSelectedGems((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmitGemPick = (() => {
    if (!isHumanTurn || selectedGems.length === 0) return false;
    if (selectedGems.length === 2 && selectedGems[0] === selectedGems[1]) {
      return (gameState?.gems?.[selectedGems[0]] || 0) >= 4;
    }
    const unique = new Set(selectedGems);
    if (unique.size !== selectedGems.length) return false;
    // Allow 1-3 distinct colors (game rules allow <3 only if fewer colors remain in bank, server validates)
    const availableDistinct = GEM_COLORS.filter((c) => (gameState?.gems?.[c] || 0) > 0).length;
    if (selectedGems.length === 3) return true;
    return selectedGems.length === Math.min(3, availableDistinct);
  })();

  const handleConfirmGems = () => {
    if (!humanPlayer || !canSubmitGemPick) return;
    playChipClink(muted, 2);
    if (selectedGems.length === 2 && selectedGems[0] === selectedGems[1]) {
      socket.emit('take-two-gems', { playerId: humanPlayer.id, color: selectedGems[0] });
    } else {
      socket.emit('take-gems', { playerId: humanPlayer.id, colors: selectedGems });
    }
    setSelectedGems([]);
  };

  const handleBuyCard = (card) => {
    if (!humanPlayer || !isHumanTurn) return;
    playCardBuy(muted);
    socket.emit('buy-card', { playerId: humanPlayer.id, cardId: card.id });
    setInspectCard(null);
    setSelectedGems([]);
  };

  const handleReserveCard = (card, tier = null) => {
    if (!humanPlayer || !isHumanTurn) return;
    if ((humanPlayer.reserved?.length || 0) >= 3) {
      showToast('킵 슬롯(최대 3장)이 모두 가득 찼습니다.');
      return;
    }
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
    playChipClink(muted, delta);
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
    if (!humanPlayer || selectedReturnTotal !== excessToReturn) return;
    playChipClink(muted, 1);
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

    const seatConfigs =
      setupTab === 'spec'
        ? [
            { name: '로렌초', role: 'AI 상인', img: PORTRAITS.lorenzo, isHuman: false },
            { name: '베아트리체', role: 'AI 상인', img: PORTRAITS.beatrice, isHuman: false },
            { name: '코시모', role: 'AI 상인', img: PORTRAITS.cosimo, isHuman: false },
            { name: '이사벨라', role: 'AI 상인', img: PORTRAITS.duchess, isHuman: false },
          ]
        : [
            { name: playerName, role: '플레이어', img: PORTRAITS.player, isHuman: true },
            { name: '로렌초', role: 'AI 상인', img: PORTRAITS.lorenzo, isHuman: false },
            { name: '베아트리체', role: 'AI 상인', img: PORTRAITS.beatrice, isHuman: false },
            { name: '코시모', role: 'AI 상인', img: PORTRAITS.cosimo, isHuman: false },
          ];

    return (
      <main className="setup-stage">
        <VelvetAmbience />
        {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}

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
                <div
                  key={idx}
                  className={`setup-seat-card ${seat.isHuman ? 'is-human' : ''}`}
                >
                  <div className="setup-seat-portrait-wrap">
                    <img src={seat.img} alt={seat.name} className="setup-seat-portrait" />
                    <span className="setup-seat-role">{seat.role}</span>
                  </div>
                  <div className="setup-seat-footer">
                    {seat.isHuman ? (
                      <input
                        type="text"
                        className="setup-name-input"
                        value={playerName}
                        maxLength={14}
                        onChange={(e) => setPlayerName(e.target.value)}
                        aria-label="플레이어 상인 이름"
                        placeholder="상인 이름 입력"
                      />
                    ) : (
                      <>
                        <span className="setup-seat-name">{seat.name}</span>
                        <span className="setup-seat-sub">르네상스 길드 AI</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* 4th Seat: Toggleable between + Add Merchant and 4th AI Portrait */}
              {setupCount === 4 ? (
                <div className="setup-seat-card">
                  <div className="setup-seat-portrait-wrap">
                    <img
                      src={seatConfigs[3].img}
                      alt={seatConfigs[3].name}
                      className="setup-seat-portrait"
                    />
                    <span className="setup-seat-role">{seatConfigs[3].role}</span>
                    <button
                      type="button"
                      className="setup-seat-remove"
                      onClick={() => setSetupCount(3)}
                      title="3인 대전으로 변경"
                      aria-label="4번째 상인 제거"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="setup-seat-footer">
                    <span className="setup-seat-name">{seatConfigs[3].name}</span>
                    <span className="setup-seat-sub">르네상스 길드 AI</span>
                  </div>
                </div>
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
                localStorage.setItem('splendor_player_name', clean);
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
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{joinedMe.name}</div>
            <div style={{ fontSize: '0.78rem', color: mobileIsMyTurn ? 'var(--gold-bright)' : 'var(--ink-muted)' }}>
              {gameState?.status === 'lobby'
                ? 'TV에서 게임 시작 대기 중'
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
      />

      {toastMsg && <div className="steam-toast" role="alert">{toastMsg}</div>}

      {/* MAIN VELVET PLAYMAT: Left Opponents | Center 3x5 Market | Right Poker Chips | Far-Right Nobles */}
      <main className="steam-playmat" aria-label="스플렌더 게임 테이블">
        {/* 1. LEFT EDGE: OPPONENT PORTRAIT PLAQUES */}
        <aside className="steam-opponents-col" aria-label="상대 상인 현황">
          {leftOpponents.map((opp, idx) => (
            <OpponentPortraitPlaque
              key={opp.id}
              player={opp}
              index={idx + 1}
              isActive={gameState.status === 'playing' && currentPlayer?.id === opp.id}
              isInspected={inspectedPlayerId === opp.id}
              actionWhisper={playerWhispers[opp.id] || null}
              scorePulse={scorePulseIds.includes(opp.id)}
              onClick={
                sandboxMode === 'spec' || viewMode === 'tv'
                  ? () => setInspectedPlayerId(opp.id)
                  : undefined
              }
            />
          ))}
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
                        ? () => setInspectCard({ card, fromReserved: false })
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
              : `서로 다른 색 ${selectedGems.length}/3`}
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

      {/* BOTTOM HORIZONTAL MERCHANT DOCK */}
      <footer
        className={`steam-bottom-dock ${interactiveBoard ? 'is-my-turn' : ''}`}
        aria-label="내 상인 트레이"
        data-dock-merchant={dockMerchant?.id || ''}
      >
        {/* Dock Left: Merchant Portrait & Prestige Medal */}
        {dockMerchant ? (
          <div className="dock-merchant-identity">
            <div className="dock-avatar-frame">
              <img
                src={getPlayerPortrait(dockMerchant, 0)}
                alt={dockMerchant.name}
                className="dock-avatar-img"
              />
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
              </div>
              <span className={`dock-turn-status ${interactiveBoard ? 'is-turn' : ''}`}>
                {gameState.status === 'finished'
                  ? '대전 종료'
                  : interactiveBoard
                    ? '당신의 턴 · 보석·카드 선택'
                    : sandboxMode === 'spec'
                      ? `AI 관전 중 · ${currentPlayer?.name?.replace(' (AI)', '') || ''} 차례`
                      : dockIsCurrent
                        ? '진행 중'
                        : `${currentPlayer?.name?.replace(' (AI)', '') || '상대'} 차례`}
              </span>
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
                    ? () => setInspectCard({ card: rCard, fromReserved: true })
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
            className={`dock-icon-btn ${muted ? '' : 'is-active'}`}
            onClick={() => setMuted((m) => !m)}
            title={muted ? '효과음 켜기' : '효과음 끄기'}
            aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showChronicle ? 'is-active' : ''}`}
            onClick={() => setShowChronicle((v) => !v)}
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
                  setConfirmRestart(false);
                  setSelectedGems([]);
                  setInspectCard(null);
                  socket.emit('restart-game');
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
                onClick={() => socket.emit('restart-game')}
              >
                다시 대전하기
              </button>
              <button
                type="button"
                className="btn-gilded-secondary"
                onClick={() => setViewMode('selector')}
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
