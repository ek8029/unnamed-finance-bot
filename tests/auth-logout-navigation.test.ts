import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the actual shell's event handler without mounting unrelated dashboard
// widgets. HTTP and navigation are the only boundaries; no database mock.
function logoutHandler(fetch: typeof globalThis.fetch, replace: ReturnType<typeof vi.fn>) {
  const source = ts.createSourceFile('shell.tsx', readFileSync('app/dashboard/dashboard-shell.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleLogout') handler = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) throw new Error('Actual logout handler not found');
  const js = ts.transpileModule(`const run = ${handler.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const router = { push: vi.fn(), refresh: vi.fn() };
  const run = new Function('fetch', 'window', 'router', 'setLoggingOut', 'navigateAfterAuth', `${js}; return run;`)(fetch, { location: { replace } }, router, vi.fn(), replace);
  return { run, router };
}

describe('dashboard logout account boundary', () => {
  it('discards the document only after the server confirms sign-out', async () => {
    const replace = vi.fn();
    let complete!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { complete = resolve; }));
    const { run, router } = logoutHandler(fetch, replace);
    const pending = run();
    expect(replace).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    complete(new Response(JSON.stringify({ success: true })));
    await pending;
    expect(replace).toHaveBeenCalledWith('/login');
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('does not pretend a failed logout succeeded', async () => {
    const replace = vi.fn();
    const { run, router } = logoutHandler(vi.fn().mockResolvedValue(new Response('{}', { status: 500 })), replace);
    await run();
    expect(replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
