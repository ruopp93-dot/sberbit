import { NextResponse, after } from 'next/server';
import { getRates } from '@/lib/cryptoRates';
import { ensureWebhook } from '@/lib/telegramAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rates = await getRates();
  // заодно (после ответа) проверяем, что вебхук бота указывает на этот сайт
  after(() => ensureWebhook().catch(() => {}));
  return NextResponse.json(rates, {
    headers: { 'Cache-Control': 'no-store, no-cache' },
  });
}
