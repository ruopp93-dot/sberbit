import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bot } from '@/lib/bot';
import { sendOrderStatusEmail } from '@/lib/email';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await prisma.exchangeOrder.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });

    if (existing.exchangeStatus === 'COMPLETED') {
      return NextResponse.json({ error: 'Выполненную заявку нельзя отменить' }, { status: 409 });
    }

    const updated = await prisma.exchangeOrder.update({
      where: { id },
      data: {
        exchangeStatus: 'CANCELLED',
        statusHistory: {
          create: {
            from: existing.exchangeStatus,
            to: 'CANCELLED',
            actor: 'user',
            note: 'Пользователь отменил заявку',
          },
        },
      },
    });

    const status = 'Заявка отменена пользователем';
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId) {
      try {
        await bot.api.sendMessage(chatId, [
          '❌ Пользователь отменил заявку',
          `#${id}`,
          `Отдавал: ${updated.amount} ${updated.fromCurrency}`,
          `Получал: ${updated.toAmount} ${updated.toCurrency}`,
          `На счет: ${updated.walletAddress}`,
        ].join('\n'));
      } catch (error) {
        console.warn('Telegram cancellation notification failed', error);
      }
    }

    try {
      await sendOrderStatusEmail(updated.contact || undefined, `Заявка #${id}: отменена пользователем`, {
        id,
        status,
        email: updated.contact || undefined,
        fromAmount: String(updated.amount),
        fromCurrency: updated.fromCurrency,
        toAmount: String(updated.toAmount),
        toCurrency: updated.toCurrency,
        toAccount: updated.walletAddress,
        createdAt: updated.createdAt.toLocaleDateString('ru-RU'),
        lastStatusUpdate: updated.updatedAt.toLocaleDateString('ru-RU'),
        paymentDetails: updated.paymentUrl || '',
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      });
    } catch (error) {
      console.warn('Cancellation email failed', error);
    }

    return NextResponse.json({ success: true, order: { id, status, exchangeStatus: updated.exchangeStatus } });
  } catch (error) {
    console.error('Ошибка при отмене заявки:', error);
    return NextResponse.json({ error: 'Ошибка при отмене заявки' }, { status: 500 });
  }
}
