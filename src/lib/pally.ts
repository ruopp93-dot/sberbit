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
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.PALLY_WEBHOOK_SECRET || "")
    .update(body)
    .digest("hex");

  return expected === signature;
}
