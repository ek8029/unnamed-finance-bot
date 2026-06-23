export interface MacroItem {
  headline: string;
  sourceUrl: string | null;
  exposureLine: string | null;
}

export function MacroStrip({ items }: { items: MacroItem[] }) {
  if (!items || items.length === 0) return null;

  const visible = items.slice(0, 2);

  return (
    <div className="mb-8">
      {/* Section eyebrow */}
      <div
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A] mb-3 flex items-center gap-[10px]"
        style={{ fontFamily: "'Space Grotesk', monospace" }}
      >
        <span className="text-[#E6B94D]">Macro</span>
        <span className="text-[#4A4A4A]">· only what moves your book</span>
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((item, i) => (
          <div
            key={i}
            className="flex overflow-hidden rounded-[4px] border border-white/[0.06] bg-[#131313]"
          >
            {/* 3px neutral spine */}
            <div className="w-[3px] shrink-0 bg-[#6A6A6A]" style={{ opacity: 0.6 }} />

            <div className="flex-1 px-[22px] py-[18px]">
              <div className="flex items-start">
                <div className="flex-1">
                  {/* Headline — links when sourceUrl present */}
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[16px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#FAFAFA] hover:text-[#E6B94D] transition-colors mb-[10px]"
                    >
                      {item.headline}
                    </a>
                  ) : (
                    <p className="text-[16px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#FAFAFA] m-0 mb-[10px]">
                      {item.headline}
                    </p>
                  )}

                  {/* Exposure line */}
                  {item.exposureLine && (
                    <div className="flex items-baseline gap-[10px]">
                      <span
                        className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#4A4A4A] shrink-0"
                        style={{ fontFamily: "'Space Grotesk', monospace" }}
                      >
                        Your Exposure
                      </span>
                      <span className="text-[14.5px] leading-[1.55] text-[#9A9A9A]">
                        {item.exposureLine}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
