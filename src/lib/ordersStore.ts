import { randomInt } from 'crypto';
import { getRedis } from './redis';

export interface ExchangeOrder {
  id: string;
  status: string;
  fromAmount: string; // сумма в рублях, введенная пользователем
  fromCurrency: string; // способ оплаты (банк/МИР/СБП)
  toAmount: string; // рассчитанная сумма криптовалюты
  toCurrency: string; // выбранная монета
  toAccount: string; // адрес кошелька пользователя
  paymentDetails: string; // реквизиты для оплаты (системные)
  createdAt: string;
  createdAtTs: number;
  lastStatusUpdate: string;
  // необязательное поле, если пользователь не вводил реквизиты отправителя
  fromAccount?: string;
  email?: string;
  txLink?: string; // ссылка/хэш транзакции отправки крипты (заполняет админ)
}

const ORDER_TTL_SEC = 60 * 60 * 24 * 90; // заявки хранятся 90 дней
const INDEX_KEY = 'sb:orders';
const orderKey = (id: string) => `sb:order:${id}`;

// in-memory fallback for local development without Redis
const globalKey = '__SB_ORDERS_STORE_V2__';
const _g = globalThis as unknown as Record<string, Map<string, ExchangeOrder>>;
if (!_g[globalKey]) _g[globalKey] = new Map<string, ExchangeOrder>();
const mem = _g[globalKey];

function isValidId(id: string) {
  return /^\d{6,20}$/.test(id);
}

export const OrdersStore = {
  /** Случайный 12-значный ID: последовательные ID позволяли перебирать чужие заявки. */
  newId(): string {
    return String(randomInt(100_000_000_000, 999_999_999_999));
  },

  async save(order: ExchangeOrder): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      mem.set(order.id, order);
      return;
    }
    await redis.set(orderKey(order.id), order, { ex: ORDER_TTL_SEC });
    await redis.zadd(INDEX_KEY, { score: order.createdAtTs, member: order.id });
  },

  async get(id: string): Promise<ExchangeOrder | null> {
    if (!isValidId(id)) return null;
    const redis = getRedis();
    if (!redis) return mem.get(id) ?? null;
    return (await redis.get<ExchangeOrder>(orderKey(id))) ?? null;
  },

  /** Последние заявки, новые первыми. */
  async all(limit = 500): Promise<ExchangeOrder[]> {
    const redis = getRedis();
    if (!redis) {
      return Array.from(mem.values()).sort((a, b) => b.createdAtTs - a.createdAtTs).slice(0, limit);
    }
    await redis.zremrangebyscore(INDEX_KEY, 0, Date.now() - ORDER_TTL_SEC * 1000);
    const ids = await redis.zrange<string[]>(INDEX_KEY, 0, limit - 1, { rev: true });
    if (!ids.length) return [];
    const orders = await redis.mget<(ExchangeOrder | null)[]>(...ids.map((id) => orderKey(String(id))));
    return orders.filter((o): o is ExchangeOrder => !!o);
  },
};
