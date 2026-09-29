import { NextRequest, NextResponse } from 'next/server';
import { ensureWebhook } from '@/lib/telegramAdmin';
import { safeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';

// Ручная перерегистрация вебхука бота и диагностика:
// https://<сайт>/api/telegram/setup?key=<TELEGRAM_WEBHOOK_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const key = req.nextUrl.searchParams.get('key') || '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const status = await ensureWebhook(true);
    return NextResponse.json(status, { status: status.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
