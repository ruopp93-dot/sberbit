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

    const now = new Date();
    const updated = {
      ...existing,
      status: 'Заявка отменена пользователем',
      lastStatusUpdate: `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
    };
    OrdersStore.save(updated);

    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId) {
      const text = [
        '❌ Пользователь отменил заявку',
        `#${id}`,
        `Отдавал: ${updated.fromAmount} ${updated.fromCurrency}`,
        updated.fromAccount ? `Со счета: ${updated.fromAccount}` : undefined,
        `Получал: ${updated.toAmount} ${updated.toCurrency}`,
        `На счет: ${updated.toAccount}`,
      ].filter(Boolean).join('\n');
      await bot.api.sendMessage(chatId, text);
    }

    // Email пользователю об отмене
    try {
      await sendOrderStatusEmail(
        updated.email,
        `Заявка #${updated.id}: отменена пользователем`,
        {
          id: updated.id,
          status: updated.status,
          email: updated.email || undefined,
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
      console.warn('Не удалось отправить email об отмене заявки:', e);
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Ошибка при отмене заявки:', error);
    return NextResponse.json(
      { error: 'Ошибка при отмене заявки' },
      { status: 500 }
    );
  }
}
