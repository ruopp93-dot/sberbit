// Next.js instrumentation hook — runs once on server startup.
// Automatically registers the Telegram webhook so the bot receives messages.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!token || !siteUrl) {
    console.warn('[Telegram] Skipping webhook registration: TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_SITE_URL not set.');
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = secret
    ? `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook?secret=${encodeURIComponent(secret)}`
    : `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json();
    if (data.ok) {
      console.log('[Telegram] Webhook registered:', webhookUrl);
    } else {
      console.warn('[Telegram] Webhook registration failed:', data);
    }
  } catch (e) {
    console.warn('[Telegram] Failed to register webhook:', e);
  }
}
