'use client';

import { useCallback, useEffect, useState } from 'react';

type Order = {
  id: string;
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  toAmount: string;
  walletAddress: string;
  exchangeStatus: string;
  paymentStatus: string;
  payment?: { service: string; externalId: string | null; status: string } | null;
  createdAt: string;
};

const statuses = ['CREATED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Требуется авторизация' : 'Ошибка загрузки');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(id: string, nextStatus: string) {
    const response = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    if (!response.ok) {
      setError('Не удалось изменить статус');
      return;
    }
    await load();
  }

  const visible = status ? orders.filter(o => o.exchangeStatus === status) : orders;

  return (
    <main style={{ maxWidth: 1400, margin: '30px auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <h1>SberBits — заявки</h1>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {loading && <p>Загрузка…</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>ID</th><th>Сумма</th><th>Получает</th><th>Оплата</th><th>Статус</th><th>Действие</th></tr></thead>
          <tbody>
            {visible.map(order => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.amount} {order.fromCurrency}</td>
                <td>{order.toAmount} {order.toCurrency}</td>
                <td>{order.paymentStatus} / {order.payment?.externalId || '—'}</td>
                <td>{order.exchangeStatus}</td>
                <td>
                  <select value={order.exchangeStatus} onChange={e => void changeStatus(order.id, e.target.value)}>
                    {statuses.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
