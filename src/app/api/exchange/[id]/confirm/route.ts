import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/bot';
import { OrdersStore } from '@/lib/ordersStore';
import { sendOrderStatusEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = OrdersStore.get(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Заявка не найдена', details: `Заявка с ID ${id} не существует` },
        { status: 404 }
      );
    }

    // Обновляем статус и время изменения
    const now = new Date();
    const createdAt = existing.createdAt || now.toLocaleDateString('ru-RU');
    const lastStatusUpdate = `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    const updated = {
      ...existing,
      status: 'Заявка оплачена — идет проверка платежа и обработка заявки',
      createdAt,
      lastStatusUpdate,
    };
    OrdersStore.save(updated);
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId) {
      const text = [
        `🔔 Пользователь подтвердил оплату заявки #${id}`,
        '',
        `Отдаете: ${updated.fromAmount} ${updated.fromCurrency}`,
        updated.fromAccount ? `Со счета: ${updated.fromAccount}` : undefined,
        updated.email ? `Email: ${updated.email}` : undefined,
        `Получаете: ${updated.toAmount} ${updated.toCurrency}`,
        `На счет: ${updated.toAccount}`,
        '',
        'Необходимо проверить поступление средств.'
      ].filter(Boolean).join('\n');
      await bot.api.sendMessage(chatId, text);
    }

    // Email пользователю об изменении статуса
    try {
      await sendOrderStatusEmail(
        updated.email,
        `Заявка #${updated.id}: подтверждение оплаты принято`,
        {
          id: updated.id,
          status: updated.status,
          email: updated.email,
          fromAmount: updated.fromAmount,
          fromCurrency: updated.fromCurrency,
          toAmount: updated.toAmount,
          toCurrency: updated.toCurrency,
          toAccount: updated.toAccount,
          createdAt: updated.createdAt,
          lastStatusUpdate: updated.lastStatusUpdate,
          paymentDetails: updated.paymentDetails,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        }
      );
    } catch (e) {
      console.warn('Не удалось отправить email о подтверждении оплаты:', e);
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Ошибка при подтверждении оплаты:', error);
    return NextResponse.json(
      { error: 'Ошибка при подтверждении оплаты' },
      { status: 500 }
    );
  }
}
