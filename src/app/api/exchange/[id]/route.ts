import { NextRequest, NextResponse } from 'next/server';
import { OrdersStore } from '@/lib/ordersStore';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = OrdersStore.get(id);
    if (!order) {
      return NextResponse.json(
        { error: 'Заявка не найдена', details: `Заявка с ID ${id} не существует` },
        { status: 404 }
      );
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error('Ошибка при получении заявки:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении данных заявки' },
      { status: 500 }
    );
  }
}
