import { memo, useEffect, useRef, useState } from 'react';
import veniceImg from '../assets/images/renaissance_bg_venice_1795573793835.jpg';
import guildhallImg from '../assets/images/renaissance_bg_guildhall_1795573793539.jpg';
import florenceImg from '../assets/images/renaissance_bg_florence_1795573793718.jpg';
import harborImg from '../assets/images/renaissance_bg_harbor_1795573793960.jpg';

const RENAISSANCE_SCENES = [
  { id: 'venice', src: veniceImg, alt: '16세기 베네치아 대운하 황혼 풍경', motion: 'pan-right' },
  { id: 'guildhall', src: guildhallImg, alt: '르네상스 보석 상인 길드 홀', motion: 'pan-left' },
  { id: 'florence', src: florenceImg, alt: '피렌체 대성당과 아르노강 석양', motion: 'pan-right-out' },
  { id: 'harbor', src: harborImg, alt: '지중해 르네상스 무역항 범선', motion: 'pan-left-in' },
];

const VIDEO_SRC = '/videos/renaissance_title_bg.mp4?v=2';

/**
 * Full-bleed Renaissance cinematic background reel for the start / title screen.
 * Plays the seamlessly looping H.264 panoramic video when decoded by the browser,
 * while rendering a synchronized Ken Burns Renaissance slideshow underneath for
 * instant first paint and guaranteed animation even if hardware video decode is unavailable.
 */
export const SetupRenaissanceBackdrop = memo(function SetupRenaissanceBackdrop() {
  const videoRef = useRef(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return undefined;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      vid.pause();
      return undefined;
    }

    vid.muted = true;
    vid.defaultMuted = true;
    vid.playsInline = true;

    const markPlaying = () => {
      if (vid.readyState >= 2 && !vid.paused) {
        setVideoPlaying(true);
      }
    };

    const handleError = () => {
      setVideoPlaying(false);
    };

    vid.addEventListener('playing', markPlaying);
    vid.addEventListener('timeupdate', markPlaying);
    vid.addEventListener('error', handleError);

    const playPromise = vid.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setVideoPlaying(false);
      });
    }

    return () => {
      vid.removeEventListener('playing', markPlaying);
      vid.removeEventListener('timeupdate', markPlaying);
      vid.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div
      className={`setup-renaissance-backdrop ${videoPlaying ? 'is-video-active' : ''}`}
      aria-hidden="true"
      data-renaissance-backdrop="true"
      data-video-active={videoPlaying ? 'true' : 'false'}
    >
      {/* Layer 0: Smooth Ken Burns Renaissance Oil-Painting Reel (instant paint + non-H.264 fallback) */}
      <div className="setup-renaissance-reel">
        {RENAISSANCE_SCENES.map((scene, index) => (
          <img
            key={scene.id}
            src={scene.src}
            alt=""
            referrerPolicy="no-referrer"
            className={`setup-renaissance-slide is-slot-${index} is-${scene.motion}`}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>

      {/* Layer 1: Seamlessly Looping Renaissance Panorama MP4 */}
      <video
        ref={videoRef}
        className={`setup-renaissance-video ${videoPlaying ? 'is-visible' : ''}`}
        src={VIDEO_SRC}
        poster={veniceImg}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />

      {/* Layer 2: Warm Candlelight Wash & Deep Velvet Vignette Scrim (preserves >= 4.5:1 UI legibility) */}
      <div className="setup-renaissance-grade" />
      <div className="setup-renaissance-scrim" />
    </div>
  );
});
