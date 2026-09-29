import crypto from "crypto";

const PALLY_API_URL = process.env.PALLY_API_URL || "https://pally.info/api";

export async function createPallyPayment(params: {
  amount: number;
  orderId: string;
  description?: string;
}) {
  const response = await fetch(`${PALLY_API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PALLY_API_TOKEN}`,
    },
    body: JSON.stringify({
      amount: params.amount,
      order_id: params.orderId,
      description: params.description || "SberBits exchange",
      callback_url: `${process.env.NEXT_PUBLIC_URL}/api/payment/pally/webhook`,
    }),
  });

  if (!response.ok) {
    throw new Error("Pally payment creation failed");
  }

  return response.json();
}

export function verifyPallySignature(body: string, signature: string) {
  const secret = process.env.PALLY_WEBHOOK_SECRET;
  // Without a secret anyone could forge a valid HMAC (empty key) — fail closed.
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
