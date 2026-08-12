import { createHash, timingSafeEqual } from 'node:crypto';

const PALLY_API_URL = process.env.PALLY_API_URL || 'https://pal24.pro/api/v1';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export type PallyPayment = {
  billId: string;
  paymentUrl: string;
  qrUrl?: string;
};

export async function createPallyPayment(input: {
  orderId: string;
  amount: string;
  description: string;
  custom?: string;
}): Promise<PallyPayment> {
  const token = requireEnv('PALLY_API_TOKEN');
  const shopId = requireEnv('PALLY_SHOP_ID');

  const body = new URLSearchParams({
    amount: input.amount,
    order_id: input.orderId,
    description: input.description,
    type: 'normal',
    shop_id: shopId,
    currency_in: process.env.PALLY_CURRENCY || 'RUB',
    custom: input.custom || input.orderId,
    payer_pays_commission: process.env.PALLY_PAYER_PAYS_COMMISSION || '1',
  });

  const response = await fetch(`${PALLY_API_URL}/bill/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean | string; bill_id?: string; link_page_url?: string; link_url?: string; message?: string }
    | null;

  if (!response.ok || String(payload?.success) !== 'true' || !payload?.bill_id || !payload?.link_page_url) {
    console.error('Pally create bill failed', { status: response.status, payload });
    throw new Error('Pally payment creation failed');
  }

  return {
    billId: payload.bill_id,
    paymentUrl: payload.link_page_url,
    qrUrl: payload.link_url,
  };
}

/**
 * Pally payment postback uses MD5, not HMAC-SHA256:
 * strtoupper(md5(OutSum:InvId:apiToken))
 * See Pally API docs: https://pally.info/ru/reference/api
 */
export function verifyPallyPostback(fields: {
  amount: string;
  orderId: string;
  signature: string;
}): boolean {
  const token = requireEnv('PALLY_API_TOKEN');
  const expected = createHash('md5')
    .update(`${fields.amount}:${fields.orderId}:${token}`, 'utf8')
    .digest('hex')
    .toUpperCase();
  const received = fields.signature.trim().toUpperCase();

  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function mapPallyStatus(status?: string): 'NEW' | 'PROCESS' | 'UNDERPAID' | 'SUCCESS' | 'OVERPAID' | 'FAIL' {
  switch (String(status || '').toUpperCase()) {
    case 'PROCESS': return 'PROCESS';
    case 'UNDERPAID': return 'UNDERPAID';
    case 'SUCCESS': return 'SUCCESS';
    case 'OVERPAID': return 'OVERPAID';
    case 'FAIL': return 'FAIL';
    default: return 'NEW';
  }
}
