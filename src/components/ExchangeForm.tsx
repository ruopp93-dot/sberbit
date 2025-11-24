"use client";

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Decimal from 'decimal.js';

const exchangeFormSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  amount: z.string().refine((val) => !isNaN(Number(val)), {
    message: "Должно быть числом"
  }),
  email: z.string().email("Неверный формат email"),
  walletAddress: z.string().min(1, "Необходимо указать адрес кошелька"),
});

type ExchangeFormData = z.infer<typeof exchangeFormSchema>;

const currencies = {
  RUB: {
    name: "Рубли",
    methods: ["Сбербанк", "Альфа-Банк", "ВТБ", "МИР", "СБП"]
  },
  CRYPTO: {
    name: "Криптовалюты",
    coins: ["BTC", "ETH", "USDT-TRC20",]
  }
};

export function ExchangeForm() {
  const [step, setStep] = useState(1);
  const [currentRate, setCurrentRate] = useState('0');
  const [estimatedAmount, setEstimatedAmount] = useState('0');
  const [isCalculating, setIsCalculating] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeFormSchema)
  });

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');

  const amount = watch('amount');
  const fromCurrency = watch('fromCurrency');
  const toCurrency = watch('toCurrency');

  const onSubmit = async (data: ExchangeFormData) => {
    try {
      const estimate = await calculateEstimate();
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
            fromAmount: data.amount,
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

  const calculateEstimate = useCallback(async () => {
    if (!amount || !fromCurrency || !toCurrency) {
      return null;
    }

    try {
      // Получаем актуальные курсы из API
      const response = await fetch('/api/rates');
      const rates = await response.json();
      
      // Получаем курс для выбранной криптовалюты
      const cryptoKey = toCurrency.split('-')[0];
      const cryptoRate = rates[cryptoKey];
      
      if (!cryptoRate) {
        return null;
      }

      // Направление: рубли -> криптовалюта
      const rateRubPerUnit = new Decimal(cryptoRate.rub);
      const estimatedAmountDecimal = new Decimal(amount).dividedBy(rateRubPerUnit);

      return {
        amount: estimatedAmountDecimal.toFixed(8),
        rate: rateRubPerUnit.toString()
      };
    } catch (error) {
      console.error('Ошибка при расчете:', error);
      return null;
    }
  }, [amount, fromCurrency, toCurrency]);

  // Обновляем расчет при изменении входных данных
  useEffect(() => {
    const updateEstimate = async () => {
      if (!amount || !fromCurrency || !toCurrency) {
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



  return (
  <div className="max-w-lg mx-auto p-6 rounded-lg shadow-lg" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {step === 1 ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Отдаю</label>
            <select
              {...register('fromCurrency')}
              className="mt-1 block w-full rounded-md shadow-sm"
              style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(128,128,128,0.2)' }}
            >
              {currencies.RUB.methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            {errors.fromCurrency && (
              <p className="text-red-500 text-xs mt-1">{errors.fromCurrency.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Получаю</label>
            <select
              {...register('toCurrency')}
              className="mt-1 block w-full rounded-md shadow-sm"
              style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(128,128,128,0.2)' }}
            >
              {currencies.CRYPTO.coins.map((coin) => (
                <option key={coin} value={coin}>
                  {coin}
                </option>
              ))}
            </select>
            {errors.toCurrency && (
              <p className="text-red-500 text-xs mt-1">{errors.toCurrency.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Сумма</label>
            <input
              type="text"
              {...register('amount')}
              className="mt-1 block w-full rounded-md shadow-sm"
              style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(128,128,128,0.2)' }}
              placeholder="Введите сумму"
            />
            {errors.amount && (
              <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md shadow-sm"
              style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(128,128,128,0.2)' }}
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Адрес кошелька</label>
            <input
              type="text"
              {...register('walletAddress')}
              className="mt-1 block w-full rounded-md shadow-sm"
              style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(128,128,128,0.2)' }}
              placeholder="Введите адрес кошелька"
            />
            {errors.walletAddress && (
              <p className="text-red-500 text-xs mt-1">{errors.walletAddress.message}</p>
            )}
          </div>

          <div className="p-4 rounded-md" style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--foreground)' }}>
            {amount && fromCurrency && toCurrency && (
              <>
                <div className="text-sm mb-2" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <span className="font-medium">Курс обмена:</span>{' '}
                  {isCalculating ? 'Расчет...' : `${currentRate} ₽ за 1 ${toCurrency.split('-')[0]}`}
                </div>
                <div className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <span className="font-medium">Вы получите:</span>{' '}
                  {isCalculating ? 'Расчет...' : `${estimatedAmount} ${toCurrency}`}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                  Курс обмена может измениться в момент создания заявки
                </p>
              </>
            )}
          </div>

          {/* Captcha block */}
          <div className="mt-4 p-4 border rounded">
            {captchaQuestion ? (
              <>
                <div className="text-sm text-gray-700">Пожалуйста, решите капчу для подтверждения:</div>
                <div className="font-medium my-2">{captchaQuestion}</div>
                <input
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="mt-1 block w-full rounded-md shadow-sm"
                  style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(128,128,128,0.2)' }}
                  placeholder="Ответ"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/captcha');
                    const json = await res.json();
                    setCaptchaToken(json.token);
                    setCaptchaQuestion(json.question);
                  } catch (error) {
                    console.error('Не удалось получить капчу', error);
                    alert('Не удалось получить капчу. Попробуйте позже.');
                  }
                }}
                className="w-full py-2 px-4 rounded-md"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--foreground)' }}
              >
                Получить капчу
              </button>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 rounded-md"
            style={{ background: 'var(--accent, #2563eb)', color: '#fff' }}
          >
            Создать заявку
          </button>
        </form>
      ) : (
        <div className="text-center">
          <h3 className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>Заявка создана</h3>
          <div className="mt-4 space-y-4">
            <p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
              Пожалуйста, переведите средства по указанным реквизитам
            </p>
            {/* Здесь будут отображаться реквизиты для оплаты */}
            <button
              onClick={() => setStep(1)}
              className="hover:underline"
              style={{ color: 'var(--accent, #2563eb)' }}
            >
              Создать новую заявку
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
