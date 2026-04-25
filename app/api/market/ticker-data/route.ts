import { NextRequest, NextResponse } from 'next/server';
import { getFullTickerData } from '@/lib/financial-data';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase().replace(/[^A-Z]/g, '');

  if (!symbol || symbol.length > 5) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  const data = await getFullTickerData(symbol);

  if (!data.quote && !data.profile) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
