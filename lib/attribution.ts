/**
 * FIRST-TOUCH ATTRIBUTION.
 *
 * The old capture read utm_* from the URL inside a useEffect on /signup, which
 * meant it only ever fired if someone landed DIRECTLY on the signup page with
 * the params still attached. Every real link points at the homepage, a blog
 * post or an /analyze page; by the time the person clicks through to /signup the
 * URL is clean and there is nothing to read. Result: all 198 accounts had
 * utm_source null, and four months of channel decisions were made blind.
 *
 * The fix is to record attribution at FIRST TOUCH, in middleware, on whatever
 * page they actually landed on, into a cookie that survives until they sign up.
 *
 * FIRST touch, not last: the blog post that brought someone is the acquisition.
 * The /signup page they reached three clicks later is not, and overwriting would
 * relabel every organic arrival as self-referral. The cookie is therefore
 * written once and never updated.
 *
 * Referrer is captured too, because the channel that actually matters here is
 * organic search, and organic arrivals carry no utm params at all. Without this
 * the fix would still report "(none)" for the majority of real traffic.
 */

export interface FirstTouch {
  /** utm_source, or a host derived from the referrer, or 'direct'. */
  source: string | null;
  medium: string | null;
  campaign: string | null;
  /** Referring host, kept raw so a wrong source guess can be re-derived later. */
  referrer: string | null;
  /** The page they actually arrived on. Tells you which content pulled them. */
  landing: string | null;
  /** ISO date of first touch. Day precision: the hour is not worth the bytes. */
  at: string | null;
}

export const ATTR_COOKIE = 'helm_attr';
/** Long enough to cover a slow consideration cycle, short enough to stay honest. */
export const ATTR_MAX_AGE = 60 * 60 * 24 * 90;

/** Hosts that are search engines rather than referring sites. */
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|baidu|yandex)\./i;
/** AI assistants that cite us. The whole GEO thesis rests on measuring these. */
const ASSISTANT = /(^|\.)(chatgpt|openai|perplexity|claude|anthropic|gemini|copilot)\./i;
const SOCIAL = /(^|\.)(x|twitter|t|linkedin|lnkd|reddit|news\.ycombinator|tiktok|instagram|facebook)\./i;

function host(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, '') || null; } catch { return null; }
}

/**
 * Derive a channel from a referrer when the link carried no utm params. Kept
 * deliberately coarse: search / assistant / social / referral. A finer taxonomy
 * would be guessing, and `referrer` is stored raw so it can be redone later.
 */
/**
 * The second-to-last label, not the first. `news.ycombinator.com` reported as
 * "news" otherwise, which is both wrong and useless in a channel report;
 * `ycombinator` is the thing anyone would search the table for.
 */
function label(h: string): string {
  const parts = h.split('.');
  return parts.length >= 2 ? parts[parts.length - 2] : h;
}

/** Shorteners and rebrands, so one channel does not split across two rows. */
const ALIAS: Record<string, string> = {
  t: 'x', twitter: 'x', lnkd: 'linkedin', ycombinator: 'hackernews',
  openai: 'chatgpt', anthropic: 'claude',
};

function fromReferrer(ref: string | null, selfHost: string): { source: string; medium: string } | null {
  const h = host(ref);
  if (!h) return null;
  if (h === selfHost || h.endsWith(`.${selfHost}`)) return null; // internal navigation
  const name = ALIAS[label(h)] ?? label(h);
  if (SEARCH.test(`.${h}`)) return { source: name, medium: 'organic' };
  if (ASSISTANT.test(`.${h}`)) return { source: name, medium: 'ai_assistant' };
  if (SOCIAL.test(`.${h}`)) return { source: name, medium: 'social' };
  return { source: h, medium: 'referral' };
}

/**
 * Build the first-touch record for a request, or null when there is nothing
 * worth recording. Returning null for a bare internal navigation is what keeps
 * the cookie meaning "how they arrived" rather than "the last page they saw".
 */
export function buildFirstTouch(
  url: URL,
  referrer: string | null,
  selfHost: string,
): FirstTouch | null {
  const q = url.searchParams;
  const utmSource = q.get('utm_source');
  const utmMedium = q.get('utm_medium');
  const utmCampaign = q.get('utm_campaign');
  const derived = fromReferrer(referrer, selfHost);

  // No tag and no external referrer: a direct arrival. Still worth recording,
  // because "direct" is an answer and (none) is not — but only on a real entry
  // page, which the caller decides by only writing the cookie once.
  const source = utmSource ?? derived?.source ?? 'direct';
  const medium = utmMedium ?? derived?.medium ?? 'none';

  return {
    source: source.slice(0, 64),
    medium: medium.slice(0, 64),
    campaign: utmCampaign ? utmCampaign.slice(0, 64) : null,
    referrer: host(referrer),
    landing: url.pathname.slice(0, 128),
    at: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Plain JSON. NextResponse.cookies.set() percent-encodes the value on write and
 * request.cookies.get() decodes it on read, so encoding here as well produced a
 * double-encoded cookie (%257B rather than %7B). It happened to survive the
 * round trip, but only because the decode below undid the second layer — a
 * campaign name containing a literal % would have thrown and silently dropped
 * the attribution.
 */
export function encodeFirstTouch(f: FirstTouch): string {
  return JSON.stringify(f);
}

/**
 * Never throws: a malformed cookie must not be able to break a signup.
 * Tolerates a still-encoded value so cookies written by an older deploy, which
 * are already in browsers, keep resolving instead of silently reading as null.
 */
export function decodeFirstTouch(raw: string | undefined | null): FirstTouch | null {
  if (!raw) return null;
  try {
    let text = raw;
    if (!text.trimStart().startsWith('{')) {
      try { text = decodeURIComponent(text); } catch { /* keep the original */ }
    }
    const o = JSON.parse(text) as Partial<FirstTouch>;
    if (!o || typeof o !== 'object') return null;
    const s = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 128) : null);
    return {
      source: s(o.source), medium: s(o.medium), campaign: s(o.campaign),
      referrer: s(o.referrer), landing: s(o.landing), at: s(o.at),
    };
  } catch {
    return null;
  }
}
