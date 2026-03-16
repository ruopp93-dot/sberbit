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

// Bank quick-pay buttons
const BANK_BUTTONS = [
  {
    name: 'Тинькофф',
    bg: '#FFDD00',
    fg: '#000000',
    scheme: 'tinkoff://transfer?phone=',
    intentPackage: 'com.idamob.tinkoff.android',
    icon: (
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="18" fill="rgba(0,0,0,0.2)" />
        <text x="18" y="25" textAnchor="middle" fontSize="17" fontWeight="800" fill="#000" fontFamily="Arial, sans-serif">T</text>
      </svg>
    ),
  },
  {
    name: 'Сбербанк',
    bg: '#1DA462',
    fg: '#ffffff',
    scheme: 'sberbankonline://p2ptransfer?phone=',
    intentPackage: 'ru.sberbankmobile',
    icon: (
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="18" fill="rgba(0,0,0,0.15)" />
        <circle cx="18" cy="18" r="9" stroke="#fff" strokeWidth="2" fill="none" />
        <path d="M13 18l3.5 3.5L23 13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: 'ВТБ',
    bg: '#009FDF',
    fg: '#ffffff',
    scheme: 'vtbmobile://transfer?phone=',
    intentPackage: 'ru.vtb24.mobilebanking.android',
    icon: (
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="18" fill="rgba(0,0,0,0.15)" />
        <rect x="10" y="13" width="16" height="2.5" rx="1.25" fill="#fff" />
        <rect x="10" y="17.5" width="16" height="2.5" rx="1.25" fill="#fff" />
        <rect x="10" y="22" width="16" height="2.5" rx="1.25" fill="#fff" />
      </svg>
    ),
  },
  {
    name: 'Альфа-Банк',
    bg: '#EF3124',
    fg: '#ffffff',
    scheme: 'alfabank://payment?phone=',
    intentPackage: 'ru.alfabank.mobile.android',
    icon: (
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
        <rect width="36" height="36" rx="18" fill="rgba(0,0,0,0.15)" />
        <text x="18" y="25" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">А</text>
      </svg>
    ),
  },
];

function getBankDeepLink(scheme: string, intentPackage: string, rawPhone: string): string {
  // Normalize phone to +7XXXXXXXXXX format
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  const formattedPhone = encodeURIComponent('+' + digits);

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    // Chrome on Android requires intent:// format to open native apps
    const schemePart = scheme.split('://')[0];
    const pathAndQuery = scheme.split('://')[1] ?? '';
    return `intent://${pathAndQuery}${formattedPhone}#Intent;scheme=${schemePart};package=${intentPackage};end`;
  }
  return `${scheme}${formattedPhone}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 rounded-lg p-2 transition-colors"
      style={{ color: copied ? '#34d399' : 'rgba(232,237,246,0.5)' }}
      title="Скопировать"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
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
      <div
        className="flex items-center gap-3 rounded-2xl px-5 py-4"
        style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)' }}
      >
        <span className="font-semibold text-red-400">Время оплаты истекло</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-5 py-4"
      style={{ background: 'rgba(127,0,0,0.25)', border: '1px solid rgba(220,38,38,0.3)' }}
    >
      <div className="flex items-center gap-1">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
          style={{ background: '#dc2626' }}
        >
          {String(mins).padStart(2, '0')}
        </span>
        <span className="text-lg font-bold text-red-400 px-0.5">:</span>
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
          style={{ background: '#dc2626' }}
        >
          {String(secs).padStart(2, '0')}
        </span>
      </div>
      <span className="text-sm text-[var(--foreground)]">Осталось для оплаты</span>
    </div>
  );
}

function InfoCard({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <div className="mb-1 text-xs" style={{ color: 'rgba(232,237,246,0.55)' }}>{label}</div>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[var(--foreground)]">{value}</span>
        {copyable && <CopyButton text={value} />}
      </div>
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
      {/* Amount header banner */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #3d1d8c 0%, #2a1260 50%, #1a0a40 100%)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <div className="px-5 py-6 text-center">
          <div className="mb-2 text-sm font-medium" style={{ color: 'rgba(196,170,255,0.8)' }}>К оплате</div>
          <div className="text-5xl font-bold text-white tracking-tight">
            {order.fromAmount}
          </div>
          <div className="mt-1 text-xl font-semibold" style={{ color: 'rgba(196,170,255,0.9)' }}>RUB</div>
        </div>
      </div>

      {/* Status banners */}
      {isPaid && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}
        >
          <p className="font-semibold text-emerald-400">Заявка оплачена</p>
          <p className="mt-1 text-sm" style={{ color: 'rgba(232,237,246,0.65)' }}>
            Идёт проверка платежа и обработка заявки. Это занимает 15–90 минут.
          </p>
        </div>
      )}
      {isCanceled && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)' }}
        >
          <p className="font-semibold text-red-400">Заявка отменена</p>
        </div>
      )}

      {/* Payment instructions (only while pending) */}
      {!isPaid && !isCanceled && (
        <>
          <PaymentTimer orderId={orderId} />

          {phone && <InfoCard label="Телефон для перевода" value={phone} copyable />}
          <InfoCard label="Сумма к переводу" value={`${order.fromAmount} RUB`} copyable />
          {order.paymentRecipient && <InfoCard label="Получатель" value={order.paymentRecipient} />}
          {order.paymentBank && <InfoCard label="Банк" value={order.paymentBank} />}

          {/* Quick pay bank buttons */}
          {rawPhone && (
            <div className="space-y-2 pt-1">
              {BANK_BUTTONS.map((btn) => (
                <a
                  key={btn.name}
                  href={getBankDeepLink(btn.scheme, btn.intentPackage, rawPhone)}
                  className="flex items-center justify-between rounded-2xl px-5 py-4 font-semibold transition-opacity hover:opacity-90 active:opacity-80"
                  style={{ background: btn.bg, color: btn.fg }}
                >
                  <div>
                    <div className="text-base font-bold">Оплатить</div>
                    <div className="text-xs opacity-75">В 1 клик</div>
                  </div>
                  {btn.icon}
                </a>
              ))}
            </div>
          )}

          {/* Confirm / Cancel */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleCancel}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                border: '1px solid rgba(220,38,38,0.5)',
                color: '#f87171',
                background: 'rgba(220,38,38,0.08)',
              }}
            >
              Отменить
            </button>
            <button
              onClick={handlePaymentConfirm}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(180deg, #3ecb6f 0%, #1a9e4a 100%)' }}
            >
              Я оплатил
            </button>
          </div>
        </>
      )}

      {/* Order summary */}
      <div
        className="rounded-2xl px-5 py-4 text-sm"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="space-y-2">
          <div className="flex justify-between">
            <span style={{ color: 'rgba(232,237,246,0.55)' }}>Заявка</span>
            <span className="font-mono text-xs">#{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgba(232,237,246,0.55)' }}>Статус</span>
            <span className="max-w-[200px] text-right text-xs">{order.status}</span>
          </div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex justify-between">
            <span style={{ color: 'rgba(232,237,246,0.55)' }}>Отдаёте</span>
            <span>{order.fromAmount} {order.fromCurrency}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgba(232,237,246,0.55)' }}>Получаете</span>
            <span>{order.toAmount} {order.toCurrency}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgba(232,237,246,0.55)' }}>Кошелёк</span>
            <span className="max-w-[200px] break-all text-right text-xs">{order.toAccount}</span>
          </div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex justify-between text-xs" style={{ color: 'rgba(232,237,246,0.4)' }}>
            <span>Обновлено</span>
            <span>{order.lastStatusUpdate}</span>
          </div>
        </div>
      </div>

      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between px-1 text-xs" style={{ color: 'rgba(232,237,246,0.4)' }}>
        <span>Обновляется каждые 30 сек.</span>
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
