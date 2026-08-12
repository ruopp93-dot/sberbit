'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Order = {
  id: string;
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  toAmount: string;
  walletAddress: string;
  contact?: string | null;
  exchangeStatus: string;
  paymentStatus: string;
  paymentUrl?: string | null;
  payment?: { service: string; externalId: string | null; status: string; amount: string } | null;
  statusHistory: { id: string; from: string | null; to: string; actor: string | null; note: string | null; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
};

const statuses = [
  ['CREATED', 'Создана'],
  ['AWAITING_PAYMENT', 'Ожидает оплаты'],
  ['PAID', 'Оплачено'],
  ['PROCESSING', 'В обработке'],
  ['COMPLETED', 'Выполнено'],
  ['CANCELLED', 'Отменено'],
] as const;

const statusLabel = Object.fromEntries(statuses);

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = status ? `/api/admin/orders?status=${encodeURIComponent(status)}` : '/api/admin/orders';
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Требуется авторизация' : 'Ошибка загрузки');
      const data = await response.json();
      setOrders(data.orders || []);
      setSelectedId(current => current && (data.orders || []).some((o: Order) => o.id === current) ? current : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter(order =>
      [order.id, order.contact || '', order.walletAddress, order.payment?.externalId || '']
        .some(value => value.toLowerCase().includes(needle))
    );
  }, [orders, query]);

  const selected = orders.find(order => order.id === selectedId) || null;

  async function changeStatus(id: string, nextStatus: string) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus, note: note.trim() || undefined }),
      });
      if (!response.ok) throw new Error('Не удалось изменить статус');
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 1500, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>SberBits — админ-панель</h1>
          <div style={{ color: '#6b7280' }}>Всего заявок: {orders.length}</div>
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db' }}>
          {loading ? 'Обновление…' : 'Обновить'}
        </button>
      </header>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск: ID, email, кошелек, payment ID" style={{ minWidth: 320, flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }}>
          <option value="">Все статусы</option>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </section>

      {error && <div style={{ padding: 12, marginBottom: 16, color: '#991b1b', background: '#fee2e2', borderRadius: 8 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0, 1fr) 420px' : '1fr', gap: 20 }}>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: 12 }}>ID</th><th style={{ padding: 12 }}>Сумма</th><th style={{ padding: 12 }}>Получает</th><th style={{ padding: 12 }}>Оплата</th><th style={{ padding: 12 }}>Статус</th><th style={{ padding: 12 }}>Дата</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} onClick={() => setSelectedId(order.id)} style={{ cursor: 'pointer', background: selectedId === order.id ? '#f3f4f6' : undefined, borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 12, fontFamily: 'monospace' }}>{order.id.slice(0, 10)}…</td>
                  <td style={{ padding: 12 }}>{order.amount} {order.fromCurrency}</td>
                  <td style={{ padding: 12 }}>{order.toAmount} {order.toCurrency}</td>
                  <td style={{ padding: 12 }}>{order.paymentStatus}<br /><small>{order.payment?.externalId || '—'}</small></td>
                  <td style={{ padding: 12 }}>{statusLabel[order.exchangeStatus] || order.exchangeStatus}</td>
                  <td style={{ padding: 12 }}>{new Date(order.createdAt).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 24, color: '#6b7280' }}>Заявок не найдено.</div>}
        </div>

        {selected && (
          <aside style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Заявка</h2>
              <button onClick={() => setSelectedId(null)} style={{ border: 0, background: 'transparent', fontSize: 20 }}>×</button>
            </div>
            <dl style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <div><dt style={{ color: '#6b7280' }}>ID</dt><dd style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{selected.id}</dd></div>
              <div><dt style={{ color: '#6b7280' }}>Клиент</dt><dd>{selected.contact || '—'}</dd></div>
              <div><dt style={{ color: '#6b7280' }}>Отдает</dt><dd>{selected.amount} {selected.fromCurrency}</dd></div>
              <div><dt style={{ color: '#6b7280' }}>Получает</dt><dd>{selected.toAmount} {selected.toCurrency}</dd></div>
              <div><dt style={{ color: '#6b7280' }}>Кошелек</dt><dd style={{ wordBreak: 'break-all' }}>{selected.walletAddress}</dd></div>
              <div><dt style={{ color: '#6b7280' }}>Payment ID</dt><dd style={{ wordBreak: 'break-all' }}>{selected.payment?.externalId || '—'}</dd></div>
              <div><dt style={{ color: '#6b7280' }}>Создана</dt><dd>{new Date(selected.createdAt).toLocaleString('ru-RU')}</dd></div>
            </dl>

            {selected.paymentUrl && <a href={selected.paymentUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 14 }}>Открыть оплату Pally</a>}

            <div style={{ marginTop: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Новый статус</label>
              <select value={selected.exchangeStatus} onChange={e => void changeStatus(selected.id, e.target.value)} disabled={saving} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }}>
                {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Комментарий к изменению статуса" maxLength={500} rows={3} style={{ width: '100%', marginTop: 10, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, resize: 'vertical' }} />
            </div>

            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>История</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {selected.statusHistory.map(entry => (
                  <div key={entry.id} style={{ padding: 10, borderRadius: 8, background: '#f9fafb', fontSize: 13 }}>
                    <div><strong>{entry.from || '—'} → {entry.to}</strong> · {entry.actor || 'system'}</div>
                    <div>{entry.note || '—'}</div>
                    <div style={{ color: '#6b7280', marginTop: 4 }}>{new Date(entry.createdAt).toLocaleString('ru-RU')}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
