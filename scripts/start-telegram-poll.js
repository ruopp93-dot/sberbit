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

let previousWebhookUrl = '';
let stopping = false;

async function restoreWebhook() {
  if (!previousWebhookUrl) return;
  const body = { url: previousWebhookUrl };
  if (webhookSecret) body.secret_token = webhookSecret;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('[poller] webhook restored:', data.ok ? 'ok' : data.description);
  } catch (err) {
    console.error('[poller] failed to restore webhook, re-register it via /api/telegram/setup', err);
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  await restoreWebhook();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function poll() {
  // getUpdates does not work while a webhook is set: remember it, remove it, restore on exit
  try {
    const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
    previousWebhookUrl = info?.result?.url || '';
  } catch {
    // ignore
  }
  if (previousWebhookUrl) {
    console.warn('[poller] temporarily removing webhook; it will be restored on Ctrl+C. Prefer a separate dev bot token.');
  }
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: 'POST' }).catch(() => {});
  let offset = 0;
  console.log('[poller] Telegram poller started, forwarding to', endpoint);
  while (!stopping) {
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
