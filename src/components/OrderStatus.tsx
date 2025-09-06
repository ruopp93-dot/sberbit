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
      const response = await fetch(`/api/exchange/${orderId}`);
      const data = await response.json();
      
      if (!response.ok) {
        // Fallback: пробуем достать заявку из localStorage, если сервер не нашёл (после рестарта)
        if (response.status === 404) {
          try {
            const raw = localStorage.getItem(`order:${orderId}`);
            if (raw) {
              const cached = JSON.parse(raw);
              setOrder(cached);
              return;
            }
          } catch (e) {
            // ignore parse errors
          }
        }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
      
      if (!response.ok) {
        // Если сервер не нашёл заявку (например, после рестарта) — обновим локально
        if (response.status === 404 && order) {
          const now = new Date();
          const updated = {
            ...order,
            status: 'Заявка оплачена — идет проверка платежа и обработка заявки',
            lastStatusUpdate: `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          };
          setOrder(updated);
          try {
            localStorage.setItem(`order:${orderId}`, JSON.stringify(updated));
          } catch {}
          return;
        }
        throw new Error('Ошибка при подтверждении оплаты');
      }
      const result = await response.json();
      if (result?.order) {
        setOrder(result.order);
        try {
          localStorage.setItem(`order:${orderId}`, JSON.stringify(result.order));
        } catch {}
      } else {
        fetchOrderStatus();
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Произошла ошибка при подтверждении оплаты');
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
        throw new Error('Ошибка при отмене заявки');
      }
      
      fetchOrderStatus();
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Произошла ошибка при отмене заявки');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 rounded-lg shadow-lg" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>Заявка ID {order.id}</h1>
      <p style={{ color: 'var(--foreground)', opacity: 0.85 }} className="mb-6">
        Данная операция производится в автоматическом режиме.
      </p>

      {order.status.startsWith('Заявка оплачена') && (
    <div className="mb-6 p-4 border border-green-300 rounded" style={{ background: 'rgba(16,185,129,0.06)', color: 'var(--foreground)' }}>
          <p className="font-semibold mb-2">Заявка оплачена</p>
          <p>Идет проверка Вашего платежа и обработка заявки.</p>
          <p className="mt-4 font-semibold">Заявка оплачена</p>
          <p>Идет проверка Вашего платежа и обработка заявки.</p>
          <p className="mt-4">Это занимает от 15 до 90 минут (в зависимости от загрузки).</p>
          <p>Ссылка на транзакция появится на этой странице и будет продублирована Вам на почту указанную в заявке.</p>
        </div>
      )}

  <div className="p-6 rounded-lg mb-6" style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--foreground)' }}>
        <h2 className="text-xl font-semibold mb-4">Как оплатить</h2>
        <ol className="list-decimal list-inside space-y-2 mb-4">
          <li>
            Переведите указанную сумму <strong>{order.fromAmount} {order.fromCurrency}</strong> по ссылке в сервис DonationAlerts:
            <div className="mt-1">
                  <a
                    href={order.paymentDetails?.trim()}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline break-all"
                    style={{ color: 'var(--accent, #2563eb)' }}
                  >
                    {order.paymentDetails?.trim()}
                  </a>
                </div>
          </li>
          <li>Нажмите на кнопку <strong>&quot;Я оплатил заявку&quot;</strong></li>
          <li>Ожидайте обработку заявки оператором</li>
        </ol>
      </div>

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
  <div className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
          Время изменения статуса: {order.lastStatusUpdate}
        </div>
        <div className="font-medium">
          Статус заявки: {order.status}
        </div>
      </div>

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

  <div className="mt-6 text-sm" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
      <div className="flex items-center justify-between">
          <span>Страница обновляется каждые 30 секунд.</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="hover:underline"
            style={{ color: 'var(--accent, #2563eb)' }}
          >
            {autoRefresh ? 'Выключить обновление' : 'Включить обновление'}
          </button>
        </div>
      </div>
    </div>
  );
}
