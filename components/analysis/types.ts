// Shared types for analysis cards — used by both dashboard chat and public analysis pages

export interface AnalysisMetric {
  label: string;
  value: string;
  change?: string | null;
  context?: string | null;
}

export interface NewsHighlight {
  headline: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  date: string;
}

export interface StockAnalysis {
  type: 'stock_analysis';
  ticker: string;
  companyName: string;
  verdict: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  metrics: AnalysisMetric[];
  bullCase: string;
  bearCase: string;
  recommendation: string;
  newsHighlights: NewsHighlight[];
}

export interface PortfolioReview {
  type: 'portfolio_review';
  title: string;
  summary: string;
  metrics: AnalysisMetric[];
  strengths: string[];
  weaknesses: string[];
  recommendations: { action: string; rationale: string; priority: 'high' | 'medium' | 'low' }[];
  riskFactors: string[];
}

export interface GeneralAnalysis {
  type: 'general';
  title: string;
  summary: string;
  keyPoints: { point: string; detail: string }[];
  metrics: AnalysisMetric[];
}

export interface PortfolioQAHighlight {
  label: string;
  value: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'warning';
  detail: string;
}

export interface PortfolioQA {
  type: 'portfolio_qa';
  title: string;
  summary: string;
  highlights: PortfolioQAHighlight[];
  recommendation: string;
  followUpQuestions: string[];
}

export type Analysis = StockAnalysis | PortfolioReview | GeneralAnalysis | PortfolioQA;
