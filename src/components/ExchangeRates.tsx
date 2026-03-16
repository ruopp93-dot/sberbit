"use client";

import { useEffect, useState } from 'react';

type Rate = { currency: string; rub: number; lastUpdate: string };
type Rates = Record<string, Rate>;

const CRYPTO_LABELS: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'Tether USDT',
};

export default function ExchangeRates() {
  const [rates, setRates] = useState<Rates>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retries = 0;

    const fetchRates = async () => {
      if (cancelled) return;
      try {
        setError(false);
        const res = await fetch('/api/rates', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (json && typeof json === 'object' && !json.error && Object.keys(json).length > 0) {
          setRates(json);
          setLoading(false);
          return;
        }
        throw new Error('empty response');
      } catch {
        if (cancelled) return;
        retries++;
        if (retries < 3) {
          // retry after 2s
          setTimeout(fetchRates, 2000);
        } else {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchRates();
    const id = setInterval(() => { retries = 0; fetchRates(); }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-md px-1">
      <div
        className="rounded-2xl p-4 shadow-xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Курсы обмена</h3>
          <span className="text-xs" style={{ color: 'rgba(232,237,246,0.4)' }}>
            {loading ? 'Обновление…' : error ? 'Ошибка' : 'Актуально'}
          </span>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="space-y-2">
              {['BTC', 'ETH', 'USDT'].map(k => (
                <div key={k} className="h-10 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
              ))}
            </div>
          ) : error || Object.keys(rates).length === 0 ? (
            <div className="text-sm" style={{ color: 'rgba(232,237,246,0.5)' }}>
              Не удалось загрузить курсы. Попробуйте обновить страницу.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(rates).map(([ccy, r]) => (
                <div
                  key={ccy}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="text-sm font-semibold">
                    {CRYPTO_LABELS[ccy] ?? ccy}
                    <span className="ml-1.5 text-xs font-normal" style={{ color: 'rgba(232,237,246,0.5)' }}>{ccy}</span>
                  </div>
                  <div className="text-sm font-semibold">
                    {r.rub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
