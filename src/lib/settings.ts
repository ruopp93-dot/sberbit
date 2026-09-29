// Настройки сайта, которыми администратор управляет через Telegram-бота.
import { getRedis } from './redis';

const PAYMENT_DETAILS_KEY = 'sb:settings:paymentDetails';
const DEFAULT_PAYMENT_DETAILS = process.env.PAYMENT_DETAILS || 'https://dalink.to/sberbits_com_ru';

const _g = globalThis as unknown as Record<string, string | undefined>;
const memKey = '__SB_PAYMENT_DETAILS__';

export async function getPaymentDetails(): Promise<string> {
  const redis = getRedis();
  if (!redis) return _g[memKey] || DEFAULT_PAYMENT_DETAILS;
  // stored as an object: Upstash would parse a digits-only string (card number) into a number
  const stored = await redis.get<{ value?: string }>(PAYMENT_DETAILS_KEY);
  return (stored && typeof stored.value === 'string' && stored.value) || DEFAULT_PAYMENT_DETAILS;
}

export async function setPaymentDetails(value: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    _g[memKey] = value;
    return;
  }
  await redis.set(PAYMENT_DETAILS_KEY, { value });
}
