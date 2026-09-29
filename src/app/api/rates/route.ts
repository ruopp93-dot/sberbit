import { NextResponse } from 'next/server';
import { getRates } from '@/lib/cryptoRates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rates = await getRates();
  return NextResponse.json(rates, {
    headers: { 'Cache-Control': 'no-store, no-cache' },
  });
}
