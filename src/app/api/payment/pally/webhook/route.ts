import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPallyStatus, verifyPallyPostback } from '@/lib/pally';

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
    if (!order) {
      console.warn('Pally postback for unknown order', { orderId });
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    const received = Number(amount);
    const expected = Number(order.amount);
    let finalPaymentStatus = status;
    let finalExchangeStatus = order.exchangeStatus;

    if (status === 'SUCCESS') {
      if (received < expected) finalPaymentStatus = 'UNDERPAID';
      else if (received > expected) finalPaymentStatus = 'OVERPAID';
      else finalExchangeStatus = 'PAID';
    }

    await prisma.$transaction(async (tx) => {
      const existingPayment = order.payment;

      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: finalPaymentStatus,
            externalId: paymentId || existingPayment.externalId,
            rawPayload: payload,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            service: 'Pally',
            amount: amount,
            status: finalPaymentStatus,
            externalId: paymentId,
            rawPayload: payload,
          },
        });
      }

      if (finalExchangeStatus !== order.exchangeStatus) {
        await tx.exchangeOrder.update({
          where: { id: order.id },
          data: {
            paymentStatus: finalPaymentStatus,
            exchangeStatus: finalExchangeStatus,
            paymentId: billId || order.paymentId,
            statusHistory: {
              create: {
                from: order.exchangeStatus,
                to: finalExchangeStatus,
                actor: 'pally-webhook',
                note: `Pally status ${status}`,
              },
            },
          },
        });
      } else {
        await tx.exchangeOrder.update({
          where: { id: order.id },
          data: {
            paymentStatus: finalPaymentStatus,
            paymentId: billId || order.paymentId,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Pally webhook error:', error);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
