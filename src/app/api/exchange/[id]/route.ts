import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function serialize(order: any) {
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = await prisma.exchangeOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    return NextResponse.json(serialize(order));
  } catch (error) {
    console.error('Ошибка при получении заявки:', error);
    return NextResponse.json({ error: 'Ошибка при получении данных заявки' }, { status: 500 });
  }
}
