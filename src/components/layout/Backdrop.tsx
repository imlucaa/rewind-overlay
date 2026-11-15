'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

// A halftone field behind the top of the page: dots grow toward the top centre (under the notch) and thin out in soft,
// uneven patches, then fade out before the content. Drawn once per size and theme; nothing runs after that.
const GAP = 12; // px between dot centres
const MAX_R = 3.6; // px, the biggest dot
const HEIGHT = 560; // px of page the field covers

/** 0..1, smooth and repeatable: overlapping waves, so the patches look organic without a noise library. */
function patch(x: number, y: number) {
  const a = Math.sin(x * 0.011 + Math.sin(y * 0.019) * 1.6);
  const b = Math.cos(y * 0.015 - x * 0.007 + Math.sin(x * 0.004) * 2);
  return 0.5 + 0.25 * a + 0.25 * b;
}

export function Backdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const draw = () => {
      const ctx = el.getContext('2d');
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      el.width = width * ratio;
      el.height = HEIGHT * ratio;
      el.style.width = `${width}px`;
      el.style.height = `${HEIGHT}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.fillStyle = resolvedTheme === 'light' ? '#000' : '#fff';
      const cx = width / 2;
      for (let y = GAP / 2; y < HEIGHT; y += GAP) {
        for (let x = GAP / 2; x < width; x += GAP) {
          // Strongest at the top centre, an ellipse twice as wide as it is tall, gone by its edge.
          const d = Math.hypot((x - cx) / (width * 0.62), y / HEIGHT);
          const fall = Math.max(0, 1 - d);
          const t = fall * fall * (0.35 + 0.65 * patch(x, y));
          const r = MAX_R * t;
          if (r < 0.35) continue;
          ctx.globalAlpha = 0.08 + 0.32 * t;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [resolvedTheme]);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10" />;
}
