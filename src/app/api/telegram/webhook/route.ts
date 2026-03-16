import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/bot';
import { OrdersStore } from '@/lib/ordersStore';
import { sendOrderStatusEmail } from '@/lib/email';
import { getRates, getRateValue } from '@/lib/cryptoRates';
import { PaymentConfigStore } from '@/lib/paymentConfig';

// Pending admin actions stored globally
const globalPendingKey = '__SB_TELEGRAM_PENDING_ACTIONS_V1__';
const _g: any = (globalThis as any);
if (!_g[globalPendingKey]) _g[globalPendingKey] = new Map<string, { type: string; orderId: string }>();
const PendingActions: Map<string, { type: string; orderId: string }> = _g[globalPendingKey];

function checkSecret(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return expected ? secret === expected : true;
}

function isAdmin(chatId?: number | string | null) {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!admin) return true; // dev mode
  return String(chatId) === String(admin);
}

function isCanceled(status: string) { return /отмен/i.test(status); }
function isPaid(status: string) { return /оплачена/i.test(status); }

function nowStamp() {
  const now = new Date();
  return `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function buildMainMenu() {
  return {
    inline_keyboard: [
      [
        { text: '📝 Активные', callback_data: 'menu:orders' },
        { text: '💸 Оплаченные', callback_data: 'menu:paid' },
      ],
      [
        { text: '🗑 Отменённые', callback_data: 'menu:canceled' },
        { text: '📋 Все', callback_data: 'menu:all' },
      ],
      [
        { text: '📈 Курсы', callback_data: 'menu:rates' },
        { text: '💳 Реквизиты', callback_data: 'menu:requisites' },
      ],
      [
        { text: '❓ Помощь', callback_data: 'menu:help' },
        { text: '🆘 Поддержка', url: 'https://t.me/SberBitssupport' },
      ],
    ],
  };
}

type ListFilter = 'active' | 'paid' | 'canceled' | 'all';

function filterTitle(filter: ListFilter) {
  if (filter === 'active') return 'Активные заявки';
  if (filter === 'paid') return 'Оплаченные заявки';
  if (filter === 'canceled') return 'Отменённые заявки';
  return 'Все заявки';
}

function paginate<T>(arr: T[], page: number, perPage = 10) {
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * perPage;
  return { slice: arr.slice(start, start + perPage), p, pages, total };
}

async function handleShowRates(chatId: number | string) {
  const num = new Intl.NumberFormat('ru-RU');
  const rates = getRates();
  const btcRub = getRateValue('BTC', 'RUB');
  const usdtRub = getRateValue('USDT', 'RUB');
  const ethRub = getRateValue('ETH', 'RUB');
  const lines = [
    '📈 Текущие курсы (с учётом наценки):',
    '',
    `BTC: ${num.format(Math.round(btcRub))} ₽`,
    `ETH: ${num.format(Math.round(ethRub))} ₽`,
    `USDT: ${num.format(usdtRub)} ₽`,
    rates.BTC?.lastUpdate ? `\nОбновлено: ${new Date(rates.BTC.lastUpdate).toLocaleString('ru-RU')}` : '',
  ].filter((v) => v !== undefined).join('\n');
  await bot.api.sendMessage(chatId, lines, { reply_markup: buildMainMenu() as any });
}

function buildRatesAdminKeyboard(rates: ReturnType<typeof getRates>) {
  const keys = Object.keys(rates);
  const rows = keys.map((k) => [{ text: `✏️ Изменить ${k}`, callback_data: `rates:edit:${k}` }]);
  rows.push([{ text: '🏠 В меню', callback_data: 'menu:main' }]);
  return { inline_keyboard: rows };
}

function buildRequisitesMenu() {
  return {
    inline_keyboard: [
      [{ text: '📱 Изменить телефон', callback_data: 'req:edit:phone' }],
      [{ text: '👤 Изменить получателя', callback_data: 'req:edit:recipient' }],
      [{ text: '🏦 Изменить банк', callback_data: 'req:edit:bank' }],
      [{ text: '🏠 В меню', callback_data: 'menu:main' }],
    ],
  };
}

async function handleShowRequisites(chatId: number | string) {
  const config = PaymentConfigStore.get();
  const text = [
    '💳 Текущие реквизиты для оплаты:',
    '',
    `📱 Телефон: ${config.phone}`,
    `👤 Получатель: ${config.recipient}`,
    `🏦 Банк: ${config.bank}`,
  ].join('\n');
  await bot.api.sendMessage(chatId, text, { reply_markup: buildRequisitesMenu() as any });
}

async function handleShowList(chatId: number | string, filter: ListFilter, page = 1) {
  const list = OrdersStore.all().reverse();
  let items = list;
  if (filter === 'active') items = list.filter(o => !isCanceled(o.status));
  else if (filter === 'paid') items = list.filter(o => isPaid(o.status));
  else if (filter === 'canceled') items = list.filter(o => isCanceled(o.status));

  if (items.length === 0) {
    await bot.api.sendMessage(chatId, 'Список заявок пуст.', { reply_markup: buildMainMenu() as any });
    return;
  }

  const { slice, p, pages, total } = paginate(items, page);
  const header = `${filterTitle(filter)} (всего: ${total}, стр. ${p}/${pages})`;
  const lines = slice.map(o => `#${o.id} | ${o.fromAmount} ${o.fromCurrency} → ${o.toAmount} ${o.toCurrency} | ${o.status}`);
  const text = [header, '', ...lines].join('\n');

  const navRow: any[] = [];
  if (p > 1) navRow.push({ text: '⬅️ Назад', callback_data: `list:${filter}:${p - 1}` });
  if (p < pages) navRow.push({ text: 'Вперёд ➡️', callback_data: `list:${filter}:${p + 1}` });

  const keyboard = {
    inline_keyboard: [
      ...slice.map(o => [{ text: `#${o.id}`, callback_data: `order:${o.id}` }]),
      navRow.length ? navRow : [{ text: '🔄 Обновить', callback_data: `list:${filter}:${p}` }],
      [{ text: '🏠 В меню', callback_data: 'menu:main' }],
    ],
  };
  await bot.api.sendMessage(chatId, text, { reply_markup: keyboard as any });
}

async function handleShowOrder(chatId: string | number, id: string) {
  const o = OrdersStore.get(id);
  if (!o) {
    await bot.api.sendMessage(chatId, `Заявка #${id} не найдена.`, { reply_markup: buildMainMenu() as any });
    return;
  }

  const lines = [
    `📋 Заявка #${o.id}`,
    `Статус: ${o.status}`,
    `Отдаёт: ${o.fromAmount} ${o.fromCurrency}`,
    o.fromAccount ? `Со счёта: ${o.fromAccount}` : undefined,
    `Получает: ${o.toAmount} ${o.toCurrency}`,
    `Кошелёк: ${o.toAccount}`,
    '',
    '💳 Реквизиты:',
    o.paymentPhone ? `Телефон: ${o.paymentPhone}` : `Реквизиты: ${o.paymentDetails}`,
    o.paymentRecipient ? `Получатель: ${o.paymentRecipient}` : undefined,
    o.paymentBank ? `Банк: ${o.paymentBank}` : undefined,
    '',
    `Создана: ${o.createdAt}`,
    `Обновлена: ${o.lastStatusUpdate}`,
  ].filter(Boolean).join('\n');

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const openUrl = site ? `${site.replace(/\/$/, '')}/order/${o.id}` : undefined;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Подтвердить (со ссылкой)', callback_data: `act:confirm:${o.id}:with_link` },
        { text: '✅ Подтвердить', callback_data: `act:confirm:${o.id}:no_link` },
      ],
      [{ text: '🗑 Отменить заявку', callback_data: `act:cancel:${o.id}` }],
      ...(openUrl ? [[{ text: '🔗 Открыть в браузере', url: openUrl }]] as any[] : []),
      [{ text: '⬅️ К списку', callback_data: 'menu:orders' }],
      [{ text: '🏠 В меню', callback_data: 'menu:main' }],
    ],
  };

  await bot.api.sendMessage(chatId, lines, { reply_markup: keyboard as any });
}

function buildOrderText(o: ReturnType<typeof OrdersStore.get>) {
  if (!o) return '';
  return [
    `📋 Заявка #${o.id}`,
    `Статус: ${o.status}`,
    `Отдаёт: ${o.fromAmount} ${o.fromCurrency}`,
    o.fromAccount ? `Со счёта: ${o.fromAccount}` : undefined,
    `Получает: ${o.toAmount} ${o.toCurrency}`,
    `Кошелёк: ${o.toAccount}`,
    o.paymentPhone ? `Телефон: ${o.paymentPhone}` : `Реквизиты: ${o.paymentDetails}`,
    o.paymentRecipient ? `Получатель: ${o.paymentRecipient}` : undefined,
    o.paymentBank ? `Банк: ${o.paymentBank}` : undefined,
    `Создана: ${o.createdAt}`,
    `Обновлена: ${o.lastStatusUpdate}`,
  ].filter(Boolean).join('\n');
}

async function handleActionConfirm(chatId: number, id: string, messageId?: number) {
  const o = OrdersStore.get(id);
  if (!o) { await bot.api.sendMessage(chatId, `Заявка #${id} не найдена.`); return; }

  const updated = { ...o, status: 'Заявка оплачена — идет проверка платежа и обработка заявки', lastStatusUpdate: nowStamp() };
  OrdersStore.save(updated);

  const text = buildOrderText(updated);
  try {
    if (messageId) await bot.api.editMessageText(chatId, messageId, text);
    else await bot.api.sendMessage(chatId, text);
  } catch {
    await bot.api.sendMessage(chatId, text);
  }

  try {
    await sendOrderStatusEmail(updated.email, `Заявка #${updated.id}: оплата подтверждена`, {
      id: updated.id, status: updated.status, email: updated.email,
      fromAmount: updated.fromAmount, fromCurrency: updated.fromCurrency,
      toAmount: updated.toAmount, toCurrency: updated.toCurrency,
      toAccount: updated.toAccount, createdAt: updated.createdAt,
      lastStatusUpdate: updated.lastStatusUpdate, paymentDetails: updated.paymentDetails,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
  } catch (e) { console.warn('Email error (confirm):', e); }
}

async function handleActionCancel(chatId: number, id: string, messageId?: number) {
  const o = OrdersStore.get(id);
  if (!o) { await bot.api.sendMessage(chatId, `Заявка #${id} не найдена.`); return; }

  const updated = { ...o, status: 'Заявка отменена администратором', lastStatusUpdate: nowStamp() };
  OrdersStore.save(updated);

  const text = buildOrderText(updated);
  try {
    if (messageId) await bot.api.editMessageText(chatId, messageId, text);
    else await bot.api.sendMessage(chatId, text);
  } catch {
    await bot.api.sendMessage(chatId, text);
  }

  try {
    await sendOrderStatusEmail(updated.email, `Заявка #${updated.id}: отменена администратором`, {
      id: updated.id, status: updated.status, email: updated.email,
      fromAmount: updated.fromAmount, fromCurrency: updated.fromCurrency,
      toAmount: updated.toAmount, toCurrency: updated.toCurrency,
      toAccount: updated.toAccount, createdAt: updated.createdAt,
      lastStatusUpdate: updated.lastStatusUpdate, paymentDetails: updated.paymentDetails,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
  } catch (e) { console.warn('Email error (cancel):', e); }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkSecret(request)) return NextResponse.json({ ok: true }, { status: 200 });

    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id as number;
      const text: string = (update.message.text || '').trim();

      // Handle pending actions
      if (PendingActions.has(String(chatId))) {
        const pending = PendingActions.get(String(chatId))!;

        // Skip pending action
        if (text === '/skip') {
          if (pending.type === 'confirm') {
            await handleActionConfirm(chatId, pending.orderId);
            await bot.api.sendMessage(chatId, `Заявка #${pending.orderId} подтверждена без ссылки.`);
          }
          PendingActions.delete(String(chatId));
          return NextResponse.json({ ok: true });
        }

        // Edit rate
        if (pending.type === 'edit_rate') {
          const currency = pending.orderId;
          const parsed = Number(String(text).replace(/[^\d,\.]/g, '').replace(',', '.'));
          if (isNaN(parsed) || parsed <= 0) {
            await bot.api.sendMessage(chatId, `Не удалось распознать число из "${text}". Введите положительное число.`);
            return NextResponse.json({ ok: true });
          }
          try {
            const { updateRate } = await import('@/lib/cryptoRates');
            updateRate(currency, parsed);
            PendingActions.delete(String(chatId));
            await bot.api.sendMessage(
              chatId,
              `✅ Курс ${currency} обновлён: ${parsed} ₽\n\n💡 Чтобы изменение сохранялось после перезапуска сервера — обновите переменную окружения DEFAULT_${currency}_RATE=${parsed} в Vercel.`,
              { reply_markup: buildMainMenu() as any }
            );
          } catch (e) {
            await bot.api.sendMessage(chatId, `Ошибка обновления курса: ${String(e)}`);
          }
          return NextResponse.json({ ok: true });
        }

        // Edit requisite field
        if (pending.type === 'edit_req') {
          const field = pending.orderId as 'phone' | 'recipient' | 'bank';
          PaymentConfigStore.update({ [field]: text });
          PendingActions.delete(String(chatId));
          const fieldNames: Record<string, string> = { phone: 'Телефон', recipient: 'Получатель', bank: 'Банк' };
          const envKeys: Record<string, string> = { phone: 'PAYMENT_PHONE', recipient: 'PAYMENT_RECIPIENT', bank: 'PAYMENT_BANK' };
          await bot.api.sendMessage(
            chatId,
            `✅ ${fieldNames[field] || field} обновлён: ${text}\n\n💡 Для постоянного хранения обновите переменную окружения ${envKeys[field]}="${text}" в Vercel.`,
            { reply_markup: buildRequisitesMenu() as any }
          );
          return NextResponse.json({ ok: true });
        }

        // Treat message as payment link for confirm
        if (pending.type === 'confirm') {
          const existing = OrdersStore.get(pending.orderId);
          if (existing) {
            const updated = { ...existing, paymentDetails: text, lastStatusUpdate: nowStamp(), status: 'Заявка оплачена — идет проверка платежа и обработка заявки' };
            OrdersStore.save(updated);
            PendingActions.delete(String(chatId));
            await bot.api.sendMessage(chatId, `✅ Ссылка сохранена и заявка #${pending.orderId} подтверждена.`);
            try {
              await sendOrderStatusEmail(updated.email, `Заявка #${updated.id}: оплата подтверждена`, {
                id: updated.id, status: updated.status, email: updated.email,
                fromAmount: updated.fromAmount, fromCurrency: updated.fromCurrency,
                toAmount: updated.toAmount, toCurrency: updated.toCurrency,
                toAccount: updated.toAccount, createdAt: updated.createdAt,
                lastStatusUpdate: updated.lastStatusUpdate, paymentDetails: updated.paymentDetails,
                siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
              });
            } catch (e) { console.warn('Email error:', e); }
            return NextResponse.json({ ok: true });
          }
        }
      }

      // Public commands
      if (text === '/start' || text === 'menu' || text === '/menu') {
        const greeting = isAdmin(chatId) ? 'Панель администратора SberBits' : 'Добро пожаловать!';
        await bot.api.sendMessage(chatId, greeting, { reply_markup: buildMainMenu() as any });
      } else if (/^\/rates?/i.test(text)) {
        await handleShowRates(chatId);
      } else if (/^#?(\d{10,})$/.test(text)) {
        const id = text.replace('#', '');
        if (isAdmin(chatId)) await handleShowOrder(chatId, id);
        else await bot.api.sendMessage(chatId, 'Просмотр заявок доступен только администратору.');
      } else if (/^\/(orders|list|paid|canceled|cancelled|all)/i.test(text)) {
        if (!isAdmin(chatId)) { await bot.api.sendMessage(chatId, 'Доступно только администратору.'); return NextResponse.json({ ok: true }); }
        if (/paid/i.test(text)) await handleShowList(chatId, 'paid', 1);
        else if (/canceled|cancelled/i.test(text)) await handleShowList(chatId, 'canceled', 1);
        else if (/all/i.test(text)) await handleShowList(chatId, 'all', 1);
        else await handleShowList(chatId, 'active', 1);
      } else if (text === '/requisites' || text === '/req') {
        if (!isAdmin(chatId)) { await bot.api.sendMessage(chatId, 'Доступно только администратору.'); return NextResponse.json({ ok: true }); }
        await handleShowRequisites(chatId);
      } else {
        await bot.api.sendMessage(chatId, 'Используйте меню ниже.', { reply_markup: buildMainMenu() as any });
      }
    } else if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id as number;
      const data: string = cq.data || '';

      const adminOnly = /^(menu:(orders|paid|canceled|all|requisites))|^list:|^act:|^req:|^rates:edit/i.test(data);
      if (adminOnly && !isAdmin(chatId)) {
        try { await bot.api.answerCallbackQuery(cq.id, { text: 'Действие доступно только администратору.' } as any); } catch {}
        return NextResponse.json({ ok: true });
      }

      if (data === 'menu:main') {
        const greeting = isAdmin(chatId) ? 'Панель администратора SberBits' : 'Главное меню';
        await bot.api.editMessageText(chatId, cq.message!.message_id, greeting, { reply_markup: buildMainMenu() as any });
      } else if (data === 'menu:orders') {
        await handleShowList(chatId, 'active', 1);
      } else if (data === 'menu:paid') {
        await handleShowList(chatId, 'paid', 1);
      } else if (data === 'menu:canceled') {
        await handleShowList(chatId, 'canceled', 1);
      } else if (data === 'menu:all') {
        await handleShowList(chatId, 'all', 1);
      } else if (data === 'menu:rates') {
        if (isAdmin(chatId)) {
          const rates = getRates();
          const lines = ['📈 Курсы (исходные, без наценки):', '', ...Object.entries(rates).map(([k, v]) => `${k}: ${v.rub} ₽`)].join('\n');
          await bot.api.sendMessage(chatId, lines, { reply_markup: buildRatesAdminKeyboard(rates) as any });
        } else {
          await handleShowRates(chatId);
        }
      } else if (data.startsWith('rates:edit:')) {
        const currency = data.split(':')[2];
        PendingActions.set(String(chatId), { type: 'edit_rate', orderId: currency });
        await bot.api.sendMessage(chatId, `Введите новый курс для ${currency} в ₽ (например: 95.45)`);
      } else if (data === 'menu:requisites') {
        await handleShowRequisites(chatId);
      } else if (data.startsWith('req:edit:')) {
        const field = data.split(':')[2];
        PendingActions.set(String(chatId), { type: 'edit_req', orderId: field });
        const prompts: Record<string, string> = {
          phone: 'Введите новый номер телефона (например: +7 999 123-45-67):',
          recipient: 'Введите имя получателя (например: ИВАН ИВАНОВ):',
          bank: 'Введите название банка (например: Тинькофф):',
        };
        await bot.api.sendMessage(chatId, prompts[field] || `Введите значение для ${field}:`);
      } else if (data === 'menu:help') {
        const helpText = [
          '📚 Доступные команды:',
          '/orders — активные заявки',
          '/paid — оплаченные заявки',
          '/canceled — отменённые заявки',
          '/all — все заявки',
          '/rates — текущие курсы',
          '/req — реквизиты для оплаты',
          '#ID — найти заявку по ID',
        ].join('\n');
        await bot.api.sendMessage(chatId, helpText, { reply_markup: buildMainMenu() as any });
      } else if (data.startsWith('order:')) {
        const id = data.split(':')[1];
        await handleShowOrder(chatId, id);
      } else if (data.startsWith('list:')) {
        const [, filter, pageStr] = data.split(':');
        const page = parseInt(pageStr || '1', 10) || 1;
        const f = (['active', 'paid', 'canceled', 'all'].includes(filter) ? filter : 'active') as ListFilter;
        await handleShowList(chatId, f, page);
      } else if (data.startsWith('act:confirm:')) {
        const parts = data.split(':');
        const id = parts[2];
        const mode = parts[3] || 'no_link';
        if (mode === 'with_link') {
          PendingActions.set(String(chatId), { type: 'confirm', orderId: id });
          await bot.api.sendMessage(chatId, `Отправьте ссылку для заявки #${id}. Чтобы подтвердить без ссылки — /skip`);
        } else {
          await handleActionConfirm(chatId, id, cq.message?.message_id);
        }
      } else if (data.startsWith('act:cancel:')) {
        const id = data.split(':')[2];
        await handleActionCancel(chatId, id, cq.message?.message_id);
      }

      if (cq.id) {
        try { await bot.api.answerCallbackQuery(cq.id); } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Telegram webhook error:', e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
