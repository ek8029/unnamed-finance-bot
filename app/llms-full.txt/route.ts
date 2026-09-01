import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  // Template lives in content/llms, not public: a public file at the route's
  // own path makes Next dev 500 the route (conflicting-public-file-page).
  const content = readFileSync(join(process.cwd(), 'content', 'llms', 'llms-full.txt'), 'utf-8');
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
