import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bot } from '@/lib/bot';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = await prisma.exchangeOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });

    // Клиент больше не может сам выставить PAID: источником истины является Pally postback.
    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        from: order.exchangeStatus,
        to: order.exchangeStatus,
        actor: 'user',
        note: 'Пользователь сообщил об оплате; ожидается подтверждение Pally',
      },
    });

    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId) {
      try {
        await bot.api.sendMessage(chatId, `🔔 Пользователь сообщил об оплате заявки #${id}. Статус оплаты изменяет только Pally webhook.`);
      } catch (error) {
        console.warn('Telegram confirmation notification failed', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Сообщение об оплате принято. После подтверждения Pally статус обновится автоматически.',
      paymentStatus: order.paymentStatus,
      exchangeStatus: order.exchangeStatus,
    });
  } catch (error) {
    console.error('Ошибка при подтверждении оплаты:', error);
    return NextResponse.json({ error: 'Ошибка при подтверждении оплаты' }, { status: 500 });
  }
}
