"use client";

import { useEffect, useState } from 'react';

type Rate = { currency: string; rub: number; lastUpdate: string };
type Rates = Record<string, Rate>;

export default function ExchangeRates() {
  const [rates, setRates] = useState<Rates>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRates = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/rates/proxy');
        const json = await res.json();
        if (!cancelled && json?.success && json.rates) {
          setRates(json.rates);
        }
      } catch (err) {
        console.error('fetchRates error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRates();
    const id = setInterval(fetchRates, 10_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-md px-1">
      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 shadow-xl backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Курсы обмена</h3>
          <span className="text-xs text-[var(--sb-muted-2)]">{loading ? 'Обновление…' : 'Актуально'}</span>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="text-sm text-[var(--sb-muted)]">Загрузка…</div>
          ) : Object.keys(rates).length === 0 ? (
            <div className="text-sm text-[var(--sb-muted)]">Курсы недоступны</div>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(rates).map(([ccy, r]) => (
                <div
                  key={ccy}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="text-sm font-semibold">{ccy} → RUB</div>
                  <div className="text-sm text-[var(--sb-muted)]">
                    {r.rub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ₽
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
