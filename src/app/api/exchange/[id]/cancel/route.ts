import { NextRequest, NextResponse } from 'next/server';
import { OrdersStore } from '@/lib/ordersStore';
import { sendOrderStatusEmail } from '@/lib/email';
import { getSiteUrl } from '@/lib/siteUrl';
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
} from '@/lib/telegramAdmin';

export const dynamic = 'force-dynamic';

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

    // Нельзя отменить закрытую заявку или заявку, по которой уже заявлена оплата
    if (isCanceled(existing.status) || isDone(existing.status) || isPaid(existing.status) || isClientPaid(existing.status)) {
      return NextResponse.json({ error: 'Статус заявки не позволяет её отменить' }, { status: 409 });
    }

    const updated = { ...existing, status: STATUS.canceledByUser, lastStatusUpdate: nowStamp() };
    await OrdersStore.save(updated);

    await notifyAdmins(formatOrder(updated, `❌ Клиент отменил заявку #${id}`));

    try {
      await sendOrderStatusEmail(updated.email, `Заявка #${updated.id}: отменена`, { ...updated, siteUrl: getSiteUrl() });
    } catch (e) {
      console.warn('Не удалось отправить email об отмене заявки:', e);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, ...publicOrder } = updated;
    return NextResponse.json({ success: true, order: publicOrder });
  } catch (error) {
    console.error('Ошибка при отмене заявки:', error);
    return NextResponse.json({ error: 'Ошибка при отмене заявки' }, { status: 500 });
  }
}
