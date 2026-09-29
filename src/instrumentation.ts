// Next.js instrumentation hook — runs once on server (cold) start.
// Registers the Telegram webhook on the site's own URL (the *.vercel.app address
// when no custom domain is configured) and sets the bot commands menu.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram] Skipping webhook registration: TELEGRAM_BOT_TOKEN not set.');
    return;
  }

  const { ensureWebhook } = await import('./lib/telegramAdmin');
  const { telegramApiRoot } = await import('./lib/bot');
  try {
    const status = await ensureWebhook(true);
    if (!status.ok) console.warn('[Telegram] Webhook registration failed:', status.error);
  } catch (e) {
    console.warn('[Telegram] Failed to register webhook:', e);
  }

  try {
    const commands = [
      { command: 'start', description: '🏠 Главное меню' },
      { command: 'orders', description: '📋 Заявки' },
      { command: 'rates', description: '📈 Курсы' },
      { command: 'req', description: '💳 Реквизиты' },
      { command: 'stats', description: '📊 Статистика' },
      { command: 'help', description: '❓ Помощь' },
    ];
    const res = await fetch(`${telegramApiRoot()}/bot${token}/setMyCommands`, {
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
