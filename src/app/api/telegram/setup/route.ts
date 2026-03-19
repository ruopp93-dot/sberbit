import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set in Vercel env vars' }, { status: 500 });
  }

  // Determine base URL: from env var or from the request itself
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const reqUrl = new URL(req.url);
  const siteUrl = envSiteUrl
    ? envSiteUrl.replace(/\/$/, '')
    : `${reqUrl.protocol}//${reqUrl.host}`;

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = secret
    ? `${siteUrl}/api/telegram/webhook?secret=${encodeURIComponent(secret)}`
    : `${siteUrl}/api/telegram/webhook`;

  // Check current webhook status
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();

  // Register webhook
  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
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
    previousWebhook: info?.result?.url || '(none)',
    setWebhook: setData,
    setCommands: cmdData,
  });
}
