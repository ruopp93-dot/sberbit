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
  formatOrder,
  getPending,
  isAdmin,
  isCanceled,
  isClientPaid,
  isDone,
  isPaid,
  nowStamp,
  orderKeyboard,
  setPending,
} from '@/lib/telegramAdmin';

export const dynamic = 'force-dynamic';

const SUPPORT_URL = 'https://t.me/SberBitsupport';

// Подлинность запроса: Telegram присылает secret_token из setWebhook в заголовке.
function checkSecret(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    // без секрета любой может слать поддельные апдейты — разрешаем только в dev
    return process.env.NODE_ENV !== 'production';
  }
  return safeEqual(req.headers.get('x-telegram-bot-api-secret-token') || '', expected);
}

type Keyboard = { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] };
const send = (chatId: number, text: string, keyboard?: Keyboard) =>
  bot.api.sendMessage(chatId, text, keyboard ? { reply_markup: keyboard as never } : undefined);
const toMenu = [{ text: '🏠 В меню', callback_data: 'menu:main' }];

function buildMainMenu(): Keyboard {
  return {
    inline_keyboard: [
      [
        { text: '📝 Активные', callback_data: 'list:active:1' },
        { text: '💸 Оплаченные', callback_data: 'list:paid:1' },
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
        { text: '🌐 Открыть сайт', url: getSiteUrl() },
        { text: '❓ Помощь', callback_data: 'menu:help' },
      ],
    ],
  };
}

const HELP_TEXT = [
  '📚 Управление сайтом:',
  '/orders — активные заявки',
  '/paid — оплаченные',
  '/done — выполненные',
  '/canceled — отменённые',
  '/all — все заявки',
  '/rates — курсы (изменить / вернуть авто)',
  '/req — реквизиты для оплаты',
  'Номер заявки (например 123456789012) — открыть заявку',
  '/cancel — отменить ввод',
].join('\n');

// ─── Lists ───────────────────────────────────────────────────────────────────
type ListFilter = 'active' | 'paid' | 'done' | 'canceled' | 'all';
const LIST_TITLES: Record<ListFilter, string> = {
  active: 'Активные заявки',
  paid: 'Оплаченные заявки',
  done: 'Выполненные заявки',
  canceled: 'Отменённые заявки',
  all: 'Все заявки',
};

function matches(o: ExchangeOrder, filter: ListFilter) {
  switch (filter) {
    case 'active':
      return !isCanceled(o.status) && !isDone(o.status);
    case 'paid':
      return isPaid(o.status) || isClientPaid(o.status);
    case 'done':
      return isDone(o.status);
    case 'canceled':
      return isCanceled(o.status);
    default:
      return true;
  }
}

async function showList(chatId: number, filter: ListFilter, page = 1) {
  const items = (await OrdersStore.all()).filter((o) => matches(o, filter));
  if (!items.length) {
    await send(chatId, `${LIST_TITLES[filter]}: пусто.`, buildMainMenu());
    return;
  }
  const perPage = 10;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const p = Math.min(Math.max(1, page), pages);
  const slice = items.slice((p - 1) * perPage, p * perPage);
  const text = [
    `${LIST_TITLES[filter]} (всего: ${items.length}, стр. ${p}/${pages})`,
    '',
    ...slice.map((o) => `#${o.id} | ${o.fromAmount} ₽ → ${o.toAmount} ${o.toCurrency} | ${o.status}`),
  ].join('\n');
  const nav: { text: string; callback_data: string }[] = [];
  if (p > 1) nav.push({ text: '⬅️ Назад', callback_data: `list:${filter}:${p - 1}` });
  if (p < pages) nav.push({ text: 'Вперёд ➡️', callback_data: `list:${filter}:${p + 1}` });
  await send(chatId, text, {
    inline_keyboard: [
      ...slice.map((o) => [{ text: `#${o.id} · ${o.fromAmount} ₽`, callback_data: `order:${o.id}` }]),
      nav.length ? nav : [{ text: '🔄 Обновить', callback_data: `list:${filter}:${p}` }],
      toMenu,
    ],
  });
}

async function showOrder(chatId: number, id: string) {
  const o = await OrdersStore.get(id);
  if (!o) {
    await send(chatId, `Заявка #${id} не найдена.`, buildMainMenu());
    return;
  }
  await send(chatId, formatOrder(o), orderKeyboard(o));
}

// ─── Order actions ───────────────────────────────────────────────────────────
async function updateOrderStatus(
  chatId: number,
  id: string,
  status: string,
  emailSubject: string,
  extra: Partial<ExchangeOrder> = {}
) {
  const o = await OrdersStore.get(id);
  if (!o) {
    await send(chatId, `Заявка #${id} не найдена.`);
    return;
  }
  if (isCanceled(o.status) || isDone(o.status)) {
    await send(chatId, `Заявка #${id} уже закрыта (${o.status}).`, orderKeyboard(o));
    return;
  }
  const updated: ExchangeOrder = { ...o, ...extra, status, lastStatusUpdate: nowStamp() };
  await OrdersStore.save(updated);
  await send(chatId, formatOrder(updated), orderKeyboard(updated));
  try {
    await sendOrderStatusEmail(updated.email, `Заявка #${updated.id}: ${emailSubject}`, {
      ...updated,
      siteUrl: getSiteUrl(),
    });
  } catch (e) {
    console.warn('Не удалось отправить email:', e);
  }
}

// ─── Rates & settings ────────────────────────────────────────────────────────
async function showRates(chatId: number, admin: boolean) {
  const rates = await getRates();
  const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  if (!admin) {
    const lines = [
      'Текущие курсы (с учётом наценки):',
      '',
      `BTC → RUB: ${nf.format(Math.round(getRateValue(rates, 'BTC', 'RUB')))} ₽`,
      `USDT → RUB: ${nf.format(getRateValue(rates, 'USDT', 'RUB'))} ₽`,
    ];
    await send(chatId, lines.join('\n'));
    return;
  }
  const lines = [
    'Курсы на сайте (₽ за 1 монету):',
    '',
    ...CURRENCIES.map((c) => {
      const r = rates[c];
      return r ? `${c}: ${nf.format(r.rub)} ₽ — ${r.manual ? 'вручную' : 'авто'}` : `${c}: —`;
    }),
  ];
  await send(chatId, lines.join('\n'), {
    inline_keyboard: [
      ...CURRENCIES.map((c) => [{ text: `✏️ Изменить ${c}`, callback_data: `rates:edit:${c}` }]),
      [{ text: '🔄 Вернуть авто-курсы с биржи', callback_data: 'rates:auto' }],
      toMenu,
    ],
  });
}

async function showPaymentDetails(chatId: number) {
  await send(chatId, `Реквизиты для оплаты, которые видят клиенты:\n\n${await getPaymentDetails()}`, {
    inline_keyboard: [[{ text: '✏️ Изменить реквизиты', callback_data: 'req:edit' }], toMenu],
  });
}

// ─── Pending input from admin ────────────────────────────────────────────────
async function handlePendingInput(chatId: number, text: string): Promise<boolean> {
  const pending = await getPending(chatId);
  if (!pending) return false;

  if (text === '/cancel') {
    await clearPending(chatId);
    await send(chatId, 'Ввод отменён.', buildMainMenu());
    return true;
  }

  if (pending.type === 'edit_rate') {
    const parsed = Number(text.replace(/[^\d,.]/g, '').replace(',', '.'));
    if (!text || !Number.isFinite(parsed) || parsed <= 0) {
      await send(chatId, 'Не удалось распознать число. Введите курс ещё раз или /cancel.');
      return true;
    }
    await setManualRate(pending.currency, parsed);
    await clearPending(chatId);
    await send(chatId, `Курс ${pending.currency} установлен вручную: ${parsed} ₽`);
    await showRates(chatId, true);
    return true;
  }

  if (pending.type === 'edit_payment_details') {
    const value = text.trim();
    if (!value || value.length > 500) {
      await send(chatId, 'Реквизиты должны быть непустыми и не длиннее 500 символов. Попробуйте ещё раз или /cancel.');
      return true;
    }
    await setPaymentDetails(value);
    await clearPending(chatId);
    await send(chatId, 'Реквизиты обновлены. Они будут указаны во всех новых заявках.');
    await showPaymentDetails(chatId);
    return true;
  }

  if (pending.type === 'done') {
    await clearPending(chatId);
    const txLink = text === '/skip' ? undefined : text.trim().slice(0, 500);
    await updateOrderStatus(chatId, pending.orderId, STATUS.done, 'заявка выполнена', txLink ? { txLink } : {});
    return true;
  }

  return false;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat?.id as number;
      const text: string = String(update.message.text || '').trim();
      const admin = isAdmin(chatId);
      const cmd = text.toLowerCase().replace(/@\w+$/, '');

      if (!admin) {
        if (/^\/rates?$/.test(cmd)) {
          await showRates(chatId, false);
        } else {
          await send(chatId, 'Здравствуйте! Обмен доступен на сайте, вопросы — в поддержку.', {
            inline_keyboard: [[{ text: '🌐 Сайт', url: getSiteUrl() }], [{ text: '🆘 Поддержка', url: SUPPORT_URL }]],
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (await handlePendingInput(chatId, text)) return NextResponse.json({ ok: true });

      if (cmd === '/start' || cmd === '/menu' || cmd === 'menu') {
        await send(chatId, 'Панель администратора SberBits', buildMainMenu());
      } else if (/^\/rates?$/.test(cmd)) {
        await showRates(chatId, true);
      } else if (cmd === '/req') {
        await showPaymentDetails(chatId);
      } else if (cmd === '/help') {
        await send(chatId, HELP_TEXT, buildMainMenu());
      } else if (/^#?\d{6,20}$/.test(text)) {
        await showOrder(chatId, text.replace('#', ''));
      } else if (/^\/(orders|list)$/.test(cmd)) {
        await showList(chatId, 'active');
      } else if (cmd === '/paid') {
        await showList(chatId, 'paid');
      } else if (cmd === '/done') {
        await showList(chatId, 'done');
      } else if (/^\/cancell?ed$/.test(cmd)) {
        await showList(chatId, 'canceled');
      } else if (cmd === '/all') {
        await showList(chatId, 'all');
      } else {
        await send(chatId, 'Команда не распознана. Используйте меню ниже.', buildMainMenu());
      }
    } else if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id as number;
      const data: string = cq.data || '';
      const answer = (text?: string) =>
        bot.api.answerCallbackQuery(cq.id, text ? { text } : undefined).catch(() => {});

      if (!isAdmin(chatId)) {
        await answer('Действие доступно только администратору.');
        return NextResponse.json({ ok: true });
      }

      if (data === 'menu:main') {
        await clearPending(chatId);
        await send(chatId, 'Главное меню', buildMainMenu());
      } else if (data === 'menu:rates') {
        await showRates(chatId, true);
      } else if (data === 'menu:req') {
        await showPaymentDetails(chatId);
      } else if (data === 'menu:help') {
        await send(chatId, HELP_TEXT, buildMainMenu());
      } else if (data.startsWith('list:')) {
        const [, filter, pageStr] = data.split(':');
        const f = (filter in LIST_TITLES ? filter : 'active') as ListFilter;
        await showList(chatId, f, parseInt(pageStr || '1', 10) || 1);
      } else if (data.startsWith('order:')) {
        await showOrder(chatId, data.split(':')[1]);
      } else if (data.startsWith('act:paid:')) {
        await updateOrderStatus(chatId, data.split(':')[2], STATUS.paid, 'оплата получена');
      } else if (data.startsWith('act:done:')) {
        const id = data.split(':')[2];
        await setPending(chatId, { type: 'done', orderId: id });
        await send(chatId, `Отправьте ссылку или хэш транзакции для заявки #${id}.\n/skip — без ссылки, /cancel — отмена.`);
      } else if (data.startsWith('act:cancel:')) {
        await updateOrderStatus(chatId, data.split(':')[2], STATUS.canceledByAdmin, 'отменена администратором');
      } else if (data.startsWith('rates:edit:')) {
        const currency = data.split(':')[2];
        if ((CURRENCIES as readonly string[]).includes(currency)) {
          await setPending(chatId, { type: 'edit_rate', currency });
          await send(chatId, `Введите новый курс ${currency} в рублях за 1 монету (например 4200000).\n/cancel — отмена.`);
        }
      } else if (data === 'rates:auto') {
        await resetToAutoRates();
        await send(chatId, 'Курсы снова обновляются автоматически с биржи.');
        await showRates(chatId, true);
      } else if (data === 'req:edit') {
        await setPending(chatId, { type: 'edit_payment_details' });
        await send(chatId, 'Отправьте новые реквизиты для оплаты (ссылку или номер карты с банком).\n/cancel — отмена.');
      }

      await answer();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Telegram webhook error:', e);
    // 200, чтобы Telegram не повторял один и тот же апдейт бесконечно
    return NextResponse.json({ ok: true });
  }
}
