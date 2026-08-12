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
  paymentUrl?: string | null;
  createdAt: string;
  lastStatusUpdate: string;
}

export function OrderStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<ExchangeOrder | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchOrderStatus = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/exchange/${orderId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка при получении данных заявки');
      setOrder(data);
    } catch (error) {
      console.error('Ошибка при получении статуса:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchOrderStatus();
    let intervalId: NodeJS.Timeout | undefined;
    if (autoRefresh) intervalId = setInterval(() => void fetchOrderStatus(), 30000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchOrderStatus, autoRefresh]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/40" />
      </div>
    );
  }

  if (!order) return <div className="text-center text-red-600">Заявка не найдена</div>;

  const handlePaymentConfirm = async () => {
    try {
      const response = await fetch(`/api/exchange/${orderId}/confirm`, { method: 'POST' });
      if (!response.ok) throw new Error('Ошибка при подтверждении оплаты');
      await fetchOrderStatus();
      alert('Информация об оплате принята. Статус заявки изменит Pally после подтверждения платежа.');
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Произошла ошибка при подтверждении оплаты');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить заявку?')) return;
    try {
      const response = await fetch(`/api/exchange/${orderId}/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error('Ошибка при отмене заявки');
      await fetchOrderStatus();
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Произошла ошибка при отмене заявки');
    }
  };

  const paymentUrl = order.paymentUrl || order.paymentDetails;
  const paid = order.status.startsWith('Заявка оплачена');

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-2xl backdrop-blur">
      <h1 className="text-2xl font-bold mb-6">Заявка ID {order.id}</h1>
      <p className="mb-6 text-[var(--sb-muted)]">Оплата автоматически подтверждается платёжным сервисом Pally.</p>

      {paid && (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="font-semibold mb-2">Оплата подтверждена</p>
          <p>Заявка передана на обработку. Это занимает от 15 до 90 минут в зависимости от загрузки.</p>
        </div>
      )}

      {!paid && order.status !== 'CANCELLED' && (
        <div className="mb-6 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] p-6">
          <h2 className="text-xl font-semibold mb-4">Как оплатить</h2>
          <ol className="list-decimal list-inside space-y-2 mb-4">
            <li>
              Переведите указанную сумму <strong>{order.fromAmount} {order.fromCurrency}</strong> по ссылке Pally:
              <div className="mt-1">
                <a href={paymentUrl?.trim()} target="_blank" rel="noreferrer noopener" className="underline break-all" style={{ color: 'var(--accent)' }}>
                  {paymentUrl?.trim()}
                </a>
              </div>
            </li>
            <li>После оплаты Pally автоматически отправит уведомление на сервер.</li>
            <li>Страница обновит статус заявки автоматически.</li>
          </ol>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div className="flex justify-between"><span className="font-medium">Отдаете:</span><span>{order.fromAmount} {order.fromCurrency}</span></div>
        {order.fromAccount && <div className="flex justify-between"><span className="font-medium">Со счета:</span><span>{order.fromAccount}</span></div>}
        <div className="flex justify-between"><span className="font-medium">Получаете:</span><span>{order.toAmount} {order.toCurrency}</span></div>
        <div className="flex justify-between"><span className="font-medium">На счет:</span><span className="break-all">{order.toAccount}</span></div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="text-sm text-[var(--sb-muted)]">Время изменения статуса: {order.lastStatusUpdate}</div>
        <div className="font-medium">Статус заявки: {order.status}</div>
      </div>

      {!paid && order.status !== 'CANCELLED' && (
        <div className="flex space-x-4">
          <button onClick={handleCancel} className="px-4 py-2 border rounded" style={{ color: 'var(--danger, #dc2626)', borderColor: 'var(--danger, #dc2626)' }}>
            Отменить заявку
          </button>
          <button onClick={handlePaymentConfirm} className="px-4 py-2 rounded" style={{ background: 'var(--success, #16a34a)', color: '#fff' }}>
            Я оплатил заявку
          </button>
        </div>
      )}

      <div className="mt-6 text-sm text-[var(--sb-muted)]">
        <div className="flex items-center justify-between">
          <span>Страница обновляется каждые 30 секунд.</span>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className="hover:underline" style={{ color: 'var(--accent)' }}>
            {autoRefresh ? 'Выключить обновление' : 'Включить обновление'}
          </button>
        </div>
      </div>
    </div>
  );
}
