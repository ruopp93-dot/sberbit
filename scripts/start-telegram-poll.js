#!/usr/bin/env node
// Simple dev poller: uses node-telegram-bot-api to poll updates and forwards them to local webhook
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Set it in .env.local or environment.');
  process.exit(1);
}

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://sberbits.com.ru/';
const endpoint = webhookSecret ? `${site.replace(/\/$/, '')}/api/telegram/webhook?secret=${webhookSecret}` : `${site.replace(/\/$/, '')}/api/telegram/webhook`;

const bot = new TelegramBot(token, { polling: true });

function forwardUpdate(obj) {
  try {
    fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) })
      .then(res => console.log('[poller] forwarded update, status', res.status))
      .catch(err => console.error('[poller] forward error', err));
  } catch (e) {
    console.error('[poller] fetch failed (is Node >=18?):', e);
  }
}

bot.on('message', (msg) => {
  console.log('[poller] message from', msg.chat && (msg.chat.username || msg.chat.id));
  forwardUpdate({ message: msg });
});

bot.on('callback_query', (cq) => {
  console.log('[poller] callback_query from', cq.from && (cq.from.username || cq.from.id));
  forwardUpdate({ callback_query: cq });
});

bot.on('polling_error', (err) => console.error('[poller] polling error', err));

console.log('[poller] Telegram poller started, forwarding to', endpoint);
