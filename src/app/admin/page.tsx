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
  const [credentials, setCredentials] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!credentials) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', { headers: { Authorization: `Basic ${credentials}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Неверный логин или пароль' : 'Ошибка загрузки');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(id: string, nextStatus: string) {
    if (!credentials) return;
    const response = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    if (!response.ok) {
      setError('Не удалось изменить статус');
      return;
    }
    await load();
  }

  if (!credentials) {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
        <h1>SberBits Admin</h1>
        <p>Введите данные администратора из ADMIN_LOGIN / ADMIN_PASSWORD.</p>
        <input placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 10 }} />
        <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 10 }} />
        <button onClick={() => setCredentials(btoa(`${login}:${password}`))} style={{ padding: '10px 16px' }}>Войти</button>
      </main>
    );
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
