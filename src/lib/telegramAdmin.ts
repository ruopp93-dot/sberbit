// Helpers for the Telegram admin bot: admin check, formatting, notifications,
// webhook self-registration and pending admin input.
import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'grammy/types';
import { bot, telegramApiRoot } from './bot';
import { getRedis } from './redis';
import { getSiteUrl } from './siteUrl';
import type { ExchangeOrder } from './ordersStore';

export const STATUS = {
  created: 'Принята, ожидает оплаты клиентом',
  clientPaid: 'Клиент сообщил об оплате — идет проверка платежа',
  paid: 'Заявка оплачена — идет проверка платежа и обработка заявки',
  done: 'Заявка выполнена',
  canceledByUser: 'Заявка отменена пользователем',
  canceledByAdmin: 'Заявка отменена администратором',
} as const;

export const isCanceled = (status: string) => /отмен/i.test(status);
export const isDone = (status: string) => /выполнена/i.test(status);
export const isPaid = (status: string) => /оплачена/i.test(status);
export const isClientPaid = (status: string) => /сообщил об оплате/i.test(status);
export const isNew = (status: string) =>
  !isCanceled(status) && !isDone(status) && !isPaid(status) && !isClientPaid(status);

export function statusBadge(status: string): string {
  if (isDone(status)) return '🏁 Выполнена';
  if (isCanceled(status)) return '🗑 Отменена';
  if (isPaid(status)) return '💸 Оплачена, в работе';
  if (isClientPaid(status)) return '🔔 Клиент оплатил — проверьте';
  return '🆕 Ждёт оплаты';
}

/** Escapes text for Telegram HTML parse mode. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Chat IDs of administrators (TELEGRAM_ADMIN_CHAT_ID, comma-separated). */
export function adminChatIds(): string[] {
  return (process.env.TELEGRAM_ADMIN_CHAT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdmin(chatId?: number | string | null): boolean {
  const ids = adminChatIds();
  if (!ids.length) return process.env.NODE_ENV !== 'production'; // dev only
  return chatId != null && ids.includes(String(chatId));
}

export function nowStamp() {
  const now = new Date();
  const opts = { timeZone: 'Europe/Moscow' } as const;
  return `${now.toLocaleDateString('ru-RU', opts)}, ${now.toLocaleTimeString('ru-RU', { ...opts, hour: '2-digit', minute: '2-digit' })}`;
}

/** Order card in Telegram HTML. */
export function formatOrder(o: ExchangeOrder, title = `Заявка #${o.id}`): string {
  return [
    `<b>${esc(title)}</b>`,
    '',
    `Статус: <b>${statusBadge(o.status)}</b>`,
    '',
    `💰 Отдаёт: <b>${esc(o.fromAmount)} ₽</b> (${esc(o.fromCurrency)})`,
    `🪙 Получает: <b>${esc(o.toAmount)} ${esc(o.toCurrency)}</b>`,
    `👛 Кошелёк: <code>${esc(o.toAccount)}</code>`,
    o.email ? `✉️ Email: ${esc(o.email)}` : undefined,
    `💳 Реквизиты: ${esc(o.paymentDetails)}`,
    o.txLink ? `🔗 Транзакция: ${esc(o.txLink)}` : undefined,
    '',
    `🕒 Создана: ${esc(o.createdAt)}`,
    `✏️ Обновлена: ${esc(o.lastStatusUpdate)}`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

type Button = InlineKeyboardButton;
export type InlineKeyboard = InlineKeyboardMarkup;

export function orderKeyboard(o: ExchangeOrder): InlineKeyboard {
  const rows: Button[][] = [];
  if (!isCanceled(o.status) && !isDone(o.status)) {
    if (!isPaid(o.status)) rows.push([{ text: '✅ Оплата получена', callback_data: `act:paid:${o.id}` }]);
    rows.push([{ text: '🏁 Выполнена — указать транзакцию', callback_data: `act:done:${o.id}` }]);
    rows.push([{ text: '🗑 Отменить заявку', callback_data: `act:cancel:${o.id}` }]);
  }
  rows.push([
    { text: '🔄 Обновить', callback_data: `order:${o.id}` },
    { text: '🌐 На сайте', url: `${getSiteUrl()}/order/${o.id}` },
  ]);
  rows.push([{ text: '🏠 Главное меню', callback_data: 'menu:main' }]);
  return { inline_keyboard: rows };
}

/** Sends a message (HTML) to every admin; errors are logged, never thrown. */
export async function notifyAdmins(text: string, replyMarkup?: InlineKeyboard): Promise<void> {
  await ensureWebhook().catch(() => {});
  await Promise.all(
    adminChatIds().map(async (chatId) => {
      try {
        await bot.api.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
      } catch (e) {
        console.warn('Telegram notify failed:', e);
      }
    })
  );
}

// ─── Webhook self-registration ───────────────────────────────────────────────
// The webhook must point to this site with our secret_token, otherwise button
// presses never reach us. Checked at most every 10 minutes per instance and
// re-registered when the URL differs or Telegram reports delivery errors.
const WEBHOOK_CHECK_MS = 10 * 60 * 1000;
const _w = globalThis as unknown as Record<string, number>;
const lastCheckKey = '__SB_TG_WEBHOOK_CHECKED__';

export type WebhookStatus = {
  ok: boolean;
  url?: string;
  expectedUrl?: string;
  reRegistered?: boolean;
  pendingUpdates?: number;
  lastError?: string;
  error?: string;
};

export async function ensureWebhook(force = false): Promise<WebhookStatus> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN не задан' };
  const site = getSiteUrl();
  if (!site.startsWith('https://')) return { ok: false, error: 'Нужен публичный https-адрес сайта' };
  if (!force && Date.now() - (_w[lastCheckKey] || 0) < WEBHOOK_CHECK_MS) return { ok: true };
  _w[lastCheckKey] = Date.now();

  const api = `${telegramApiRoot()}/bot${token}`;
  const expectedUrl = `${site}/api/telegram/webhook`;
  const info = await (await fetch(`${api}/getWebhookInfo`, { cache: 'no-store' })).json();
  const current: string = info?.result?.url || '';
  const recentError =
    info?.result?.last_error_date && Date.now() / 1000 - info.result.last_error_date < WEBHOOK_CHECK_MS / 1000;

  let reRegistered = false;
  if (force || current !== expectedUrl || recentError) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await (
      await fetch(`${api}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: expectedUrl,
          allowed_updates: ['message', 'callback_query'],
          ...(secret ? { secret_token: secret } : {}),
        }),
      })
    ).json();
    if (!res?.ok) return { ok: false, url: current, expectedUrl, error: res?.description || 'setWebhook failed' };
    reRegistered = true;
    console.log('[Telegram] Webhook registered:', expectedUrl);
  }

  return {
    ok: true,
    url: current.replace(/\?.*$/, ''),
    expectedUrl,
    reRegistered,
    pendingUpdates: info?.result?.pending_update_count,
    lastError: info?.result?.last_error_message,
  };
}

// ─── Pending admin input (stored in Redis: the next message may hit another instance) ───
export type PendingAction =
  | { type: 'edit_rate'; currency: string }
  | { type: 'edit_payment_details' }
  | { type: 'done'; orderId: string };

const pendingKey = (chatId: number | string) => `sb:pending:${chatId}`;
const _g = globalThis as unknown as Record<string, Map<string, PendingAction>>;
const memKey = '__SB_TG_PENDING_V2__';
if (!_g[memKey]) _g[memKey] = new Map<string, PendingAction>();

export async function getPending(chatId: number | string): Promise<PendingAction | null> {
  const redis = getRedis();
  if (!redis) return _g[memKey].get(String(chatId)) ?? null;
  return (await redis.get<PendingAction>(pendingKey(chatId))) ?? null;
}

export async function setPending(chatId: number | string, action: PendingAction): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    _g[memKey].set(String(chatId), action);
    return;
  }
  await redis.set(pendingKey(chatId), action, { ex: 600 });
}

export async function clearPending(chatId: number | string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    _g[memKey].delete(String(chatId));
    return;
  }
  await redis.del(pendingKey(chatId));
}
