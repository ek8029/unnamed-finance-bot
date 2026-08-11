import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative, sep } from 'path';

/**
 * Every public page needs its own <title>.
 *
 * The root layout sets a static title with no `template`, so any page that
 * exports no metadata of its own silently renders
 * "Helm Terminal | Agentic Thesis Monitoring for Your Whole Portfolio" —
 * identical to the homepage, in the browser tab and in search results.
 *
 * That is how /tools/rsu-calculator, an indexed SEO asset, ended up sharing the
 * homepage's title. Client components cannot export metadata, so the fix is a
 * sibling layout.tsx; this test accepts either.
 *
 * NOTE: a root `title.template` would NOT fix this. The 53 pages that already
 * have metadata use full titles ("Sign In - Helm"), so a template would append
 * to all of them and break working pages.
 */
const APP = join(process.cwd(), 'app');

// Not public: authenticated surfaces, internal tooling, and route handlers.
const PRIVATE = ['dashboard', 'admin', 'testing', 'api'];
// The homepage legitimately uses the root layout's title.
const EXEMPT = ['page.tsx'];

const META = /export\s+const\s+metadata|export\s+async\s+function\s+generateMetadata/;

function pages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (PRIVATE.includes(entry)) continue;
      pages(full, out);
    } else if (entry === 'page.tsx') {
      out.push(full);
    }
  }
  return out;
}

/** Own metadata, or any layout between the page and app/ that has it. */
function hasTitle(pagePath: string): boolean {
  if (META.test(readFileSync(pagePath, 'utf8'))) return true;
  let dir = dirname(pagePath);
  while (dir.startsWith(APP) && dir !== APP) {
    const layout = join(dir, 'layout.tsx');
    if (existsSync(layout) && META.test(readFileSync(layout, 'utf8'))) return true;
    dir = dirname(dir);
  }
  return false;
}

describe('page metadata', () => {
  it('every public page defines its own title', () => {
    const missing = pages(APP)
      .filter((p) => !EXEMPT.includes(relative(APP, p)))
      .filter((p) => !hasTitle(p))
      .map((p) => relative(process.cwd(), p).split(sep).join('/'));

    expect(missing).toEqual([]);
  });
});
