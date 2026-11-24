import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

// Connect to socket server
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const socket = io(SOCKET_URL);

// Helper to get or generate player ID
function getOrGeneratePlayerId() {
  let id = localStorage.getItem('splendor_player_id');
  if (!id) {
    id = 'player_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('splendor_player_id', id);
  }
  return id;
}

// Gem Symbols Map for visual accessibility
const GEM_SYMBOLS = {
  white: '♢',
  blue: '▲',
  green: '⬡',
  red: '◆',
  black: '●',
  gold: '★'
};

// Safe Vibration API helper
const triggerVibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration failed', e);
    }
  }
};

// Thematic Renaissance illustration styles for cards
const getCardStyle = (card) => {
  if (!card || card.id === 'secret') return {};
  
  let bgImg = '';
  if (card.level === 1) {
    bgImg = ['white', 'green'].includes(card.color) ? '/images/mine.jpg' : '/images/caravan.jpg';
  } else if (card.level === 2) {
    bgImg = ['white', 'blue', 'green'].includes(card.color) ? '/images/ship.jpg' : '/images/gem_cutter.jpg';
  } else if (card.level === 3) {
    bgImg = '/images/jewelry_shop.jpg';
  }
  
  return {
    backgroundImage: `linear-gradient(rgba(10, 15, 25, 0.15), rgba(10, 15, 25, 0.4)), url(${bgImg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
};

// Thematic Renaissance portrait style for nobles
const getNobleStyle = (noble) => {
  if (!noble) return {};
  return {
    backgroundImage: `linear-gradient(rgba(10, 15, 25, 0.1), rgba(10, 15, 25, 0.3)), url(/images/noble.jpg)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
};

export default function App() {
  const [view, setView] = useState(null); // 'tv' or 'player'
  const [gameState, setGameState] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [playerId] = useState(getOrGeneratePlayerId());
  const [playerName, setPlayerName] = useState(localStorage.getItem('splendor_player_name') || '');
  const [sandboxActivePlayerId, setSandboxActivePlayerId] = useState(null);
  const [activeTab, setActiveTab] = useState('board'); // 'board', 'gems', 'hand'
  const [selectedGems, setSelectedGems] = useState([]); // for taking gems
  const [selectedCardForModal, setSelectedCardForModal] = useState(null);
  const [gemReturnCounts, setGemReturnCounts] = useState({
    white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0
  });
  const [toastLog, setToastLog] = useState(null);
  const [sandboxMode, setSandboxMode] = useState('pve'); // 'pve' or 'spec'
  const [sandboxCount, setSandboxCount] = useState(3); // 3 or 4
  const activeId = view === 'sandbox' ? sandboxActivePlayerId : playerId;

  // Check URL query parameters for initial view setup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('view');
    if (mode === 'tv') {
      setView('tv');
      socket.emit('register-tv');
    } else if (mode === 'player') {
      setView('player');
    } else if (mode === 'sandbox') {
      setView('sandbox');
      socket.emit('register-sandbox');
      setSandboxActivePlayerId('sandbox_p1');
    }
  }, []);

  // Listen to game state updates
  useEffect(() => {
    socket.on('state-update', (state) => {
      const targetId = view === 'sandbox' ? sandboxActivePlayerId : playerId;
      // Trigger long vibration (100ms) when a player's turn starts
      setGameState((prevState) => {
        if (view === 'player' || view === 'sandbox') {
          const wasMyTurn = prevState && prevState.status === 'playing' && prevState.players[prevState.currentPlayerIndex]?.id === targetId;
          const isNowMyTurn = state.status === 'playing' && state.players[state.currentPlayerIndex]?.id === targetId;
          if (isNowMyTurn && !wasMyTurn) {
            triggerVibrate(100);
          }
        }
        return state;
      });
      setErrorMsg(null);
      
      // If we are registered as player/sandbox and our data changed, check if we need to return gems
      if (view === 'player' || view === 'sandbox') {
        const targetMe = state.players.find(p => p.id === targetId);
        if (targetMe && targetMe.requiresGemReturn) {
          // Initialize return counts
          setGemReturnCounts({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
        }
      }
    });

    socket.on('error-message', (msg) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    });

    return () => {
      socket.off('state-update');
      socket.off('error-message');
    };
  }, [view, playerId, sandboxActivePlayerId]);

  // Toast banner for TV screen (show latest game action log for 2.5s)
  useEffect(() => {
    if (view === 'tv' && gameState && gameState.logs && gameState.logs.length > 0) {
      const latest = gameState.logs[0];
      setToastLog(latest);
      const timer = setTimeout(() => {
        setToastLog(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [view, gameState?.logs]);

  // Handle player login
  const handleJoin = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    localStorage.setItem('splendor_player_name', playerName);
    setView('player');
    socket.emit('join-game', { playerId, name: playerName });
  };

  // Start game from lobby
  const handleStartGame = () => {
    socket.emit('start-game');
  };

  // Restart game
  const handleRestartGame = () => {
    if (window.confirm('Are you sure you want to restart the game?')) {
      socket.emit('restart-game');
    }
  };

  // Start sandbox game and register virtual players/AIs
  const handleStartSandbox = (mode = 'pve', count = 3) => {
    // 1. Wipe previous players/sessions from the lobby first
    socket.emit('test-reset-game');
    
    // 2. Join fresh virtual/AI players after a brief delay
    setTimeout(() => {
      // Mode can be: 'pve' (Player vs AIs) or 'spec' (AIs spectate)
      if (mode === 'pve') {
        const localName = playerName.trim() || '나 (Player)';
        localStorage.setItem('splendor_player_name', localName);
        
        // Join Player 1 (Human)
        socket.emit('join-game', { playerId, name: localName, isAi: false });
        // Join Bots based on count
        if (count === 3) {
          socket.emit('join-game', { playerId: 'sandbox_ai1', name: 'Bob (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai2', name: 'Charlie (AI)', isAi: true });
        } else {
          socket.emit('join-game', { playerId: 'sandbox_ai1', name: 'Bob (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai2', name: 'Charlie (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai3', name: 'Daniel (AI)', isAi: true });
        }
        
        setSandboxActivePlayerId(playerId);
      } else {
        // Bots playing against each other
        if (count === 3) {
          socket.emit('join-game', { playerId: 'sandbox_ai1', name: 'Alice (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai2', name: 'Bob (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai3', name: 'Charlie (AI)', isAi: true });
        } else {
          socket.emit('join-game', { playerId: 'sandbox_ai1', name: 'Alice (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai2', name: 'Bob (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai3', name: 'Charlie (AI)', isAi: true });
          socket.emit('join-game', { playerId: 'sandbox_ai4', name: 'Daniel (AI)', isAi: true });
        }
        
        setSandboxActivePlayerId('sandbox_ai1');
      }
      
      // 3. Trigger game start shortly after
      setTimeout(() => {
        socket.emit('start-game');
      }, 500);
    }, 200);
  };

  // --- ACTIONS ---

  // Select gem for taking
  const toggleSelectGem = (color) => {
    if (color === 'gold') return;
    
    // Light vibration on selecting a gem token
    triggerVibrate(10);
    
    // Check if we already have 2 of the same color selected
    const count = selectedGems.filter(c => c === color).length;
    
    if (count === 1 && selectedGems.length === 1) {
      // Allow taking 2 of same color if it's the only type selected
      setSelectedGems([...selectedGems, color]);
    } else if (count > 0) {
      // Remove one instance of the gem (instead of all)
      const idx = selectedGems.lastIndexOf(color);
      const newSelected = [...selectedGems];
      newSelected.splice(idx, 1);
      setSelectedGems(newSelected);
    } else {
      // Add gem if we have < 3 and we are not doing a double gem selection
      const isDouble = selectedGems.length === 2 && selectedGems[0] === selectedGems[1];
      if (selectedGems.length < 3 && !isDouble) {
        setSelectedGems([...selectedGems, color]);
      }
    }
  };

  // Submit gem taking action
  const handleConfirmGems = () => {
    if (selectedGems.length === 2 && selectedGems[0] === selectedGems[1]) {
      socket.emit('take-two-gems', { playerId: activeId, color: selectedGems[0] });
    } else if (selectedGems.length === 3) {
      socket.emit('take-gems', { playerId: activeId, colors: selectedGems });
    }
    setSelectedGems([]);
  };

  // Buy a card
  const handleBuyCard = (cardId) => {
    // Distinct double vibration (40ms, 40ms) when buying a card
    triggerVibrate([40, 40, 40]);
    socket.emit('buy-card', { playerId: activeId, cardId });
    setSelectedCardForModal(null);
    socket.emit('unfocus-card', { playerId: activeId });
  };

  // Reserve a card
  const handleReserveCard = (cardId, tier = null) => {
    socket.emit('reserve-card', { playerId: activeId, cardId, tier });
    setSelectedCardForModal(null);
    socket.emit('unfocus-card', { playerId: activeId });
  };

  // Handle detailed modal card selection
  const handleSelectCardForModal = (card) => {
    setSelectedCardForModal(card);
    // Removed focus-card emit to prevent aggressive TV flashing, per UX suggestion
  };

  // Close card action modal
  const handleCloseModal = () => {
    setSelectedCardForModal(null);
  };

  // Adjust return gem count
  const adjustReturnCount = (color, increment) => {
    const targetMe = gameState.players.find(p => p.id === activeId);
    if (!targetMe) return;

    triggerVibrate(10);

    const currentCount = gemReturnCounts[color];
    const maxAvailable = targetMe.gems[color];

    if (increment && currentCount < maxAvailable) {
      setGemReturnCounts({ ...gemReturnCounts, [color]: currentCount + 1 });
    } else if (!increment && currentCount > 0) {
      setGemReturnCounts({ ...gemReturnCounts, [color]: currentCount - 1 });
    }
  };

  // Confirm returning gems
  const handleConfirmReturn = () => {
    socket.emit('return-gems', { playerId: activeId, gemCounts: gemReturnCounts });
  };

  // --- RENDERING HELPERS ---

  const renderGemIcon = (color, size = 'md') => {
    const classMap = {
      sm: 'w-5 h-5 text-xs',
      md: 'w-10 h-10 text-md',
      lg: 'w-14 h-14 text-lg'
    };
    return (
      <div className={`gem-token gem-${color} ${classMap[size] || classMap.md}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {GEM_SYMBOLS[color]}
      </div>
    );
  };

  const getGemLabel = (color) => {
    const labels = {
      white: '다이아',
      blue: '사파이어',
      green: '에메랄드',
      red: '루비',
      black: '오닉스',
      gold: '황금'
    };
    return labels[color] || color;
  };

  // Calculate if player can afford card
  const canAffordCard = (player, card) => {
    if (!player || !card || card.id === 'secret') return false;
    let goldNeeded = 0;
    for (const color of ['white', 'blue', 'green', 'red', 'black']) {
      const cost = card.cost[color] || 0;
      const discount = player.discounts[color] || 0;
      const net = Math.max(0, cost - discount);
      if (player.gems[color] < net) {
        goldNeeded += (net - player.gems[color]);
      }
    }
    return player.gems.gold >= goldNeeded;
  };

  // Lobby rendering
  if (view === null) {
    return (
      <div className="lobby-container glass gold-metallic-highlight">
        <h1 className="lobby-title title-font">SPLENDOR</h1>
        <p style={{ marginBottom: '20px', color: 'rgba(255,255,255,0.7)' }}>
          크롬캐스트 TV 화면으로 플레이하거나, 플레이어 컨트롤러로 게임에 접속하세요.
        </p>
        <div className="lobby-card">
          <button 
            className="btn-gold" 
            onClick={() => {
              setView('tv');
              socket.emit('register-tv');
              // Append view=tv to URL so reloading keeps TV view
              window.history.pushState({}, '', '?view=tv');
            }}
          >
            TV 화면 (공유 보드판) 열기
          </button>

          <div style={{ margin: '20px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>
          
          <h3 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '1rem', marginBottom: '12px', textAlign: 'center' }}>
            로컬 싱글 / AI 플레이 설정
          </h3>
          
          {/* Mode Selector Segment */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setSandboxMode('pve')}
              className={`sandbox-tab ${sandboxMode === 'pve' ? 'active' : ''}`}
              style={{ flex: 1, padding: '10px 6px', fontSize: '0.82rem', height: 'auto' }}
            >
              나 vs AI 대결
            </button>
            <button
              type="button"
              onClick={() => setSandboxMode('spec')}
              className={`sandbox-tab ${sandboxMode === 'spec' ? 'active' : ''}`}
              style={{ flex: 1, padding: '10px 6px', fontSize: '0.82rem', height: 'auto' }}
            >
              AI 자동 관전
            </button>
          </div>

          {/* Player Count Selector Segment */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setSandboxCount(3)}
              className={`sandbox-tab ${sandboxCount === 3 ? 'active' : ''}`}
              style={{ flex: 1, padding: '10px 6px', fontSize: '0.82rem', height: 'auto' }}
            >
              3인 (보석 5개)
            </button>
            <button
              type="button"
              onClick={() => setSandboxCount(4)}
              className={`sandbox-tab ${sandboxCount === 4 ? 'active' : ''}`}
              style={{ flex: 1, padding: '10px 6px', fontSize: '0.82rem', height: 'auto' }}
            >
              4인 (보석 7개)
            </button>
          </div>

          {/* Large Action Button */}
          <button 
            className="btn-gold" 
            onClick={() => {
              setView('sandbox');
              socket.emit('register-sandbox');
              window.history.pushState({}, '', '?view=sandbox');
              handleStartSandbox(sandboxMode, sandboxCount);
            }}
            style={{ width: '100%', padding: '14px', textShadow: '0 1px 2px rgba(0,0,0,0.5)', cursor: 'pointer' }}
          >
            {sandboxMode === 'pve' ? `나 vs AI (${sandboxCount}인) 플레이 시작` : `AI 대결 (${sandboxCount}인) 관전 시작`}
          </button>
          
          <div style={{ margin: '20px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>
          
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="title-font" style={{ color: 'var(--color-gold)' }}>플레이어로 참가</h3>
            <input
              type="text"
              placeholder="닉네임을 입력하세요"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={12}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--color-gold)',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                fontSize: '1rem',
                textAlign: 'center',
                outline: 'none'
              }}
            />
            <button type="submit" className="btn-gold" disabled={!playerName.trim()}>
              게임 입장하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Waiting for state
  if (!gameState) {
    return (
      <div style={{ textAlign: 'center', marginTop: '30vh' }}>
        <div className="spinner"></div>
        <p className="title-font" style={{ color: 'var(--color-gold)', marginTop: '10px' }}>
          서버에 연결 중...
        </p>
      </div>
    );
  }

  const { status, players, currentPlayerIndex, board, nobles, gems, logs, winner } = gameState;
  const isMyTurn = (view === 'player' && players[currentPlayerIndex]?.id === playerId) ||
                   (view === 'sandbox' && players[currentPlayerIndex]?.id === sandboxActivePlayerId);
  const me = view === 'player' ? players.find(p => p.id === playerId) :
             (view === 'sandbox' ? players.find(p => p.id === sandboxActivePlayerId) : null);

  // ==========================================
  // 📺 TV VIEW
  // ==========================================
  const renderTVView = (isSandbox = false) => {
    const qrUrl = `http://${gameState.localIp}:${gameState.port}`;
    return (
      <div className="tv-layout" style={isSandbox ? { height: '100%', width: '100%', padding: '0', gridTemplateColumns: '220px 1fr 240px', gap: '10px' } : {}}>
        {/* Toast Notification Banner */}
        {toastLog && (
          <div className="tv-toast-banner">
            <span style={{ color: 'var(--color-gold)', marginRight: '8px' }}>✦</span>
            {toastLog.text}
            <span style={{ color: 'var(--color-gold)', marginLeft: '8px' }}>✦</span>
          </div>
        )}

        {/* Left Side: Nobles and Bank */}
        <div className="glass gold-metallic-highlight" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'space-between' }}>
          <div>
            <h3 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>귀족 타일</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              {nobles.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>귀족 없음</div>
              ) : (
                nobles.map(noble => (
                  <div key={noble.id} className="noble-card" style={getNobleStyle(noble)}>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                      <div className="pv-shield" style={{ transform: 'scale(1.1)' }}>{noble.points}</div>
                    </div>
                    <div className="card-costs" style={{ flexDirection: 'row', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {Object.entries(noble.cost).map(([color, cost]) => (
                        <div key={color} className="noble-cost-item">
                          <div className={`gem-token-small gem-${color}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                            {GEM_SYMBOLS[color]}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{cost}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>보석 은행</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', justifyItems: 'center' }}>
              {Object.entries(gems).map(([color, count]) => (
                <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div className={`gem-token gem-${color}`} style={{ cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    <span style={{ fontSize: '1.25rem', marginBottom: '1px' }}>{GEM_SYMBOLS[color]}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{count}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{getGemLabel(color)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Decks and Card Board */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {status === 'lobby' ? (
            <div className="glass gold-metallic-highlight" style={{ padding: '40px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
              <h2 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '2rem' }}>대기실 (LOBBY)</h2>
              
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', margin: '20px 0' }}>
                <div style={{ background: '#fff', padding: '12px', borderRadius: '8px' }}>
                  <QRCodeSVG value={qrUrl} size={150} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>동일 와이파이 접속 방법:</p>
                  <p style={{ color: 'var(--color-gold)', fontSize: '1.1rem', fontFamily: 'monospace' }}>{qrUrl}</p>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
                    스마트폰으로 QR 코드를 스캔하거나 위 주소에 접속하여 입장하세요.
                  </p>
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: '400px' }}>
                <h4 className="title-font" style={{ color: 'var(--color-gold)', marginBottom: '10px' }}>참여한 플레이어 ({players.length}/4)</h4>
                {players.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.4)' }}>플레이어를 기다리는 중...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {players.map((p, idx) => (
                      <div key={p.id} className="glass" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{idx + 1}. {p.name}</span>
                        <span style={{ color: 'green', fontSize: '0.8rem' }}>● 연결됨</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                className="btn-gold" 
                onClick={handleStartGame} 
                disabled={players.length < 2}
                style={{ marginTop: '20px', padding: '12px 30px', fontSize: '1.1rem' }}
              >
                게임 시작
              </button>
            </div>
          ) : (
            // Active Board
            [3, 2, 1].map(tier => (
              <div key={tier} className="glass" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '0.85rem' }}>
                  {tier}단계 개발 카드
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(4, 1fr)', gap: '12px' }}>
                  {/* Deck Pile Card */}
                  <div 
                    className="dev-card" 
                    style={{ 
                      background: 'linear-gradient(135deg, #090d16, #161e2b)', 
                      border: '2px dashed var(--color-gold)', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      cursor: 'default'
                    }}
                  >
                    <span className="title-font" style={{ color: 'var(--color-gold)', fontSize: '1.5rem' }}>D{tier}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>남은 카드</span>
                  </div>
                  {/* Cards on board */}
                  {board[tier].map(card => {
                    // Check if focused by any player
                    const focusPlayerIdx = players.findIndex(p => gameState.focusMap && gameState.focusMap[p.id] === card.id);
                    const focusClass = focusPlayerIdx !== -1 ? `card-focused-p${focusPlayerIdx}` : '';
                    const currentPlayer = players[currentPlayerIndex];
                    const affordable = status === 'playing' && currentPlayer && canAffordCard(currentPlayer, card);
                    return (
                      <div key={card.id} className={`dev-card tier-${tier} ${focusClass} ${affordable ? 'affordable-glow' : ''}`} style={getCardStyle(card)}>
                        <div className="card-header">
                          {card.points > 0 ? (
                            <div className="pv-shield">{card.points}</div>
                          ) : (
                            <div style={{ width: '28px', height: '32px' }} />
                          )}
                          <div className={`card-gem-bonus gem-${card.color}`} style={{ color: card.color === 'white' ? '#000' : '#fff' }}>
                            {GEM_SYMBOLS[card.color]}
                          </div>
                        </div>
                        <div className="card-costs">
                          {Object.entries(card.cost).map(([color, cost]) => (
                            <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div className={`gem-token-small gem-${color}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                                {GEM_SYMBOLS[color]}
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{cost}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {/* Placeholders if cards are empty */}
                  {Array.from({ length: 4 - board[tier].length }).map((_, idx) => (
                    <div key={idx} className="dev-card" style={{ opacity: 0.1, border: '1px dashed #fff', cursor: 'default' }} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Players and Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '100%' }}>
          {/* Players scoreboard */}
          <div className="glass gold-metallic-highlight" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
            <h3 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>점수판</h3>
            {players.map((player, idx) => {
              const isTurn = status === 'playing' && currentPlayerIndex === idx;
              return (
                <div 
                  key={player.id} 
                  className={`glass ${isTurn ? 'pulse-active' : ''}`}
                  style={{ 
                    padding: '10px', 
                    borderLeft: isTurn ? '4px solid var(--color-gold)' : '1px solid var(--border-color)',
                    background: isTurn ? 'rgba(223, 177, 91, 0.08)' : ''
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isTurn && <span style={{ color: 'var(--color-gold)' }}>▶</span>}
                      {player.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="pv-shield" style={{ width: '30px', height: '34px', fontSize: '1.1rem' }}>{player.points}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: 'bold' }}>PV</span>
                    </div>
                  </div>

                  {/* Gem discounts (permanent) */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    {Object.entries(player.discounts).map(([color, val]) => (
                      <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <div className={`gem-token-small gem-${color}`} style={{ borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                          {GEM_SYMBOLS[color]}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: val > 0 ? '#fff' : 'rgba(255,255,255,0.3)' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Gems owned (hand) */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Object.entries(player.gems).map(([color, val]) => (
                      <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <div className={`gem-token-small gem-${color}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                          {GEM_SYMBOLS[color]}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: val > 0 ? '#fff' : 'rgba(255,255,255,0.3)' }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>킵:</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{player.reservedCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Logs */}
          <div className="glass gold-metallic-highlight" style={{ padding: '12px', height: '200px', display: 'flex', flexDirection: 'column' }}>
            <h4 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '0.85rem', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>로그</h4>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              {logs.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '10px' }}>로그 기록이 없습니다.</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '2px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>[{log.time}]</span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {status !== 'lobby' && (
            <button className="btn-outline" onClick={handleRestartGame} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              게임 리셋
            </button>
          )}
        </div>

        {/* Winner Dialog Overlay */}
        {winner && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div className="glass gold-metallic-highlight" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', width: '90%' }}>
              <h1 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '3rem', marginBottom: '20px' }}>VICTORY</h1>
              <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>{winner.name}</h2>
              <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)', marginBottom: '30px' }}>
                명성 점수 {winner.points}점으로 승리하셨습니다!
              </p>
              <button className="btn-gold" onClick={handleRestartGame}>
                새 게임 시작
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 📱 PLAYER CONTROLLER VIEW (MOBILE)
  // ==========================================
  const renderPlayerView = (isSandbox = false) => {
    const myIndex = players.findIndex(p => p.id === activeId);
  if (myIndex === -1) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>게임에 참가하는 중...</p>
      </div>
    );
  }

  const isLobby = status === 'lobby';

  // Render return gems screen if player has too many gems
  if (me && me.requiresGemReturn) {
    const totalDiscarded = Object.values(gemReturnCounts).reduce((a, b) => a + b, 0);
    const totalGems = Object.values(me.gems).reduce((a, b) => a + b, 0);
    const targetDiscard = totalGems - 10;
    
    return (
      <div className="mobile-layout">
        <div className="glass gold-metallic-highlight" style={{ padding: '20px', textAlign: 'center' }}>
          <h2 className="title-font" style={{ color: 'var(--gem-red)', marginBottom: '10px' }}>보석 한도 초과</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>
            보석을 10개 이하로 유지해야 합니다.<br />
            <strong>{targetDiscard}개</strong>의 보석을 버려주세요. (- 버튼을 눌러 버림)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
            {Object.entries(me.gems).map(([color, total]) => {
              if (total === 0) return null;
              const discardVal = gemReturnCounts[color] || 0;
              const keepVal = total - discardVal;
              return (
                <div key={color} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {renderGemIcon(color, 'sm')}
                    <span>보유: {total}개</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => adjustReturnCount(color, true)} /* true means increase discard (decrease keep) */
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--gem-red)', background: 'transparent', color: 'var(--gem-red)', fontSize: '1.2rem', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem', minWidth: '20px', textAlign: 'center' }}>{keepVal}</span>
                    <button 
                      onClick={() => adjustReturnCount(color, false)} /* false means decrease discard (increase keep) */
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #fff', background: 'transparent', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span>남는 보석 수:</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: totalDiscarded === targetDiscard ? 'var(--gem-green)' : 'var(--gem-red)' }}>
              {totalGems - totalDiscarded} / 10개
            </span>
          </div>

          <button 
            className="btn-gold" 
            disabled={totalDiscarded !== targetDiscard}
            onClick={handleConfirmReturn}
            style={{ width: '100%' }}
          >
            버리기 완료
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-layout">
      {/* Header bar */}
      <div className="glass gold-metallic-highlight" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', display: 'block' }}>플레이어</span>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>{me.name}</h3>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', display: 'block' }}>상태</span>
          <div style={{ fontSize: '0.95rem', color: isMyTurn ? 'var(--color-gold-light)' : '#fff', fontWeight: 'bold' }}>
            {isMyTurn ? '내 차례!' : '상대 대기중'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="pv-shield" style={{ width: '30px', height: '34px', fontSize: '1.15rem' }}>{me.points}</div>
          <div style={{ textAlign: 'left', lineHeight: '1.1' }}>
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', display: 'block' }}>명성 점수</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-gold)', fontWeight: 'bold' }}>PV</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--gem-red)', borderRadius: '8px', padding: '10px', textAlign: 'center', fontSize: '0.9rem', color: '#fca5a5' }}>
          {errorMsg}
        </div>
      )}

      {isLobby ? (
        <div className="glass gold-metallic-highlight" style={{ padding: '30px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
          <h2 className="title-font" style={{ color: 'var(--color-gold)' }}>대기 중</h2>
          <p>모든 플레이어가 들어오면 방장이 게임 시작 버튼을 누르거나, 아래 버튼을 눌러 바로 시작할 수 있습니다.</p>
          <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>
            참가자 수: {players.length}명
          </div>
          <button className="btn-gold" onClick={handleStartGame} disabled={players.length < 2}>
            게임 시작하기
          </button>
        </div>
      ) : (
        // ACTIVE GAME CONTROLS
        <>
          {/* Sticky Resource Bar */}
          <div className="glass" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(10, 12, 16, 0.95)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
            {['white', 'blue', 'green', 'red', 'black', 'gold'].map(color => (
              <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div className={`gem-token-small gem-${color}`} style={{ width: '18px', height: '18px', fontSize: '0.55rem' }}>
                  {GEM_SYMBOLS[color]}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{me.gems[color]}</span>
                {color !== 'gold' && me.discounts[color] > 0 && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-gold-light)' }}>+{me.discounts[color]}</span>
                )}
              </div>
            ))}
          </div>

          {/* Main action tabs selector */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className={`glass ${activeTab === 'board' ? 'glass-glow' : ''}`}
              onClick={() => setActiveTab('board')}
              style={{
                flex: 1, padding: '12px', border: '1px solid',
                borderColor: activeTab === 'board' ? 'var(--color-gold)' : 'var(--border-color)',
                color: activeTab === 'board' ? 'var(--color-gold)' : '#fff',
                background: 'transparent', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer'
              }}
            >
              개발 카드 구매
            </button>
            <button 
              className={`glass ${activeTab === 'gems' ? 'glass-glow' : ''}`}
              onClick={() => setActiveTab('gems')}
              style={{
                flex: 1, padding: '12px', border: '1px solid',
                borderColor: activeTab === 'gems' ? 'var(--color-gold)' : 'var(--border-color)',
                color: activeTab === 'gems' ? 'var(--color-gold)' : '#fff',
                background: 'transparent', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer'
              }}
            >
              보석 가져오기
            </button>
            <button 
              className={`glass ${activeTab === 'hand' ? 'glass-glow' : ''}`}
              onClick={() => setActiveTab('hand')}
              style={{
                flex: 1, padding: '12px', border: '1px solid',
                borderColor: activeTab === 'hand' ? 'var(--color-gold)' : 'var(--border-color)',
                color: activeTab === 'hand' ? 'var(--color-gold)' : '#fff',
                background: 'transparent', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer'
              }}
            >
              내 보석 & 킵
            </button>
          </div>

          {/* TAB 1: BOARD CARDS */}
          {activeTab === 'board' && (
            <div className="glass" style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                  TV 보드판과 1:1 매핑된 그리드입니다. 카드를 탭하여 구매/킵 하세요.
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[3, 2, 1].map(tier => {
                  const deckReservable = isMyTurn && me.reservedCount < 3;
                  return (
                    <div key={tier} style={{ display: 'grid', gridTemplateColumns: '46px repeat(4, 1fr)', gap: '6px', alignItems: 'center' }}>
                      {/* Left: Deck Pile / Blind Keep Button */}
                      <div 
                        className="dev-card deck-pile" 
                        onClick={() => deckReservable && handleReserveCard(null, tier)}
                        style={{ 
                          background: 'linear-gradient(135deg, #090d16, #161e2b)', 
                          border: deckReservable ? '1px dashed var(--color-gold)' : '1px dashed rgba(255,255,255,0.15)', 
                          justifyContent: 'center', 
                          alignItems: 'center',
                          cursor: deckReservable ? 'pointer' : 'default',
                          opacity: deckReservable ? 1 : 0.4,
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <span className="title-font" style={{ color: deckReservable ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 'bold' }}>D{tier}</span>
                        <span style={{ fontSize: '0.55rem', opacity: 0.6, color: '#fff', textAlign: 'center' }}>킵</span>
                      </div>

                      {/* Right: 4 Card Slots */}
                      {board[tier].map(card => {
                        const affordable = canAffordCard(me, card);
                        return (
                          <div 
                            key={card.id} 
                            className={`dev-card tier-${tier} ${affordable && isMyTurn ? 'affordable-glow' : ''}`}
                            onClick={() => handleSelectCardForModal(card)}
                            style={{
                              ...getCardStyle(card),
                              opacity: isMyTurn ? 1 : 0.75,
                              padding: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div className="card-header" style={{ marginBottom: '2px' }}>
                              {card.points > 0 ? (
                                <div className="pv-shield" style={{ width: '15px', height: '18px', fontSize: '0.65rem', borderWidth: '1px', borderRadius: '0 0 8px 8px' }}>
                                  {card.points}
                                </div>
                              ) : (
                                <div style={{ width: '15px', height: '18px' }} />
                              )}
                              <div className={`card-gem-bonus gem-${card.color}`} style={{ width: '13px', height: '13px', fontSize: '0.45rem', color: card.color === 'white' ? '#000' : '#fff' }}>
                                {GEM_SYMBOLS[card.color]}
                              </div>
                            </div>
                            <div className="card-costs" style={{ gap: '1px' }}>
                              {Object.entries(card.cost).map(([color, cost]) => {
                                const satisfied = (me.discounts[color] + me.gems[color]) >= cost;
                                return (
                                  <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <div className={`gem-token-small gem-${color}`} style={{ width: '9px', height: '9px', fontSize: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {GEM_SYMBOLS[color]}
                                    </div>
                                    <span style={{ fontSize: '0.6rem', color: satisfied ? '#fff' : 'var(--gem-red)', fontWeight: 'bold', lineHeight: 1 }}>{cost}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Placeholders for empty board slots */}
                      {Array.from({ length: 4 - board[tier].length }).map((_, idx) => (
                        <div 
                          key={idx} 
                          className="dev-card empty-placeholder" 
                          style={{ 
                            opacity: 0.15, 
                            border: '1px dashed rgba(255,255,255,0.4)', 
                            cursor: 'default',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '4px'
                          }} 
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TAKE GEMS */}
          {activeTab === 'gems' && (
            <div className="glass" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h3 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '1.2rem', marginBottom: '4px' }}>보석 획득 방식</h3>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                  서로 다른 3개 색상을 1개씩 선택하거나,<br />
                  은행에 4개 이상 남아있는 동일 색상을 2개 선택할 수 있습니다.
                </p>
              </div>

              {/* Circle tokens container */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {['white', 'blue', 'green', 'red', 'black'].map(color => {
                  const count = selectedGems.filter(c => c === color).length;
                  const isSelectable = isMyTurn && gems[color] > 0;
                  
                  return (
                    <div 
                      key={color} 
                      onClick={() => isSelectable && toggleSelectGem(color)}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '6px', 
                        opacity: isSelectable ? 1 : 0.4 
                      }}
                    >
                      <div 
                        className={`gem-token gem-${color} ${count > 0 ? 'active-selection' : ''}`}
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          lineHeight: 1 
                        }}
                      >
                        <span style={{ fontSize: '1.4rem' }}>{GEM_SYMBOLS[color]}</span>
                        {count > 0 && (
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '2px' }}>
                            +{count}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        남음: {gems[color]}개
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>선택 목록:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {selectedGems.map((color, idx) => (
                      <div key={idx} className={`gem-token-small gem-${color}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                        {GEM_SYMBOLS[color]}
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  className="btn-gold"
                  onClick={handleConfirmGems}
                  disabled={!isMyTurn || !(selectedGems.length === 3 || (selectedGems.length === 2 && selectedGems[0] === selectedGems[1]))}
                  style={{ width: '100%', padding: '14px' }}
                >
                  보석 가져오기 확정
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MY HAND & RESERVED */}
          {activeTab === 'hand' && (
            <div className="glass" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              
              {/* Owned resources */}
              <div>
                <h4 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '0.9rem', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>내 보석 & 영구 할인</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {['white', 'blue', 'green', 'red', 'black', 'gold'].map(color => (
                    <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                      {renderGemIcon(color, 'sm')}
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{me.gems[color]}</span>
                        {color !== 'gold' && (
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>할인: {me.discounts[color]}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reserved Cards */}
              <div style={{ flex: 1 }}>
                <h4 className="title-font" style={{ color: 'var(--color-gold)', fontSize: '0.9rem', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>내가 킵해둔 카드 (Reserved - {me.reserved.length}/3)</h4>
                
                {me.reserved.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>
                    킵해둔 카드가 없습니다.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {me.reserved.map(card => {
                      const affordable = canAffordCard(me, card);
                      return (
                        <div 
                          key={card.id} 
                          className={`dev-card tier-${card.level} ${affordable && isMyTurn ? 'affordable-glow' : ''}`}
                          onClick={() => handleSelectCardForModal(card)}
                          style={{
                            ...getCardStyle(card),
                            opacity: isMyTurn ? 1 : 0.75,
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div className="card-header" style={{ marginBottom: '2px' }}>
                            {card.points > 0 ? (
                              <div className="pv-shield" style={{ width: '15px', height: '18px', fontSize: '0.65rem', borderWidth: '1px', borderRadius: '0 0 8px 8px' }}>
                                {card.points}
                              </div>
                            ) : (
                              <div style={{ width: '15px', height: '18px' }} />
                            )}
                            <div className={`card-gem-bonus gem-${card.color}`} style={{ width: '13px', height: '13px', fontSize: '0.45rem', color: card.color === 'white' ? '#000' : '#fff' }}>
                              {GEM_SYMBOLS[card.color]}
                            </div>
                          </div>
                          <div className="card-costs" style={{ gap: '1px' }}>
                            {Object.entries(card.cost).map(([color, cost]) => {
                              const satisfied = (me.discounts[color] + me.gems[color]) >= cost;
                              return (
                                <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <div className={`gem-token-small gem-${color}`} style={{ width: '9px', height: '9px', fontSize: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {GEM_SYMBOLS[color]}
                                  </div>
                                  <span style={{ fontSize: '0.6rem', color: satisfied ? '#fff' : 'var(--gem-red)', fontWeight: 'bold', lineHeight: 1 }}>{cost}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reset connection button */}
              <button 
                onClick={() => {
                  if (confirm('Lobby로 나가시겠습니까?')) {
                    setView(null);
                    window.history.pushState({}, '', '/');
                  }
                }}
                className="btn-outline"
                style={{ padding: '8px 12px', fontSize: '0.8rem', width: '100%', marginTop: '10px' }}
              >
                메인 화면으로 나가기
              </button>
            </div>
          )}
        </>
      )}

      {/* Card Action Detail Modal */}
      {selectedCardForModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '20px'
        }}>
          <div className="glass gold-metallic-highlight" style={{ padding: '20px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="title-font" style={{ color: 'var(--color-gold)' }}>카드 정보</h3>
              <button 
                onClick={handleCloseModal}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {/* Detailed Card Preview */}
              <div 
                className={`dev-card tier-${selectedCardForModal.level}`}
                style={{ ...getCardStyle(selectedCardForModal), width: '130px', height: '182px', transform: 'none', cursor: 'default', padding: '12px' }}
              >
                <div className="card-header">
                  {selectedCardForModal.points > 0 ? (
                    <div className="pv-shield" style={{ width: '32px', height: '36px', fontSize: '1.25rem' }}>{selectedCardForModal.points}</div>
                  ) : (
                    <div style={{ width: '32px', height: '36px' }} />
                  )}
                  <div className={`card-gem-bonus gem-${selectedCardForModal.color}`} style={{ width: '24px', height: '24px', fontSize: '0.75rem', color: selectedCardForModal.color === 'white' ? '#000' : '#fff' }}>
                    {GEM_SYMBOLS[selectedCardForModal.color]}
                  </div>
                </div>
                <div className="card-costs" style={{ gap: '4px', marginTop: '12px' }}>
                  {Object.entries(selectedCardForModal.cost).map(([color, cost]) => (
                    <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className={`gem-token-small gem-${color}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                        {GEM_SYMBOLS[color]}
                      </div>
                      <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculations info */}
            <div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: '8px' }}>
                {canAffordCard(me, selectedCardForModal) ? '구매 가능합니다!' : '보석이 부족하여 구매할 수 없습니다.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                className="btn-gold"
                disabled={!isMyTurn || !canAffordCard(me, selectedCardForModal)}
                onClick={() => handleBuyCard(selectedCardForModal.id)}
              >
                구매하기
              </button>
              
              {/* Only allow reserving if the card is not already reserved */}
              {!me.reserved.some(c => c.id === selectedCardForModal.id) && (
                <button 
                  className="btn-outline"
                  disabled={!isMyTurn || me.reserved.length >= 3}
                  onClick={() => handleReserveCard(selectedCardForModal.id)}
                >
                  킵하기 (Reserve)
                </button>
              )}
              
              <button 
                onClick={handleCloseModal}
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: '6px' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  };

  if (view === 'tv') {
    return renderTVView(false);
  }

  if (view === 'player') {
    return renderPlayerView(false);
  }

  if (view === 'sandbox') {
    return (
      <div className="sandbox-container">
        <div className="sandbox-left-panel">
          {renderTVView(true)}
        </div>
        <div className="sandbox-right-panel">
          <div className="sandbox-player-tabs">
            {players.map(p => {
              const isCurrent = players[currentPlayerIndex]?.id === p.id;
              const isActive = sandboxActivePlayerId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSandboxActivePlayerId(p.id);
                    socket.emit('unfocus-card', { playerId: activeId });
                  }}
                  className={`sandbox-tab ${isActive ? 'active' : ''} ${isCurrent ? 'current-turn animate-pulse' : ''}`}
                  style={{ position: 'relative' }}
                >
                  {p.name}
                  {isCurrent && (
                    <span style={{ 
                      display: 'inline-block', 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: 'var(--gem-red)', 
                      marginLeft: '6px' 
                    }} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="sandbox-controller-wrapper">
            {renderPlayerView(true)}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
