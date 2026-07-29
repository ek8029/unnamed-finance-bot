// The research engine's shared vocabulary.
//
// The research tab is meant to read like a grounded analyst, not an intent
// router. Its whole credibility rests on one rule: every claim it makes ties
// back to something the agent actually surfaced or a real market number. These
// types carry that discipline — a `Finding` is a real row the agent produced,
// and a `GroundedAnswer` may only cite `Finding`s that were retrieved for the
// query.

/** Where a finding came from in the agent's own output tables. */
export type FindingKind = 'catch' | 'investigation' | 'cross_thesis' | 'action';

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  catch: 'Thesis catch',
  investigation: 'Investigation',
  cross_thesis: 'Cross-thesis risk',
  action: 'Actions inbox',
};

/**
 * One thing the agent already found, normalised across the four source tables
 * (pillar_evidence, thesis_investigations, thesis_clusters, insights).
 *
 * `id` is the citation handle. The model is handed these ids and must cite by
 * id; anything it cites that is not in the retrieved set is dropped before the
 * answer is returned. That is what stops it inventing a finding.
 */
export interface Finding {
  id: string;
  kind: FindingKind;
  ticker: string | null;
  /** The pillar claim this attaches to, when it came from a thesis. */
  claim?: string;
  /** One line: what the agent found. */
  summary: string;
  /** Verbatim source text, when there is one (the receipt). */
  quote?: string;
  /** Human-readable source label (filing title, "Helm investigation", …). */
  source: string;
  url?: string | null;
  /** ISO date (YYYY-MM-DD). */
  date?: string | null;
  verdict?: 'supports' | 'contradicts' | 'neutral';
}

export type Topic = 'tax' | 'risk' | 'concentration' | 'earnings' | 'performance';

/**
 * The weekly analyst note: a written memo composed once a week from the
 * agent's findings on the user's book. Citations are snapshots taken at
 * compose time so the receipts render forever, unchanged.
 */
export interface AnalystNote {
  id: string;
  /** Monday of the covered week, YYYY-MM-DD. */
  weekStart: string;
  title: string;
  /** Prose with inline [kind:id] citations, same grammar as GroundedAnswer. */
  body: string;
  citations: Finding[];
  createdAt: string;
  adviceFlag?: boolean;
}

// The book read and the value ledger live in the data layer (service-role
// reads); re-exported here so consumers get them from one place.
export type { PortfolioBrief, BriefHolding, ValueLedger, LedgerLine } from './account';
import type { PortfolioBrief, ValueLedger } from './account';

/** Everything retrieved for a single question, before the model composes. */
export interface ResearchContext {
  query: string;
  tickers: string[];
  topics: Topic[];
  findings: Finding[];
  portfolio: PortfolioBrief | null;
  /** Pre-formatted realized-gains + harvestable-loss block, or ''. */
  tax: string;
  /** Dollar value Helm has surfaced (harvest + insight impacts). */
  ledger: ValueLedger;
  /** Pre-formatted live market data block for mentioned tickers, or ''. */
  marketData: string;
}

/**
 * The free-form response the engine returns for anything that is not a clean
 * templated card. Prose, plus the exact findings it stood on.
 */
export interface GroundedAnswer {
  type: 'grounded_answer';
  answer: string;
  citations: Finding[];
  followUps: string[];
  /** Set when the answer contained advice language the guardrail caught. */
  adviceFlag?: boolean;
}
