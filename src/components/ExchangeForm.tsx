"use client";

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Decimal from 'decimal.js';

function normalizeAmountInput(value: string): string {
  const v = String(value ?? '').trim().replace(/\s+/g, '');
  if (!v) return '';
  const hasComma = v.includes(',');
  const hasDot = v.includes('.');
  if (hasComma && hasDot) return v.replace(/,/g, '');
  if (hasComma && !hasDot) {
    const parts = v.split(',');
    if (parts.length === 2 && parts[1].length === 3) return parts[0] + parts[1];
    return v.replace(/,/g, '.');
  }
  if (hasDot && !hasComma) {
    const parts = v.split('.');
    if (parts.length === 2 && parts[1].length === 3) return parts[0] + parts[1];
  }
  return v;
}

function parsePositiveAmount(value: string): Decimal | null {
  const normalized = normalizeAmountInput(value).replace(/[^\d.]/g, '');
  if (!normalized) return null;
  try {
    const d = new Decimal(normalized);
    if (!d.isFinite() || d.lte(0)) return null;
    return d;
  } catch {
    return null;
  }
}

function formatNumber(value: string, opts: Intl.NumberFormatOptions) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString('ru-RU', opts);
}

const exchangeFormSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  amount: z
    .string()
    .trim()
    .min(1, 'Введите сумму')
    .refine((val) => parsePositiveAmount(val) !== null, { message: 'Должно быть числом больше 0' }),
  email: z.string().email('Неверный формат email'),
  walletAddress: z.string().min(1, 'Необходимо указать адрес кошелька'),
});

type ExchangeFormData = z.infer<typeof exchangeFormSchema>;

const paymentMethods = ['Tinkoff', 'Сбербанк', 'Альфа-Банк', 'ВТБ', 'МИР', 'СБП'];

const cryptoOptions = [
  { value: 'USDT-TRC20', ticker: 'USDT', label: 'Tether USDT' },
  { value: 'BTC', ticker: 'BTC', label: 'Bitcoin' },
  { value: 'ETH', ticker: 'ETH', label: 'Ethereum' },
] as const;

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CryptoIcon({ ticker }: { ticker: string }) {
  if (ticker === 'USDT') {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow"
        style={{ background: 'linear-gradient(180deg, #26a17b 0%, #1a8c66 100%)' }}
        aria-hidden="true"
      >
        ₮
      </span>
    );
  }
  if (ticker === 'BTC') {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow"
        style={{ background: 'linear-gradient(180deg, #f7931a 0%, #e07810 100%)' }}
        aria-hidden="true"
      >
        ₿
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow"
      style={{ background: 'linear-gradient(180deg, #627eea 0%, #4c6bd6 100%)' }}
      aria-hidden="true"
    >
      Ξ
    </span>
  );
}

export function ExchangeForm() {
  const [currentRate, setCurrentRate] = useState('0');
  const [estimatedAmount, setEstimatedAmount] = useState('0');
  const [isCalculating, setIsCalculating] = useState(false);
  const [stage, setStage] = useState<'quick' | 'details'>('quick');

  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeFormSchema),
    defaultValues: {
      fromCurrency: paymentMethods[0],
      toCurrency: cryptoOptions[0].value,
      amount: '',
      email: '',
      walletAddress: '',
    },
  });

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const amount = watch('amount');
  const fromCurrency = watch('fromCurrency');
  const toCurrency = watch('toCurrency');
  const walletAddress = watch('walletAddress');

  const selectedCrypto = cryptoOptions.find((o) => o.value === toCurrency) ?? cryptoOptions[0];
  const cryptoTicker = selectedCrypto.ticker;

  const calculateEstimate = useCallback(async (amountOverride?: string, toCurrencyOverride?: string) => {
    const rawAmount = amountOverride ?? amount;
    const rawToCurrency = toCurrencyOverride ?? toCurrency;
    if (!rawAmount || !rawToCurrency) return null;
    try {
      const response = await fetch('/api/rates');
      const rates = await response.json();
      const cryptoKey = rawToCurrency.split('-')[0];
      const cryptoRate = rates[cryptoKey];
      if (!cryptoRate) return null;
      const rateRubPerUnit = new Decimal(cryptoRate.rub);
      const amountDecimal = parsePositiveAmount(rawAmount);
      if (!amountDecimal) return null;
      return {
        amount: amountDecimal.dividedBy(rateRubPerUnit).toFixed(8),
        rate: rateRubPerUnit.toString(),
      };
    } catch {
      return null;
    }
  }, [amount, toCurrency]);

  useEffect(() => {
    const updateEstimate = async () => {
      if (!amount || !fromCurrency || !toCurrency || !parsePositiveAmount(amount)) {
        setEstimatedAmount('0');
        setCurrentRate('0');
        return;
      }
      setIsCalculating(true);
      try {
        const estimate = await calculateEstimate();
        if (estimate) {
          setEstimatedAmount(estimate.amount);
          setCurrentRate(estimate.rate);
        }
      } finally {
        setIsCalculating(false);
      }
    };
    updateEstimate();
  }, [amount, fromCurrency, toCurrency, calculateEstimate]);

  const fetchCaptcha = useCallback(async () => {
    const res = await fetch('/api/captcha');
    const json = await res.json();
    setCaptchaToken(json.token);
    setCaptchaQuestion(json.question);
    setCaptchaAnswer('');
  }, []);

  useEffect(() => {
    if (stage !== 'details') return;
    if (captchaToken && captchaQuestion) return;
    fetchCaptcha().catch(() => {});
  }, [stage, captchaToken, captchaQuestion, fetchCaptcha]);

  const onSubmit = async (data: ExchangeFormData) => {
    try {
      const normalizedAmount = normalizeAmountInput(data.amount).replace(/[^\d.]/g, '');
      const estimate = await calculateEstimate(normalizedAmount, data.toCurrency);
      if (!estimate) throw new Error('Не удалось рассчитать сумму обмена');

      if (!captchaToken) {
        const cRes = await fetch('/api/captcha');
        const cData = await cRes.json();
        setCaptchaToken(cData.token);
        setCaptchaQuestion(cData.question);
        alert('Пожалуйста, введите ответ на капчу и повторите отправку.');
        return;
      }
      if (!captchaAnswer.trim()) {
        alert('Пожалуйста, введите ответ на капчу.');
        (document.querySelector('input[placeholder="Ответ"]') as HTMLInputElement | null)?.focus();
        return;
      }

      const response = await fetch('/api/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          amount: normalizedAmount,
          estimatedAmount: estimate.amount,
          exchangeRate: estimate.rate,
          captchaToken,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result && typeof result.message === 'string' && /капч/i.test(result.message)) {
          try {
            const cRes = await fetch('/api/captcha');
            if (cRes.ok) {
              const cData = await cRes.json();
              setCaptchaToken(cData.token);
              setCaptchaQuestion(cData.question);
              setCaptchaAnswer('');
            }
          } catch { /* ignore */ }
          alert(result.message + '. Капча обновлена — введите новый ответ.');
          return;
        }
        throw new Error(result.message || 'Ошибка при создании заявки');
      }

      try {
        const serverOrder = result.order;
        if (serverOrder) {
          localStorage.setItem(`order:${serverOrder.id}`, JSON.stringify(serverOrder));
        }
      } catch { /* ignore */ }

      window.location.href = `/order/${result.orderId}`;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Произошла ошибка. Попробуйте позже.');
    }
  };

  const goToDetails = async () => {
    const ok = await trigger(['fromCurrency', 'toCurrency', 'amount']);
    if (ok) setStage('details');
  };

  return (
    <div
      className="rounded-2xl shadow-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <form
        className="p-5 space-y-3"
        onSubmit={(e) => {
          if (stage !== 'details') { e.preventDefault(); void goToDetails(); return; }
          void handleSubmit(onSubmit)(e);
        }}
      >
        {/* FROM row */}
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Russian flag */}
          <span
            className="h-7 w-10 shrink-0 rounded-sm overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            aria-hidden="true"
          >
            <div style={{ height: '33.33%', background: '#fff' }} />
            <div style={{ height: '33.33%', background: '#003DA5' }} />
            <div style={{ height: '33.33%', background: '#CC0000' }} />
          </span>
          <div className="relative flex-1 min-w-0">
            <select
              {...register('fromCurrency')}
              className="w-full appearance-none bg-transparent pr-6 text-base font-semibold text-[var(--foreground)] outline-none cursor-pointer"
            >
              {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sb-muted-2)]" />
          </div>
          {/* Amount input */}
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 cursor-text"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <input
              type="text"
              inputMode="decimal"
              {...register('amount')}
              className="w-24 bg-transparent text-right text-lg font-bold text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)]"
              placeholder="50 000"
            />
            <span className="text-sm font-semibold" style={{ color: 'rgba(232,237,246,0.6)' }}>₽</span>
          </div>
        </div>
        {errors.amount && <p className="text-xs text-red-400 -mt-1 px-1">{errors.amount.message}</p>}

        {/* Divider */}
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'rgba(232,237,246,0.3)' }}>
            <path d="M5 11V3m0 0L2 6m3-3l3 3M11 5v8m0 0l3-3m-3 3l-3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* TO row */}
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <CryptoIcon ticker={cryptoTicker} />
          <div className="relative flex-1 min-w-0">
            <select
              {...register('toCurrency')}
              className="w-full appearance-none bg-transparent pr-6 text-base font-semibold text-[var(--foreground)] outline-none cursor-pointer"
            >
              {cryptoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sb-muted-2)]" />
          </div>
          {/* Estimated output */}
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-sm" style={{ color: 'rgba(232,237,246,0.5)' }}>≈</span>
            <span className="text-lg font-bold text-[var(--foreground)]">
              {isCalculating ? '…' : formatNumber(estimatedAmount, { maximumFractionDigits: 8 })}
            </span>
            <span className="text-sm font-semibold" style={{ color: 'rgba(232,237,246,0.6)' }}>{cryptoTicker}</span>
          </div>
        </div>

        {/* Rate info */}
        <div className="space-y-1 px-1 text-sm" style={{ color: 'rgba(232,237,246,0.6)' }}>
          <div>
            Курс:{' '}
            <span className="font-semibold text-[var(--foreground)]">
              1 {cryptoTicker} = {isCalculating ? '…' : formatNumber(currentRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </span>
          </div>
          <div>
            Получите на:{' '}
            <span className="font-semibold text-[var(--foreground)]">
              {walletAddress?.trim() || `Ваш ${cryptoTicker} кошелёк`}
            </span>
          </div>
        </div>

        {/* Details stage */}
        {stage === 'details' && (
          <div className="space-y-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <label className="mb-1 block text-xs" style={{ color: 'rgba(232,237,246,0.6)' }}>Email для уведомлений</label>
              <input
                type="email"
                {...register('email')}
                className="block w-full rounded-xl px-3 py-3 text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)]"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                placeholder="your@email.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs" style={{ color: 'rgba(232,237,246,0.6)' }}>Адрес {cryptoTicker} кошелька</label>
              <input
                type="text"
                {...register('walletAddress')}
                className="block w-full rounded-xl px-3 py-3 text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)]"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                placeholder="Введите адрес кошелька"
              />
              {errors.walletAddress && <p className="mt-1 text-xs text-red-400">{errors.walletAddress.message}</p>}
            </div>

            <div
              className="rounded-xl px-3 py-3"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs" style={{ color: 'rgba(232,237,246,0.6)' }}>Капча</div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    {captchaQuestion ?? 'Загрузка…'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchCaptcha().catch(() => alert('Не удалось обновить капчу.'))}
                  className="shrink-0 rounded-lg px-3 py-2 text-xs transition-colors"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(232,237,246,0.6)',
                  }}
                >
                  Обновить
                </button>
              </div>
              <input
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                className="mt-3 block w-full rounded-lg px-3 py-2 text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)]"
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                placeholder="Ответ"
              />
            </div>

            <button
              type="button"
              onClick={() => setStage('quick')}
              className="text-sm hover:underline"
              style={{ color: 'rgba(232,237,246,0.5)' }}
            >
              ← Назад
            </button>
          </div>
        )}

        {/* Main button */}
        <button
          type={stage === 'details' ? 'submit' : 'button'}
          onClick={stage === 'details' ? undefined : () => void goToDetails()}
          className="w-full rounded-xl px-4 py-4 text-center text-lg font-bold text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: 'linear-gradient(180deg, #3ecb6f 0%, #1a9e4a 100%)' }}
        >
          Начать обмен
        </button>

        <p className="text-center text-xs" style={{ color: 'rgba(232,237,246,0.35)' }}>
          Курс фиксируется на момент создания заявки
        </p>
      </form>
    </div>
  );
}
