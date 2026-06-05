'use client';

import { useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Wraps horizontally scrollable content with a visible gold scrollbar
 * at the top with arrow buttons. Uses direct DOM manipulation (RAF)
 * for smooth, lag-free thumb tracking.
 */
export function ScrollHint({ children, className }: { children: React.ReactNode; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftBtnRef = useRef<HTMLButtonElement>(null);
  const rightBtnRef = useRef<HTMLButtonElement>(null);
  const rafId = useRef(0);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);

  const syncThumb = useCallback(() => {
    const el = contentRef.current;
    const thumb = thumbRef.current;
    const track = trackRef.current;
    const wrap = wrapRef.current;
    const lBtn = leftBtnRef.current;
    const rBtn = rightBtnRef.current;
    if (!el || !thumb || !track || !wrap) return;

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const overflow = scrollWidth > clientWidth + 2;

    // Show/hide entire scrollbar row
    wrap.style.display = overflow ? '' : 'none';
    if (!overflow) return;

    const ratio = clientWidth / scrollWidth;
    const thumbW = Math.max(ratio * 100, 10);
    const maxScroll = scrollWidth - clientWidth;
    const thumbL = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - thumbW) : 0;

    thumb.style.width = `${thumbW}%`;
    thumb.style.left = `${thumbL}%`;

    // Arrow visibility
    if (lBtn) lBtn.style.opacity = scrollLeft > 2 ? '1' : '0.25';
    if (rBtn) rBtn.style.opacity = scrollLeft < maxScroll - 2 ? '1' : '0.25';
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(syncThumb);
  }, [syncThumb]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    syncThumb();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(syncThumb);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(rafId.current); };
  }, [onScroll, syncThumb]);

  const scrollBy = (px: number) => {
    contentRef.current?.scrollBy({ left: px, behavior: 'smooth' });
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // ignore arrow clicks
    const el = contentRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    el.scrollLeft = clickRatio * (el.scrollWidth - el.clientWidth);
  };

  const handleThumbDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScroll.current = contentRef.current?.scrollLeft ?? 0;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !contentRef.current || !trackRef.current) return;
      const trackWidth = trackRef.current.clientWidth;
      const dx = ev.clientX - dragStartX.current;
      const scrollRange = contentRef.current.scrollWidth - contentRef.current.clientWidth;
      contentRef.current.scrollLeft = dragStartScroll.current + (dx / trackWidth) * scrollRange;
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className={className}>
      {/* Scrollbar row: arrow | track | arrow */}
      <div ref={wrapRef} className="flex items-center gap-1.5 mx-3 mb-1" style={{ display: 'none' }}>
        <button
          ref={leftBtnRef}
          onClick={() => scrollBy(-200)}
          className="shrink-0 w-5 h-5 grid place-items-center rounded text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="flex-1 h-[5px] rounded-full bg-[var(--color-gold)]/15 cursor-pointer relative"
        >
          <div
            ref={thumbRef}
            onMouseDown={handleThumbDown}
            className="absolute top-0 h-full rounded-full bg-[var(--color-gold)] cursor-grab active:cursor-grabbing"
          />
        </div>
        <button
          ref={rightBtnRef}
          onClick={() => scrollBy(200)}
          className="shrink-0 w-5 h-5 grid place-items-center rounded text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Scrollable content — hide native scrollbar */}
      <div
        ref={contentRef}
        className="overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
        {children}
      </div>
    </div>
  );
}
