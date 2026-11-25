import { memo, useEffect, useId, useRef, useState } from 'react';

/**
 * Orbiting golden glow border overlay that traces the exact rounded-rectangle
 * perimeter of any active player deck/tray at uniform constant speed using
 * SVG pathLength="100" stroke-dashoffset animation.
 * Uses layered translucent strokes instead of SVG feGaussianBlur filters so
 * mounting/unmounting never triggers GPU compositor invalidation flicker.
 */
export const TurnGlowBorder = memo(function TurnGlowBorder({
  active = false,
  rx = 12,
  urgent = false,
  inset = 1.5,
  className = '',
}) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    if (!active) return undefined;
    const node = hostRef.current;
    if (!node) return undefined;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  if (!active) return null;

  const w = size.width;
  const h = size.height;
  const innerW = Math.max(0, w - inset * 2);
  const innerH = Math.max(0, h - inset * 2);
  const clampedRx = Math.min(rx, innerW / 2, innerH / 2);

  return (
    <div
      ref={hostRef}
      className={`turn-glow-border ${urgent ? 'is-urgent' : ''} ${className}`}
      aria-hidden="true"
      data-turn-glow="active"
    >
      {w > 8 && h > 8 && (
        <svg
          className="turn-glow-svg"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          fill="none"
        >
          <defs>
            <linearGradient id={`tg-core-${safeId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={urgent ? '#fff5cc' : '#fffbe0'} />
              <stop offset="50%" stopColor={urgent ? '#fbbf24' : '#f3cb6c'} />
              <stop offset="100%" stopColor={urgent ? '#ef4444' : '#d99a2b'} />
            </linearGradient>
          </defs>

          {/* Subtle golden perimeter rail */}
          <rect
            x={inset}
            y={inset}
            width={innerW}
            height={innerH}
            rx={clampedRx}
            className="turn-glow-rail"
          />

          {/* Soft wide halo comet (layered translucent stroke, zero SVG filter stutter) */}
          <rect
            x={inset}
            y={inset}
            width={innerW}
            height={innerH}
            rx={clampedRx}
            pathLength="100"
            stroke={`url(#tg-core-${safeId})`}
            strokeOpacity="0.34"
            className="turn-glow-halo"
          />

          {/* Razor-bright primary golden comet */}
          <rect
            x={inset}
            y={inset}
            width={innerW}
            height={innerH}
            rx={clampedRx}
            pathLength="100"
            stroke={`url(#tg-core-${safeId})`}
            className="turn-glow-comet"
          />

          {/* Secondary glint orbiting on the opposite side of the border */}
          <rect
            x={inset}
            y={inset}
            width={innerW}
            height={innerH}
            rx={clampedRx}
            pathLength="100"
            stroke={urgent ? '#ffe4b5' : '#fff8d6'}
            className="turn-glow-spark"
          />
        </svg>
      )}
    </div>
  );
});
