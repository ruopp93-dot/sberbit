import { NextResponse } from "next/server";
import { z } from "zod";
import { OrdersStore, type ExchangeOrder } from "@/lib/ordersStore";
import { CaptchaStore } from "@/lib/captchaStore";
import { getRates } from "@/lib/cryptoRates";
import { getPaymentDetails } from "@/lib/settings";
import { sendOrderStatusEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/siteUrl";
import { getClientIp, rateLimit } from "@/lib/security";
import { STATUS, formatOrder, notifyAdmins, nowStamp, orderKeyboard } from "@/lib/telegramAdmin";

export const dynamic = "force-dynamic";

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
  captchaToken: z.string().min(1).max(200),
  captchaAnswer: z.string().min(1).max(10),
  agreeTerms: z.literal(true, { message: "Необходимо согласиться с условиями обмена" }),
});

export async function POST(request: Request) {
  if (!(await rateLimit(`exchange:${getClientIp(request)}`, 10, 60 * 60 * 1000))) {
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

  if (!(await CaptchaStore.validate(data.captchaToken, data.captchaAnswer))) {
    return NextResponse.json({ success: false, message: "Неверная капча" }, { status: 400 });
  }

  try {
    // Сумма к получению считается на сервере по текущему курсу, а не берётся от клиента
    const [cryptoKey, network] = data.toCurrency.split("-");
    const rate = (await getRates())[cryptoKey]?.rub;
    if (!rate || rate <= 0) {
      return NextResponse.json({ success: false, message: "Курс временно недоступен" }, { status: 503 });
    }

    const now = new Date();
    const order: ExchangeOrder = {
      id: OrdersStore.newId(),
      status: STATUS.created,
      fromAmount: String(data.amount),
      fromCurrency: data.fromCurrency,
      toAmount: (data.amount / rate).toFixed(8),
      toCurrency: network ? `${cryptoKey} ${network}` : cryptoKey,
      toAccount: data.walletAddress,
      paymentDetails: await getPaymentDetails(),
      createdAt: nowStamp(),
      createdAtTs: now.getTime(),
      lastStatusUpdate: nowStamp(),
      email: data.email,
    };

    await OrdersStore.save(order);

    await notifyAdmins(formatOrder(order, `🆕 Новая заявка #${order.id}`), orderKeyboard(order));

    try {
      await sendOrderStatusEmail(order.email, `Заявка #${order.id} создана`, { ...order, siteUrl: getSiteUrl() });
    } catch (e) {
      console.warn("Не удалось отправить email о создании заявки:", e);
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error) {
    // Internal details are logged only; the client gets a generic message.
    console.error("EXCHANGE ERROR:", error);
    return NextResponse.json({ success: false, message: "Ошибка создания заявки" }, { status: 500 });
  }
}
