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

  // If both are present, assume commas are thousand separators.
  if (hasComma && hasDot) {
    return v.replace(/,/g, '');
  }

  // If only comma is present, decide whether it's decimal or thousand separator.
  if (hasComma && !hasDot) {
    const parts = v.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      return parts[0] + parts[1];
    }
    return v.replace(/,/g, '.');
  }

  // If only dot is present, it might be a thousand separator in some inputs.
  if (hasDot && !hasComma) {
    const parts = v.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      return parts[0] + parts[1];
    }
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
  email: z.string().email("Неверный формат email"),
  walletAddress: z.string().min(1, "Необходимо указать адрес кошелька"),
});

type ExchangeFormData = z.infer<typeof exchangeFormSchema>;

const currencies = {
  RUB: {
    name: "Рубли",
    methods: ["Tinkoff", "Сбербанк", "Альфа-Банк", "ВТБ", "МИР", "СБП"]
  },
};

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
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-white shadow"
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
      fromCurrency: currencies.RUB.methods[0],
      toCurrency: cryptoOptions[0].value,
      amount: '',
      email: '',
      walletAddress: '',
    },
  });

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');

  const amount = watch('amount');
  const fromCurrency = watch('fromCurrency');
  const toCurrency = watch('toCurrency');
  const walletAddress = watch('walletAddress');

  const selectedCrypto = cryptoOptions.find((o) => o.value === toCurrency) ?? cryptoOptions[0];
  const cryptoTicker = selectedCrypto.ticker;

  const onSubmit = async (data: ExchangeFormData) => {
    try {
      const normalizedAmount = normalizeAmountInput(data.amount).replace(/[^\d.]/g, '');
      const estimate = await calculateEstimate(normalizedAmount, data.toCurrency);
      if (!estimate) {
        throw new Error('Не удалось рассчитать сумму обмена');
      }

      // Ensure captcha token exists; if not, try to fetch a new one
      if (!captchaToken) {
        const cRes = await fetch('/api/captcha');
        const cData = await cRes.json();
        setCaptchaToken(cData.token);
        setCaptchaQuestion(cData.question);
        alert('Пожалуйста, введите ответ на капчу и повторите отправку.');
        return;
      }

      // Ensure user entered a captcha answer
      if (!captchaAnswer || !String(captchaAnswer).trim()) {
        alert('Пожалуйста, введите ответ на капчу.');
        // try to focus the captcha input
        const el = document.querySelector('input[placeholder="Ответ"]') as HTMLInputElement | null;
        if (el) el.focus();
        return;
      }

      const response = await fetch('/api/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          amount: normalizedAmount,
          estimatedAmount: estimate.amount,
          exchangeRate: estimate.rate,
          captchaToken,
          captchaAnswer: String(captchaAnswer).trim()
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
          // If server indicates captcha is wrong, automatically refresh it and ask user to retry
          if (result && typeof result.message === 'string' && /капч/i.test(result.message)) {
            try {
              const cRes = await fetch('/api/captcha');
              if (cRes.ok) {
                const cData = await cRes.json();
                setCaptchaToken(cData.token);
                setCaptchaQuestion(cData.question);
                setCaptchaAnswer('');
              }
            } catch {
              // ignore fetch errors for captcha refresh
            }
            alert(result.message + '. Капча обновлена — введите новый ответ и отправьте форму ещё раз.');
            return;
          }

          throw new Error(result.message || '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0438 \u0437\u0430\u044f\u0432\u043a\u0438');
      }

      // Сохраняем заказ в localStorage как резервную копию на случай перезапуска сервера
      try {
        const cryptoKey = (data.toCurrency || '').split('-')[0];
        const serverOrder = result.order;
        if (serverOrder) {
          localStorage.setItem(`order:${serverOrder.id}`, JSON.stringify(serverOrder));
        } else {
          const backupOrder = {
            id: result.orderId as string,
            status: 'Принята, ожидает оплаты клиентом',
            fromAmount: normalizedAmount,
            fromCurrency: data.fromCurrency,
            toAmount: estimate.amount,
            toCurrency: cryptoKey + (data.toCurrency.includes('-') ? ` ${data.toCurrency.split('-')[1]}` : ''),
            toAccount: data.walletAddress,
            paymentDetails: '2204 1201 3018 1643',
            createdAt: new Date().toLocaleDateString('ru-RU'),
            lastStatusUpdate: new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          };
          localStorage.setItem(`order:${result.orderId}`, JSON.stringify(backupOrder));
        }
      } catch {
        // ignore localStorage errors
      }

      // Перенаправляем на страницу заявки
      window.location.href = `/order/${result.orderId}`;
    } catch (error) {
      console.error('Ошибка:', error);
      alert(error instanceof Error ? error.message : 'Произошла ошибка при создании заявки. Пожалуйста, попробуйте позже.');
    }
  };

  const calculateEstimate = useCallback(async (amountOverride?: string, toCurrencyOverride?: string) => {
    const rawAmount = amountOverride ?? amount;
    const rawToCurrency = toCurrencyOverride ?? toCurrency;

    if (!rawAmount || !rawToCurrency) {
      return null;
    }

    try {
      // Получаем актуальные курсы из API
      const response = await fetch('/api/rates');
      const rates = await response.json();
      
      // Получаем курс для выбранной криптовалюты
      const cryptoKey = rawToCurrency.split('-')[0];
      const cryptoRate = rates[cryptoKey];
      
      if (!cryptoRate) {
        return null;
      }

      // Направление: рубли -> криптовалюта
      const rateRubPerUnit = new Decimal(cryptoRate.rub);
      const amountDecimal = parsePositiveAmount(rawAmount);
      if (!amountDecimal) return null;
      const estimatedAmountDecimal = amountDecimal.dividedBy(rateRubPerUnit);

      return {
        amount: estimatedAmountDecimal.toFixed(8),
        rate: rateRubPerUnit.toString()
      };
    } catch (error) {
      console.error('Ошибка при расчете:', error);
      return null;
    }
  }, [amount, toCurrency]);

  // Обновляем расчет при изменении входных данных
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
      } catch (error) {
        console.error('Ошибка при расчете:', error);
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

    fetchCaptcha().catch(() => {
      // ignore fetch errors here; onSubmit has fallback
    });
  }, [stage, captchaToken, captchaQuestion, fetchCaptcha]);

  return (
    <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 shadow-2xl backdrop-blur">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          if (stage !== 'details') {
            e.preventDefault();
            void (async () => {
              const ok = await trigger(['fromCurrency', 'toCurrency', 'amount']);
              if (ok) setStage('details');
            })();
            return;
          }
          void handleSubmit(onSubmit)(e);
        }}
      >
        <div className="space-y-3">
          <div>
            <div className="mb-2 text-xs text-[var(--sb-muted)]">Отдаёте</div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="h-7 w-10 rounded-sm border border-white/10"
                  style={{
                    background: 'linear-gradient(to bottom, #ffffff 0 33%, #2563eb 33% 66%, #ef4444 66% 100%)',
                  }}
                  aria-hidden="true"
                />

                <div className="relative min-w-0 flex-1">
                  <select
                    {...register('fromCurrency')}
                    className="w-full appearance-none bg-transparent pr-10 text-base font-semibold text-[var(--foreground)] outline-none"
                  >
                    {currencies.RUB.methods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--sb-muted-2)]" />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[var(--sb-border)] bg-black/20 px-3 py-2">
                <input
                  type="text"
                  inputMode="decimal"
                  {...register('amount')}
                  className="w-28 bg-transparent text-right text-lg font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--sb-muted-2)]"
                  placeholder="50 000"
                />
                <span className="text-sm font-semibold text-[var(--sb-muted)]">₽</span>
              </div>
            </div>
            {errors.fromCurrency && <p className="mt-1 text-xs text-red-400">{errors.fromCurrency.message}</p>}
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <div className="mb-2 text-xs text-[var(--sb-muted)]">Получаете</div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface-2)] px-3 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <CryptoIcon ticker={cryptoTicker} />

                <div className="relative min-w-0 flex-1">
                  <select
                    {...register('toCurrency')}
                    className="w-full appearance-none bg-transparent pr-10 text-base font-semibold text-[var(--foreground)] outline-none"
                  >
                    {cryptoOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--sb-muted-2)]" />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[var(--sb-border)] bg-black/20 px-3 py-2">
                <span className="text-sm text-[var(--sb-muted)]">≈</span>
                <span className="text-lg font-semibold text-[var(--foreground)]">
                  {isCalculating ? '…' : formatNumber(estimatedAmount, { maximumFractionDigits: 8 })}
                </span>
                <span className="text-sm font-semibold text-[var(--sb-muted)]">{cryptoTicker}</span>
              </div>
            </div>
            {errors.toCurrency && <p className="mt-1 text-xs text-red-400">{errors.toCurrency.message}</p>}
          </div>
        </div>

        <div className="h-px bg-white/10" />

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
              {walletAddress?.trim() ? walletAddress : `Ваш ${cryptoTicker} кошелёк`}
            </span>
          </div>
        </div>

        {stage === 'details' && (
          <div className="space-y-3 pt-2">
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
                <div className="min-w-0">
                  <div className="text-xs text-[var(--sb-muted)]">Капча</div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    {captchaQuestion ? captchaQuestion : 'Загрузка…'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchCaptcha().catch(() => alert('Не удалось обновить капчу. Попробуйте позже.'))}
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
              className="text-left text-sm text-[var(--sb-muted)] hover:text-[var(--foreground)] hover:underline"
            >
              ← Назад
            </button>
          </div>
        )}

        <button
          type={stage === 'details' ? 'submit' : 'button'}
          onClick={
            stage === 'details'
              ? undefined
              : () => {
                  void (async () => {
                    const ok = await trigger(['fromCurrency', 'toCurrency', 'amount']);
                    if (ok) setStage('details');
                  })();
                }
          }
          className="w-full rounded-xl px-4 py-4 text-center text-lg font-semibold text-white shadow-2xl"
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

  );
}
