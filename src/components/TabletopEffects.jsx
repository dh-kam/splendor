import { FacetedGemSvg, DevelopmentCard } from './SplendorVisuals';

// Harmonious Renaissance Champagne-Gold & Jewel-Tinted Ambient Starlight Field
const AMBIENT_STARLIGHT = [
  { id: 1, left: '8%', top: '14%', size: 10, kind: 'star', tone: 'gold', delay: '0s', dur: '5.6s' },
  { id: 2, left: '16%', top: '42%', size: 5, kind: 'mote', tone: 'pearl', delay: '1.4s', dur: '11s' },
  { id: 3, left: '22%', top: '76%', size: 12, kind: 'star', tone: 'gold', delay: '2.6s', dur: '6.4s' },
  { id: 4, left: '29%', top: '20%', size: 8, kind: 'star', tone: 'pearl', delay: '0.9s', dur: '5.2s' },
  { id: 5, left: '35%', top: '56%', size: 5, kind: 'mote', tone: 'gold', delay: '3.2s', dur: '13s' },
  { id: 6, left: '43%', top: '10%', size: 11, kind: 'star', tone: 'gold', delay: '1.9s', dur: '6.0s' },
  { id: 7, left: '49%', top: '82%', size: 9, kind: 'star', tone: 'amber', delay: '4.1s', dur: '5.8s' },
  { id: 8, left: '56%', top: '29%', size: 4, kind: 'mote', tone: 'pearl', delay: '0.5s', dur: '12s' },
  { id: 9, left: '62%', top: '67%', size: 13, kind: 'star', tone: 'gold', delay: '2.1s', dur: '6.8s' },
  { id: 10, left: '69%', top: '15%', size: 9, kind: 'star', tone: 'pearl', delay: '3.7s', dur: '5.4s' },
  { id: 11, left: '74%', top: '48%', size: 5, kind: 'mote', tone: 'amber', delay: '1.1s', dur: '14s' },
  { id: 12, left: '81%', top: '24%', size: 12, kind: 'star', tone: 'gold', delay: '0.4s', dur: '6.2s' },
  { id: 13, left: '87%', top: '61%', size: 10, kind: 'star', tone: 'pearl', delay: '2.9s', dur: '5.9s' },
  { id: 14, left: '92%', top: '18%', size: 11, kind: 'star', tone: 'gold', delay: '4.4s', dur: '6.6s' },
  { id: 15, left: '13%', top: '64%', size: 4, kind: 'mote', tone: 'gold', delay: '5.1s', dur: '12.5s' },
  { id: 16, left: '41%', top: '41%', size: 8, kind: 'star', tone: 'pearl', delay: '3.0s', dur: '7.0s' },
  { id: 17, left: '59%', top: '11%', size: 6, kind: 'mote', tone: 'gold', delay: '2.2s', dur: '11.5s' },
  { id: 18, left: '78%', top: '79%', size: 11, kind: 'star', tone: 'amber', delay: '1.6s', dur: '6.1s' },
  { id: 19, left: '25%', top: '34%', size: 6, kind: 'mote', tone: 'pearl', delay: '4.6s', dur: '13.5s' },
  { id: 20, left: '94%', top: '74%', size: 9, kind: 'star', tone: 'gold', delay: '0.7s', dur: '5.5s' },
];

// Lush, grand Renaissance celestial starfield exclusively for the Title/Setup Stage
const SETUP_HERO_STARLIGHT = [
  // Giant radiant 4-point hero stars (22px - 34px)
  { id: 'h1', left: '6%', top: '12%', size: 30, kind: 'hero-star', tone: 'gold', delay: '0s', dur: '4.8s' },
  { id: 'h2', left: '14%', top: '26%', size: 22, kind: 'hero-star', tone: 'pearl', delay: '1.1s', dur: '5.4s' },
  { id: 'h3', left: '24%', top: '9%', size: 28, kind: 'hero-star', tone: 'gold', delay: '2.2s', dur: '4.6s' },
  { id: 'h4', left: '34%', top: '16%', size: 19, kind: 'hero-star', tone: 'sapphire', delay: '0.6s', dur: '5.1s' },
  { id: 'h5', left: '66%', top: '11%', size: 26, kind: 'hero-star', tone: 'gold', delay: '1.7s', dur: '4.9s' },
  { id: 'h6', left: '76%', top: '21%', size: 32, kind: 'hero-star', tone: 'pearl', delay: '0.3s', dur: '5.3s' },
  { id: 'h7', left: '86%', top: '10%', size: 28, kind: 'hero-star', tone: 'gold', delay: '2.5s', dur: '4.5s' },
  { id: 'h8', left: '94%', top: '28%', size: 24, kind: 'hero-star', tone: 'amber', delay: '1.4s', dur: '5.2s' },
  { id: 'h9', left: '4%', top: '52%', size: 26, kind: 'hero-star', tone: 'pearl', delay: '2.8s', dur: '5.6s' },
  { id: 'h10', left: '95%', top: '56%', size: 30, kind: 'hero-star', tone: 'gold', delay: '0.8s', dur: '4.7s' },
  { id: 'h11', left: '7%', top: '84%', size: 28, kind: 'hero-star', tone: 'amber', delay: '1.9s', dur: '5.0s' },
  { id: 'h12', left: '91%', top: '85%', size: 26, kind: 'hero-star', tone: 'pearl', delay: '0.5s', dur: '4.8s' },
  { id: 'h13', left: '49%', top: '6%', size: 24, kind: 'hero-star', tone: 'gold', delay: '1.3s', dur: '4.4s' },
  { id: 'h14', left: '53%', top: '92%', size: 22, kind: 'hero-star', tone: 'gold', delay: '2.1s', dur: '5.1s' },

  // Medium sparkling constellation stars (13px - 20px)
  { id: 'm1', left: '11%', top: '6%', size: 16, kind: 'star', tone: 'pearl', delay: '0.4s', dur: '4.2s' },
  { id: 'm2', left: '19%', top: '19%', size: 18, kind: 'star', tone: 'amber', delay: '2.0s', dur: '4.7s' },
  { id: 'm3', left: '29%', top: '28%', size: 15, kind: 'star', tone: 'gold', delay: '3.1s', dur: '4.5s' },
  { id: 'm4', left: '39%', top: '8%', size: 17, kind: 'star', tone: 'pearl', delay: '1.2s', dur: '4.9s' },
  { id: 'm5', left: '59%', top: '18%', size: 16, kind: 'star', tone: 'sapphire', delay: '2.6s', dur: '4.6s' },
  { id: 'm6', left: '71%', top: '7%', size: 19, kind: 'star', tone: 'gold', delay: '0.9s', dur: '4.3s' },
  { id: 'm7', left: '82%', top: '33%', size: 17, kind: 'star', tone: 'pearl', delay: '3.4s', dur: '5.0s' },
  { id: 'm8', left: '91%', top: '42%', size: 18, kind: 'star', tone: 'gold', delay: '1.5s', dur: '4.4s' },
  { id: 'm9', left: '3%', top: '35%', size: 16, kind: 'star', tone: 'gold', delay: '2.3s', dur: '4.8s' },
  { id: 'm10', left: '5%', top: '68%', size: 19, kind: 'star', tone: 'sapphire', delay: '0.7s', dur: '5.2s' },
  { id: 'm11', left: '18%', top: '91%', size: 18, kind: 'star', tone: 'gold', delay: '1.8s', dur: '4.5s' },
  { id: 'm12', left: '33%', top: '94%', size: 15, kind: 'star', tone: 'pearl', delay: '2.9s', dur: '4.9s' },
  { id: 'm13', left: '68%', top: '93%', size: 17, kind: 'star', tone: 'amber', delay: '0.2s', dur: '4.6s' },
  { id: 'm14', left: '81%', top: '90%', size: 19, kind: 'star', tone: 'gold', delay: '2.4s', dur: '4.4s' },
  { id: 'm15', left: '96%', top: '70%', size: 17, kind: 'star', tone: 'pearl', delay: '1.6s', dur: '5.1s' },
  { id: 'm16', left: '12%', top: '46%', size: 14, kind: 'star', tone: 'gold', delay: '3.0s', dur: '4.8s' },

  // Large luminous golden bokeh stardust motes floating upward
  { id: 'b1', left: '9%', top: '74%', size: 14, kind: 'bokeh', tone: 'gold', delay: '0s', dur: '11s' },
  { id: 'b2', left: '22%', top: '60%', size: 10, kind: 'bokeh', tone: 'pearl', delay: '2.4s', dur: '13s' },
  { id: 'b3', left: '44%', top: '24%', size: 12, kind: 'bokeh', tone: 'gold', delay: '1.1s', dur: '12s' },
  { id: 'b4', left: '62%', top: '86%', size: 15, kind: 'bokeh', tone: 'amber', delay: '3.6s', dur: '10.5s' },
  { id: 'b5', left: '78%', top: '64%', size: 12, kind: 'bokeh', tone: 'gold', delay: '0.8s', dur: '12.5s' },
  { id: 'b6', left: '89%', top: '38%', size: 14, kind: 'bokeh', tone: 'pearl', delay: '4.2s', dur: '11.5s' },
  { id: 'b7', left: '31%', top: '82%', size: 11, kind: 'bokeh', tone: 'sapphire', delay: '2.1s', dur: '14s' },
  { id: 'b8', left: '95%', top: '18%', size: 13, kind: 'bokeh', tone: 'gold', delay: '1.7s', dur: '11s' },
];

const SETUP_SHOOTING_STARS = [
  { id: 's1', left: '16%', top: '8%', delay: '1.2s', dur: '7.5s' },
  { id: 's2', left: '64%', top: '5%', delay: '4.8s', dur: '8.6s' },
  { id: 's3', left: '82%', top: '22%', delay: '8.4s', dur: '9.2s' },
];

const SLAM_SPARKS = [
  { angle: -150, dist: 76, size: 11 },
  { angle: -110, dist: 68, size: 9 },
  { angle: -65, dist: 72, size: 12 },
  { angle: -25, dist: 78, size: 10 },
  { angle: 25, dist: 74, size: 10 },
  { angle: 155, dist: 74, size: 11 },
];

// 8 primary 4-point diamond starlight rays + 6 outer stardust glints
const PRIMARY_STAR_RAYS = [
  { angle: 0, dist: 56, size: 13, delay: 0 },
  { angle: 45, dist: 46, size: 10, delay: 40 },
  { angle: 90, dist: 58, size: 14, delay: 20 },
  { angle: 135, dist: 48, size: 11, delay: 55 },
  { angle: 180, dist: 56, size: 13, delay: 10 },
  { angle: 225, dist: 46, size: 10, delay: 45 },
  { angle: 270, dist: 58, size: 14, delay: 25 },
  { angle: 315, dist: 48, size: 11, delay: 60 },
];

const OUTER_GLINT_RAYS = [
  { angle: 22, dist: 72, size: 6, delay: 90 },
  { angle: 78, dist: 68, size: 7, delay: 110 },
  { angle: 148, dist: 74, size: 6, delay: 80 },
  { angle: 205, dist: 70, size: 7, delay: 120 },
  { angle: 262, dist: 74, size: 6, delay: 95 },
  { angle: 332, dist: 69, size: 7, delay: 115 },
];

// Palette-matched Renaissance jewel tones (never jarring neon)
const SPARKLE_TONE_VARS = {
  gold: {
    '--sp-core': '#fff9df',
    '--sp-glow': '#f2c45a',
    '--sp-ring': 'rgba(255, 238, 174, 0.92)',
  },
  white: {
    '--sp-core': '#ffffff',
    '--sp-glow': '#dce7f7',
    '--sp-ring': 'rgba(241, 245, 255, 0.92)',
  },
  blue: {
    '--sp-core': '#e0f2fe',
    '--sp-glow': '#60a5fa',
    '--sp-ring': 'rgba(147, 197, 253, 0.92)',
  },
  green: {
    '--sp-core': '#dcfce7',
    '--sp-glow': '#34d399',
    '--sp-ring': 'rgba(110, 231, 183, 0.92)',
  },
  red: {
    '--sp-core': '#ffe4e6',
    '--sp-glow': '#f87171',
    '--sp-ring': 'rgba(252, 165, 165, 0.92)',
  },
  black: {
    '--sp-core': '#fdecc8',
    '--sp-glow': '#d69e66',
    '--sp-ring': 'rgba(226, 184, 134, 0.90)',
  },
};

export function VelvetAmbience({ variant = 'tabletop' }) {
  const isSetup = variant === 'setup';
  const items = isSetup ? [...AMBIENT_STARLIGHT, ...SETUP_HERO_STARLIGHT] : AMBIENT_STARLIGHT;

  return (
    <div className={`velvet-ambience-layer ${isSetup ? 'is-setup' : ''}`} aria-hidden="true">
      <div className="velvet-candle-glow" />
      {isSetup && <div className="velvet-nebula-glow" />}
      {items.map((m) => {
        const cls =
          m.kind === 'hero-star'
            ? `velvet-hero-star tone-${m.tone}`
            : m.kind === 'bokeh'
              ? `velvet-bokeh-orb tone-${m.tone}`
              : m.kind === 'star'
                ? `velvet-magic-star tone-${m.tone}`
                : `velvet-dust-mote tone-${m.tone}`;
        return (
          <span
            key={m.id}
            className={cls}
            style={{
              left: m.left,
              top: m.top,
              width: `${m.size}px`,
              height: `${m.size}px`,
              animationDelay: m.delay,
              animationDuration: m.dur,
            }}
          />
        );
      })}
      {isSetup &&
        SETUP_SHOOTING_STARS.map((st) => (
          <span
            key={st.id}
            className="velvet-shooting-star"
            style={{
              left: st.left,
              top: st.top,
              animationDelay: st.delay,
              animationDuration: st.dur,
            }}
          />
        ))}
    </div>
  );
}

/**
 * Dramatic 10-second slam-stamp countdown overlay for the active human player.
 * Keyed per second so every numeral (10 -> 1) slams in with kinetic weight,
 * shockwave ring, and golden-crimson ember sparks without blocking tabletop clicks.
 */
export function TurnCountdownSlamOverlay({ secondsLeft, lifted = false }) {
  if (secondsLeft === null || secondsLeft === undefined || secondsLeft > 10 || secondsLeft <= 0) {
    return null;
  }

  const isCritical = secondsLeft <= 5;

  return (
    <div
      className={`fx-countdown-slam-stage ${lifted ? 'is-lifted' : ''} ${isCritical ? 'is-critical' : ''}`}
      aria-live="assertive"
      aria-label={`남은 턴 시간 ${secondsLeft}초`}
      data-countdown-slam={secondsLeft}
    >
      <div key={secondsLeft} className={`fx-countdown-slam-core ${isCritical ? 'is-critical' : ''}`}>
        <span className="fx-slam-shockwave" aria-hidden="true" />
        <span className="fx-slam-shockwave is-outer" aria-hidden="true" />
        {SLAM_SPARKS.map((sp, idx) => {
          const rad = (sp.angle * Math.PI) / 180;
          const tx = Math.round(Math.cos(rad) * sp.dist);
          const ty = Math.round(Math.sin(rad) * sp.dist);
          return (
            <span
              key={idx}
              className="fx-slam-spark"
              aria-hidden="true"
              style={{
                width: `${sp.size}px`,
                height: `${sp.size}px`,
                marginLeft: `${-sp.size / 2}px`,
                marginTop: `${-sp.size / 2}px`,
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
              }}
            />
          );
        })}
        <span className="fx-countdown-slam-num numeric">{secondsLeft}</span>
        <span className="fx-countdown-slam-caption">
          {isCritical ? '곧 자동 선택!' : '턴 종료 임박'}
        </span>
      </div>
    </div>
  );
}

export function TabletopEffectsLayer({
  flyingChips,
  flyingCards,
  sparkles,
  scorePops,
  banner,
}) {
  return (
    <div className="tabletop-fx-layer" aria-hidden="true">
      {/* 1. Flying 3D Poker Chips with Trailing Magic Starlight Dust */}
      {flyingChips.map((chip) => {
        const toneVars = SPARKLE_TONE_VARS[chip.color] || SPARKLE_TONE_VARS.gold;
        return (
          <div key={chip.id}>
            {[1, 2].map((trailIdx) => (
              <div
                key={`${chip.id}_t${trailIdx}`}
                className={`fx-chip-comet-trail trail-${trailIdx}`}
                style={{
                  ...toneVars,
                  left: `${chip.fromX}px`,
                  top: `${chip.fromY}px`,
                  '--dx': `${chip.toX - chip.fromX}px`,
                  '--dy': `${chip.toY - chip.fromY}px`,
                  '--arc-y': `${chip.arcY}px`,
                  animationDelay: `${chip.delayMs + trailIdx * 65}ms`,
                }}
              />
            ))}
            <div
              className="fx-flying-chip-anchor"
              style={{
                ...toneVars,
                left: `${chip.fromX}px`,
                top: `${chip.fromY}px`,
                '--dx': `${chip.toX - chip.fromX}px`,
                '--dy': `${chip.toY - chip.fromY}px`,
                '--arc-y': `${chip.arcY}px`,
                animationDelay: `${chip.delayMs}ms`,
              }}
            >
              <div className={`fx-flying-chip-disc chip-${chip.color}`}>
                <div className="fx-flying-chip-face">
                  <FacetedGemSvg color={chip.color} size={24} />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 2. Flying Development Cards (Smooth Long 3D Swoop + Starlight Halo) */}
      {flyingCards.map((fc) => {
        const toneVars = SPARKLE_TONE_VARS[fc.card?.color] || SPARKLE_TONE_VARS.gold;
        return (
          <div
            key={fc.id}
            className={`fx-flying-card-anchor ${fc.action === 'reserve' ? 'is-reserve' : 'is-buy'}`}
            style={{
              ...toneVars,
              left: `${fc.fromX}px`,
              top: `${fc.fromY}px`,
              width: `${fc.width}px`,
              height: `${fc.height}px`,
              '--dx': `${fc.toX - fc.fromX}px`,
              '--dy': `${fc.toY - fc.fromY}px`,
            }}
          >
            <span className="fx-card-magic-aura" />
            <DevelopmentCard card={fc.card} />
          </div>
        );
      })}

      {/* 3. Rich Gem-Tinted Magic Starlight Bursts (Double Ring + 14 Stars + Core Flash) */}
      {sparkles.map((sp) => {
        const toneVars = SPARKLE_TONE_VARS[sp.color] || SPARKLE_TONE_VARS.gold;
        const scale = sp.scale || 1;
        return (
          <div
            key={sp.id}
            className="fx-sparkle-burst"
            style={{
              ...toneVars,
              left: `${sp.x}px`,
              top: `${sp.y}px`,
              '--sp-scale': scale,
            }}
          >
            <span className="fx-sparkle-flash" />
            <span className="fx-sparkle-ring" />
            <span className="fx-sparkle-ring is-outer" />
            {PRIMARY_STAR_RAYS.map((ray, i) => {
              const rad = (ray.angle * Math.PI) / 180;
              const tx = Math.round(Math.cos(rad) * ray.dist * scale);
              const ty = Math.round(Math.sin(rad) * ray.dist * scale);
              return (
                <span
                  key={`p_${i}`}
                  className="fx-sparkle-star"
                  style={{
                    width: `${ray.size}px`,
                    height: `${ray.size}px`,
                    marginLeft: `${-ray.size / 2}px`,
                    marginTop: `${-ray.size / 2}px`,
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    animationDelay: `${ray.delay}ms`,
                  }}
                />
              );
            })}
            {OUTER_GLINT_RAYS.map((ray, i) => {
              const rad = (ray.angle * Math.PI) / 180;
              const tx = Math.round(Math.cos(rad) * ray.dist * scale);
              const ty = Math.round(Math.sin(rad) * ray.dist * scale);
              return (
                <span
                  key={`g_${i}`}
                  className="fx-sparkle-glint"
                  style={{
                    width: `${ray.size}px`,
                    height: `${ray.size}px`,
                    marginLeft: `${-ray.size / 2}px`,
                    marginTop: `${-ray.size / 2}px`,
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    animationDelay: `${ray.delay}ms`,
                  }}
                />
              );
            })}
          </div>
        );
      })}

      {/* 4. Floating Golden Prestige (+N) Callouts */}
      {scorePops.map((pop) => (
        <div
          key={pop.id}
          className="fx-score-pop numeric"
          style={{
            left: `${pop.x}px`,
            top: `${pop.y}px`,
          }}
        >
          ✦ +{pop.delta}
        </div>
      ))}

      {/* 5. Calligraphic Turn / Noble Visit Banner with Starlight Flourish */}
      {banner && (
        <div
          key={banner.id}
          className={`fx-banner ${banner.kind === 'noble' ? 'is-noble' : 'is-turn'}`}
        >
          <span className="fx-banner-ornament">✦</span>
          <span className="fx-banner-text">{banner.text}</span>
          <span className="fx-banner-ornament">✦</span>
        </div>
      )}
    </div>
  );
}
