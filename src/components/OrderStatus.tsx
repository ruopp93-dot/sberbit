"use client";

import { useCallback, useEffect, useState } from 'react';

interface ExchangeOrder {
  id: string;
  status: string;
  fromAmount: string;
  fromCurrency: string;
  fromAccount?: string;
  toAmount: string;
  toCurrency: string;
  toAccount: string;
  paymentDetails: string;
  paymentPhone?: string;
  paymentRecipient?: string;
  paymentBank?: string;
  createdAt: string;
  lastStatusUpdate: string;
}

const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

const BANK_BUTTONS = [
  { name: 'Тинькофф', bg: '#FFDD00', fg: '#000', icon: 'T', scheme: 'tinkoff://transfer?phone=' },
  { name: 'Сбербанк', bg: '#21A038', fg: '#fff', icon: 'S', scheme: 'sberbankonline://payment?phone=' },
  { name: 'ВТБ', bg: '#009FDF', fg: '#fff', icon: '≡', scheme: 'vtbmobile://transfer?phone=' },
  { name: 'Альфа-Банк', bg: '#EF3124', fg: '#fff', icon: 'A', scheme: 'alfabank://payment?phone=' },
] as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 rounded-lg p-2 text-[var(--sb-muted)] hover:bg-white/10 hover:text-[var(--foreground)] transition-colors"
      title="Скопировать"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function PaymentTimer({ orderId }: { orderId: string }) {
  const expiresAt = parseInt(orderId, 10) + PAYMENT_TIMEOUT_MS;
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(Math.max(0, expiresAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);

  if (timeLeft === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-900/20 px-5 py-4">
        <span className="font-semibold text-red-400">Время оплаты истекло</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-900/20 px-5 py-4">
      <div className="flex items-center gap-1">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-lg font-bold text-white">
          {String(mins).padStart(2, '0')}
        </span>
        <span className="text-lg font-bold text-red-400 px-0.5">:</span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-lg font-bold text-white">
          {String(secs).padStart(2, '0')}
        </span>
      </div>
      <span className="text-sm text-[var(--foreground)]">Осталось для оплаты</span>
    </div>
  );
}

export function OrderStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<ExchangeOrder | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchOrderStatus = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    try {
      const response = await fetch(`/api/exchange/${orderId}`);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          try {
            const raw = localStorage.getItem(`order:${orderId}`);
            if (raw) { setOrder(JSON.parse(raw)); return; }
          } catch { /* ignore */ }
        }
        throw new Error(data.error || 'Ошибка получения заявки');
      }
      setOrder(data);
    } catch (error) {
      console.error('Ошибка при получении статуса:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderStatus();
    if (!autoRefresh) return;
    const id = setInterval(fetchOrderStatus, 30000);
    return () => clearInterval(id);
  }, [fetchOrderStatus, autoRefresh]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white/40" />
      </div>
    );
  }

  if (!order) {
    return <div className="mx-auto max-w-md py-16 text-center text-red-400">Заявка не найдена</div>;
  }

  const handlePaymentConfirm = async () => {
    try {
      const response = await fetch(`/api/exchange/${orderId}/confirm`, { method: 'POST' });
      if (!response.ok) {
        if (response.status === 404 && order) {
          const now = new Date();
          const updated = {
            ...order,
            status: 'Заявка оплачена — идет проверка платежа и обработка заявки',
            lastStatusUpdate: `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          };
          setOrder(updated);
          try { localStorage.setItem(`order:${orderId}`, JSON.stringify(updated)); } catch { /* ignore */ }
          return;
        }
        throw new Error('Ошибка подтверждения');
      }
      const result = await response.json();
      if (result?.order) {
        setOrder(result.order);
        try { localStorage.setItem(`order:${orderId}`, JSON.stringify(result.order)); } catch { /* ignore */ }
      } else {
        fetchOrderStatus();
      }
    } catch {
      alert('Произошла ошибка при подтверждении оплаты');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить заявку?')) return;
    try {
      const response = await fetch(`/api/exchange/${orderId}/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error('Ошибка');
      fetchOrderStatus();
    } catch {
      alert('Произошла ошибка при отмене заявки');
    }
  };

  const isPaid = /оплачена/i.test(order.status);
  const isCanceled = /отмен/i.test(order.status);
  const phone = order.paymentPhone || order.paymentDetails || '';
  const rawPhone = phone.replace(/\D/g, '');

  return (
    <div className="mx-auto max-w-md space-y-3">
      {/* Amount header */}
      <div
        className="overflow-hidden rounded-2xl border border-purple-500/20"
        style={{ background: 'linear-gradient(135deg, #2d1f5e 0%, #1a1040 100%)' }}
      >
        <div className="px-5 py-6 text-center">
          <div className="mb-1 text-sm text-purple-300/80">К оплате</div>
          <div className="text-4xl font-bold text-white">
            {order.fromAmount}{' '}
            <span className="text-2xl font-semibold text-purple-200">RUB</span>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isPaid && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4">
          <p className="font-semibold text-emerald-400">Заявка оплачена</p>
          <p className="mt-1 text-sm text-[var(--sb-muted)]">
            Идёт проверка платежа и обработка заявки. Это занимает 15–90 минут.
          </p>
        </div>
      )}
      {isCanceled && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4">
          <p className="font-semibold text-red-400">Заявка отменена</p>
        </div>
      )}

      {/* Timer + Payment details (only if pending) */}
      {!isPaid && !isCanceled && (
        <>
          <PaymentTimer orderId={orderId} />

          {/* Phone */}
          {phone && (
            <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] px-5 py-4">
              <div className="mb-1 text-xs text-[var(--sb-muted)]">Телефон для перевода</div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{phone}</span>
                <CopyButton text={phone} />
              </div>
            </div>
          )}

          {/* Amount to transfer */}
          <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] px-5 py-4">
            <div className="mb-1 text-xs text-[var(--sb-muted)]">Сумма к переводу</div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{order.fromAmount} RUB</span>
              <CopyButton text={order.fromAmount} />
            </div>
          </div>

          {/* Recipient */}
          {order.paymentRecipient && (
            <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] px-5 py-4">
              <div className="mb-1 text-xs text-[var(--sb-muted)]">Получатель</div>
              <div className="text-base font-semibold">{order.paymentRecipient}</div>
            </div>
          )}

          {/* Bank */}
          {order.paymentBank && (
            <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] px-5 py-4">
              <div className="mb-1 text-xs text-[var(--sb-muted)]">Банк</div>
              <div className="text-base font-semibold">{order.paymentBank}</div>
            </div>
          )}

          {/* Quick pay buttons */}
          {rawPhone && (
            <div className="space-y-2">
              {BANK_BUTTONS.map((btn) => (
                <a
                  key={btn.name}
                  href={`${btn.scheme}${rawPhone}`}
                  className="flex items-center justify-between rounded-2xl px-5 py-4 font-semibold transition-opacity hover:opacity-90 active:opacity-80"
                  style={{ background: btn.bg, color: btn.fg }}
                >
                  <div>
                    <div className="text-base">Оплатить</div>
                    <div className="text-xs opacity-80">В 1 клик</div>
                  </div>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  >
                    {btn.icon}
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* Confirm / Cancel */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              Отменить заявку
            </button>
            <button
              onClick={handlePaymentConfirm}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--success)' }}
            >
              Я оплатил заявку
            </button>
          </div>
        </>
      )}

      {/* Order summary */}
      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] px-5 py-4 text-sm">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--sb-muted)]">Заявка</span>
            <span>#{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--sb-muted)]">Статус</span>
            <span className="max-w-[200px] text-right">{order.status}</span>
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex justify-between">
            <span className="text-[var(--sb-muted)]">Отдаёте</span>
            <span>{order.fromAmount} {order.fromCurrency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--sb-muted)]">Получаете</span>
            <span>{order.toAmount} {order.toCurrency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--sb-muted)]">Кошелёк</span>
            <span className="max-w-[200px] break-all text-right text-xs">{order.toAccount}</span>
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex justify-between text-xs text-[var(--sb-muted-2)]">
            <span>Обновлено</span>
            <span>{order.lastStatusUpdate}</span>
          </div>
        </div>
      </div>

      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between px-1 text-xs text-[var(--sb-muted-2)]">
        <span>Страница обновляется каждые 30 сек.</span>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {autoRefresh ? 'Отключить' : 'Включить'}
        </button>
      </div>
    </div>
  );
}
