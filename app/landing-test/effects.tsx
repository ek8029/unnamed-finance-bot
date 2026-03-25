'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════════════════
   Interactive Grid + Floating Particles
   Canvas with gold constellation on mouse proximity + drifting gold motes
   ═══════════════════════════════════════════════════════════════════════════ */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

export function InteractiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SPACING = 60;
    const MAX_DIST = 200;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;
    const MAX_PARTICLES = 50;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const mx = mouse.current.x;
      const my = mouse.current.y;
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;

      // ── Grid proximity ──
      const prox: number[][] = Array.from({ length: cols }, () => new Array(rows));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const dx = mx - c * SPACING;
          const dy = my - r * SPACING;
          const dSq = dx * dx + dy * dy;
          prox[c][r] = dSq < MAX_DIST_SQ ? 1 - Math.sqrt(dSq) / MAX_DIST : 0;
        }
      }

      // ── Constellation lines ──
      ctx.lineWidth = 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const p = prox[c][r];
          if (p < 0.05) continue;
          const x = c * SPACING;
          const y = r * SPACING;

          if (c + 1 < cols && prox[c + 1][r] > 0.05) {
            ctx.strokeStyle = `rgba(230,185,77,${Math.min(p, prox[c + 1][r]) * 0.18})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + SPACING, y);
            ctx.stroke();
          }
          if (r + 1 < rows && prox[c][r + 1] > 0.05) {
            ctx.strokeStyle = `rgba(230,185,77,${Math.min(p, prox[c][r + 1]) * 0.18})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + SPACING);
            ctx.stroke();
          }
          if (c + 1 < cols && r + 1 < rows && prox[c + 1][r + 1] > 0.05) {
            ctx.strokeStyle = `rgba(230,185,77,${Math.min(p, prox[c + 1][r + 1]) * 0.1})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + SPACING, y + SPACING);
            ctx.stroke();
          }
        }
      }

      // ── Grid dots ──
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * SPACING;
          const y = r * SPACING;
          const p = prox[c][r];
          ctx.beginPath();
          ctx.arc(x, y, 1 + p * 2.5, 0, Math.PI * 2);
          ctx.fillStyle =
            p > 0.05
              ? `rgba(230,185,77,${0.1 + p * 0.6})`
              : 'rgba(255,255,255,0.04)';
          ctx.fill();
        }
      }

      // ── Floating particles ──
      if (particles.length < MAX_PARTICLES && Math.random() < 0.12) {
        particles.push({
          x: Math.random() * width,
          y: height + 5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(0.2 + Math.random() * 0.4),
          size: 0.5 + Math.random() * 1.5,
          life: 0,
          maxLife: 400 + Math.random() * 300,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;

        if (pt.life > pt.maxLife || pt.y < -10) {
          particles.splice(i, 1);
          continue;
        }

        const ratio = pt.life / pt.maxLife;
        let alpha: number;
        if (ratio < 0.15) alpha = ratio / 0.15;
        else if (ratio > 0.7) alpha = (1 - ratio) / 0.3;
        else alpha = 1;
        alpha *= 0.25;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,185,77,${alpha})`;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);

    const onMouse = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouse);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Stagger Text
   Per-character 3D flip reveal with optional gold highlighting
   ═══════════════════════════════════════════════════════════════════════════ */

const charVariants = {
  hidden: { opacity: 0, y: 50, rotateX: -80 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function StaggerText({
  text,
  delay = 0,
  stagger = 0.025,
  goldWord,
  glowClass = '',
  className = '',
}: {
  text: string;
  delay?: number;
  stagger?: number;
  goldWord?: string;
  glowClass?: string;
  className?: string;
}) {
  const goldStart = goldWord ? text.indexOf(goldWord) : -1;
  const goldEnd = goldStart >= 0 && goldWord ? goldStart + goldWord.length : -1;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay / 1000,
          },
        },
      }}
    >
      {text.split('').map((char, i) => {
        const isGold = i >= goldStart && i < goldEnd;
        return (
          <motion.span
            key={i}
            className={`inline-block ${isGold ? `text-[var(--color-gold)] ${glowClass}` : ''}`}
            variants={charVariants}
            style={{ transformOrigin: 'bottom center' }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3D Tilt Card
   Perspective transform with spring physics and dynamic shine
   ═══════════════════════════════════════════════════════════════════════════ */

export function TiltCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: ((e.clientY - cy) / (rect.height / 2)) * -8,
      y: ((e.clientX - cx) / (rect.width / 2)) * 8,
    });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setTilt({ x: 0, y: 0 });
        setHover(false);
      }}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
        scale: hover ? 1.02 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
      className={`relative ${className}`}
    >
      {children}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300"
        style={{
          background: hover
            ? `radial-gradient(circle at ${50 - tilt.y * 4}% ${50 - tilt.x * 4}%, rgba(230,185,77,0.08) 0%, transparent 60%)`
            : 'none',
          opacity: hover ? 1 : 0,
        }}
      />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Count-Up Number
   ═══════════════════════════════════════════════════════════════════════════ */

export function CountUp({
  end,
  duration = 2000,
  formatter,
  className = '',
}: {
  end: number;
  duration?: number;
  formatter?: (v: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setVal((1 - Math.pow(1 - p, 3)) * end);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, end, duration]);

  return (
    <span ref={ref} className={className}>
      {formatter ? formatter(val) : Math.round(val).toLocaleString()}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Typing Text
   ═══════════════════════════════════════════════════════════════════════════ */

export function TypingText({
  text,
  delay = 0,
  speed = 30,
  className = '',
}: {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
}) {
  const [shown, setShown] = useState('');
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let cursorTimer: ReturnType<typeof setTimeout>;

    const start = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        if (i < text.length) {
          setShown(text.slice(0, ++i));
        } else {
          clearInterval(interval);
          cursorTimer = setTimeout(() => setCursor(false), 2500);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
      clearTimeout(cursorTimer);
    };
  }, [text, delay, speed]);

  return (
    <span className={className}>
      {shown}
      {cursor && (
        <span className="inline-block w-[2px] h-[1.1em] bg-[var(--color-gold)] ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Fade-In Section
   ═══════════════════════════════════════════════════════════════════════════ */

export function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const offsets = {
    up: { x: 0, y: 40 },
    down: { x: 0, y: -40 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
    none: { x: 0, y: 0 },
  };
  const { x, y } = offsets[direction];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x, y }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{
        duration: 0.7,
        delay: delay / 1000,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Terminal Block
   Reusable dark terminal container with optional command header
   ═══════════════════════════════════════════════════════════════════════════ */

export function TerminalBlock({
  command,
  children,
  className = '',
}: {
  command?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[rgba(10,10,10,0.8)] border border-white/[0.06] rounded-lg px-5 py-4 font-mono text-sm ${className}`}
    >
      {command && (
        <div className="text-[var(--color-text-muted)] mb-3 text-xs">
          {command}
        </div>
      )}
      {children}
    </div>
  );
}
