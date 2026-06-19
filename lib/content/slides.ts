export interface SlideModel { index: number; title: string; body: string; kind: 'hook'|'pillar'|'event'|'cite'|'verdict'|'cta' }
const KINDS = ['hook','pillar','event','cite','verdict','cta'] as const;
export function toSlides(slideCopy: { title: string; body: string }[]): SlideModel[] {
  return slideCopy.slice(0, 6).map((s, i) => ({ index: i, kind: KINDS[i], ...s }));
}
