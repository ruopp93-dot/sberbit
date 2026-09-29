import { NextRequest, NextResponse } from 'next/server';
import { OrdersStore } from '@/lib/ordersStore';
import { getClientIp, rateLimit } from '@/lib/security';
import {
  STATUS,
  formatOrder,
  isCanceled,
  isClientPaid,
  isDone,
  isPaid,
  notifyAdmins,
  nowStamp,
  orderKeyboard,
} from '@/lib/telegramAdmin';

export const dynamic = 'force-dynamic';

// Клиент сообщает, что оплатил заявку. Окончательно оплату подтверждает админ в боте.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(`order-action:${getClientIp(request)}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
  }

  try {
    const { id } = await context.params;
    const existing = await OrdersStore.get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    if (isCanceled(existing.status) || isDone(existing.status) || isPaid(existing.status) || isClientPaid(existing.status)) {
      return NextResponse.json({ error: 'Статус заявки не позволяет подтвердить оплату' }, { status: 409 });
    }

    const updated = { ...existing, status: STATUS.clientPaid, lastStatusUpdate: nowStamp() };
    await OrdersStore.save(updated);

    await notifyAdmins(
      formatOrder(updated, `🔔 Клиент сообщил об оплате заявки #${id}\nПроверьте поступление средств.`),
      orderKeyboard(updated)
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, ...publicOrder } = updated;
    return NextResponse.json({ success: true, order: publicOrder });
  } catch (error) {
    console.error('Ошибка при подтверждении оплаты:', error);
    return NextResponse.json({ error: 'Ошибка при подтверждении оплаты' }, { status: 500 });
  }
}
