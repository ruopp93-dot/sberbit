import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPallyStatus, verifyPallyPostback } from '@/lib/pally';
import { bot } from '@/lib/bot';
import { sendOrderStatusEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const form = new URLSearchParams(raw);
    const payload = Object.fromEntries(form.entries());

    const orderId = form.get('InvId')?.trim();
    const amount = form.get('OutSum')?.trim();
    const signature = form.get('SignatureValue')?.trim();
    const status = mapPallyStatus(form.get('Status') || undefined);
    const billId = form.get('BillId')?.trim() || form.get('bill_id')?.trim() || undefined;
    const paymentId = form.get('TrsId')?.trim() || form.get('PaymentId')?.trim() || billId;

    if (!orderId || !amount || !signature) {
      return NextResponse.json({ ok: false, error: 'Invalid postback' }, { status: 400 });
    }

    if (!verifyPallyPostback({ amount, orderId, signature })) {
      console.warn('Rejected invalid Pally signature', { orderId });
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
    }

    const order = await prisma.exchangeOrder.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

    const received = Number(amount);
    const expected = Number(order.amount);
    let finalPaymentStatus = status;
    let finalExchangeStatus = order.exchangeStatus;

    if (status === 'SUCCESS') {
      if (received < expected) finalPaymentStatus = 'UNDERPAID';
      else if (received > expected) finalPaymentStatus = 'OVERPAID';
      else finalExchangeStatus = 'PAID';
    } else if (status === 'FAIL') {
      finalExchangeStatus = 'CANCELLED';
    }

    const alreadyHandled = order.paymentStatus === finalPaymentStatus && order.exchangeStatus === finalExchangeStatus;
    if (alreadyHandled) return NextResponse.json({ ok: true, duplicate: true });

    await prisma.$transaction(async (tx) => {
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            status: finalPaymentStatus,
            externalId: paymentId || order.payment.externalId,
            rawPayload: payload,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            service: 'Pally',
            amount,
            status: finalPaymentStatus,
            externalId: paymentId,
            rawPayload: payload,
          },
        });
      }

      await tx.exchangeOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: finalPaymentStatus,
          exchangeStatus: finalExchangeStatus,
          paymentId: billId || order.paymentId,
          statusHistory: finalExchangeStatus !== order.exchangeStatus
            ? {
                create: {
                  from: order.exchangeStatus,
                  to: finalExchangeStatus,
                  actor: 'pally-webhook',
                  note: `Pally status ${status}`,
                },
              }
            : undefined,
        },
      });
    });

    if (finalExchangeStatus === 'PAID') {
      const text = `✅ Pally подтвердил оплату заявки #${order.id}\nСумма: ${amount} RUB\nСтатус: PAID`;
      try {
        const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (chatId) await bot.api.sendMessage(chatId, text);
      } catch (error) {
        console.warn('Telegram payment notification failed', error);
      }

      try {
        await sendOrderStatusEmail(order.contact || undefined, `Заявка #${order.id}: оплата подтверждена`, {
          id: order.id,
          status: 'Заявка оплачена — идет проверка платежа и обработка заявки',
          email: order.contact || undefined,
          fromAmount: String(order.amount),
          fromCurrency: order.fromCurrency,
          toAmount: String(order.toAmount),
          toCurrency: order.toCurrency,
          toAccount: order.walletAddress,
          createdAt: order.createdAt.toLocaleDateString('ru-RU'),
          lastStatusUpdate: new Date().toLocaleDateString('ru-RU'),
          paymentDetails: order.paymentUrl || '',
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        });
      } catch (error) {
        console.warn('Payment email failed', error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Pally webhook error:', error);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
