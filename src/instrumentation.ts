// Next.js instrumentation hook — runs once on server (cold) start.
// Registers the Telegram webhook on the site's own URL (the *.vercel.app address
// when no custom domain is configured) and sets the bot commands menu.
import { getSiteUrl } from './lib/siteUrl';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Preview deployments must not take the production bot's webhook over.
  if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram] Skipping webhook registration: TELEGRAM_BOT_TOKEN not set.');
    return;
  }
  const siteUrl = getSiteUrl();
  if (siteUrl.startsWith('http://localhost')) return; // Telegram requires a public https URL

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  // Секрет передаётся через secret_token (заголовок), а не в URL, чтобы не светить его в логах.
  const webhookUrl = `${siteUrl}/api/telegram/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        ...(secret ? { secret_token: secret } : {}),
      }),
    });
    const data = await res.json();
    if (data.ok) console.log('[Telegram] Webhook registered:', webhookUrl);
    else console.warn('[Telegram] Webhook registration failed:', data);
  } catch (e) {
    console.warn('[Telegram] Failed to register webhook:', e);
  }

  try {
    const commands = [
      { command: 'start', description: 'Главное меню' },
      { command: 'orders', description: 'Активные заявки' },
      { command: 'paid', description: 'Оплаченные заявки' },
      { command: 'done', description: 'Выполненные заявки' },
      { command: 'canceled', description: 'Отменённые заявки' },
      { command: 'all', description: 'Все заявки' },
      { command: 'rates', description: 'Курсы' },
      { command: 'req', description: 'Реквизиты для оплаты' },
      { command: 'help', description: 'Справка' },
    ];
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    const data = await res.json();
    if (!data.ok) console.warn('[Telegram] Failed to set bot commands:', data);
  } catch (e) {
    console.warn('[Telegram] Failed to set bot commands:', e);
  }
}
