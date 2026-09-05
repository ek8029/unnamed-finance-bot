'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * The five app screens, told against one phone that stays put.
 *
 * The first version of /app was five identical zig-zag blocks, phone left then
 * phone right then phone left, running 5,790px tall. Every block had the same
 * shape, so the page read as one section repeated rather than five things
 * worth knowing, and the eye had nothing to hold on to between them.
 *
 * Here the device is pinned and the copy moves past it, so the screen swap is
 * the thing that marks progress.
 *
 * The pin is gated on viewport HEIGHT as well as width (.device-stage in
 * globals.css), because a pinned device needs vertical room to be worth
 * anything and because a width-only gate keeps this layout at 200% browser
 * zoom, where the screenshot collapses. Below either threshold the page stacks
 * and each block carries its own phone inline.
 */

export interface AppScreen {
  id: string;
  src: string;
  tab: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}

export function PhoneFrame({
  src,
  alt,
  priority = false,
  sizes = '(max-width: 1024px) 60vw, 420px',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    // Flat, dark, and unlit on purpose.
    //
    // This used to be a #2a2a2c-to-#141416 gradient at 4px with a 1px white
    // outer ring. Against a #0A0A0A page that is a bright band tracing the
    // whole outline, and it reads as a glow around the screen rather than as
    // the edge of a device. A bezel only has to make the silhouette findable:
    // one flat value a little above the page does it, with nothing outside the
    // shape at all.
    <div className="relative rounded-[2.1rem] p-[3px] bg-[#17171a]">
      {/* No fake screen glare either. These are real screenshots of a grid of
          numbers, and a diagonal white sheen lifts the blacks unevenly across
          it, so the left column of figures reads lighter than the right. */}
      <div className="relative rounded-[1.95rem] overflow-hidden bg-black">
        <Image
          src={src}
          alt={alt}
          width={1290}
          height={2796}
          priority={priority}
          sizes={sizes}
          className="block w-full h-auto"
        />
      </div>
    </div>
  );
}

export function DeviceScroller({ screens }: { screens: AppScreen[] }) {
  const [active, setActive] = useState(0);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const nodes = blockRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;

    // A narrow band across the middle of the viewport. Whichever block is
    // crossing it owns the device.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = nodes.indexOf(e.target as HTMLDivElement);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [screens.length]);

  return (
    <div className="relative device-stage">
      {/* Pinned device. Gated on viewport height as well as width, see .device-stage in globals.css */}
      <div className="device-stage__pin">
        {/* No fixed height on the sticky box.
            It used to be h-[calc(100vh-8rem)], and a sticky element that is
            nearly as tall as the viewport detaches that far BEFORE its parent
            ends: the phone slid away while the last screen's copy was still
            being read, which looks exactly like the pin failing. The box now
            shrink-wraps the device, and the device is kept meaningfully shorter
            than a copy block so it stays put until the section genuinely
            finishes. */}
        <div className="sticky top-24">
          {/* Sized by HEIGHT, not width. A phone is a tall object in a column
              bounded by the viewport, so a max-width picks the wrong dimension:
              it overflowed the box on a short laptop and stayed small on a tall
              display. Height drives it, the aspect ratio gives the width. */}
          <div
            className="relative mx-auto flex flex-col items-center"
            style={{ height: 'clamp(320px, calc(100vh - 16rem), 720px)', maxWidth: '100%' }}
          >
            <div className="relative flex-1 min-h-0 aspect-[1290/2796]">
              {screens.map((s, i) => (
                <div
                  key={s.id}
                  className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none"
                  style={{ opacity: i === active ? 1 : 0 }}
                >
                  <PhoneFrame src={s.src} alt="" sizes="(max-width: 1280px) 320px, 440px" />
                </div>
              ))}
            </div>

            {/* Position rail. Five marks, the live one gold and wide. */}
            <div className="mt-7 shrink-0 flex items-center justify-center gap-2">
              {screens.map((s, i) => (
                <span
                  key={s.id}
                  aria-hidden="true"
                  className="h-[2px] rounded-full transition-all duration-300 motion-reduce:transition-none"
                  style={{
                    width: i === active ? 26 : 12,
                    background: i === active ? 'var(--color-gold)' : 'var(--color-rule)',
                  }}
                />
              ))}
            </div>
            <p
              aria-hidden="true"
              className="mt-3 shrink-0 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {screens[active]?.tab}
            </p>
            {/* Which screen is showing was state a sighted reader got from the
                rail and nobody else got at all. */}
            <p className="sr-only" aria-live="polite">
              Showing the {screens[active]?.tab} screen
            </p>
          </div>
        </div>
      </div>

      {/* Copy column */}
      <div>
        {screens.map((s, i) => (
          <div
            key={s.id}
            id={s.id}
            ref={(el) => {
              blockRefs.current[i] = el;
            }}
            className="device-stage__block scroll-mt-24 py-14 flex flex-col justify-center border-t border-[var(--color-rule)]"
          >
            <div className="flex items-baseline gap-4 mb-5">
              <span
                className="text-[11px] tracking-[0.18em] text-[var(--color-gold)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {s.eyebrow}
              </span>
              <span aria-hidden="true" className="flex-1 h-px bg-[var(--color-rule)]" />
            </div>

            {/* h3, and a step down in size. These sit under the section's own
                h2, and rendering both at 38px bold made the parent heading rank
                the same as its five children in the type and in the outline. */}
            <h3 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-[1.08] text-[var(--color-text-primary)] mb-5 text-balance">
              {s.title}
            </h3>

            {/* Phone inline below lg, where nothing is pinned. */}
            <div className="device-stage__inline max-w-[250px] my-6">
              <PhoneFrame
                src={s.src}
                alt={`Helm for iPhone, the ${s.tab} screen`}
                sizes="250px"
              />
            </div>

            <p className="text-[16px] text-[var(--color-text-secondary)] leading-[1.65] max-w-[54ch] mb-8">
              {s.body}
            </p>

            <ul className="space-y-0">
              {s.points.map((p) => (
                <li
                  key={p}
                  className="flex gap-4 py-3 border-t border-[var(--color-rule)] text-[14px] text-[var(--color-text-secondary)] leading-relaxed"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[9px] w-3 h-px shrink-0 bg-[var(--color-text-muted)]"
                  />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
