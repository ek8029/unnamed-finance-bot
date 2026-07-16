'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EvidenceTimeline as EvidenceChronology } from '@/components/thesis/evidence-timeline';
import { VerdictCard, type ThesisIntelligenceItem } from '@/components/thesis/verdict-card';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)" };

type PillarStatus = 'unverified' | 'intact' | 'weakening' | 'broken';

interface EvidenceRow {
  id: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  is_backfill: boolean;
  excerpt: string;
  why: string;
  what_it_means: string;
  consider: string | null;
  source_title: string;
  source_url: string | null;
  source_published_at: string | null;
  created_at: string;
}

interface Pillar {
  id: string;
  claim: string;
  origin: 'user' | 'ai_draft';
  confirmed: boolean;
  status: PillarStatus;
  status_override: PillarStatus | null;
  status_changed_at: string | null;
  sort_order: number;
  evidence: EvidenceRow[];
}

interface Thesis {
  id: string;
  ticker: string;
  tracked: boolean;
  notes: string | null;
  last_scanned_at?: string | null;
  version?: number | null;
  version_updated_at?: string | null;
}

const STATUS_META: Record<PillarStatus, { label: string; color: string }> = {
  intact: { label: 'Intact', color: '#4ADE80' },
  weakening: { label: 'Weakening', color: '#E6B94D' },
  broken: { label: 'Broken', color: '#F87171' },
  unverified: { label: 'Watching', color: '#6A6A6A' },
};

function effectiveStatus(p: Pillar): PillarStatus {
  return p.status_override ?? p.status;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toIntelligenceItem(ticker: string, pillar: Pillar, e: EvidenceRow): ThesisIntelligenceItem {
  return {
    ticker,
    pillarClaim: pillar.claim,
    verdict: e.verdict,
    materiality: e.materiality,
    why: e.why,
    whatItMeans: e.what_it_means,
    consider: e.consider,
    isHistorical: e.is_backfill,
    statusChanged: false,
    sources: [{
      excerpt: e.excerpt,
      sourceTitle: e.source_title,
      sourceUrl: e.source_url,
      sourcePublishedAt: e.source_published_at,
    }],
  };
}

function ruleExplanation(status: PillarStatus): string {
  if (status === 'broken') return 'Marked broken: 2 or more contradicting sources in the last 30 days.';
  return 'Marked weakening: a contradicting source in the last 30 days.';
}

function StatusChip({ status }: { status: PillarStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07]" style={MONO}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

function LockIcon({ size = 13, color = '#6A6A6A' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function MiniButton({
  primary, onClick, disabled, children,
}: {
  primary?: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'font-mono text-[10px] font-semibold uppercase tracking-[0.15em] px-3 py-1.5 rounded bg-[#E6B94D] text-black border border-[#E6B94D] hover:bg-[#EFCB72] transition-colors disabled:opacity-50'
          : 'font-mono text-[10px] font-semibold uppercase tracking-[0.15em] px-3 py-1.5 rounded bg-transparent text-[#9A9A9A] border border-white/[0.14] hover:text-[#FAFAFA] transition-colors disabled:opacity-50'
      }
    >
      {children}
    </button>
  );
}

function ClaimTextarea({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus
      rows={2}
      className="w-full rounded bg-[#060606] border border-[rgba(230,185,77,0.35)] text-[#FAFAFA] text-[15px] font-semibold leading-[1.45] tracking-[-0.01em] px-3 py-2.5 outline-none resize-y"
    />
  );
}

function EvidenceTimeline({ ticker, pillar }: { ticker: string; pillar: Pillar }) {
  const [showNeutral, setShowNeutral] = useState(false);
  const all = pillar.evidence;
  const neutralCount = all.filter((e) => e.verdict === 'neutral').length;
  const shown = showNeutral ? all : all.filter((e) => e.verdict !== 'neutral');

  if (all.length === 0) {
    return (
      <p className="text-[14.5px] italic text-[#6A6A6A] py-3 m-0" style={SERIF}>
        No filings or news have moved this pillar since you wrote it. Helm keeps watching.
      </p>
    );
  }

  return (
    <div className="pt-2 pb-3">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {shown.map((e) => (
          <VerdictCard key={e.id} item={toIntelligenceItem(ticker, pillar, e)} showPillarClaim={false} />
        ))}
        {shown.length === 0 && (
          <p className="text-[14px] text-[#6A6A6A] m-0">Only neutral evidence so far.</p>
        )}
      </div>
      {neutralCount > 0 && (
        <button
          type="button"
          onClick={() => setShowNeutral((s) => !s)}
          className="mt-3 font-mono text-[12px] tracking-[0.06em] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors"
        >
          {showNeutral ? 'Hide neutral evidence' : `Show all evidence (${neutralCount} neutral hidden)`}
        </button>
      )}
    </div>
  );
}

function ConfirmedPillarRow({
  ticker, pillar, open, onToggle, onPatch, onRemove,
}: {
  ticker: string;
  pillar: Pillar;
  open: boolean;
  onToggle: () => void;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(pillar.claim);
  const [busy, setBusy] = useState(false);

  const eff = effectiveStatus(pillar);
  const flagged = (pillar.status === 'weakening' || pillar.status === 'broken') && !pillar.status_override;

  const saveClaim = async () => {
    if (text.trim().length === 0 || busy) return;
    setBusy(true);
    const ok = await onPatch(pillar.id, { claim: text.trim() });
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      <div className="flex items-start gap-4 py-3">
        <div className="pt-0.5 shrink-0">
          <StatusChip status={eff} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div>
              <ClaimTextarea value={text} onChange={setText} />
              <div className="flex gap-2 mt-2.5">
                <MiniButton primary onClick={saveClaim} disabled={busy}>Save</MiniButton>
                <MiniButton onClick={() => { setText(pillar.claim); setEditing(false); }}>Cancel</MiniButton>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setText(pillar.claim); setEditing(true); }}
              title="Click to edit"
              className="block w-full text-left text-[15.5px] font-medium leading-[1.4] tracking-[-0.01em] text-[#FAFAFA] cursor-text"
            >
              {pillar.claim}
            </button>
          )}

          {eff === 'unverified' && !editing && pillar.evidence.some((e) => e.verdict === 'supports') && (
            <div className="mt-2 font-mono text-[12px] tracking-[0.04em] text-[#6A6A6A]">
              Historical support &middot; watching for live confirmation
            </div>
          )}

          {flagged && !editing && (
            <div className="mt-3 flex items-start gap-3 px-3.5 py-2.5 rounded border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.06)]">
              <span className="flex-1 text-[15px] leading-[1.5] text-[#E6B94D]">
                {ruleExplanation(pillar.status)}
              </span>
              <button
                type="button"
                onClick={() => onPatch(pillar.id, { status_override: 'intact' })}
                className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9A9A9A] border border-white/[0.14] rounded px-2.5 py-1.5 hover:text-[#FAFAFA] transition-colors whitespace-nowrap"
              >
                Keep intact, I disagree
              </button>
            </div>
          )}

          {pillar.status_override && !editing && (
            <div className="mt-2.5 flex items-center gap-3 font-mono text-[12px] tracking-[0.04em] text-[#6A6A6A]">
              <span>You marked this intact on {fmtDate(pillar.status_changed_at)}</span>
              <button
                type="button"
                onClick={() => onPatch(pillar.id, { status_override: null })}
                className="underline underline-offset-2 hover:text-[#9A9A9A] transition-colors"
              >
                Undo
              </button>
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-[#9A9A9A] hover:text-[#FAFAFA] transition-colors"
          >
            <span className="font-mono text-[13.5px] tracking-[0.04em]">{pillar.evidence.length} evidence</span>
            <span className="text-[10px] text-[#6A6A6A] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
              &#9662;
            </span>
          </button>
          <button
            type="button"
            onClick={() => { if (window.confirm('Remove this pillar? This deletes it and its evidence.')) onRemove(pillar.id); }}
            title="Remove pillar"
            className="w-7 h-7 inline-flex items-center justify-center rounded border border-white/[0.1] text-[#6A6A6A] hover:text-[#F87171] hover:border-[rgba(248,113,113,0.4)] transition-colors font-mono text-[15px]"
          >
            &times;
          </button>
        </div>
      </div>
      {open && (
        <div className="pb-4">
          <EvidenceTimeline ticker={ticker} pillar={pillar} />
        </div>
      )}
    </div>
  );
}

function DraftPillarRow({
  pillar, onPatch, onDismiss,
}: {
  pillar: Pillar;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onDismiss: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(pillar.claim);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    await onPatch(pillar.id, { confirmed: true });
    setBusy(false);
  };

  const saveEdit = async () => {
    if (text.trim().length === 0 || busy) return;
    setBusy(true);
    const ok = await onPatch(pillar.id, { claim: text.trim(), confirmed: true });
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="border-t border-[var(--color-border-subtle)] py-3">
      <div className="flex items-start gap-4">
        <div className="pt-0.5 shrink-0">
          <StatusChip status="unverified" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div>
              <ClaimTextarea value={text} onChange={setText} />
              <div className="flex gap-2 mt-2.5">
                <MiniButton primary onClick={saveEdit} disabled={busy}>Save</MiniButton>
                <MiniButton onClick={() => { setText(pillar.claim); setEditing(false); }}>Cancel</MiniButton>
              </div>
            </div>
          ) : (
            <>
              <div className="text-[15.5px] font-medium italic leading-[1.4] tracking-[-0.01em] text-[#9A9A9A] border-l-2 border-dashed border-white/[0.18] pl-3.5">
                {pillar.claim}
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#6A6A6A]">
                drafted from your holdings &middot; not yours until you accept it
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              title="Accept"
              className="w-8 h-8 inline-flex items-center justify-center rounded border border-white/[0.14] text-[#4ADE80] font-mono text-[15px] hover:border-white/[0.28] transition-colors disabled:opacity-50"
            >
              &#10003;
            </button>
            <button
              type="button"
              onClick={() => { setText(pillar.claim); setEditing(true); }}
              title="Edit"
              className="w-8 h-8 inline-flex items-center justify-center rounded border border-white/[0.14] text-[#9A9A9A] font-mono text-[14px] hover:border-white/[0.28] transition-colors"
            >
              &#9998;
            </button>
            <button
              type="button"
              onClick={() => onDismiss(pillar.id)}
              disabled={busy}
              title="Dismiss"
              className="w-8 h-8 inline-flex items-center justify-center rounded border border-white/[0.14] text-[#F87171] font-mono text-[15px] hover:border-white/[0.28] transition-colors disabled:opacity-50"
            >
              &times;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-4 space-y-3 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-white/[0.05]" />
      <div className="h-4 w-1/2 rounded bg-white/[0.05]" />
      <div className="h-4 w-3/5 rounded bg-white/[0.05]" />
    </div>
  );
}

export function WhyIOwnThis({ ticker, bare = false }: { ticker: string; bare?: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'none' | 'ready' | 'error'>('loading');
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [openPillars, setOpenPillars] = useState<Set<string>>(new Set());
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [trackBusy, setTrackBusy] = useState(false);

  const applyPayload = useCallback((data: { thesis: Thesis; pillars?: Partial<Pillar>[] }) => {
    setThesis(data.thesis);
    setNotesDraft(data.thesis.notes ?? '');
    const withEv = ((data.pillars ?? []) as Pillar[]).map((p) => ({ ...p, evidence: p.evidence ?? [] }));
    setPillars(withEv);
    // Auto-open evidence for pillars that have it: the substance shows on first
    // expand, no second click.
    setOpenPillars(new Set()); // evidence collapsed by default — tap a pillar to expand
    setPhase('ready');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/thesis/${encodeURIComponent(ticker)}`);
        if (cancelled) return;
        if (res.status === 404) { setPhase('none'); return; }
        if (!res.ok) { setPhase('error'); return; }
        const data = await res.json();
        if (cancelled) return;
        applyPayload(data);
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [ticker, applyPayload]);

  const patchPillar = useCallback(async (id: string, body: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/thesis/pillars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      const data = await res.json() as { pillar: Pillar };
      setPillars((prev) => prev.map((p) => (p.id === id ? { ...data.pillar, evidence: p.evidence } : p)));
      return true;
    } catch {
      return false;
    }
  }, []);

  const dismissPillar = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/thesis/pillars/${id}`, { method: 'DELETE' });
      if (res.ok) setPillars((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // leave row in place on failure
    }
  }, []);

  const seedThesis = useCallback(async () => {
    if (seedBusy) return;
    setSeedBusy(true);
    try {
      const res = await fetch('/api/thesis/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) applyPayload(await res.json());
    } finally {
      setSeedBusy(false);
    }
  }, [ticker, seedBusy, applyPayload]);

  const addPillar = useCallback(async () => {
    const claim = addText.trim();
    if (claim.length === 0 || addBusy) return;
    setAddBusy(true);
    try {
      if (!thesis) {
        // The API only creates a thesis through the seed route.
        const seedRes = await fetch('/api/thesis/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });
        if (!seedRes.ok) return;
        applyPayload(await seedRes.json());
      }
      const res = await fetch(`/api/thesis/${encodeURIComponent(ticker)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim }),
      });
      if (res.ok) {
        const data = await res.json() as { pillar: Pillar };
        setPillars((prev) => [...prev, { ...data.pillar, evidence: [] }]);
        setAddText('');
        setAdding(false);
      }
    } finally {
      setAddBusy(false);
    }
  }, [ticker, thesis, addText, addBusy, applyPayload]);

  const trackThesis = useCallback(async () => {
    if (trackBusy) return;
    setTrackBusy(true);
    try {
      const res = await fetch(`/api/thesis/${encodeURIComponent(ticker)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: true }),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        setLockedMessage(data?.error ?? 'Free tier tracks one thesis. Upgrade to track all your positions.');
        return;
      }
      if (res.ok) {
        const data = await res.json() as { thesis: Thesis };
        setThesis((prev) => ({ ...prev, ...data.thesis }));
      }
    } finally {
      setTrackBusy(false);
    }
  }, [ticker, trackBusy]);

  const saveNotes = useCallback(async () => {
    if (!thesis) return;
    const next = notesDraft.trim().length === 0 ? null : notesDraft;
    if ((thesis.notes ?? null) === next) return;
    try {
      const res = await fetch(`/api/thesis/${encodeURIComponent(ticker)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: next }),
      });
      if (res.ok) {
        const data = await res.json() as { thesis: Thesis };
        setThesis((prev) => (prev ? { ...prev, notes: data.thesis.notes } : prev));
      }
    } catch {
      // keep local draft; retried on next blur
    }
  }, [ticker, thesis, notesDraft]);

  const confirmed = pillars.filter((p) => p.confirmed);
  const drafts = pillars.filter((p) => p.origin === 'ai_draft' && !p.confirmed);
  const intactCount = confirmed.filter((p) => effectiveStatus(p) === 'intact').length;
  const allIntact = confirmed.length > 0 && intactCount === confirmed.length;
  const timelineEvidence = confirmed.flatMap((p) =>
    p.evidence.map((e) => ({
      date: e.source_published_at ?? e.created_at,
      source_type: e.source_type,
      verdict: e.verdict,
      materiality: e.materiality,
      excerpt: e.excerpt,
      source_title: e.source_title,
      source_url: e.source_url,
      pillarClaim: p.claim,
      whatItMeans: e.what_it_means,
    })),
  );

  const acceptAllDrafts = useCallback(async () => {
    await Promise.all(drafts.map((d) => patchPillar(d.id, { confirmed: true })));
  }, [drafts, patchPillar]);

  const addControl = adding ? (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <ClaimTextarea
          value={addText}
          onChange={setAddText}
          placeholder={`Write a reason you own ${ticker}, in one sentence`}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <MiniButton primary onClick={addPillar} disabled={addBusy}>Add pillar</MiniButton>
        <MiniButton onClick={() => { setAdding(false); setAddText(''); }}>Cancel</MiniButton>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex items-center gap-3 text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors"
    >
      <span className="w-[22px] h-[22px] inline-flex items-center justify-center border border-white/[0.14] rounded text-[15px]">+</span>
      <span className="text-[14.5px]">Add a pillar</span>
    </button>
  );

  return (
    <section className={bare ? '' : 'rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5'}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-gold)]">
              Why I Own This
            </span>
            {/* F4 provenance pill: your thesis, versioned like the document it is. */}
            {phase === 'ready' && thesis && typeof thesis.version === 'number' && (
              <span className="font-mono text-[10px] tracking-[0.08em] text-[#6A6A6A] px-1.5 py-[2px] rounded border border-white/[0.08]" style={MONO}>
                v{thesis.version}
                {thesis.version_updated_at ? ` · edited ${fmtDate(thesis.version_updated_at)}` : ''}
              </span>
            )}
          </div>
          {phase === 'ready' && (
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mt-2 max-w-[520px] m-0">
              The reasons you hold {ticker}, in your words. Helm scans filings and news against each one and surfaces only what changes them.
            </p>
          )}
        </div>
        {phase === 'ready' && confirmed.length > 0 && (
          allIntact ? (
            <div className="font-mono text-[12px] tracking-[0.06em] inline-flex items-center gap-1.5" style={{ color: '#4ADE80' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ADE80', boxShadow: '0 0 6px #4ADE8088' }} />
              All {confirmed.length} holding
            </div>
          ) : (
            <div className="font-mono text-[12px] tracking-[0.06em] text-[#6A6A6A]">
              {confirmed.length} pillar{confirmed.length === 1 ? '' : 's'} &middot; {intactCount} intact
            </div>
          )
        )}
      </div>

      {phase === 'loading' && <Skeleton />}

      {phase === 'error' && (
        <p className="mt-4 text-[14px] text-[#6A6A6A] m-0">Could not load your thesis. Refresh to retry.</p>
      )}

      {phase === 'none' && (
        <div className="mt-4">
          <p className="text-[14.5px] text-[var(--color-text-secondary)] leading-relaxed m-0">
            No thesis for {ticker} yet. Write the reasons you own it, or let Helm draft a starting point from your holdings.
          </p>
          <div className="flex items-center gap-3 mt-3.5">
            <MiniButton primary onClick={seedThesis} disabled={seedBusy}>
              {seedBusy ? 'Drafting' : 'Draft my thesis'}
            </MiniButton>
            {!adding && <MiniButton onClick={() => setAdding(true)}>+ Add a pillar</MiniButton>}
          </div>
          {adding && <div className="mt-3.5">{addControl}</div>}
        </div>
      )}

      {phase === 'ready' && lockedMessage && (
        <div className="relative mt-4">
          <div className="pointer-events-none select-none" style={{ filter: 'blur(2.5px)', opacity: 0.55 }} aria-hidden>
            {pillars.map((p, i) => (
              <div key={p.id} className={`flex items-start gap-3 py-3 ${i ? 'border-t border-[var(--color-border-subtle)]' : ''}`}>
                <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 bg-[#6A6A6A]" />
                <span className="text-[15px] leading-[1.45] font-medium text-[#9A9A9A]">{p.claim}</span>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col justify-end">
            <div
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(6,6,6,0.85) 55%)' }}
            >
              <LockIcon size={14} color="#E6B94D" />
              <span className="text-[15px] text-[var(--color-text-secondary)]">{lockedMessage}</span>
              <Link
                href="/pricing"
                className="ml-auto font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-gold)] hover:text-[#EFCB72] transition-colors whitespace-nowrap"
              >
                Unlock with Pro
              </Link>
            </div>
          </div>
        </div>
      )}

      {phase === 'ready' && !lockedMessage && (
        <>
          {thesis && !thesis.tracked && (
            <div className="mt-4 flex items-center gap-3 flex-wrap px-3.5 py-3 rounded border border-white/[0.07] bg-[#060606]">
              <span className="flex-1 min-w-[200px] text-[15px] text-[var(--color-text-secondary)] leading-[1.5]">
                Helm is not scanning this thesis yet. Track it to check filings and news against each pillar.
              </span>
              <MiniButton primary onClick={trackThesis} disabled={trackBusy}>
                {trackBusy ? 'Tracking' : 'Track this position'}
              </MiniButton>
            </div>
          )}

          <div className="mt-4">
            {confirmed.map((p) => (
              <ConfirmedPillarRow
                key={p.id}
                ticker={ticker}
                pillar={p}
                open={openPillars.has(p.id)}
                onToggle={() => setOpenPillars((cur) => {
                  const next = new Set(cur);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                })}
                onPatch={patchPillar}
                onRemove={dismissPillar}
              />
            ))}

            {drafts.length >= 2 && (
              <div className="border-t border-[var(--color-border-subtle)] py-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={acceptAllDrafts}
                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[#E6B94D] hover:text-[#EFCB72] transition-colors"
                >
                  Accept all
                </button>
              </div>
            )}

            {drafts.map((p) => (
              <DraftPillarRow key={p.id} pillar={p} onPatch={patchPillar} onDismiss={dismissPillar} />
            ))}

            {confirmed.length < 4 && (
              <div className="border-t border-[var(--color-border-subtle)] py-3.5">{addControl}</div>
            )}
          </div>

          {timelineEvidence.length > 0 && (
            <div className="mt-3">
              <EvidenceChronology evidence={timelineEvidence} />
            </div>
          )}

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setNotesOpen((o) => !o)}
              className="flex items-center gap-2.5 text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors py-1.5"
            >
              <span className="text-[10px] transition-transform" style={{ transform: notesOpen ? 'rotate(90deg)' : 'none' }}>
                &#9656;
              </span>
              <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.15em]">Your notes</span>
              <span className="font-mono text-[12px] text-[#6A6A6A] normal-case tracking-normal">not scanned</span>
            </button>
            {notesOpen && (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={saveNotes}
                placeholder="Narrative, context, anything Helm should not treat as a scored claim. Yours alone."
                rows={4}
                className="w-full mt-2 rounded bg-[#060606] border border-white/[0.07] text-[#FAFAFA] text-[14.5px] leading-[1.6] px-3.5 py-3 outline-none resize-y"
                style={SERIF}
              />
            )}
          </div>

          <div className="mt-3 font-mono text-[12px] tracking-[0.06em] text-[#6A6A6A]">
            {thesis?.last_scanned_at ? `Last scanned ${fmtDate(thesis.last_scanned_at)}` : 'Not scanned yet'}
          </div>
        </>
      )}
    </section>
  );
}
