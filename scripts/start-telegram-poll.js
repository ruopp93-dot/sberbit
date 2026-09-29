#!/usr/bin/env node
// Simple dev poller: long-polls Telegram getUpdates and forwards updates to the local webhook.
// Requires Node >= 18 (global fetch).
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Set it in .env.local or environment.');
  process.exit(1);
}

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://sberbits.com.ru/';
const endpoint = `${site.replace(/\/$/, '')}/api/telegram/webhook`;
const headers = { 'content-type': 'application/json' };
if (webhookSecret) headers['x-telegram-bot-api-secret-token'] = webhookSecret;

async function forwardUpdate(update) {
  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(update) });
    console.log('[poller] forwarded update, status', res.status);
  } catch (err) {
    console.error('[poller] forward error', err);
  }
}

async function poll() {
  // getUpdates does not work while a webhook is set
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: 'POST' }).catch(() => {});
  let offset = 0;
  console.log('[poller] Telegram poller started, forwarding to', endpoint);
  for (;;) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=30&offset=${offset}`);
      const data = await res.json();
      if (!data.ok) {
        console.error('[poller] polling error', data.description);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message || update.callback_query) await forwardUpdate(update);
      }
    } catch (err) {
      console.error('[poller] polling error', err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

poll();
