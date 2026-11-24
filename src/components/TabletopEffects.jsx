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

export function VelvetAmbience() {
  return (
    <div className="velvet-ambience-layer" aria-hidden="true">
      <div className="velvet-candle-glow" />
      {AMBIENT_STARLIGHT.map((m) => (
        <span
          key={m.id}
          className={
            m.kind === 'star'
              ? `velvet-magic-star tone-${m.tone}`
              : `velvet-dust-mote tone-${m.tone}`
          }
          style={{
            left: m.left,
            top: m.top,
            width: `${m.size}px`,
            height: `${m.size}px`,
            animationDelay: m.delay,
            animationDuration: m.dur,
          }}
        />
      ))}
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
