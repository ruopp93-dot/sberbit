import ExchangeRates from '@/components/ExchangeRates';

export default function RatesPage() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold">Текущие курсы валют</h1>
          <p className="mt-2 text-[var(--sb-muted)]">Актуальные курсы обмена криптовалют</p>
        </div>

        <ExchangeRates />
      </div>
    </main>
  );
}
