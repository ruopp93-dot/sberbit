import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/bot';
import { OrdersStore, type ExchangeOrder } from '@/lib/ordersStore';
import { sendOrderStatusEmail } from '@/lib/email';
import { CURRENCIES, getRates, getRateValue, resetToAutoRates, setManualRate } from '@/lib/cryptoRates';
import { getPaymentDetails, setPaymentDetails } from '@/lib/settings';
import { getSiteUrl } from '@/lib/siteUrl';
import { safeEqual } from '@/lib/security';
import {
  STATUS,
  clearPending,
  esc,
  formatOrder,
  getPending,
  isAdmin,
  isCanceled,
  isClientPaid,
  isDone,
  isNew,
  isPaid,
  nowStamp,
  orderKeyboard,
  setPending,
  statusBadge,
  type InlineKeyboard,
} from '@/lib/telegramAdmin';

export const dynamic = 'force-dynamic';

const SUPPORT_URL = 'https://t.me/SberBitsupport';

// Подлинность запроса: Telegram присылает secret_token из setWebhook в заголовке.
// ?secret=... в адресе — устаревший способ регистрации, тоже принимаем.
function checkSecret(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production'; // без секрета — только dev
  const provided =
    req.headers.get('x-telegram-bot-api-secret-token') || new URL(req.url).searchParams.get('secret') || '';
  return safeEqual(provided, expected);
}

// ─── Output helpers ──────────────────────────────────────────────────────────
type Ctx = { chatId: number; messageId?: number };

const html = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } };

async function send(chatId: number, text: string, keyboard?: unknown) {
  await bot.api.sendMessage(chatId, text, { ...html, ...(keyboard ? { reply_markup: keyboard as never } : {}) });
}

/** Edits the message the button belongs to (clean navigation), or sends a new one. */
async function show(ctx: Ctx, text: string, keyboard?: InlineKeyboard) {
  if (ctx.messageId) {
    try {
      await bot.api.editMessageText(ctx.chatId, ctx.messageId, text, {
        ...html,
        ...(keyboard ? { reply_markup: keyboard } : {}),
      });
      return;
    } catch (e) {
      if (String(e).includes('message is not modified')) return;
    }
  }
  await send(ctx.chatId, text, keyboard);
}

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const back = (to = 'menu:main', text = '⬅️ Назад') => [{ text, callback_data: to }];
const home = [{ text: '🏠 Главное меню', callback_data: 'menu:main' }];

// Постоянная клавиатура внизу чата
const REPLY_KEYBOARD = {
  keyboard: [
    [{ text: '🏠 Главное меню' }, { text: '🔔 Проверить оплату' }],
    [{ text: '📋 Заявки' }, { text: '📊 Статистика' }],
    [{ text: '📈 Курсы' }, { text: '💳 Реквизиты' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// ─── Screens ─────────────────────────────────────────────────────────────────
type ListFilter = 'new' | 'check' | 'paid' | 'active' | 'done' | 'canceled' | 'all';
const LISTS: Record<ListFilter, { title: string; match: (o: ExchangeOrder) => boolean }> = {
  new: { title: '🆕 Ждут оплаты', match: (o) => isNew(o.status) },
  check: { title: '🔔 Клиент оплатил — проверить', match: (o) => isClientPaid(o.status) },
  paid: { title: '💸 Оплачены, в работе', match: (o) => isPaid(o.status) },
  active: { title: '📝 Все открытые', match: (o) => !isCanceled(o.status) && !isDone(o.status) },
  done: { title: '🏁 Выполненные', match: (o) => isDone(o.status) },
  canceled: { title: '🗑 Отменённые', match: (o) => isCanceled(o.status) },
  all: { title: '📋 Все заявки', match: () => true },
};

async function mainMenu(ctx: Ctx) {
  const [orders, rates, req] = await Promise.all([OrdersStore.all(), getRates(), getPaymentDetails()]);
  const count = (f: ListFilter) => orders.filter(LISTS[f].match).length;
  const text = [
    '<b>🏦 SberBits — панель управления</b>',
    '',
    `🔔 Проверить оплату: <b>${count('check')}</b>`,
    `🆕 Ждут оплаты: <b>${count('new')}</b>`,
    `💸 В работе: <b>${count('paid')}</b>`,
    '',
    '<b>📈 Курсы</b> (₽ за 1 монету)',
    ...CURRENCIES.map((c) => `${c}: <b>${nf.format(rates[c]?.rub ?? 0)} ₽</b> ${rates[c]?.manual ? '✍️ вручную' : '🔄 авто'}`),
    '',
    `<b>💳 Реквизиты:</b> ${esc(req)}`,
  ].join('\n');
  await show(ctx, text, {
    inline_keyboard: [
      [{ text: `🔔 Проверить оплату (${count('check')})`, callback_data: 'list:check:1' }],
      [
        { text: `🆕 Ждут оплаты (${count('new')})`, callback_data: 'list:new:1' },
        { text: `💸 В работе (${count('paid')})`, callback_data: 'list:paid:1' },
      ],
      [
        { text: '🏁 Выполненные', callback_data: 'list:done:1' },
        { text: '🗑 Отменённые', callback_data: 'list:canceled:1' },
      ],
      [{ text: '📋 Все заявки', callback_data: 'list:all:1' }],
      [
        { text: '📈 Курсы', callback_data: 'menu:rates' },
        { text: '💳 Реквизиты', callback_data: 'menu:req' },
      ],
      [
        { text: '📊 Статистика', callback_data: 'menu:stats' },
        { text: '❓ Помощь', callback_data: 'menu:help' },
      ],
      [
        { text: '🔄 Обновить', callback_data: 'menu:main' },
        { text: '🌐 Открыть сайт', url: getSiteUrl() },
      ],
    ],
  });
}

async function listsMenu(ctx: Ctx) {
  const orders = await OrdersStore.all();
  const row = (f: ListFilter) => [{ text: `${LISTS[f].title} (${orders.filter(LISTS[f].match).length})`, callback_data: `list:${f}:1` }];
  await show(ctx, '<b>📋 Заявки</b>\n\nВыберите список. Чтобы открыть заявку по номеру — просто отправьте номер.', {
    inline_keyboard: [row('check'), row('new'), row('paid'), row('done'), row('canceled'), row('all'), home],
  });
}

async function showList(ctx: Ctx, filter: ListFilter, page = 1) {
  const items = (await OrdersStore.all()).filter(LISTS[filter].match);
  if (!items.length) {
    await show(ctx, `<b>${LISTS[filter].title}</b>\n\nЗаявок нет.`, { inline_keyboard: [back('menu:lists'), home] });
    return;
  }
  const perPage = 8;
  const pages = Math.ceil(items.length / perPage);
  const p = Math.min(Math.max(1, page), pages);
  const slice = items.slice((p - 1) * perPage, p * perPage);
  const text = [
    `<b>${LISTS[filter].title}</b> — ${items.length} шт.${pages > 1 ? `, стр. ${p}/${pages}` : ''}`,
    '',
    ...slice.map((o) => `<b>#${o.id}</b> · ${esc(o.fromAmount)} ₽ → ${esc(o.toAmount)} ${esc(o.toCurrency)}\n${statusBadge(o.status)} · ${esc(o.createdAt)}`),
    '',
    'Нажмите на заявку, чтобы открыть её.',
  ].join('\n');
  const nav: { text: string; callback_data: string }[] = [];
  if (p > 1) nav.push({ text: '⬅️', callback_data: `list:${filter}:${p - 1}` });
  if (p < pages) nav.push({ text: '➡️', callback_data: `list:${filter}:${p + 1}` });
  await show(ctx, text, {
    inline_keyboard: [
      ...slice.map((o) => [{ text: `#${o.id} · ${o.fromAmount} ₽ · ${statusBadge(o.status)}`, callback_data: `order:${o.id}` }]),
      ...(nav.length ? [nav] : []),
      [{ text: '🔄 Обновить', callback_data: `list:${filter}:${p}` }, ...back('menu:lists')],
      home,
    ],
  });
}

async function showOrder(ctx: Ctx, id: string) {
  const o = await OrdersStore.get(id);
  if (!o) {
    await show(ctx, `Заявка #${esc(id)} не найдена.`, { inline_keyboard: [home] });
    return;
  }
  await show(ctx, formatOrder(o), orderKeyboard(o));
}

async function ratesMenu(ctx: Ctx, note?: string) {
  const rates = await getRates();
  const text = [
    note ? `${note}\n` : undefined,
    '<b>📈 Курсы на сайте</b> (₽ за 1 монету)',
    '',
    ...CURRENCIES.map((c) => {
      const r = rates[c];
      return `<b>${c}</b>: ${nf.format(r?.rub ?? 0)} ₽ — ${r?.manual ? '✍️ задан вручную' : '🔄 авто с биржи'}`;
    }),
    '',
    '🔄 Авто — курс обновляется с биржи раз в минуту.',
    '✍️ Вручную — курс не меняется, пока вы его не измените.',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
  await show(ctx, text, {
    inline_keyboard: [
      CURRENCIES.map((c) => ({ text: `✏️ ${c}`, callback_data: `rates:edit:${c}` })),
      [{ text: '🔄 Все курсы — авто с биржи', callback_data: 'rates:auto' }],
      home,
    ],
  });
}

async function reqMenu(ctx: Ctx, note?: string) {
  const req = await getPaymentDetails();
  await show(
    ctx,
    [
      note ? `${note}\n` : undefined,
      '<b>💳 Реквизиты для оплаты</b>',
      '',
      'Клиенты видят их на странице заявки:',
      `<code>${esc(req)}</code>`,
      '',
      'Новые реквизиты применяются к новым заявкам.',
    ]
      .filter((l) => l !== undefined)
      .join('\n'),
    { inline_keyboard: [[{ text: '✏️ Изменить реквизиты', callback_data: 'req:edit' }], home] }
  );
}

async function statsMenu(ctx: Ctx) {
  const orders = await OrdersStore.all();
  const today = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
  const todays = orders.filter((o) => o.createdAt.startsWith(today));
  const sum = (list: ExchangeOrder[]) => list.reduce((s, o) => s + (Number(o.fromAmount) || 0), 0);
  const doneAll = orders.filter((o) => isDone(o.status));
  const doneToday = todays.filter((o) => isDone(o.status));
  await show(
    ctx,
    [
      '<b>📊 Статистика</b>',
      '',
      `<b>Сегодня</b> (${today})`,
      `Заявок: <b>${todays.length}</b>, выполнено: <b>${doneToday.length}</b> на <b>${nf.format(sum(doneToday))} ₽</b>`,
      '',
      '<b>За 90 дней</b>',
      `Заявок: <b>${orders.length}</b>, выполнено: <b>${doneAll.length}</b> на <b>${nf.format(sum(doneAll))} ₽</b>`,
      `Отменено: <b>${orders.filter((o) => isCanceled(o.status)).length}</b>`,
    ].join('\n'),
    { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'menu:stats' }], home] }
  );
}

const HELP_TEXT = [
  '<b>❓ Как пользоваться</b>',
  '',
  '1. Клиент создаёт заявку на сайте — вам приходит уведомление 🆕.',
  '2. Клиент нажимает «Я оплатил» — приходит уведомление 🔔.',
  '3. Проверьте поступление денег и нажмите <b>✅ Оплата получена</b>.',
  '4. Отправьте крипту и нажмите <b>🏁 Выполнена</b> — пришлите ссылку или хэш транзакции.',
  '',
  'Курсы и реквизиты меняются в разделах 📈 и 💳.',
  'Открыть заявку — отправьте её номер.',
  '',
  'Команды: /start /orders /rates /req /stats /help',
].join('\n');

// ─── Order actions ───────────────────────────────────────────────────────────
async function changeStatus(ctx: Ctx, id: string, status: string, emailSubject: string, extra: Partial<ExchangeOrder> = {}) {
  const o = await OrdersStore.get(id);
  if (!o) {
    await show(ctx, `Заявка #${esc(id)} не найдена.`, { inline_keyboard: [home] });
    return;
  }
  if (isCanceled(o.status) || isDone(o.status)) {
    await show(ctx, `${formatOrder(o)}\n\n⚠️ Заявка уже закрыта.`, orderKeyboard(o));
    return;
  }
  const updated: ExchangeOrder = { ...o, ...extra, status, lastStatusUpdate: nowStamp() };
  await OrdersStore.save(updated);
  await show(ctx, formatOrder(updated), orderKeyboard(updated));
  try {
    await sendOrderStatusEmail(updated.email, `Заявка #${updated.id}: ${emailSubject}`, { ...updated, siteUrl: getSiteUrl() });
  } catch (e) {
    console.warn('Не удалось отправить email:', e);
  }
}

// ─── Admin text input ────────────────────────────────────────────────────────
async function handlePendingInput(chatId: number, text: string): Promise<boolean> {
  const pending = await getPending(chatId);
  if (!pending) return false;
  const ctx: Ctx = { chatId };

  if (pending.type === 'edit_rate') {
    const parsed = Number(text.replace(/[^\d,.]/g, '').replace(',', '.'));
    if (!text || !Number.isFinite(parsed) || parsed <= 0) {
      await send(chatId, '⚠️ Не удалось распознать число. Введите курс цифрами, например <code>4200000</code>.', {
        inline_keyboard: [[{ text: '✖️ Отмена', callback_data: 'input:cancel' }]],
      });
      return true;
    }
    await setManualRate(pending.currency, parsed);
    await clearPending(chatId);
    await ratesMenu(ctx, `✅ Курс <b>${pending.currency}</b> установлен: <b>${nf.format(parsed)} ₽</b>`);
    return true;
  }

  if (pending.type === 'edit_payment_details') {
    const value = text.trim();
    if (!value || value.length > 500) {
      await send(chatId, '⚠️ Реквизиты должны быть непустыми и не длиннее 500 символов.', {
        inline_keyboard: [[{ text: '✖️ Отмена', callback_data: 'input:cancel' }]],
      });
      return true;
    }
    await setPaymentDetails(value);
    await clearPending(chatId);
    await reqMenu(ctx, '✅ Реквизиты обновлены.');
    return true;
  }

  if (pending.type === 'done') {
    await clearPending(chatId);
    await changeStatus(ctx, pending.orderId, STATUS.done, 'заявка выполнена', { txLink: text.trim().slice(0, 500) });
    return true;
  }

  return false;
}

// ─── Routing ─────────────────────────────────────────────────────────────────
const TEXT_ROUTES: Record<string, (ctx: Ctx) => Promise<void>> = {
  '/start': mainMenu,
  '/menu': mainMenu,
  '🏠 главное меню': mainMenu,
  '/orders': listsMenu,
  '📋 заявки': listsMenu,
  '🔔 проверить оплату': (ctx) => showList(ctx, 'check'),
  '/rates': (ctx) => ratesMenu(ctx),
  '📈 курсы': (ctx) => ratesMenu(ctx),
  '/req': (ctx) => reqMenu(ctx),
  '💳 реквизиты': (ctx) => reqMenu(ctx),
  '/stats': statsMenu,
  '📊 статистика': statsMenu,
  '/help': (ctx) => show(ctx, HELP_TEXT, { inline_keyboard: [home] }),
};

async function handleMessage(chatId: number, text: string) {
  const cmd = text.toLowerCase().replace(/@\w+$/, '');

  if (!isAdmin(chatId)) {
    if (cmd === '/rates') {
      const rates = await getRates();
      await send(
        chatId,
        [
          '<b>Текущие курсы</b> (с учётом наценки):',
          `BTC → RUB: ${nf.format(Math.round(getRateValue(rates, 'BTC', 'RUB')))} ₽`,
          `USDT → RUB: ${nf.format(getRateValue(rates, 'USDT', 'RUB'))} ₽`,
        ].join('\n')
      );
      return;
    }
    await send(chatId, 'Здравствуйте! Обмен доступен на сайте, вопросы — в поддержку.', {
      inline_keyboard: [[{ text: '🌐 Сайт', url: getSiteUrl() }], [{ text: '🆘 Поддержка', url: SUPPORT_URL }]],
    });
    return;
  }

  // кнопки меню и команды отменяют незавершённый ввод
  const route = TEXT_ROUTES[cmd];
  if (route) {
    await clearPending(chatId);
    if (cmd === '/start') {
      await send(chatId, '👋 Панель администратора. Кнопки внизу всегда под рукой.', REPLY_KEYBOARD);
    }
    await route({ chatId });
    return;
  }

  if (await handlePendingInput(chatId, text)) return;

  if (/^#?\d{6,20}$/.test(text)) {
    await showOrder({ chatId }, text.replace('#', ''));
    return;
  }

  await send(chatId, 'Не понял команду 🤔 Используйте кнопки меню.', REPLY_KEYBOARD);
}

async function handleCallback(ctx: Ctx, data: string) {
  const [kind, a, b] = data.split(':');

  if (kind === 'menu') {
    await clearPending(ctx.chatId);
    if (a === 'main') return mainMenu(ctx);
    if (a === 'lists') return listsMenu(ctx);
    if (a === 'rates') return ratesMenu(ctx);
    if (a === 'req') return reqMenu(ctx);
    if (a === 'stats') return statsMenu(ctx);
    if (a === 'help') return show(ctx, HELP_TEXT, { inline_keyboard: [home] });
  }

  if (kind === 'list') {
    const f = (a in LISTS ? a : 'active') as ListFilter;
    return showList(ctx, f, parseInt(b || '1', 10) || 1);
  }

  if (kind === 'order') return showOrder(ctx, a);

  if (kind === 'act') {
    const id = b;
    if (a === 'paid') return changeStatus(ctx, id, STATUS.paid, 'оплата получена');
    if (a === 'done') {
      await setPending(ctx.chatId, { type: 'done', orderId: id });
      return show(ctx, `<b>🏁 Заявка #${esc(id)}</b>\n\nОтправьте сообщением ссылку или хэш транзакции — клиент увидит её на сайте и в письме.`, {
        inline_keyboard: [
          [{ text: '✅ Выполнена без ссылки', callback_data: `act:donenolink:${id}` }],
          [{ text: '✖️ Отмена', callback_data: `order:${id}` }],
        ],
      });
    }
    if (a === 'donenolink') {
      await clearPending(ctx.chatId);
      return changeStatus(ctx, id, STATUS.done, 'заявка выполнена');
    }
    if (a === 'cancel') {
      return show(ctx, `<b>Отменить заявку #${esc(id)}?</b>\n\nКлиент увидит статус «отменена администратором».`, {
        inline_keyboard: [
          [{ text: '🗑 Да, отменить', callback_data: `act:cancelyes:${id}` }],
          [{ text: '⬅️ Нет, назад', callback_data: `order:${id}` }],
        ],
      });
    }
    if (a === 'cancelyes') return changeStatus(ctx, id, STATUS.canceledByAdmin, 'отменена администратором');
  }

  if (kind === 'rates') {
    if (a === 'auto') {
      await resetToAutoRates();
      return ratesMenu(ctx, '✅ Курсы снова обновляются автоматически с биржи.');
    }
    if (a === 'edit' && (CURRENCIES as readonly string[]).includes(b)) {
      const current = (await getRates())[b]?.rub ?? 0;
      await setPending(ctx.chatId, { type: 'edit_rate', currency: b });
      return show(ctx, `<b>✏️ Курс ${b}</b>\n\nСейчас: <b>${nf.format(current)} ₽</b>\n\nОтправьте новый курс в рублях за 1 ${b} сообщением, например <code>${Math.round(current) || 4200000}</code>.`, {
        inline_keyboard: [[{ text: '✖️ Отмена', callback_data: 'menu:rates' }]],
      });
    }
  }

  if (kind === 'req' && a === 'edit') {
    await setPending(ctx.chatId, { type: 'edit_payment_details' });
    return show(ctx, '<b>✏️ Новые реквизиты</b>\n\nОтправьте сообщением ссылку на оплату или номер карты с названием банка и получателем.', {
      inline_keyboard: [[{ text: '✖️ Отмена', callback_data: 'menu:req' }]],
    });
  }

  if (kind === 'input' && a === 'cancel') {
    await clearPending(ctx.chatId);
    return mainMenu(ctx);
  }
}

// ─── Webhook ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    console.warn('[Telegram] webhook rejected: wrong or missing secret token');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat?.id as number;
      const text = String(update.message.text || '').trim();
      if (chatId && text) await handleMessage(chatId, text);
    } else if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id as number;
      if (!isAdmin(chatId)) {
        await bot.api.answerCallbackQuery(cq.id, { text: 'Действие доступно только администратору.' }).catch(() => {});
      } else {
        // сразу снимаем «часики» с кнопки, параллельно выполняем действие
        const answered = bot.api.answerCallbackQuery(cq.id).catch(() => {});
        await handleCallback({ chatId, messageId: cq.message?.message_id }, String(cq.data || ''));
        await answered;
      }
    }
  } catch (e) {
    console.error('Telegram webhook error:', e);
  }
  // всегда 200, чтобы Telegram не повторял один и тот же апдейт бесконечно
  return NextResponse.json({ ok: true });
}
