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
  txLink?: string;
  createdAt: string;
  lastStatusUpdate: string;
}

const isUrl = (v?: string) => !!v && /^https?:\/\//i.test(v.trim());

function LinkOrText({ value }: { value?: string }) {
  const v = value?.trim() ?? '';
  if (!isUrl(v)) return <span className="break-all font-medium">{v}</span>;
  return (
    <a href={v} target="_blank" rel="noreferrer noopener" className="underline break-all" style={{ color: 'var(--accent)' }}>
      {v}
    </a>
  );
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
      const response = await fetch(`/api/exchange/${orderId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при получении данных заявки');
      }
      
      setOrder(data);
    } catch (error) {
      console.error('Ошибка при получении статуса:', error);
      // Не обновляем состояние заказа при ошибке
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderStatus();

    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(fetchOrderStatus, 30000); // Обновление каждые 30 секунд
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchOrderStatus, autoRefresh]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/40"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center text-red-600">
        Заявка не найдена
      </div>
    );
  }

  const handlePaymentConfirm = async () => {
    try {
      const response = await fetch(`/api/exchange/${orderId}/confirm`, {
        method: 'POST',
      });
      
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Ошибка при подтверждении оплаты');
      }
      if (result?.order) setOrder(result.order);
      else fetchOrderStatus();
    } catch (error) {
      console.error('Ошибка:', error);
      alert(error instanceof Error ? error.message : 'Произошла ошибка при подтверждении оплаты');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить заявку?')) {
      return;
    }

    try {
      const response = await fetch(`/api/exchange/${orderId}/cancel`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.error || 'Ошибка при отмене заявки');
      }

      fetchOrderStatus();
    } catch (error) {
      console.error('Ошибка:', error);
      alert(error instanceof Error ? error.message : 'Произошла ошибка при отмене заявки');
    }
  };

  const closed = /отмен|выполнена/i.test(order.status);
  const paymentReported = /оплачена|сообщил об оплате/i.test(order.status);
  const done = /выполнена/i.test(order.status);

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-2xl backdrop-blur">
      <h1 className="text-2xl font-bold mb-6">Заявка ID {order.id}</h1>
      {done && (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="font-semibold mb-2">Заявка выполнена</p>
          <p>Средства отправлены на указанный кошелёк.</p>
          {order.txLink && (
            <p className="mt-2">
              Транзакция: <LinkOrText value={order.txLink} />
            </p>
          )}
        </div>
      )}

      {!closed && paymentReported && (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="font-semibold mb-2">Оплата получена в обработку</p>
          <p>Идет проверка Вашего платежа и обработка заявки.</p>
          <p className="mt-4">Это занимает от 15 до 90 минут (в зависимости от загрузки).</p>
          <p>Ссылка на транзакцию появится на этой странице и будет продублирована Вам на почту, указанную в заявке.</p>
        </div>
      )}

      {!closed && !paymentReported && (
        <div className="mb-6 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] p-6">
          <h2 className="text-xl font-semibold mb-4">Как оплатить</h2>
          <ol className="list-decimal list-inside space-y-2 mb-4">
            <li>
              Переведите сумму <strong>{order.fromAmount} ₽</strong> по реквизитам:
              <div className="mt-1">
                <LinkOrText value={order.paymentDetails} />
              </div>
            </li>
            <li>Нажмите на кнопку <strong>&quot;Я оплатил заявку&quot;</strong></li>
            <li>Ожидайте обработку заявки оператором</li>
          </ol>
        </div>
      )}

  <div className="space-y-4 mb-6">
        <div className="flex justify-between">
          <span className="font-medium">Отдаете:</span>
          <span>{order.fromAmount} {order.fromCurrency}</span>
        </div>
        {order.fromAccount && (
          <div className="flex justify-between">
            <span className="font-medium">Со счета:</span>
            <span>{order.fromAccount}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="font-medium">Получаете:</span>
          <span>{order.toAmount} {order.toCurrency}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">На счет:</span>
          <span className="break-all">{order.toAccount}</span>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="text-sm text-[var(--sb-muted)]">Время изменения статуса: {order.lastStatusUpdate}</div>
        <div className="font-medium">
          Статус заявки: {order.status}
        </div>
      </div>

      {!closed && !paymentReported && (
        <div className="flex space-x-4">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border rounded"
            style={{ color: 'var(--danger, #dc2626)', borderColor: 'var(--danger, #dc2626)' }}
          >
            Отменить заявку
          </button>
          <button
            onClick={handlePaymentConfirm}
            className="px-4 py-2 rounded"
            style={{ background: 'var(--success, #16a34a)', color: '#fff' }}
          >
            Я оплатил заявку
          </button>
        </div>
      )}

      <div className="mt-6 text-sm text-[var(--sb-muted)]">
        <div className="flex items-center justify-between">
          <span>Страница обновляется каждые 30 секунд.</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {autoRefresh ? 'Выключить обновление' : 'Включить обновление'}
          </button>
        </div>
      </div>
    </div>
  );
}
