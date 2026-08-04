'use client';

import { useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Wraps scrollable content with a visible gold scrollbar and arrow buttons.
 * Uses direct DOM manipulation (RAF) for smooth, lag-free thumb tracking.
 *
 * Horizontal is always on. Pass `maxHeight` to cap the content and get a
 * matching vertical rail on the right: ONE scroll container drives both axes,
 * because nesting a vertical scroller inside the horizontal one makes the
 * inner track's width depend on the outer scroll position.
 *
 * `maxHeight` should be viewport-relative (e.g. 'min(68vh, 900px)') so a long
 * table stays a fixed share of the screen instead of a fixed number of rows —
 * a px cap that shows 12 rows on a laptop also shows 12 on a 3840px display.
 */
export function ScrollHint({
  children,
  className,
  maxHeight,
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftBtnRef = useRef<HTMLButtonElement>(null);
  const rightBtnRef = useRef<HTMLButtonElement>(null);
  const vWrapRef = useRef<HTMLDivElement>(null);
  const vThumbRef = useRef<HTMLDivElement>(null);
  const vTrackRef = useRef<HTMLDivElement>(null);
  const upBtnRef = useRef<HTMLButtonElement>(null);
  const downBtnRef = useRef<HTMLButtonElement>(null);
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

  const syncVThumb = useCallback(() => {
    const el = contentRef.current;
    const thumb = vThumbRef.current;
    const wrap = vWrapRef.current;
    if (!el || !thumb || !wrap) return;

    const { scrollHeight, clientHeight, scrollTop } = el;
    const overflow = scrollHeight > clientHeight + 2;
    wrap.style.display = overflow ? '' : 'none';
    if (!overflow) return;

    const ratio = clientHeight / scrollHeight;
    const thumbH = Math.max(ratio * 100, 8);
    const maxScroll = scrollHeight - clientHeight;
    const thumbT = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbH) : 0;

    thumb.style.height = `${thumbH}%`;
    thumb.style.top = `${thumbT}%`;

    if (upBtnRef.current) upBtnRef.current.style.opacity = scrollTop > 2 ? '1' : '0.25';
    if (downBtnRef.current) downBtnRef.current.style.opacity = scrollTop < maxScroll - 2 ? '1' : '0.25';
  }, []);

  const sync = useCallback(() => {
    syncThumb();
    if (maxHeight) syncVThumb();
  }, [syncThumb, syncVThumb, maxHeight]);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(sync);
  }, [sync]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    // Rows can appear without the container resizing (filter/sort), so watch
    // the content itself too, or the thumb keeps a stale size.
    const mo = new MutationObserver(() => requestAnimationFrame(sync));
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, [onScroll, sync]);

  const scrollBy = (px: number) => {
    contentRef.current?.scrollBy({ left: px, behavior: 'smooth' });
  };

  /** One screenful, so paging feels like the keyboard's PageUp/PageDown. */
  const scrollByPage = (dir: 1 | -1) => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * Math.max(el.clientHeight - 60, 120), behavior: 'smooth' });
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
      <div className="relative">
        <div
          ref={contentRef}
          className={maxHeight ? 'overflow-x-auto overflow-y-auto' : 'overflow-x-auto'}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', maxHeight }}
        >
          <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
          {children}
        </div>

        {maxHeight && (
          <div
            ref={vWrapRef}
            className="absolute right-1 top-2 bottom-2 flex flex-col items-center gap-1.5 pointer-events-none"
            style={{ display: 'none' }}
          >
            <button
              ref={upBtnRef}
              onClick={() => scrollByPage(-1)}
              className="pointer-events-auto shrink-0 w-5 h-5 grid place-items-center rounded text-[var(--color-gold)] bg-[var(--color-bg-surface)]/80 hover:bg-[var(--color-gold)]/10 transition-colors"
              aria-label="Scroll up one page"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <div
              ref={vTrackRef}
              className="pointer-events-auto flex-1 w-[5px] rounded-full bg-[var(--color-gold)]/15 relative"
            >
              <div
                ref={vThumbRef}
                className="absolute left-0 w-full rounded-full bg-[var(--color-gold)]"
              />
            </div>
            <button
              ref={downBtnRef}
              onClick={() => scrollByPage(1)}
              className="pointer-events-auto shrink-0 w-5 h-5 grid place-items-center rounded text-[var(--color-gold)] bg-[var(--color-bg-surface)]/80 hover:bg-[var(--color-gold)]/10 transition-colors"
              aria-label="Scroll down one page"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
