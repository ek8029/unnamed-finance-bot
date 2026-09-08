'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Expand, X, ZoomIn, ZoomOut } from 'lucide-react';
import manifest from '@/public/product/screenshots/manifest.json';
import s from './product-screenshot.module.css';

const labels = { overview: 'Portfolio overview', thesis: 'Investment theses', exposure: 'Portfolio · True Exposure', brief: 'Daily brief', taxes: 'Taxes · Loss harvesting' };

/** Lossless browser captures of the actual app. Keep the opened screen stable. */
export function ProductScreenshot({ name, alt, priority = false, interactive = true }: {
  name: keyof typeof labels;
  alt: string;
  priority?: boolean;
  interactive?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [narrow, setNarrow] = useState(false);
  const [opened, setOpened] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [openedDevice, setOpenedDevice] = useState<'desktop' | 'mobile'>('desktop');
  const imageAlt = name === 'thesis'
    ? 'Helm investment theses table with ten illustrative positions, portfolio value, pressure alerts, evidence counts and estimated earnings dates'
    : alt;
  const device = narrow ? 'mobile' : 'desktop';
  const file = `${name}-${device}.webp`;
  const size = manifest.images.find(image => image.file === file)!;
  const src = `/product/screenshots/${file}?v=${encodeURIComponent(manifest.capturedAt)}`;
  const fullSize = manifest.images.find(image => image.file === `${name}-${openedDevice}.webp`)!;
  const fullSrc = `/product/screenshots/${fullSize.file}?v=${encodeURIComponent(manifest.capturedAt)}`;

  useEffect(() => {
    // A narrow desktop column should not pretend the desktop app is a phone.
    const query = window.matchMedia('(max-width: 1024px)');
    const update = () => setNarrow(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [opened]);

  const picture = <picture className={s.picture}>
    <Image src={src} alt={imageAlt} width={size.width} height={size.height}
      className={s.image} unoptimized loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />
  </picture>;

  return <div className={s.root} data-product-image={name} data-composition={device}>
    {interactive ? <button type="button" className={s.open} ref={trigger} aria-label={`Enlarge ${labels[name]} screenshot`} onClick={() => {
      setOpenedDevice(device); setZoomed(false); setOpened(true); dialog.current?.showModal();
    }}>{picture}<span className={s.openLabel}><span className={s.provenance}>Pro preview · Sample data</span><span className={s.enlarge}><Expand size={15} /> View full size</span></span></button> : picture}
    {interactive && <dialog ref={dialog} className={s.dialog} aria-labelledby={titleId} onClose={() => {
      setOpened(false); setZoomed(false); trigger.current?.focus({ preventScroll: true });
    }} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className={s.viewer}>
        <header className={s.viewerHeader}><div><h2 id={titleId}>{labels[name]}</h2><p>{openedDevice === 'mobile' ? 'Mobile' : 'Desktop'} app · Pro · Illustrative sample data</p></div>
          <div className={s.viewerActions}><button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}{zoomed ? 'Fit image' : 'Zoom in'}</button><button type="button" aria-label="Close screenshot" onClick={() => dialog.current?.close()}><X size={22} /></button></div>
        </header>
        <div className={s.canvas} tabIndex={0} aria-label="Screenshot. Scroll to inspect when zoomed.">
          {opened && <Image src={fullSrc} alt={imageAlt} width={fullSize.width} height={fullSize.height} unoptimized style={{ width: zoomed ? fullSize.cssWidth * 1.5 : fullSize.cssWidth }} className={`${s.fullImage} ${zoomed ? s.zoomed : ''}`} />}
        </div>
      </div>
    </dialog>}
  </div>;
}
