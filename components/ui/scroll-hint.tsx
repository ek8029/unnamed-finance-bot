'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Wraps horizontally scrollable content with a visible gold scrollbar
 * at the top so users can see and drag to scroll.
 */
export function ScrollHint({ children, className }: { children: React.ReactNode; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(100);
  const [thumbLeft, setThumbLeft] = useState(0);
  const [needsScroll, setNeedsScroll] = useState(false);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);

  const sync = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const overflow = scrollWidth > clientWidth + 2;
    setNeedsScroll(overflow);
    if (overflow) {
      const ratio = clientWidth / scrollWidth;
      setThumbWidth(Math.max(ratio * 100, 10));
      setThumbLeft((scrollLeft / (scrollWidth - clientWidth)) * (100 - ratio * 100));
    }
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', sync); ro.disconnect(); };
  }, [sync]);

  const handleTrackClick = (e: React.MouseEvent) => {
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
      {/* Gold scrollbar track — visible when content overflows */}
      {needsScroll && (
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="h-[6px] mx-4 mb-1 rounded-full bg-[var(--color-border-subtle)] cursor-pointer relative"
        >
          <div
            onMouseDown={handleThumbDown}
            className="absolute top-0 h-full rounded-full bg-[var(--color-gold)]/60 hover:bg-[var(--color-gold)] transition-colors cursor-grab active:cursor-grabbing"
            style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
          />
        </div>
      )}

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
