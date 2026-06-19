export interface Pillar {
  id: string;        // stable slug, e.g. 'gov-revenue'
  claim: string;     // the falsifiable reason-to-own
  breaks_if: string; // the single fact that would invalidate it
}
export interface HouseThesis {
  ticker: string;
  company: string;
  pillars: Pillar[]; // 2-3 per ticker
}
export interface ScoredItem {
  ticker: string;
  pillarId: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  verbatimCite: string;
  citeDate: string;
  sourceUrl: string;
  sourceType: 'filing' | 'major_news' | 'minor_news';
  summary: string;
}
export interface ContentEvent extends ScoredItem {
  id: string;
  date: string;
  company: string;
  pillarClaim: string;
  newsworthiness: number;
}
export interface GeneratedContent {
  xThread: string[];
  linkedinPost: string;
  caption: string;
  disclaimer: string;
}
