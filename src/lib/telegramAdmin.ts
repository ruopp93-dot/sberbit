// Helpers for the Telegram admin bot: admin check, notifications, order cards.
import { bot } from './bot';
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

export function formatOrder(o: ExchangeOrder, title = `Заявка #${o.id}`): string {
  return [
    title,
    `Статус: ${o.status}`,
    `Отдаёт: ${o.fromAmount} ₽ (${o.fromCurrency})`,
    o.fromAccount ? `Со счета: ${o.fromAccount}` : undefined,
    `Получает: ${o.toAmount} ${o.toCurrency}`,
    `На кошелёк: ${o.toAccount}`,
    o.email ? `Email: ${o.email}` : undefined,
    `Реквизиты: ${o.paymentDetails}`,
    o.txLink ? `Транзакция: ${o.txLink}` : undefined,
    `Создана: ${o.createdAt}`,
    `Обновлена: ${o.lastStatusUpdate}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function orderKeyboard(o: ExchangeOrder) {
  const rows: { text: string; callback_data?: string; url?: string }[][] = [];
  if (!isCanceled(o.status) && !isDone(o.status)) {
    if (!isPaid(o.status)) rows.push([{ text: '✅ Оплата получена', callback_data: `act:paid:${o.id}` }]);
    rows.push([{ text: '🏁 Выполнена (указать транзакцию)', callback_data: `act:done:${o.id}` }]);
    rows.push([{ text: '🗑 Отменить заявку', callback_data: `act:cancel:${o.id}` }]);
  }
  rows.push([{ text: '🔗 Открыть на сайте', url: `${getSiteUrl()}/order/${o.id}` }]);
  rows.push([{ text: '🏠 В меню', callback_data: 'menu:main' }]);
  return { inline_keyboard: rows };
}

/** Sends a message to every admin; errors are logged, never thrown. */
export async function notifyAdmins(text: string, replyMarkup?: unknown): Promise<void> {
  await Promise.all(
    adminChatIds().map(async (chatId) => {
      try {
        await bot.api.sendMessage(chatId, text, replyMarkup ? { reply_markup: replyMarkup as never } : undefined);
      } catch (e) {
        console.warn('Telegram notify failed:', e);
      }
    })
  );
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
