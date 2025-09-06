import ExchangeRates from '@/components/ExchangeRates';

export default function RatesPage() {
  return (
    <main className="min-h-screen py-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
            Текущие курсы валют
          </h1>
          <p className="text-lg" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
            Актуальные курсы обмена криптовалют
          </p>
        </div>

        <div className="mb-12">
          <ExchangeRates />
        </div>
      </div>
    </main>
  );
}
