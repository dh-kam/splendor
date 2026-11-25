import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, RotateCcw, Home, Sparkles } from 'lucide-react';
import { getPlayerPortrait } from '../utils/gemMeta';
import {
  buildVictoryTallyPlan,
  createGoldLeafField,
  createFireworkSchedule,
  FIREWORK_PALETTE,
} from '../utils/victoryTally';
import {
  playVictoryTallyTick,
  playVictoryTallyComplete,
} from '../utils/soundFx';

/**
 * Full-viewport 2D canvas rendering shimmering tumbling gold-leaf flakes
 * and celebratory Renaissance fireworks bursts behind/around the victory modal.
 */
function VictoryCelebrationCanvas({ finaleBurstTrigger = 0 }) {
  const canvasRef = useRef(null);
  const spawnBurstRef = useRef(null);

  useEffect(() => {
    if (finaleBurstTrigger > 0 && spawnBurstRef.current) {
      spawnBurstRef.current(0.22, 0.28, 0);
      spawnBurstRef.current(0.78, 0.28, 4);
      spawnBurstRef.current(0.5, 0.16, 1);
    }
  }, [finaleBurstTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth || 1440;
    let height = window.innerHeight || 900;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth || 1440;
      height = window.innerHeight || 900;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const leaves = createGoldLeafField(52, 1509).map((l) => ({
      ...l,
      x: l.xNorm * width,
      y: l.yNorm * height,
    }));

    const sparks = [];
    const flashes = [];

    const spawnBurst = (xNorm, yNorm, paletteIdx = 0, sparkCount = 32, radius = 108) => {
      const cx = xNorm * width;
      const cy = yNorm * height;
      const colors = FIREWORK_PALETTE[paletteIdx % FIREWORK_PALETTE.length];
      flashes.push({
        x: cx,
        y: cy,
        radius: radius * 0.68,
        age: 0,
        maxAge: 0.44,
        color: colors[0],
      });
      for (let i = 0; i < sparkCount; i += 1) {
        const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const speed = (0.48 + Math.random() * 0.72) * radius * 2.2;
        sparks.push({
          x: cx,
          y: cy,
          prevX: cx,
          prevY: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 18,
          age: 0,
          maxAge: 0.88 + Math.random() * 0.52,
          size: 2.0 + Math.random() * 2.3,
          color: colors[i % colors.length],
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    spawnBurstRef.current = spawnBurst;

    const drawLeaf = (leaf, t) => {
      const swayX = Math.sin(t * leaf.swayFreq + leaf.phase) * leaf.swayAmp;
      const drawX = leaf.x + swayX;
      const drawY = leaf.y;
      const flipScale = Math.cos(leaf.flip);
      const absFlip = Math.abs(flipScale);

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(leaf.spin);
      ctx.scale(Math.max(0.18, absFlip), 1);

      const w = leaf.size;
      const h = leaf.size * leaf.aspect;

      // Tapered Renaissance gold-foil leaf with front/back metallic facet shading
      ctx.globalAlpha = leaf.opacity * (0.68 + 0.32 * absFlip);
      ctx.fillStyle =
        absFlip > 0.82
          ? leaf.palette.shimmer
          : flipScale >= 0
            ? leaf.palette.fill
            : leaf.palette.edge;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.65);
      ctx.quadraticCurveTo(w * 0.62, -h * 0.2, w * 0.46, h * 0.45);
      ctx.quadraticCurveTo(0, h * 0.75, -w * 0.52, h * 0.38);
      ctx.quadraticCurveTo(-w * 0.62, -h * 0.22, 0, -h * 0.65);
      ctx.closePath();
      ctx.fill();

      // Subtle darker gold rim for foil depth
      ctx.strokeStyle = leaf.palette.edge;
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Specular glint when gold leaf catches the overhead spotlight
      if (absFlip > 0.84) {
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-w * 0.1, -h * 0.12, Math.max(1.1, w * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // Reduced-motion users receive a graceful single static frame of golden leaves
    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      leaves.forEach((leaf) => drawLeaf(leaf, 0.5));
      return () => {
        window.removeEventListener('resize', resize);
        spawnBurstRef.current = null;
      };
    }

    const initialBursts = createFireworkSchedule(6, 1515);
    const burstTimers = initialBursts.map((b, idx) =>
      window.setTimeout(() => {
        spawnBurst(b.xNorm, b.yNorm, idx, b.sparkCount, b.radius);
      }, b.delayMs)
    );

    let periodicIdx = initialBursts.length;
    const sideAnchors = [
      [0.14, 0.24],
      [0.86, 0.22],
      [0.18, 0.46],
      [0.82, 0.44],
      [0.24, 0.2],
      [0.76, 0.2],
    ];
    const periodicTimer = window.setInterval(() => {
      if (document.hidden) return;
      const [ax, ay] = sideAnchors[periodicIdx % sideAnchors.length];
      spawnBurst(
        ax + (Math.random() - 0.5) * 0.06,
        ay + (Math.random() - 0.5) * 0.06,
        periodicIdx,
        28,
        98
      );
      periodicIdx += 1;
    }, 1350);

    let rafId = 0;
    let frameTimerId = 0;
    let disposed = false;
    let lastTime = performance.now();
    const startTime = lastTime;

    const scheduleNext = () => {
      if (disposed) return;
      frameTimerId = window.setTimeout(() => {
        if (disposed) return;
        rafId = window.requestAnimationFrame(frame);
      }, 22);
    };

    const frame = (now) => {
      if (disposed) return;
      if (document.hidden) {
        lastTime = now;
        scheduleNext();
        return;
      }
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(0.05, Math.max(0.008, rawDt));
      const elapsedSec = (now - startTime) / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // 1. Update & render soft feathered firework glow flashes (only 1-4 active at once)
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        const fl = flashes[i];
        fl.age += dt;
        if (fl.age >= fl.maxAge) {
          flashes.splice(i, 1);
          continue;
        }
        const p = fl.age / fl.maxAge;
        const alpha = (1 - p) * (1 - p) * 0.56;
        const r = fl.radius * (0.48 + p * 0.92);
        const grad = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, r);
        grad.addColorStop(0, fl.color);
        grad.addColorStop(0.36, 'rgba(255, 224, 146, 0.34)');
        grad.addColorStop(1, 'rgba(255, 224, 146, 0)');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Update & render firework trails + twinkling embers
      ctx.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const sp = sparks[i];
        sp.age += dt;
        if (sp.age >= sp.maxAge) {
          sparks.splice(i, 1);
          continue;
        }
        sp.prevX = sp.x;
        sp.prevY = sp.y;
        const drag = Math.pow(0.24, dt);
        sp.vx *= drag;
        sp.vy = sp.vy * drag + 112 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;

        const life = 1 - sp.age / sp.maxAge;
        const twinkle = 0.65 + 0.35 * Math.sin(elapsedSec * 22 + sp.twinklePhase);
        const alpha = Math.max(0, life * life * twinkle);

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = Math.max(1.1, sp.size * 0.78 * life);
        ctx.beginPath();
        ctx.moveTo(sp.prevX, sp.prevY);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, Math.max(0.9, sp.size * 0.58 * life), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 3. Update & render falling gold leaf flakes
      for (let i = 0; i < leaves.length; i += 1) {
        const leaf = leaves[i];
        leaf.y += leaf.fallSpeed * dt;
        leaf.spin += leaf.spinSpeed * dt;
        leaf.flip += leaf.flipSpeed * dt;

        if (leaf.y > height + 24) {
          leaf.y = -18 - Math.random() * 24;
          leaf.x = Math.random() * width;
        }
        drawLeaf(leaf, elapsedSec);
      }

      scheduleNext();
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(frameTimerId);
      window.removeEventListener('resize', resize);
      burstTimers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(periodicTimer);
      spawnBurstRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="victory-particles-canvas"
      aria-hidden="true"
      data-testid="victory-particles-canvas"
    />
  );
}

export function VictoryModal({
  winner,
  players,
  myId,
  muted = false,
  onRestart,
  onReturnHome,
}) {
  const plan = useMemo(() => buildVictoryTallyPlan(winner, players), [winner, players]);
  const isHumanWinner = Boolean(plan.winner && plan.winner.id === myId);
  const winnerPortrait = getPlayerPortrait(plan.winner, plan.winnerSeatIndex);

  const [displayPoints, setDisplayPoints] = useState(0);
  const [tallyDone, setTallyDone] = useState(plan.totalPoints === 0);
  const [finaleTrigger, setFinaleTrigger] = useState(0);

  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Run the ceremonial point tally (0 -> totalPoints) with ascending musical ticks & finale chord
  useEffect(() => {
    const timers = [];

    if (plan.totalPoints === 0) {
      return undefined;
    }

    plan.stepDelaysMs.forEach((delayMs, idx) => {
      const stepValue = idx + 1;
      const t = window.setTimeout(() => {
        setDisplayPoints(stepValue);
        playVictoryTallyTick(mutedRef.current, stepValue, plan.totalPoints);
      }, delayMs);
      timers.push(t);
    });

    const doneTimer = window.setTimeout(() => {
      setTallyDone(true);
      setFinaleTrigger((n) => n + 1);
      playVictoryTallyComplete(mutedRef.current, isHumanWinner);
    }, plan.completeAtMs);
    timers.push(doneTimer);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [plan, isHumanWinner]);

  return (
    <div
      className="steam-modal-backdrop victory-ceremony-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${plan.winnerName} 승리, 최종 점수 ${plan.totalPoints}점`}
      data-victory-ceremony="true"
    >
      {/* Layer 1: Dual sweeping Venetian spotlight cones converging on the champion portrait */}
      <div className="victory-spotlight-stage" aria-hidden="true">
        <div className="victory-spot-beam is-left" />
        <div className="victory-spot-beam is-right" />
        <div className="victory-spot-crown-pool" />
      </div>

      {/* Layer 2: Full-screen Fireworks & Falling Gold Leaf Particle Canvas */}
      <VictoryCelebrationCanvas finaleBurstTrigger={finaleTrigger} />

      {/* Layer 3: Gilded Renaissance Victory Ceremony Card */}
      <div className={`victory-modal-card is-ceremony ${tallyDone ? 'is-tally-complete' : ''}`}>
        {/* Spotlighted Winner Portrait Stage */}
        <div className="victory-portrait-stage">
          <div className="victory-sunburst-rays" aria-hidden="true" />
          <div className="victory-portrait-halo" aria-hidden="true" />

          <div className="victory-crown-badge" aria-hidden="true">
            <Crown size={28} strokeWidth={2.2} />
          </div>

          <div className="victory-portrait-medallion">
            <img
              src={winnerPortrait}
              alt={`${plan.winnerName} 초상화`}
              className="victory-portrait-img"
            />
            <span className="victory-portrait-sheen" aria-hidden="true" />
          </div>

          <span className="victory-portrait-spark spark-1" aria-hidden="true" />
          <span className="victory-portrait-spark spark-2" aria-hidden="true" />
          <span className="victory-portrait-spark spark-3" aria-hidden="true" />
          <span className="victory-portrait-spark spark-4" aria-hidden="true" />
        </div>

        {/* Champion Title Ribbon */}
        <div className="victory-headline-block">
          <span className="victory-kicker">
            <Sparkles size={13} aria-hidden="true" />
            RENAISSANCE GUILD CHAMPION
            <Sparkles size={13} aria-hidden="true" />
          </span>
          <h2 className="victory-winner-title">{plan.winnerName} 승리!</h2>
        </div>

        {/* Animated Victory Point Tally Showcase */}
        <div
          className={`victory-tally-stage ${tallyDone ? 'is-complete' : 'is-counting'}`}
          data-victory-tally-current={displayPoints}
          data-victory-tally-target={plan.totalPoints}
          data-victory-tally-done={tallyDone ? 'true' : 'false'}
        >
          <div className="victory-tally-medallion">
            <span className="victory-tally-ring" aria-hidden="true" />
            <span key={displayPoints} className="victory-tally-number numeric">
              {displayPoints}
            </span>
            <span className="victory-tally-unit">승점</span>
          </div>

          <div className="victory-tally-breakdown" aria-label="승점 세부 내역">
            <span className="victory-breakdown-chip">
              개발 카드 <strong className="numeric">+{plan.cardPoints}</strong>
            </span>
            <span className="victory-breakdown-sep" aria-hidden="true">·</span>
            <span className="victory-breakdown-chip">
              귀족 후원 <strong className="numeric">+{plan.noblePoints}</strong>
            </span>
            <span className="victory-breakdown-sep" aria-hidden="true">·</span>
            <span className="victory-breakdown-chip">
              카드 <strong className="numeric">{plan.cardCount}장</strong>
            </span>
          </div>
        </div>

        {/* Staggered Ranked Standings */}
        <div className="victory-standings">
          {plan.standings.map((p, idx) => {
            const seatIdx = Math.max(
              0,
              players.findIndex((pl) => pl.id === p.id)
            );
            const isWin = p.id === plan.winner.id;
            return (
              <div
                key={p.id}
                className={`victory-row ${isWin ? 'is-winner' : ''}`}
                style={{ '--row-idx': idx }}
              >
                <div className="victory-row-left">
                  <span className={`victory-rank-badge ${isWin ? 'is-first' : ''}`}>
                    {idx + 1}위
                  </span>
                  <img
                    src={getPlayerPortrait(p, seatIdx)}
                    alt=""
                    aria-hidden="true"
                    className="victory-row-avatar"
                  />
                  <span className="victory-row-name">{p.name.replace(' (AI)', '')}</span>
                </div>
                <span className="victory-row-score numeric">
                  {p.points}점 <small>(카드 {p.cardCount}장)</small>
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="victory-actions">
          <button
            type="button"
            className="btn-gilded-primary"
            onClick={onRestart}
          >
            <RotateCcw size={17} aria-hidden="true" /> 다시 대전하기
          </button>
          <button
            type="button"
            className="btn-gilded-secondary"
            onClick={onReturnHome}
          >
            <Home size={17} aria-hidden="true" /> 처음으로
          </button>
        </div>
      </div>
    </div>
  );
}
