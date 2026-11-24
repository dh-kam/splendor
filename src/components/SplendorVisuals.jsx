import {
  GEM_META,
  GEM_COLORS,
  getCardArtStyle,
  getCardBackStyle,
  getNoblePortrait,
  getPlayerPortrait,
} from '../utils/gemMeta';
import { TurnGlowBorder } from './TurnGlowBorder';

export function SplendorEmblem({ compact = false }) {
  return (
    <div className={`splendor-emblem ${compact ? 'is-compact' : 'is-hero'}`}>
      <div className="emblem-crest" aria-hidden="true">
        <svg viewBox="0 0 180 56" fill="none" className="emblem-crown-svg">
          {/* Ornate left & right gilded filigree wings */}
          <path
            d="M14 34 Q42 18 68 27 Q54 34 38 35"
            stroke="url(#emblemGoldStroke)"
            strokeWidth="2.1"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M166 34 Q138 18 112 27 Q126 34 142 35"
            stroke="url(#emblemGoldStroke)"
            strokeWidth="2.1"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M44 26 Q56 12 72 20"
            stroke="#f5de9a"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M136 26 Q124 12 108 20"
            stroke="#f5de9a"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Flanking jewel pearls */}
          <circle cx="12" cy="34" r="3" fill="#fff3c4" />
          <circle cx="168" cy="34" r="3" fill="#fff3c4" />
          <circle cx="43" cy="25" r="2.2" fill="#f3d68b" />
          <circle cx="137" cy="25" r="2.2" fill="#f3d68b" />
          {/* Twin 4-point Renaissance star glints */}
          <path d="M28 15 L30 20 L35 22 L30 24 L28 29 L26 24 L21 22 L26 20 Z" fill="#fff7d4" />
          <path d="M152 15 L154 20 L159 22 L154 24 L152 29 L150 24 L145 22 L150 20 Z" fill="#fff7d4" />
          {/* Center Royal Sapphire Crest */}
          <path
            d="M90 5 L108 26 L90 48 L72 26 Z"
            fill="url(#emblemSapphire)"
            stroke="#fff0be"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M90 5 L99 26 L90 48 L81 26 Z" fill="rgba(255,255,255,0.3)" />
          <path d="M90 10 L96 24 L90 28 L84 24 Z" fill="rgba(255,255,255,0.45)" />
          <defs>
            <linearGradient id="emblemSapphire" x1="72" y1="5" x2="108" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="46%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id="emblemGoldStroke" x1="14" y1="26" x2="166" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c59437" />
              <stop offset="50%" stopColor="#fff3c7" />
              <stop offset="100%" stopColor="#c59437" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="emblem-wordmark-wrap">
        {!compact && <span className="emblem-wordmark-aura" aria-hidden="true" />}
        <div className="emblem-wordmark">Splendor</div>
        {!compact && (
          <>
            <div className="emblem-wordmark-glow" aria-hidden="true">
              Splendor
            </div>
            <span className="emblem-letter-star star-1" aria-hidden="true" />
            <span className="emblem-letter-star star-2" aria-hidden="true" />
            <span className="emblem-letter-star star-3" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  );
}

export function FacetedGemSvg({ color, size = 24, className = '' }) {
  const palettes = {
    white: {
      top: '#ffffff',
      left: '#e2e8f0',
      right: '#cbd5e1',
      center: '#f8fafc',
      bottom: '#94a3b8',
      stroke: '#64748b',
    },
    blue: {
      top: '#bae6fd',
      left: '#3b82f6',
      right: '#1d4ed8',
      center: '#60a5fa',
      bottom: '#172554',
      stroke: '#93c5fd',
    },
    green: {
      top: '#a7f3d0',
      left: '#10b981',
      right: '#047857',
      center: '#34d399',
      bottom: '#064e3b',
      stroke: '#6ee7b7',
    },
    red: {
      top: '#fecaca',
      left: '#ef4444',
      right: '#b91c1c',
      center: '#f87171',
      bottom: '#7f1d1d',
      stroke: '#fca5a5',
    },
    black: {
      top: '#b08978',
      left: '#5c3c2e',
      right: '#2e1b14',
      center: '#78503e',
      bottom: '#1a0e0a',
      stroke: '#a17c6b',
    },
    gold: {
      top: '#fef9c3',
      left: '#f59e0b',
      right: '#b45309',
      center: '#fde047',
      bottom: '#78350f',
      stroke: '#fef08a',
    },
  };

  const p = palettes[color] || palettes.white;

  if (color === 'white') {
    // Classic brilliant-cut diamond silhouette
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={`faceted-gem-svg ${className}`}
        aria-hidden="true"
      >
        <polygon points="10,7 30,7 37,16 20,36 3,16" fill={p.left} stroke={p.stroke} strokeWidth="1.6" strokeLinejoin="round" />
        <polygon points="10,7 30,7 26,16 14,16" fill={p.top} />
        <polygon points="3,16 14,16 20,36" fill={p.right} />
        <polygon points="37,16 26,16 20,36" fill={p.bottom} />
        <polygon points="14,16 26,16 20,36" fill={p.center} />
        <polygon points="10,7 14,16 3,16" fill={p.center} />
        <polygon points="30,7 37,16 26,16" fill={p.right} />
        <polygon points="13,9 24,9 21,14 15,14" fill="#ffffff" opacity="0.68" />
      </svg>
    );
  }

  if (color === 'green') {
    // Octagonal emerald cut
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={`faceted-gem-svg ${className}`}
        aria-hidden="true"
      >
        <polygon points="12,4 28,4 35,11 35,29 28,36 12,36 5,29 5,11" fill={p.left} stroke={p.stroke} strokeWidth="1.6" strokeLinejoin="round" />
        <polygon points="12,4 28,4 25,11 15,11" fill={p.top} />
        <polygon points="28,4 35,11 35,29 28,36 25,29 25,11" fill={p.right} />
        <polygon points="12,36 28,36 25,29 15,29" fill={p.bottom} />
        <rect x="14" y="11" width="12" height="18" rx="1.5" fill={p.center} />
        <polygon points="15,12 24,12 18,19 15,19" fill="#ffffff" opacity="0.46" />
      </svg>
    );
  }

  if (color === 'blue') {
    // Marquise / oval faceted sapphire
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={`faceted-gem-svg ${className}`}
        aria-hidden="true"
      >
        <polygon points="20,3 33,12 33,28 20,37 7,28 7,12" fill={p.left} stroke={p.stroke} strokeWidth="1.6" strokeLinejoin="round" />
        <polygon points="20,3 33,12 26,16 20,11 14,16 7,12" fill={p.top} />
        <polygon points="33,12 33,28 20,37 26,25 26,16" fill={p.right} />
        <polygon points="7,28 20,37 14,25" fill={p.bottom} />
        <polygon points="20,10 27,16 27,24 20,30 13,24 13,16" fill={p.center} />
        <polygon points="20,11 25,16 18,19 14,16" fill="#ffffff" opacity="0.48" />
      </svg>
    );
  }

  if (color === 'red') {
    // Teardrop / cushion faceted ruby
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={`faceted-gem-svg ${className}`}
        aria-hidden="true"
      >
        <polygon points="13,5 27,5 36,15 32,31 20,37 8,31 4,15" fill={p.left} stroke={p.stroke} strokeWidth="1.6" strokeLinejoin="round" />
        <polygon points="13,5 27,5 25,13 15,13" fill={p.top} />
        <polygon points="27,5 36,15 32,31 20,37 25,26 25,13" fill={p.right} />
        <polygon points="8,31 20,37 15,26" fill={p.bottom} />
        <polygon points="15,13 25,13 28,22 20,29 12,22" fill={p.center} />
        <polygon points="15,14 23,14 19,20 13,20" fill="#ffffff" opacity="0.45" />
      </svg>
    );
  }

  if (color === 'gold') {
    // Burnished Renaissance gold ingot / coin emblem
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className={`faceted-gem-svg ${className}`}
        aria-hidden="true"
      >
        <polygon points="11,8 29,8 35,20 29,32 11,32 5,20" fill={p.left} stroke={p.stroke} strokeWidth="1.6" strokeLinejoin="round" />
        <polygon points="11,8 29,8 25,15 15,15" fill={p.top} />
        <polygon points="29,8 35,20 29,32 25,25 25,15" fill={p.right} />
        <polygon points="11,32 29,32 25,25 15,25" fill={p.bottom} />
        <polygon points="15,15 25,15 27,20 25,25 15,25 13,20" fill={p.center} />
        <polygon points="15,16 24,16 20,20 14,20" fill="#ffffff" opacity="0.52" />
      </svg>
    );
  }

  // Onyx (round beveled espresso-chocolate cabochon like Steam Splendor)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={`faceted-gem-svg ${className}`}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="15.5" fill={p.left} stroke={p.stroke} strokeWidth="1.7" />
      <path d="M8,16 A13,13 0 0,1 31,12 L25,17 A7,7 0 0,0 14,19 Z" fill={p.top} opacity="0.78" />
      <circle cx="20" cy="20" r="9.5" fill={p.center} />
      <ellipse cx="16.5" cy="14.5" rx="4.2" ry="2.2" transform="rotate(-24 16.5 14.5)" fill="#ffffff" opacity="0.44" />
      <path d="M12,27 A11,11 0 0,0 30,24 L26,21 A7,7 0 0,1 15,24 Z" fill={p.bottom} opacity="0.78" />
    </svg>
  );
}

const CHIP_STACK_JITTER = [0, 1.3, -1.1, 0.9, -1.2, 0.8, -0.4];

/**
 * Steam Splendor vertical 3D stacked clay poker chip.
 * Renders true cylindrical clay discs with striped 3D sidewalls, cast velvet shadow,
 * specular inlay face, larger faceted gem, and magical hover/selection effects.
 */
export function PokerChipStack3D({
  color,
  count,
  selectedCount = 0,
  interactive = false,
  disabled = false,
  onClick,
}) {
  const meta = GEM_META[color] || { label: color };
  const visibleLayers = Math.max(0, Math.min(count, 7));
  const isGold = color === 'gold';
  const isClickable = interactive && !isGold && !disabled && count > 0;
  const remainingAfterPick = Math.max(0, count - selectedCount);

  const innerContent = (
    <>
      <span className={`steam-chip-count ${count === 0 ? 'is-empty' : ''}`}>
        {remainingAfterPick}
      </span>

      <div className={`steam-chip-stack-visual tone-${color} ${selectedCount > 0 ? 'is-picked' : ''}`}>
        {visibleLayers === 0 ? (
          <div className="steam-chip-empty-well" />
        ) : (
          <div className="steam-chip-pile" style={{ '--stack-depth': visibleLayers }}>
            <div className="steam-chip-ground-shadow" aria-hidden="true" />
            {Array.from({ length: visibleLayers }).map((_, idx) => {
              const isTop = idx === visibleLayers - 1;
              const isSecond = idx === visibleLayers - 2;
              const liftOffset = isTop && selectedCount > 0 ? 11 : 0;
              const jitterX = isTop && selectedCount > 0 ? 0 : (CHIP_STACK_JITTER[idx] || 0);
              return (
                <div
                  key={idx}
                  className={`steam-chip-disc chip-${color} ${isTop ? 'is-top' : ''} ${isSecond ? 'is-second' : ''} ${isTop && selectedCount > 0 ? 'is-levitating' : ''}`}
                  style={{
                    '--base-y': `${-(idx * 4.8 + liftOffset)}px`,
                    '--base-x': `${jitterX}px`,
                    zIndex: idx + 1,
                  }}
                >
                  <div className="steam-chip-cylinder" aria-hidden="true" />
                  <div className="steam-chip-top-cap">
                    {isTop && (
                      <>
                        <div className="steam-chip-face">
                          <FacetedGemSvg color={color} size={31} />
                          <span className="steam-chip-gloss" aria-hidden="true" />
                        </div>
                        <span className="steam-chip-shimmer" aria-hidden="true" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {selectedCount > 0 && (
              <div
                className={`steam-chip-magic-ring tone-${color}`}
                style={{ transform: `translateY(${-((visibleLayers - 1) * 4.8 + 4)}px)` }}
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {selectedCount > 0 && (
          <span className="steam-chip-pick-badge">+{selectedCount}</span>
        )}
      </div>
    </>
  );

  if (!isClickable) {
    return (
      <div
        className={`steam-chip-slot is-static ${count === 0 ? 'is-zero' : ''} ${isGold ? 'is-gold-bank' : ''}`}
        title={isGold ? '황금 조커 토큰 (카드 킵 시 획득)' : `${meta.label} ${count}개`}
        aria-label={`${meta.label} 토큰 ${count}개`}
        data-gem-bank={color}
      >
        {innerContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`steam-chip-slot is-interactive tone-${color} ${selectedCount > 0 ? 'is-selected' : ''}`}
      onClick={onClick}
      title={`${meta.label} 선택 (${remainingAfterPick}개 남음)`}
      aria-label={`${meta.label} 토큰 선택, 남은 수량 ${remainingAfterPick}개`}
      data-gem-bank={color}
    >
      {innerContent}
    </button>
  );
}

/**
 * Steam Splendor 3D stacked physical card deck on the left of each tier row.
 */
export function SteamDeckStack3D({ tier, count, interactive = false, disabled = false, onClick }) {
  const dots = tier === 3 ? 3 : tier === 2 ? 2 : 1;
  const roman = tier === 3 ? 'III' : tier === 2 ? 'II' : 'I';
  const clickable = interactive && !disabled && count > 0;
  const backStyle = getCardBackStyle(tier);

  const content = (
    <div className={`steam-deck-body tier-${tier}`} style={backStyle}>
      <div className="steam-deck-art-overlay">
        <div className="steam-deck-count-seal">
          <span className="steam-deck-count">{count}</span>
        </div>
        <div className="steam-deck-dots" aria-hidden="true">
          {Array.from({ length: dots }).map((_, i) => (
            <span key={i} className="steam-deck-dot" />
          ))}
        </div>
      </div>
    </div>
  );

  if (!clickable) {
    return (
      <div
        className={`steam-deck-slot tier-${tier} ${count === 0 ? 'is-empty' : ''}`}
        aria-label={`${roman}단계 카드 덱 ${count}장 남음`}
        data-deck-tier={tier}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`steam-deck-slot tier-${tier} is-interactive`}
      onClick={onClick}
      title={`${roman}단계 덱에서 비공개 킵 (+황금 토큰 1)`}
      aria-label={`${roman}단계 덱 비공개 킵하기 (${count}장 남음)`}
      data-deck-tier={tier}
    >
      {content}
    </button>
  );
}

/**
 * Steam Splendor face-up Development Card.
 * Luminous frosted-white top header, italic white-outlined prestige score top-left,
 * faceted 3D gemstone top-right, full-bleed Renaissance art, circular white-rimmed cost pips bottom-left.
 */
export function DevelopmentCard({
  card,
  affordable = false,
  isFocused = false,
  isNew = false,
  onClick,
  compact = false,
  interactive = false,
}) {
  if (!card) return null;

  if (card.id === 'secret') {
    const secretTier = card.level || 1;
    return (
      <div
        className={`steam-dev-card is-secret tier-${secretTier} ${compact ? 'is-compact' : ''}`}
        style={getCardBackStyle(secretTier)}
      >
        <div className="steam-deck-art-overlay is-secret-overlay">
          <div className="steam-deck-count-seal is-compact">
            <span className="steam-deck-count">
              {secretTier === 3 ? 'III' : secretTier === 2 ? 'II' : 'I'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const artStyle = getCardArtStyle(card);
  const backStyle = getCardBackStyle(card.level || 1);
  const costEntries = GEM_COLORS
    .map((c) => [c, card.cost?.[c] || 0])
    .filter(([, amt]) => amt > 0);
  const deckDots = card.level === 3 ? 3 : card.level === 2 ? 2 : 1;

  const inner = (
    <div className="steam-card-flipper">
      <div className="steam-card-front-face" style={artStyle}>
        <div className="steam-card-header">
          <span className="steam-card-pv">{card.points > 0 ? card.points : ''}</span>
          <span className="steam-card-gem-wrap" aria-label={GEM_META[card.color]?.label}>
            <FacetedGemSvg
              color={card.color}
              size={compact ? 22 : 42}
              className="steam-card-gem-svg"
            />
          </span>
        </div>

        {affordable && !compact && (
          <>
            <span className="steam-card-sheen" aria-hidden="true" />
            <span className="steam-card-glint glint-a" aria-hidden="true" />
            <span className="steam-card-glint glint-b" aria-hidden="true" />
          </>
        )}

        <div className="steam-card-costs">
          {costEntries.map(([costColor, amount]) => (
            <div key={costColor} className={`steam-cost-pip cost-${costColor}`}>
              {amount}
            </div>
          ))}
        </div>
      </div>

      {/* True 3D designer-illustrated back face revealed during the smooth flip-from-deck animation */}
      {isNew && !compact && (
        <div
          className={`steam-card-back-face tier-${card.level || 1}`}
          style={backStyle}
          aria-hidden="true"
        >
          <div className="steam-card-back-dots-bar">
            {Array.from({ length: deckDots }).map((_, i) => (
              <span key={i} className="steam-deck-dot" />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const className = [
    'steam-dev-card',
    `card-gem-${card.color}`,
    compact ? 'is-compact' : '',
    affordable ? 'is-affordable' : '',
    isFocused ? 'is-focused' : '',
    isNew ? 'is-newly-dealt' : '',
    interactive ? 'is-interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`${card.level}단계 ${GEM_META[card.color]?.label} 카드, 승점 ${card.points}점${affordable ? ', 구매 가능' : ''}`}
        data-card-id={card.id}
      >
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

/**
 * Steam Splendor Square Noble Tile.
 * Frosted left strip with square colored card-discount requirements,
 * unique Renaissance portrait, and italic white-outlined `3` in the bottom-right corner.
 */
export function NobleTile({ noble, index = 0, compact = false }) {
  const portraitSrc = getNoblePortrait(noble, index);
  const reqs = GEM_COLORS
    .map((c) => [c, noble.cost?.[c] || 0])
    .filter(([, amt]) => amt > 0);

  return (
    <div
      className={`steam-noble-tile ${compact ? 'is-compact' : ''}`}
      style={{ backgroundImage: `url(${portraitSrc})` }}
      title={`귀족 타일 (승점 ${noble.points}점)`}
      aria-label={`귀족 타일, 승점 ${noble.points}점`}
    >
      <div className="steam-noble-strip">
        {reqs.map(([color, amt]) => (
          <div key={color} className={`steam-noble-req req-${color}`}>
            {amt}
          </div>
        ))}
      </div>
      <div className="steam-noble-pv">{noble.points}</div>
    </div>
  );
}

/**
 * Steam Splendor Left-Edge Opponent Portrait Plaque.
 */
export function OpponentPortraitPlaque({
  player,
  index,
  isActive = false,
  isInspected = false,
  actionWhisper = null,
  scorePulse = false,
  turnRemainingSec = null,
  turnProgress = 1,
  isTurnUrgent = false,
  onClick,
}) {
  const portraitSrc = getPlayerPortrait(player, index);
  const totalGems = Object.values(player.gems || {}).reduce((a, b) => a + b, 0);
  const showTimer = isActive && turnRemainingSec !== null;

  const inner = (
    <>
      <TurnGlowBorder active={isActive} rx={13} urgent={isActive && isTurnUrgent} />

      {actionWhisper && (
        <div className="opponent-action-whisper" role="status">
          {actionWhisper}
        </div>
      )}

      <div className="opponent-portrait-row">
        <div className="opponent-avatar-frame">
          <img src={portraitSrc} alt={player.name} className="opponent-avatar-img" />
          {player.isAi && <span className="opponent-ai-crest" title="AI 상인">AI</span>}
        </div>

        <div className="opponent-meta">
          <div className="opponent-name-row">
            <span className="opponent-name">{player.name.replace(' (AI)', '')}</span>
          </div>
          <div className="opponent-substats">
            <span className="opponent-stat-item">보석 {totalGems}/10</span>
            <span className="opponent-stat-item">킵 {player.reservedCount ?? player.reserved?.length ?? 0}</span>
          </div>
          {isActive && (
            <div className="opponent-turn-row">
              <span className="opponent-turn-label">차례 진행 중</span>
              {showTimer && (
                <span
                  key={isTurnUrgent ? `opp-sec-${turnRemainingSec}` : 'opp-sec'}
                  className={`turn-timer-pill is-sm numeric ${isTurnUrgent ? 'is-urgent' : ''}`}
                  data-turn-timer="opponent"
                >
                  {turnRemainingSec}s
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className={`prestige-medal is-sm ${scorePulse ? 'is-score-pop' : ''}`}
          aria-label={`승점 ${player.points}점`}
        >
          {player.points}
        </div>
      </div>

      {showTimer && (
        <div className={`turn-timer-track ${isTurnUrgent ? 'is-urgent' : ''}`} aria-hidden="true">
          <div
            className="turn-timer-fill"
            style={{ width: `${Math.max(0, Math.min(100, turnProgress * 100))}%` }}
          />
        </div>
      )}

      <div className="opponent-economy-strip">
        {GEM_COLORS.map((color) => {
          const disc = player.discounts?.[color] || 0;
          const chip = player.gems?.[color] || 0;
          return (
            <div key={color} className="opp-econ-col" title={`${GEM_META[color].label}: 카드 ${disc}, 보석 ${chip}`}>
              <span className={`opp-mini-card cost-${color} ${disc === 0 ? 'is-zero' : ''}`}>
                {disc}
              </span>
              <span className={`opp-mini-chip cost-${color} ${chip === 0 ? 'is-zero' : ''}`}>
                {chip}
              </span>
            </div>
          );
        })}
        <div className="opp-econ-col" title={`황금 조커: ${player.gems?.gold || 0}`}>
          <span className="opp-mini-card is-spacer">★</span>
          <span className={`opp-mini-chip cost-gold ${(player.gems?.gold || 0) === 0 ? 'is-zero' : ''}`}>
            {player.gems?.gold || 0}
          </span>
        </div>
      </div>
    </>
  );

  const cls = `steam-opponent-plaque ${isActive ? 'is-active' : ''} ${isActive && isTurnUrgent ? 'is-urgent' : ''} ${isInspected ? 'is-inspected' : ''}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${cls} is-clickable`}
        onClick={onClick}
        data-player-plaque={player.id}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cls} data-player-plaque={player.id}>
      {inner}
    </div>
  );
}

/**
 * Clean clay poker chip for mobile controller & excess-gem return modals.
 */
export function GemChip({
  color,
  count,
  selectedCount = 0,
  size = 'md',
  onClick,
  disabled = false,
  interactive = false,
}) {
  const meta = GEM_META[color] || { label: color };
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 28 : 22;

  const content = (
    <>
      <div className={`clay-chip-medallion chip-${color} size-${size} ${selectedCount > 0 ? 'is-picked' : ''}`}>
        <div className="clay-chip-inner">
          <FacetedGemSvg color={color} size={iconSize} />
        </div>
        {selectedCount > 0 && <span className="clay-chip-pick">+{selectedCount}</span>}
      </div>
      {count !== undefined && <span className="clay-chip-count">{count}</span>}
    </>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        className={`clay-chip-btn ${disabled ? 'is-disabled' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={`${meta.label} 토큰${count !== undefined ? `, ${count}개` : ''}`}
      >
        {content}
      </button>
    );
  }

  return <div className="clay-chip-static">{content}</div>;
}
