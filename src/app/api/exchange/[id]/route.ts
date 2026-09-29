import { NextRequest, NextResponse } from 'next/server';
import { OrdersStore } from '@/lib/ordersStore';
import { getClientIp, rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await rateLimit(`order-view:${getClientIp(request)}`, 120, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
  }

  try {
    const { id } = await context.params;
    const order = await OrdersStore.get(id);
    if (!order) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }
    // email клиента на страницу заявки не отдаём
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, ...publicOrder } = order;
    return NextResponse.json(publicOrder);
  } catch (error) {
    console.error('Ошибка при получении заявки:', error);
    return NextResponse.json({ error: 'Ошибка при получении данных заявки' }, { status: 500 });
  }
}
