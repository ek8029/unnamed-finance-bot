'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingDown, Calendar, Zap, PieChart, DollarSign } from 'lucide-react';

/* ── Dashboard "moments" — each shows a different Pro intelligence surface ── */

const moments = [
  {
    label: 'Concentration Risk',
    cards: [
      { label: 'Portfolio Value', value: '$347,200', sub: '+2.4% this month', subColor: 'text-[var(--color-positive)]', valueColor: 'text-[var(--color-gold)]' },
      { label: 'Positions', value: '14', sub: '3 drive 68% of value', subColor: 'text-[var(--color-warning)]', valueColor: '' },
      { label: 'Health Score', value: '72', sub: 'Good — 2 warnings', subColor: 'text-[var(--color-gold)]', valueColor: '' },
    ],
    alert: { icon: PieChart, color: 'text-[var(--color-warning)]', borderColor: 'border-[var(--color-warning)]/20', bgColor: 'bg-[var(--color-warning)]/[0.04]', title: 'Concentration Risk Detected', body: 'NVDA 34%, AAPL 19%, MSFT 15% = 68% in 3 positions.' },
    actions: [
      { priority: 'URGENT', color: 'text-[var(--color-negative)]', text: 'NVDA exceeds 30% concentration threshold' },
      { priority: 'THIS WEEK', color: 'text-[var(--color-warning)]', text: 'Tech allocation: 72%' },
    ],
  },
  {
    label: 'Tax-Loss Harvesting',
    cards: [
      { label: 'Unrealized P&L', value: '+$18,400', sub: '12 positions in profit', subColor: 'text-[var(--color-positive)]', valueColor: 'text-[var(--color-positive)]' },
      { label: 'TLH Opportunities', value: '$2,800', sub: 'Wash-sale safe', subColor: 'text-[var(--color-positive)]', valueColor: 'text-[var(--color-gold)]' },
      { label: 'YTD Tax Saved', value: '$1,450', sub: 'From 3 harvests', subColor: 'text-[var(--color-text-muted)]', valueColor: 'text-[var(--color-positive)]' },
    ],
    alert: { icon: DollarSign, color: 'text-[var(--color-positive)]', borderColor: 'border-[var(--color-positive)]/20', bgColor: 'bg-[var(--color-positive)]/[0.04]', title: '$2,800 Harvesting Opportunity', body: 'VXUS has $2,800 in unrealized losses; VEA is a same-category international ETF. No purchases in 31 days, so no wash-sale conflict detected.' },
    actions: [
      { priority: 'ACTION', color: 'text-[var(--color-positive)]', text: 'VXUS unrealized loss; ~$840 potential tax offset' },
      { priority: 'MONITOR', color: 'text-[var(--color-text-muted)]', text: 'INTC approaching harvestable loss (-8.2%)' },
    ],
  },
  {
    label: 'Earnings Exposure',
    cards: [
      { label: 'Reporting This Week', value: '4', sub: '47% of portfolio', subColor: 'text-[var(--color-warning)]', valueColor: 'text-[var(--color-warning)]' },
      { label: 'Exposed Value', value: '$163,184', sub: 'Across AAPL, MSFT, GOOG, AMZN', subColor: 'text-[var(--color-text-muted)]', valueColor: '' },
      { label: 'Est. Volatility', value: '±4.2%', sub: 'Based on historical moves', subColor: 'text-[var(--color-text-muted)]', valueColor: 'text-[var(--color-negative)]' },
    ],
    alert: { icon: Calendar, color: 'text-[var(--color-warning)]', borderColor: 'border-[var(--color-warning)]/20', bgColor: 'bg-[var(--color-warning)]/[0.04]', title: '47% Earnings Exposure This Week', body: 'AAPL reports Thursday after close. MSFT reports Thursday after close. Combined: $163K or 47% of your portfolio. Historical post-earnings move: ±4.2%.' },
    actions: [
      { priority: 'URGENT', color: 'text-[var(--color-negative)]', text: 'AAPL earnings Thu — 19% of portfolio exposed' },
      { priority: 'THIS WEEK', color: 'text-[var(--color-warning)]', text: 'MSFT earnings Thu; 19% of portfolio exposed' },
    ],
  },
];

export function DashboardMockup({ momentIndex = 0 }: { momentIndex?: number }) {
  const moment = moments[momentIndex % moments.length];

  return (
    <div className="p-4 sm:p-5 space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {moment.cards.map((card) => (
          <div key={card.label} className="bg-white/[0.03] rounded-lg p-2.5">
            <div className="text-[8px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-0.5">{card.label}</div>
            <div className={`font-mono font-bold text-[15px] md:text-base ${card.valueColor} truncate`} title={card.value}>{card.value}</div>
            <div className={`text-[9px] font-mono mt-0.5 ${card.subColor}`}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Alert card */}
      <div className={`rounded-lg border ${moment.alert.borderColor} ${moment.alert.bgColor} p-3`}>
        <div className="flex items-start gap-2.5">
          <moment.alert.icon className={`w-4 h-4 ${moment.alert.color} shrink-0 mt-0.5`} aria-hidden="true" />
          <div className="min-w-0">
            <div className={`text-[12px] font-bold ${moment.alert.color} mb-1`}>{moment.alert.title}</div>
            <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">{moment.alert.body}</p>
          </div>
        </div>
      </div>

      {/* Actions inbox */}
      <div>
        <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Actions Inbox</div>
        <div className="space-y-1.5">
          {moment.actions.map((action, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/[0.02] rounded px-2.5 py-2 border border-white/[0.04]">
              <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${action.color} shrink-0 w-16`}>{action.priority}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] truncate">{action.text}</span>
              <Zap className="w-3 h-3 text-[var(--color-gold)] shrink-0 ml-auto" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const DASHBOARD_MOMENT_COUNT = moments.length;
