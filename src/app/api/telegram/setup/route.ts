import { NextRequest, NextResponse } from 'next/server';

// GET /api/telegram/setup?admin_key=YOUR_KEY
// Регистрирует webhook в Telegram
export async function GET(request: NextRequest) {
  const adminKey = process.env.TELEGRAM_SETUP_KEY;
  if (adminKey) {
    const provided = new URL(request.url).searchParams.get('admin_key');
    if (provided !== adminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL not set' }, { status: 500 });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = secret
    ? `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook?secret=${secret}`
    : `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    }
  );

  const data = await res.json();
  return NextResponse.json({ webhookUrl, telegram: data });
}
