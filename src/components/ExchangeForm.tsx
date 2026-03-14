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
  const style =
    ticker === 'USDT'
      ? { background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }
      : ticker === 'BTC'
        ? { background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' }
        : { background: 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)' };
  const text = ticker === 'USDT' ? 'T' : ticker === 'BTC' ? '₿' : 'Ξ';
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white shadow"
      style={style}
      aria-hidden="true"
    >
      {text}
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
    <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-5 shadow-2xl">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          if (stage !== 'details') { e.preventDefault(); void goToDetails(); return; }
          void handleSubmit(onSubmit)(e);
        }}
      >
        {/* From */}
        <div>
          <div className="mb-2 text-xs text-[var(--sb-muted)]">Отдаёте</div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3">
            <span
              className="h-7 w-10 shrink-0 rounded-sm border border-white/10"
              style={{ background: 'linear-gradient(to bottom, #ffffff 0 33%, #2563eb 33% 66%, #ef4444 66% 100%)' }}
              aria-hidden="true"
            />
            <div className="relative min-w-0 flex-1">
              <select
                {...register('fromCurrency')}
                className="w-full appearance-none bg-transparent pr-8 text-base font-semibold text-[var(--foreground)] outline-none"
              >
                {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sb-muted-2)]" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--sb-border)] bg-black/20 px-3 py-2">
              <input
                type="text"
                inputMode="decimal"
                {...register('amount')}
                className="w-24 bg-transparent text-right text-lg font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)]"
                placeholder="50 000"
              />
              <span className="text-sm font-semibold text-[var(--sb-muted)]">₽</span>
            </div>
          </div>
          {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[var(--sb-muted-2)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* To */}
        <div>
          <div className="mb-2 text-xs text-[var(--sb-muted)]">Получаете</div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3">
            <CryptoIcon ticker={cryptoTicker} />
            <div className="relative min-w-0 flex-1">
              <select
                {...register('toCurrency')}
                className="w-full appearance-none bg-transparent pr-8 text-base font-semibold text-[var(--foreground)] outline-none"
              >
                {cryptoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sb-muted-2)]" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--sb-border)] bg-black/20 px-3 py-2">
              <span className="text-sm text-[var(--sb-muted)]">≈</span>
              <span className="text-lg font-semibold text-[var(--foreground)]">
                {isCalculating ? '…' : formatNumber(estimatedAmount, { maximumFractionDigits: 8 })}
              </span>
              <span className="text-sm font-semibold text-[var(--sb-muted)]">{cryptoTicker}</span>
            </div>
          </div>
        </div>

        {/* Rate info */}
        <div className="space-y-1 text-sm text-[var(--sb-muted)]">
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
          <div className="space-y-3 border-t border-white/10 pt-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--sb-muted)]">Email</label>
              <input
                type="email"
                {...register('email')}
                className="block w-full rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3 text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)] focus:border-[var(--sb-border-strong)]"
                placeholder="your@email.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--sb-muted)]">Адрес кошелька</label>
              <input
                type="text"
                {...register('walletAddress')}
                className="block w-full rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3 text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)] focus:border-[var(--sb-border-strong)]"
                placeholder="Введите адрес кошелька"
              />
              {errors.walletAddress && <p className="mt-1 text-xs text-red-400">{errors.walletAddress.message}</p>}
            </div>

            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[var(--sb-muted)]">Капча</div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    {captchaQuestion ?? 'Загрузка…'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchCaptcha().catch(() => alert('Не удалось обновить капчу.'))}
                  className="shrink-0 rounded-lg border border-[var(--sb-border)] bg-black/20 px-3 py-2 text-xs text-[var(--sb-muted)] hover:text-[var(--foreground)]"
                >
                  Обновить
                </button>
              </div>
              <input
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                className="mt-3 block w-full rounded-lg border border-[var(--sb-border)] bg-black/20 px-3 py-2 text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)] focus:border-[var(--sb-border-strong)]"
                placeholder="Ответ"
              />
            </div>

            <button
              type="button"
              onClick={() => setStage('quick')}
              className="text-sm text-[var(--sb-muted)] hover:text-[var(--foreground)] hover:underline"
            >
              ← Назад
            </button>
          </div>
        )}

        <button
          type={stage === 'details' ? 'submit' : 'button'}
          onClick={stage === 'details' ? undefined : () => void goToDetails()}
          className="w-full rounded-xl px-4 py-4 text-center text-lg font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-2) 100%)' }}
        >
          Начать обмен
        </button>

        <p className="text-xs text-[var(--sb-muted-2)]">
          Курс фиксируется на момент создания заявки и может незначительно измениться.
        </p>
      </form>
    </div>
  );
}
