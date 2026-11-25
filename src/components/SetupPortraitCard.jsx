import { memo, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TurnGlowBorder } from './TurnGlowBorder';

/**
 * Title-screen merchant portrait card.
 * Renders a crisp static portrait by default (zero CSS zoom/scale).
 * When spotlighted (by rotation or deliberate hover), smoothly plays the merchant's
 * seamless gesture video (starting & ending on the exact static portrait pose),
 * then returns seamlessly to the static photograph without compositor flicker.
 */
export const SetupPortraitCard = memo(function SetupPortraitCard({
  seat,
  seatIndex,
  isSpotlight = false,
  onSpotlightComplete,
  onRequestSpotlight,
  playerName,
  onPlayerNameChange,
  onRemoveSeat,
}) {
  const videoRef = useRef(null);
  const completedRef = useRef(false);
  const hoverTimerRef = useRef(null);
  const resetSeekTimerRef = useRef(null);
  const onSpotlightCompleteRef = useRef(onSpotlightComplete);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    onSpotlightCompleteRef.current = onSpotlightComplete;
  }, [onSpotlightComplete]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (resetSeekTimerRef.current) clearTimeout(resetSeekTimerRef.current);
    };
  }, []);

  const hasVideo = Boolean(seat.videoSrc);
  const showVideo = isSpotlight && hasVideo && videoPlaying;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return undefined;

    if (resetSeekTimerRef.current) {
      clearTimeout(resetSeekTimerRef.current);
      resetSeekTimerRef.current = null;
    }

    if (!isSpotlight) {
      video.pause();
      // Wait for opacity fade-out (220ms) before rewinding so no jumped frame flashes
      resetSeekTimerRef.current = setTimeout(() => {
        resetSeekTimerRef.current = null;
        try {
          video.currentTime = 0;
        } catch {
          // Ignore seek errors before metadata is loaded
        }
      }, 240);
      return undefined;
    }

    completedRef.current = false;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      const holdTimer = setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onSpotlightCompleteRef.current?.(seatIndex);
        }
      }, 2800);
      return () => clearTimeout(holdTimer);
    }

    try {
      if (video.currentTime > 0.05) {
        video.currentTime = 0;
      }
    } catch {
      // Ignore seek errors before metadata is loaded
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay policy fallback: still keep spotlight clean and advance
      });
    }

    // Safety fallback so spotlight rotation never stalls even if media fails
    const fallbackTimer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        setVideoPlaying(false);
        onSpotlightCompleteRef.current?.(seatIndex);
      }
    }, 6800);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [isSpotlight, hasVideo, seatIndex]);

  const handleVideoEnded = () => {
    setVideoPlaying(false);
    if (resetSeekTimerRef.current) clearTimeout(resetSeekTimerRef.current);
    resetSeekTimerRef.current = setTimeout(() => {
      resetSeekTimerRef.current = null;
      const video = videoRef.current;
      if (video) {
        try {
          video.currentTime = 0;
        } catch {
          // Ignore seek errors
        }
      }
    }, 240);
    if (!completedRef.current) {
      completedRef.current = true;
      onSpotlightCompleteRef.current?.(seatIndex);
    }
  };

  const handleMouseEnter = () => {
    if (!hasVideo || isSpotlight) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      onRequestSpotlight?.(seatIndex);
    }, 170);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  return (
    <div
      className={`setup-seat-card ${seat.isHuman ? 'is-human' : ''} ${isSpotlight ? 'is-spotlight' : ''}`}
      style={{
        '--card-stagger': `${seatIndex * 0.9}s`,
        '--portrait-pos': seat.portraitPos || '50% 24%',
      }}
      data-setup-seat={seatIndex}
      data-spotlight={isSpotlight ? 'true' : 'false'}
      data-video-playing={showVideo ? 'true' : 'false'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TurnGlowBorder active={isSpotlight} rx={15} inset={2} />
      <span className="setup-card-sheen" aria-hidden="true" />
      <span className="setup-card-glint glint-a" aria-hidden="true" />
      <span className="setup-card-glint glint-b" aria-hidden="true" />

      <div className={`setup-seat-portrait-wrap ${isSpotlight ? 'is-spotlight' : ''}`}>
        <img
          src={seat.img}
          alt={seat.isHuman ? (playerName || seat.name) : seat.name}
          className="setup-seat-portrait"
        />

        {hasVideo && (
          <video
            ref={videoRef}
            className={`setup-seat-video ${showVideo ? 'is-visible' : ''}`}
            src={seat.videoSrc}
            poster={seat.img}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onPlaying={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={handleVideoEnded}
            onError={() => {
              setVideoPlaying(false);
              if (isSpotlight && !completedRef.current) {
                completedRef.current = true;
                onSpotlightCompleteRef.current?.(seatIndex);
              }
            }}
          />
        )}

        <span className="setup-portrait-candlelight" aria-hidden="true" />
        <span className="setup-seat-role">{seat.role}</span>

        {onRemoveSeat && (
          <button
            type="button"
            className="setup-seat-remove"
            onClick={onRemoveSeat}
            title="3인 대전으로 변경"
            aria-label="4번째 상인 제거"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="setup-seat-footer">
        {seat.isHuman ? (
          <input
            type="text"
            className="setup-name-input"
            value={playerName}
            maxLength={14}
            onChange={(e) => onPlayerNameChange?.(e.target.value)}
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
  );
});
