import { NextRequest, NextResponse } from 'next/server';
import { ensureWebhook } from '@/lib/telegramAdmin';
import { getClientIp, rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// Перерегистрация вебхука бота и диагностика: откройте https://<сайт>/api/telegram/setup
// Безопасно без ключа: адрес и секрет берутся только из настроек сервера.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`tg-setup:${getClientIp(req)}`, 5, 10 * 60 * 1000))) {
    return NextResponse.json({ ok: false, error: 'Слишком много запросов' }, { status: 429 });
  }
  try {
    const status = await ensureWebhook(true);
    return NextResponse.json(
      {
        ok: status.ok,
        webhook: status.expectedUrl,
        reRegistered: status.reRegistered,
        previousUrl: status.url,
        pendingUpdates: status.pendingUpdates,
        lastError: status.lastError,
        error: status.error,
      },
      { status: status.ok ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
