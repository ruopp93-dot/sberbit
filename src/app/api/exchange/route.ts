import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPallyPayment } from "@/lib/pally";
import { CaptchaStore } from "@/lib/captchaStore";
import { getClientIp, rateLimit } from "@/lib/security";

const PAYMENT_METHODS = ["Tinkoff", "Сбербанк", "Альфа-Банк", "ВТБ", "МИР", "СБП"] as const;
const CRYPTO_CURRENCIES = ["USDT-TRC20", "BTC", "ETH"] as const;

const exchangeSchema = z.object({
  fromCurrency: z.enum(PAYMENT_METHODS),
  toCurrency: z.enum(CRYPTO_CURRENCIES),
  amount: z.coerce.number().positive().max(10_000_000),
  walletAddress: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{20,100}$/, "Некорректный адрес кошелька"),
  email: z.string().trim().max(254).email(),
  captchaToken: z.string().min(1).max(100),
  captchaAnswer: z.string().min(1).max(10),
  agreeTerms: z.literal(true, { message: "Необходимо согласиться с условиями обмена" }),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`exchange:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { success: false, message: "Слишком много заявок. Попробуйте позже." },
      { status: 429 }
    );
  }

  let data: z.infer<typeof exchangeSchema>;
  try {
    const parsed = exchangeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Некорректные данные заявки" },
        { status: 400 }
      );
    }
    data = parsed.data;
  } catch {
    return NextResponse.json({ success: false, message: "Некорректные данные заявки" }, { status: 400 });
  }

  if (!CaptchaStore.validate(data.captchaToken, data.captchaAnswer)) {
    return NextResponse.json({ success: false, message: "Неверная капча" }, { status: 400 });
  }

  try {
    const order = await prisma.exchangeOrder.create({
      data: {
        direction: `${data.fromCurrency}-${data.toCurrency}`,
        amount: data.amount,
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        walletAddress: data.walletAddress,
        contact: data.email,
        paymentStatus: "pending",
        exchangeStatus: "created",
      },
    });

    const payment = await createPallyPayment({
      amount: data.amount,
      orderId: order.id,
    });

    await prisma.exchangeOrder.update({
      where: { id: order.id },
      data: {
        paymentId: payment.payment_id,
        paymentUrl: payment.payment_url,
        exchangeStatus: "waiting_payment",
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentUrl: payment.payment_url,
    });
  } catch (error) {
    // Internal details are logged only; the client gets a generic message.
    console.error("EXCHANGE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Ошибка создания заявки",
      },
      { status: 500 }
    );
  }
}
