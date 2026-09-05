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
    // A device, lit from above. Not a glowing one, and not a bare screenshot.
    //
    // Two wrong answers came before this. First a #2a2a2c bezel with a 1px
    // WHITE RING around the outside: a uniform bright outline tracing the whole
    // shape, which reads as a glow rather than as an edge. Then, overcorrecting,
    // a flat #17171a with no shadow at all, which reads as a screenshot pasted
    // on the page with no dimension to it.
    //
    // What separates the two is where the light is. A ring that is equally
    // bright all the way round is a halo. A gradient that is brightest at the
    // top edge and falls away, plus a shadow that falls downward, is an object
    // sitting under a light. Same ingredients, opposite read.
    <div className="relative">
      {/* Side hardware. Small, and the single clearest signal that this is a
          phone rather than a rectangle with a screenshot in it. */}
      <span aria-hidden="true" className="absolute -left-[2px] top-[19%] w-[3px] h-[4%] rounded-l-sm bg-[#1c1c20]" />
      <span aria-hidden="true" className="absolute -left-[2px] top-[26%] w-[3px] h-[7%] rounded-l-sm bg-[#1c1c20]" />
      <span aria-hidden="true" className="absolute -left-[2px] top-[35%] w-[3px] h-[7%] rounded-l-sm bg-[#1c1c20]" />
      <span aria-hidden="true" className="absolute -right-[2px] top-[28%] w-[3px] h-[11%] rounded-r-sm bg-[#1c1c20]" />

      <div
        className="relative rounded-[2.3rem] p-[5px] bg-gradient-to-b from-[#26262b] via-[#131316] to-[#0d0d10]"
        style={{
          boxShadow: [
            // 1px specular on the top edge only, inside the shape
            'inset 0 1px 0 rgba(255,255,255,0.13)',
            // and it grounds, rather than radiates
            '0 34px 64px -24px rgba(0,0,0,0.95)',
            '0 12px 26px -12px rgba(0,0,0,0.85)',
          ].join(', '),
        }}
      >
        {/* No fake screen glare. These are real screenshots of a grid of
            numbers, and a diagonal white sheen lifts the blacks unevenly across
            it, so the left column of figures reads lighter than the right. The
            inset hairline is the glass edge and stops there. */}
        <div className="relative rounded-[1.95rem] overflow-hidden bg-black ring-1 ring-inset ring-white/[0.07]">
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
        {/* The geometry here is solved, not tuned.
         *
         * A sticky box detaches its OWN height before its parent's range ends.
         * Writing B for the block height, V for the viewport, t for this top
         * offset and h for the box height: the last block's copy sits centred
         * at scrollY = top + 4.5B - V/2, and the box is still stuck while
         * scrollY <= top + 5B - t - h. So it holds iff
         *
         *     h <= 0.5B + V/2 - t
         *
         * Centring the device in the viewport means h = V - 2t, and
         * substituting gives B >= V - 2t. That is the whole answer: a centred,
         * viewport-tall device REQUIRES roughly one block per screenful.
         * Shrinking the device to make it hold, which is what the last attempt
         * did, was solving the wrong side of the inequality and cost 40% of its
         * size for nothing.
         *
         * B = 100vh (globals.css), t = 64px and h = V - 128 puts the box exactly
         * centred (64px top, 64px bottom) with 64px of margin on the
         * inequality at every viewport height.
         */}
        <div className="sticky top-16 flex items-center" style={{ height: 'calc(100vh - 8rem)' }}>
          {/* Sized by HEIGHT, not width. A phone is a tall object in a column
              bounded by the fold, so a max-width picks the wrong dimension.
              Height drives it, the aspect ratio gives the width. */}
          {/* This box is the DEVICE, nothing else. The rail used to live inside
              it, so centring the box put the phone 37px high by half the rail's
              height. The rail hangs off the bottom instead. */}
          <div
            className="relative mx-auto"
            style={{ height: 'min(calc(100vh - 13rem), 980px)', maxWidth: '100%' }}
          >
            <div className="relative h-full aspect-[1290/2796]">
              {screens.map((s, i) => (
                <div
                  key={s.id}
                  className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none"
                  style={{ opacity: i === active ? 1 : 0 }}
                >
                  <PhoneFrame src={s.src} alt="" sizes="(max-width: 1280px) 360px, 460px" />
                </div>
              ))}
            </div>

            {/* Position rail. Five marks, the live one gold and wide. */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 flex items-center justify-center gap-2">
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
              className="absolute top-full left-1/2 -translate-x-1/2 mt-[34px] whitespace-nowrap text-center text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
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
