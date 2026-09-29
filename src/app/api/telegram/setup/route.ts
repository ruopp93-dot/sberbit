import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Только для авторизованного администратора: иначе любой мог бы перерегистрировать вебхук.
  if (!(await getAdminFromRequest(req))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set in Vercel env vars' }, { status: 500 });
  }

  // Base URL is taken only from env: the Host header is attacker-controlled.
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!envSiteUrl) {
    return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_SITE_URL not set' }, { status: 500 });
  }
  const siteUrl = envSiteUrl.replace(/\/$/, '');

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = `${siteUrl}/api/telegram/webhook`;

  // Check current webhook status
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();

  // Register webhook
  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secret ? { url: webhookUrl, secret_token: secret } : { url: webhookUrl }),
  });
  const setData = await setRes.json();

  // Set bot commands
  const commands = [
    { command: 'start', description: 'Главное меню' },
    { command: 'orders', description: 'Активные заявки' },
    { command: 'paid', description: 'Оплаченные заявки' },
    { command: 'canceled', description: 'Отменённые заявки' },
    { command: 'all', description: 'Все заявки' },
    { command: 'rates', description: 'Курсы криптовалют' },
    { command: 'help', description: 'Справка' },
  ];
  const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  const cmdData = await cmdRes.json();

  return NextResponse.json({
    siteUrl,
    webhookUrl,
    previousWebhook: (info?.result?.url || '(none)').replace(/\?.*$/, ''),
    setWebhook: setData,
    setCommands: cmdData,
  });
}
