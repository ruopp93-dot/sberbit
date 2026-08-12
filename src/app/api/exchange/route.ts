import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import exchangeRates from '@/lib/exchangeRates';
import { prisma } from '@/lib/prisma';
import { createPallyPayment } from '@/lib/pally';
import { bot } from '@/lib/bot';
import { sendOrderStatusEmail } from '@/lib/email';
import { CaptchaStore } from '@/lib/captchaStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const exchangeSchema = z.object({
  fromCurrency: z.string().trim().min(1).max(32),
  toCurrency: z.string().trim().min(1).max(64),
  amount: z.string().trim().regex(/^\d+(?:\.\d{1,8})?$/),
  email: z.string().trim().email().max(254),
  walletAddress: z.string().trim().min(8).max(256),
  fromAccount: z.string().trim().max(256).optional(),
  captchaToken: z.string().min(1),
  captchaAnswer: z.union([z.string(), z.number()]),
});

function serializeOrder(order: {
  id: string; amount: unknown; fromCurrency: string; toCurrency: string; walletAddress: string;
  fromAccount: string | null; paymentUrl: string | null; paymentId: string | null;
  paymentStatus: string; exchangeStatus: string; toAmount: unknown; createdAt: Date; updatedAt: Date;
  contact: string | null;
}) {
  const status = order.exchangeStatus === 'AWAITING_PAYMENT'
    ? 'Принята, ожидает оплаты клиентом'
    : order.exchangeStatus === 'PAID'
      ? 'Заявка оплачена — идет проверка платежа и обработка заявки'
      : order.exchangeStatus;

  return {
    id: order.id,
    status,
    exchangeStatus: order.exchangeStatus,
    paymentStatus: order.paymentStatus,
    fromAmount: String(order.amount),
    fromCurrency: order.fromCurrency,
    fromAccount: order.fromAccount || undefined,
    toAmount: String(order.toAmount),
    toCurrency: order.toCurrency,
    toAccount: order.walletAddress,
    paymentDetails: order.paymentUrl || '',
    paymentUrl: order.paymentUrl,
    paymentId: order.paymentId,
    createdAt: order.createdAt.toLocaleDateString('ru-RU'),
    lastStatusUpdate: order.updatedAt.toLocaleDateString('ru-RU') + ', ' + order.updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    email: order.contact || undefined,
  };
}

export async function POST(request: Request) {
  try {
    const data = exchangeSchema.parse(await request.json());

    if (!CaptchaStore.validate(data.captchaToken, data.captchaAnswer)) {
      return NextResponse.json({ success: false, message: 'Неверная капча' }, { status: 400 });
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Некорректная сумма' }, { status: 400 });
    }

    const cryptoKey = data.toCurrency.split('-')[0];
    const rate = exchangeRates.getRates()[cryptoKey]?.rub;
    if (!rate || !Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ success: false, message: 'Не удалось определить курс обмена' }, { status: 400 });
    }

    const toAmount = (amount / rate).toFixed(8);
    const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
    const idempotencyHash = createHash('sha256')
      .update(`${data.fromCurrency}|${data.toCurrency}|${data.amount}|${data.walletAddress}|${bucket}`)
      .digest('hex');

    const duplicate = await prisma.exchangeOrder.findUnique({ where: { idempotencyHash } });
    if (duplicate) {
      const order = await prisma.exchangeOrder.findUniqueOrThrow({ where: { id: duplicate.id } });
      return NextResponse.json({ success: true, orderId: order.id, order: serializeOrder(order), message: 'Заявка уже создана' });
    }

    const order = await prisma.exchangeOrder.create({
      data: {
        amount: data.amount,
        fromCurrency: data.fromCurrency,
        toCurrency: cryptoKey + (data.toCurrency.includes('-') ? ` ${data.toCurrency.split('-')[1]}` : ''),
        walletAddress: data.walletAddress,
        fromAccount: data.fromAccount || null,
        contact: data.email,
        toAmount,
        exchangeStatus: 'CREATED',
        paymentStatus: 'NEW',
        idempotencyHash,
        statusHistory: { create: { to: 'CREATED', actor: 'system', note: 'Заявка создана' } },
      },
    });

    try {
      const payment = await createPallyPayment({
        orderId: order.id,
        amount: data.amount,
        description: `SberBits #${order.id}`,
        custom: order.id,
      });

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.exchangeOrder.update({
          where: { id: order.id },
          data: {
            paymentId: payment.billId,
            paymentUrl: payment.paymentUrl,
            paymentStatus: 'NEW',
            exchangeStatus: 'AWAITING_PAYMENT',
            statusHistory: { create: { from: 'CREATED', to: 'AWAITING_PAYMENT', actor: 'system', note: 'Счет Pally создан' } },
          },
        });
        await tx.payment.create({
          data: {
            orderId: order.id,
            service: 'Pally',
            amount: data.amount,
            status: 'NEW',
            externalId: payment.billId,
          },
        });
        return saved;
      });

      const serialized = serializeOrder(updated);

      try {
        const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (chatId) {
          await bot.api.sendMessage(chatId, [
            `🆕 Новая заявка #${updated.id}`,
            `Статус: ${serialized.status}`,
            `Отдаете: ${serialized.fromAmount} ${serialized.fromCurrency}`,
            serialized.fromAccount ? `Со счета: ${serialized.fromAccount}` : undefined,
            `Email: ${serialized.email}`,
            `Получаете: ${serialized.toAmount} ${serialized.toCurrency}`,
            `На счет: ${serialized.toAccount}`,
            `Оплата Pally: ${serialized.paymentUrl}`,
          ].filter(Boolean).join('\n'));
        }
      } catch (error) {
        console.warn('Telegram notification failed', error);
      }

      try {
        await sendOrderStatusEmail(serialized.email, `Заявка #${updated.id} создана`, {
          ...serialized,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        });
      } catch (error) {
        console.warn('Creation email failed', error);
      }

      return NextResponse.json({ success: true, orderId: updated.id, order: serialized, paymentUrl: payment.paymentUrl, message: 'Заявка успешно создана' });
    } catch (paymentError) {
      console.error('Pally payment creation failed', paymentError);
      return NextResponse.json({ success: false, message: 'Не удалось создать платеж. Попробуйте еще раз.' }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: 'Проверьте данные заявки', issues: error.issues }, { status: 400 });
    }
    console.error('Ошибка при создании заявки:', error);
    return NextResponse.json({ success: false, message: 'Ошибка при создании заявки' }, { status: 500 });
  }
}

export async function GET() {
  const orders = await prisma.exchangeOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ orders: orders.map(serializeOrder) });
}
