'use client';

// Import a book from a screenshot or a CSV export.
//
// This is a READ step. It extracts candidates and hands them to the manual form,
// which is where the user corrects them and where the only write happens. A
// quantity that is off by a digit poisons concentration math, tax-loss
// harvesting and every thesis pillar, so nothing here is saved automatically.
//
// The image is sent once and never stored, here or on the server.

import { useCallback, useRef, useState } from 'react';
import { Loader2, ImageIcon, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import type { ImportedRow, ImportSkip } from '@/lib/portfolio-import';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/** Bail before spending a request on something that cannot be a screenshot. */
const MAX_FILE_BYTES = 6 * 1024 * 1024;

interface Props {
  onExtracted: (rows: ImportedRow[]) => void;
}

export function PortfolioImport({ onExtracted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<ImportSkip[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = useCallback(async (payload: { csv: string } | { imageDataUrl: string }) => {
    setBusy(true);
    setError(null);
    setSkipped([]);
    try {
      const res = await fetch('/api/portfolio/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not read that.');
        setSkipped(data.skipped ?? []);
        return;
      }
      setSkipped(data.skipped ?? []);
      onExtracted(data.rows ?? []);
    } catch {
      setError('Could not reach Helm. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [onExtracted]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is too large. A normal screenshot or a holdings CSV is fine.');
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isText = /csv|tab-separated|text\/plain/.test(file.type) || /\.(csv|tsv|txt)$/i.test(file.name);

    if (isImage) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      }).catch(() => null);
      if (!dataUrl) { setError('Could not read that image.'); return; }
      await send({ imageDataUrl: dataUrl });
      return;
    }
    if (isText) {
      await send({ csv: await file.text() });
      return;
    }
    setError('Send a screenshot (PNG or JPG) or a CSV export.');
  }, [send]);

  /** Screenshot straight from the clipboard: paste beats save-then-upload. */
  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const img = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'));
    if (img) { e.preventDefault(); void handleFile(img); return; }
    const text = e.clipboardData.getData('text');
    if (text && text.includes('\n')) { e.preventDefault(); void send({ csv: text }); }
  }, [handleFile, send]);

  return (
    <div className="mb-6">
      <div
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Import holdings from a screenshot or CSV file"
        aria-busy={busy}
        className="w-full rounded-lg border border-dashed px-5 py-7 text-center cursor-pointer transition-colors focus:outline-none focus:border-[var(--color-gold)]"
        style={{
          borderColor: dragging ? 'var(--color-gold)' : 'var(--color-border-base)',
          background: dragging ? 'rgba(230,185,77,0.05)' : 'var(--color-bg-inset)',
        }}
      >
        {busy ? (
          <div className="flex items-center justify-center gap-2.5 text-[14px] text-[var(--color-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Reading your positions
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-2.5 text-[var(--color-text-muted)]">
              <ImageIcon className="w-[18px] h-[18px]" />
              <FileSpreadsheet className="w-[18px] h-[18px]" />
            </div>
            <p className="m-0 text-[15px] text-[var(--color-text-primary)]">
              Drop a screenshot of your holdings, or a CSV export
            </p>
            <p className="m-0 mt-1.5 text-[13px] text-[var(--color-text-muted)] leading-relaxed">
              Paste works too. Helm reads the positions and fills the form below for you to check.
              Nothing is saved until you save it.
            </p>
            <p className="m-0 mt-2.5 text-[11px] text-[var(--color-text-muted)]" style={MONO}>
              the image is read once and never stored
            </p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p className="mt-2.5 text-[13.5px] text-[var(--color-negative-text)] leading-relaxed">{error}</p>
      )}

      {skipped.length > 0 && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-inset)] px-3 py-2.5">
          <AlertTriangle className="w-[15px] h-[15px] mt-0.5 shrink-0 text-[var(--color-gold)]" />
          <div className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
            <p className="m-0 mb-1 text-[var(--color-text-secondary)]">
              {skipped.length} row{skipped.length === 1 ? '' : 's'} left out. Add {skipped.length === 1 ? 'it' : 'them'} by hand if you need {skipped.length === 1 ? 'it' : 'them'}.
            </p>
            <ul className="m-0 pl-4 list-disc">
              {skipped.slice(0, 6).map((s, i) => <li key={i}>{s.reason}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
