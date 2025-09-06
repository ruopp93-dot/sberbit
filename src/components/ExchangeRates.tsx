'use client';

import { useEffect, useState } from 'react';

interface Rate {
  currency: string;
  rub: number;
  lastUpdate: string;
}

interface Rates {
  [key: string]: Rate;
}

export default function ExchangeRates() {
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateRates = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/rates');
        const data = await response.json();
        setRates(data);
      } catch (error) {
        console.error('Ошибка при получении курсов:', error);
      } finally {
        setLoading(false);
      }
    };

    updateRates();
    const interval = setInterval(updateRates, 5 * 60 * 1000);

    // subscribe to server-sent events for realtime updates
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/rates/stream');
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setRates(data);
        } catch (e) {
          // ignore malformed
        }
      };
      es.onerror = () => {
        // on error, close
        try { es?.close(); } catch {};
        es = null;
      };
    } catch (e) {
      // ignore
    }

    return () => {
      clearInterval(interval);
      try { es?.close(); } catch {}
    };
  }, []);

  if (loading) {
    return <div className="text-center p-4" style={{ color: 'var(--foreground)' }}>Загрузка курсов...</div>;
  }

  if (!rates) {
    return <div className="text-center p-4" style={{ color: 'var(--foreground)' }}>Не удалось загрузить курсы</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
        <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--foreground)', opacity: 0.75 }}>
              Направление обмена
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--foreground)', opacity: 0.75 }}>
              Курс
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--foreground)', opacity: 0.75 }}>
              Обновлено
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rates).map(([currency, rate]) => (
            <tr key={currency}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {currency} → RUB
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)', opacity: 0.9 }}>
                {rate.rub.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8
                })} ₽
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)', opacity: 0.9 }}>
                {new Date(rate.lastUpdate).toLocaleString('ru-RU')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
