import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/bot';
import { OrdersStore } from '@/lib/ordersStore';
import { sendOrderStatusEmail } from '@/lib/email';
import { getRates, getRateValue } from '@/lib/cryptoRates';
import exchangeRates from '@/lib/exchangeRates';
// pendingActions: Map adminChatId -> { type: 'confirm'|'cancel', orderId }
const globalPendingKey = '__SB_TELEGRAM_PENDING_ACTIONS_V1__';
const _g: any = (globalThis as any) || {};
if (!_g[globalPendingKey]) _g[globalPendingKey] = new Map<string, { type: string; orderId: string }>();
const PendingActions: Map<string, { type: string; orderId: string }> = _g[globalPendingKey];

// Простая проверка токена вебхука через секрет в query (?secret=...)
function checkSecret(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return expected ? secret === expected : true; // если секрета нет, пропускаем (dev)
}

async function handleShowRates(chatId: number | string) {
  const number = new Intl.NumberFormat('ru-RU');
  const rates = getRates();
  const btcRub = getRateValue('BTC', 'RUB');
  const usdtRub = getRateValue('USDT', 'RUB');
  const btcUpdated = rates.BTC?.lastUpdate ? new Date(rates.BTC.lastUpdate).toLocaleString('ru-RU') : '';
  const usdtUpdated = rates.USDT?.lastUpdate ? new Date(rates.USDT.lastUpdate).toLocaleString('ru-RU') : '';

  const lines = [
    'Текущие курсы (с учётом наценки):',
    '',
    `BTC → RUB: ${number.format(Math.round(btcRub))} ₽`,
    btcUpdated ? `Обновлено (BTC): ${btcUpdated}` : undefined,
    '',
    `USDT → RUB: ${number.format(usdtRub)} ₽`,
    usdtUpdated ? `Обновлено (USDT): ${usdtUpdated}` : undefined,
  ].filter(Boolean).join('\n');

  const keyboard = { inline_keyboard: [[{ text: '🏠 В меню', callback_data: 'menu:main' }]] };
  await bot.api.sendMessage(chatId, lines, { reply_markup: keyboard as any });
}

function buildRatesAdminKeyboard(rates: any) {
  const keys = Object.keys(rates || {});
  const rows = keys.map((k: string) => [{ text: `Изменить ${k}`, callback_data: `rates:edit:${k}` }]);
  rows.push([{ text: '🏠 В меню', callback_data: 'menu:main' }]);
  return { inline_keyboard: rows };
}

function isCanceled(status: string) {
  return /отмен/i.test(status);
}

function isPaid(status: string) {
  return /оплачена/i.test(status);
}

function isAdmin(chatId?: number | string | null) {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!admin) return true; // dev mode: allow
  return String(chatId) === String(admin);
}

function formatOrderLine(o: { id: string; fromAmount: string; fromCurrency: string; toAmount: string; toCurrency: string; status: string; }) {
  return `#${o.id} | ${o.fromAmount} ${o.fromCurrency} → ${o.toAmount} ${o.toCurrency} | ${o.status}`;
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
        { text: '❓ Помощь', callback_data: 'menu:help' },
      ],
      [
        { text: '🆘 Поддержка', url: 'https://t.me/SunocomMusic' },
      ],
    ],
  };
}

type ListFilter = 'active' | 'paid' | 'canceled' | 'all';

function filterOrders(filter: ListFilter) {
  const list = OrdersStore.all();
  switch (filter) {
    case 'active':
      return list.filter(o => !isCanceled(o.status));
    case 'paid':
      return list.filter(o => isPaid(o.status));
    case 'canceled':
      return list.filter(o => isCanceled(o.status));
    default:
      return list;
  }
}

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
  const slice = arr.slice(start, start + perPage);
  return { slice, p, pages, total };
}

async function handleShowList(chatId: number | string, filter: ListFilter, page = 1) {
  const items = filterOrders(filter).reverse();
  if (items.length === 0) {
    const emptyText = filter === 'canceled' ? 'Отменённых заявок нет.' : 'Список заявок пуст.';
    await bot.api.sendMessage(chatId, emptyText, { reply_markup: buildMainMenu() as any });
    return;
  }
  const { slice, p, pages, total } = paginate(items, page);
  const header = `${filterTitle(filter)} (всего: ${total}, стр. ${p}/${pages})`;
  const text = [header, '', ...slice.map(formatOrderLine)].join('\n');
  const navRow: any[] = [];
  if (p > 1) navRow.push({ text: '⬅️ Назад', callback_data: `list:${filter}:${p - 1}` });
  if (p < pages) navRow.push({ text: 'Вперёд ➡️', callback_data: `list:${filter}:${p + 1}` });
  const keyboard = {
    inline_keyboard: [
      ...slice.map(o => [{ text: `#${o.id}`, callback_data: `order:${o.id}` }]),
      navRow.length ? navRow : [{ text: 'Обновить', callback_data: `list:${filter}:${p}` }],
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
    `Заявка #${o.id}`,
    `Статус: ${o.status}`,
    `Отдаете: ${o.fromAmount} ${o.fromCurrency}`,
    o.fromAccount ? `Со счета: ${o.fromAccount}` : undefined,
    `Получаете: ${o.toAmount} ${o.toCurrency}`,
    `На счет: ${o.toAccount}`,
    `Реквизиты для оплаты: ${o.paymentDetails}`,
    `Создана: ${o.createdAt}`,
    `Обновлена: ${o.lastStatusUpdate}`,
  ].filter(Boolean).join('\n');

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const openUrl = site ? `${site.replace(/\/$/, '')}/order/${o.id}` : undefined;
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Подтвердить оплату (вставить ссылку)', callback_data: `act:confirm:${o.id}:with_link` },
        { text: '✅ Подтвердить (без ссылки)', callback_data: `act:confirm:${o.id}:no_link` },
        { text: '🗑 Отменить заявку', callback_data: `act:cancel:${o.id}` },
      ],
      [
        ...(openUrl ? [{ text: '🔗 Открыть в кабинете', url: openUrl }] as any[] : []),
      ],
      [{ text: '⬅️ Назад', callback_data: 'menu:orders' }],
      [{ text: '🏠 В меню', callback_data: 'menu:main' }],
    ],
  };

  await bot.api.sendMessage(chatId, lines, { reply_markup: keyboard as any });
}

function nowStamp() {
  const now = new Date();
  return `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

async function handleActionConfirm(chatId: number, id: string, messageId?: number) {
  const o = OrdersStore.get(id);
  if (!o) {
    await bot.api.sendMessage(chatId, `Заявка #${id} не найдена.`);
    return;
  }
  const updated = { ...o, status: 'Заявка оплачена — идет проверка платежа и обработка заявки', lastStatusUpdate: nowStamp() };
  OrdersStore.save(updated);
  const text = [
    `Заявка #${updated.id}`,
    `Статус: ${updated.status}`,
    `Отдаете: ${updated.fromAmount} ${updated.fromCurrency}`,
    updated.fromAccount ? `Со счета: ${updated.fromAccount}` : undefined,
    `Получаете: ${updated.toAmount} ${updated.toCurrency}`,
    `На счет: ${updated.toAccount}`,
    `Реквизиты для оплаты: ${updated.paymentDetails}`,
    `Создана: ${updated.createdAt}`,
    `Обновлена: ${updated.lastStatusUpdate}`,
  ].filter(Boolean).join('\n');
  try {
    if (messageId) {
      await bot.api.editMessageText(chatId, messageId, text);
    } else {
      await bot.api.sendMessage(chatId, text);
    }
  } catch {
    await bot.api.sendMessage(chatId, text);
  }
  // Email уведомление пользователю
  try {
    await sendOrderStatusEmail(
      updated.email,
      `Заявка #${updated.id}: подтверждение оплаты принято (админ)`,
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
    console.warn('Не удалось отправить email (admin confirm):', e);
  }
}

async function handleActionCancel(chatId: number, id: string, messageId?: number) {
  const o = OrdersStore.get(id);
  if (!o) {
    await bot.api.sendMessage(chatId, `Заявка #${id} не найдена.`);
    return;
  }
  const updated = { ...o, status: 'Заявка отменена администратором', lastStatusUpdate: nowStamp() };
  OrdersStore.save(updated);
  const text = [
    `Заявка #${updated.id}`,
    `Статус: ${updated.status}`,
    `Отдаете: ${updated.fromAmount} ${updated.fromCurrency}`,
    updated.fromAccount ? `Со счета: ${updated.fromAccount}` : undefined,
    `Получаете: ${updated.toAmount} ${updated.toCurrency}`,
    `На счет: ${updated.toAccount}`,
    `Реквизиты для оплаты: ${updated.paymentDetails}`,
    `Создана: ${updated.createdAt}`,
    `Обновлена: ${updated.lastStatusUpdate}`,
  ].filter(Boolean).join('\n');
  try {
    if (messageId) {
      await bot.api.editMessageText(chatId, messageId, text);
    } else {
      await bot.api.sendMessage(chatId, text);
    }
  } catch {
    await bot.api.sendMessage(chatId, text);
  }
  // Email уведомление пользователю
  try {
    await sendOrderStatusEmail(
      updated.email,
      `Заявка #${updated.id}: отменена администратором`,
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
    console.warn('Не удалось отправить email (admin cancel):', e);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkSecret(request)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id as number;
      const text: string = (update.message.text || '').trim();

        // If admin has a pending action, treat this message as the payload (link or confirmation)
        if (PendingActions.has(String(chatId))) {
          const pending = PendingActions.get(String(chatId))!;
    // if admin sent /skip — treat as confirm without link
          if (text === '/skip') {
            // apply confirmation without additional link
            await handleActionConfirm(chatId, pending.orderId);
            PendingActions.delete(String(chatId));
            await bot.api.sendMessage(chatId, `Подтверждение для заявки #${pending.orderId} принято без ссылки.`);
            return NextResponse.json({ ok: true });
            }
          // support pending edit_rate (we store currency in orderId field)
          if (pending.type === 'edit_rate') {
            const currency = pending.orderId;
            const parsed = Number(String(text).replace(/[^\d,\.]/g, '').replace(',', '.'));
            if (isNaN(parsed)) {
              await bot.api.sendMessage(chatId, `Не удалось распознать число из '${text}'. Попробуйте ещё раз.`);
              return NextResponse.json({ ok: true });
            }
            try {
              exchangeRates.updateRate(currency, parsed);
              PendingActions.delete(String(chatId));
              await bot.api.sendMessage(chatId, `Курс ${currency} обновлён: ${parsed}`);
              return NextResponse.json({ ok: true });
            } catch (e) {
              await bot.api.sendMessage(chatId, `Не удалось обновить курс: ${String(e)}`);
              return NextResponse.json({ ok: true });
            }
          }
          // otherwise treat text as payment link and save it
          const existing = OrdersStore.get(pending.orderId);
          if (existing) {
            const updated = { ...existing, paymentDetails: text, lastStatusUpdate: nowStamp(), status: 'Заявка оплачена — идет проверка платежа и обработка заявки' };
            OrdersStore.save(updated);
            PendingActions.delete(String(chatId));
            await bot.api.sendMessage(chatId, `Ссылка сохранена и заявка #${pending.orderId} помечена как оплаченная.`);
            // notify user/email
            try {
              await sendOrderStatusEmail(
                updated.email,
                `Заявка #${updated.id}: подтверждение оплаты принято (админ)` ,
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
              console.warn('Не удалось отправить email (admin confirm with link):', e);
            }
            return NextResponse.json({ ok: true });
          }
        }

      // Normalize command: lowercase + strip @BotName suffix
      const cmd = text.toLowerCase().replace(/@\w+$/, '');

      // Public commands
      if (cmd === '/start' || cmd === 'menu' || cmd === '/menu') {
        const greeting = isAdmin(chatId) ? 'Панель администратора SberBits' : 'Добро пожаловать!';
        await bot.api.sendMessage(chatId, greeting, { reply_markup: buildMainMenu() as any });
      } else if (/^\/rates?$/i.test(cmd)) {
        await handleShowRates(chatId);
      } else if (/^\/help$/i.test(cmd)) {
        const helpText = [
          '📚 Доступные команды:',
          '/orders — активные заявки',
          '/paid — оплаченные заявки',
          '/canceled — отменённые заявки',
          '/all — все заявки',
          '/rates — текущие курсы',
          '#ID — найти заявку по ID',
        ].join('\n');
        await bot.api.sendMessage(chatId, helpText, { reply_markup: buildMainMenu() as any });
      } else if (/^#?\d+$/.test(text)) {
        const id = text.replace('#', '');
        if (isAdmin(chatId)) await handleShowOrder(chatId, id);
        else await bot.api.sendMessage(chatId, 'Просмотр заявок доступен только администратору.');
      } else if (/^\/(orders|list|paid|canceled|cancelled|all)/i.test(cmd)) {
        if (!isAdmin(chatId)) { await bot.api.sendMessage(chatId, 'Доступно только администратору.'); return NextResponse.json({ ok: true }); }
        if (/paid/i.test(cmd)) await handleShowList(chatId, 'paid', 1);
        else if (/canceled|cancelled/i.test(cmd)) await handleShowList(chatId, 'canceled', 1);
        else if (/all/i.test(cmd)) await handleShowList(chatId, 'all', 1);
        else await handleShowList(chatId, 'active', 1);
      } else {
        await bot.api.sendMessage(chatId, 'Команда не распознана. Используйте меню ниже.', { reply_markup: buildMainMenu() as any });
      }
    } else if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id as number;
      const data: string = cq.data || '';

      // Determine whether this callback requires admin rights
      const adminOnly = /^(menu:(orders|paid|canceled|all))|^list:|^act:/i.test(data);
      if (adminOnly && !isAdmin(chatId)) {
        // politely acknowledge the interaction for non-admins
        if (cq.id) {
          try { await bot.api.answerCallbackQuery(cq.id, { text: 'Действие доступно только администратору.' } as any); } catch {}
        }
        return NextResponse.json({ ok: true });
      }
      if (data === 'menu:main') {
        await bot.api.editMessageText(chatId, cq.message!.message_id, 'Главное меню', { reply_markup: buildMainMenu() as any });
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
          const lines = ['Текущие курсы (для редактирования):', '', ...Object.keys(rates).map(k => `${k}: ${rates[k].rub}`)].join('\n');
          await bot.api.sendMessage(chatId, lines, { reply_markup: buildRatesAdminKeyboard(rates) as any });
        } else {
          await handleShowRates(chatId);
        }
      } else if (data.startsWith('rates:edit:')) {
        const currency = data.split(':')[2];
        PendingActions.set(String(chatId), { type: 'edit_rate', orderId: currency });
        await bot.api.sendMessage(chatId, `Введите новый курс (в RUB) для ${currency}, например 4200000`);
      } else if (data === 'menu:help') {
        await bot.api.sendMessage(chatId, 'Доступные действия: \n- Заявки\n- Отменённые заявки\n- Просмотр заявки по ID (отправьте номер, напр. 12345)', { reply_markup: buildMainMenu() as any });
      } else if (data.startsWith('order:')) {
        const id = data.split(':')[1];
        await handleShowOrder(chatId, id);
      } else if (data.startsWith('list:')) {
        const [, filter, pageStr] = data.split(':');
        const page = parseInt(pageStr || '1', 10) || 1;
        const f = (['active','paid','canceled','all'].includes(filter) ? filter : 'active') as ListFilter;
        await handleShowList(chatId, f, page);
      } else if (data.startsWith('act:confirm:')) {
        const parts = data.split(':');
        const id = parts[2];
        const mode = parts[3] || 'no_link';
        if (mode === 'with_link') {
          // mark pending and ask admin to send the link as a message
          PendingActions.set(String(chatId), { type: 'confirm', orderId: id });
          await bot.api.sendMessage(chatId, `Пожалуйста, отправьте ссылку на платёж для заявки #${id} в ответном сообщении. Если хотите подтвердить без ссылки, отправьте /skip`);
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
