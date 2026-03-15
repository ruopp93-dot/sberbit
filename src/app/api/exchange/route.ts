import { NextResponse } from 'next/server';
import exchangeRates from '@/lib/exchangeRates';
import { OrdersStore, type ExchangeOrder } from '@/lib/ordersStore';
import { bot } from '@/lib/bot';
import { sendOrderStatusEmail } from '@/lib/email';
import { CaptchaStore } from '@/lib/captchaStore';
import { PaymentConfigStore } from '@/lib/paymentConfig';
import { z } from 'zod';

const exchangeSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  amount: z.string(),
  email: z.string().email(),
  walletAddress: z.string(),
  fromAccount: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const data = await request.json();
    exchangeSchema.parse(data);

    // Captcha validation
    const { captchaToken, captchaAnswer } = data as any;
    const captchaOk = CaptchaStore.validate(captchaToken, captchaAnswer);
    if (!captchaOk) {
      const diag = CaptchaStore.peek(captchaToken);
      if (!captchaToken) {
        console.warn('Captcha failed: no token provided');
      } else if (!diag) {
        console.warn('Captcha failed: token not found or expired', { token: captchaToken });
      } else {
        console.warn('Captcha failed: wrong answer', { token: captchaToken, provided: String(captchaAnswer), expected: diag.answer });
      }
      return NextResponse.json({ success: false, message: 'Неверная капча' }, { status: 400 });
    }

    const orderId = Date.now().toString();

    const { fromCurrency, toCurrency, amount, walletAddress, email, fromAccount } = data as {
      fromCurrency: string;
      toCurrency: string;
      amount: string;
      walletAddress: string;
      email?: string;
      fromAccount?: string;
    };

    const rates = exchangeRates.getRates();
    const cryptoKey = toCurrency.split('-')[0];
    const rate = rates[cryptoKey]?.rub;
    const toAmount = rate ? (Number(amount) / rate).toFixed(8) : '0';

    const now = new Date();
    const createdAt = now.toLocaleDateString('ru-RU');
    const lastStatusUpdate = `${createdAt}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

    const paymentConfig = PaymentConfigStore.get();

    const order: ExchangeOrder = {
      id: orderId,
      status: 'Принята, ожидает оплаты клиентом',
      fromAmount: amount,
      fromCurrency,
      ...(fromAccount ? { fromAccount } : {}),
      toAmount,
      toCurrency: cryptoKey + (toCurrency.includes('-') ? ` ${toCurrency.split('-')[1]}` : ''),
      toAccount: walletAddress,
      paymentDetails: paymentConfig.phone,
      paymentPhone: paymentConfig.phone,
      paymentRecipient: paymentConfig.recipient,
      paymentBank: paymentConfig.bank,
      createdAt,
      lastStatusUpdate,
      email,
    };

    OrdersStore.save(order);

    // Telegram notification
    try {
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (chatId) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const text = [
          `🆕 Новая заявка #${order.id}`,
          `Статус: ${order.status}`,
          `Отдаёт: ${order.fromAmount} ${order.fromCurrency}`,
          order.fromAccount ? `Со счёта: ${order.fromAccount}` : undefined,
          order.email ? `Email: ${order.email}` : undefined,
          `Получает: ${order.toAmount} ${order.toCurrency}`,
          `Кошелёк: ${order.toAccount}`,
          `Телефон: ${order.paymentPhone}`,
          `Получатель: ${order.paymentRecipient}`,
          `Банк: ${order.paymentBank}`,
          `Создана: ${order.createdAt}`,
          `IP: ${ip}`,
        ].filter(Boolean).join('\n');
        await bot.api.sendMessage(chatId, text);
      }
    } catch (notifyErr) {
      console.warn('Не удалось отправить уведомление в Telegram:', notifyErr);
    }

    // Email confirmation
    try {
      await sendOrderStatusEmail(
        order.email,
        `Заявка #${order.id} создана`,
        {
          id: order.id,
          status: order.status,
          email: order.email,
          fromAmount: order.fromAmount,
          fromCurrency: order.fromCurrency,
          toAmount: order.toAmount,
          toCurrency: order.toCurrency,
          toAccount: order.toAccount,
          createdAt: order.createdAt,
          lastStatusUpdate: order.lastStatusUpdate,
          paymentDetails: order.paymentDetails,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        }
      );
    } catch (e) {
      console.warn('Не удалось отправить email:', e);
    }

    return NextResponse.json({ success: true, orderId, order, message: 'Заявка успешно создана' });
  } catch (error) {
    console.error('Ошибка при обработке заявки:', error);
    return NextResponse.json({ success: false, message: 'Ошибка при создании заявки' }, { status: 400 });
  }
}
