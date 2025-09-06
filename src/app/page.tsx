import { ExchangeForm } from '@/components/ExchangeForm';
import ExchangeRates from '@/components/ExchangeRates';

export default function Home() {
  return (
    <main className="min-h-screen py-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
            <img src="/logo.png" alt="SberBitS" style={{ height: 56, width: 'auto', display: 'inline-block' }} />
          </h1>
          <p className="text-lg" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
            Быстрый безопасный и анонимный обмен криптовалют
          </p>
        </div>


        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
        
          </h2>
          <ExchangeForm />
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--foreground)' }}>
              🚀 Быстрые обмены
            </h3>
            <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
              Среднее время обработки заявки составляет от 15 до 90 минут
            </p>
          </div>

          <div className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--foreground)' }}>
              🔒 Безопасность
            </h3>
            <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
              Все транзакции защищены и проходят через систему безопасности
            </p>
          </div>

          <div className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--foreground)' }}>
              💎 Выгодные курсы
            </h3>
            <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
              Мы предлагаем конкурентные курсы обмена и низкие комиссии
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
