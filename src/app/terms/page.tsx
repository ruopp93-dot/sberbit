export default function Terms() {
  return (
    <main className="min-h-screen py-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>
          Условия обмена
        </h1>

        <div className="space-y-8">
          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Общие положения
            </h2>
            <p style={{ color: 'var(--foreground)', opacity: 0.85 }} className="mb-4">
              Наш сервис предоставляет услуги по обмену криптовалют в полуавтоматическом режиме. Обмен производится после подтверждения оператором поступления и отправки средств.
            </p>
          </section>

          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Время обработки
            </h2>
            <p style={{ color: 'var(--foreground)', opacity: 0.85 }} className="mb-4">
              Стандартное время обработки заявки составляет от 15 до 90 минут после подтверждения платежа. Время может варьироваться в зависимости от загруженности сети и работы операторов.
            </p>
          </section>

          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Тарифы и комиссии
            </h2>
            <div className="space-y-4">
              <h3 className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
                Ускоренная обработка:
              </h3>
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                Дополнительно взимается стандартная комиссия сети, которая зависит от её загруженности и типа криптовалюты.
              </p>
            </div>
          </section>

          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Верификация (KYC)
            </h2>
            <div className="space-y-4">
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                Верификация требуется в следующих случаях:
              </p>
              <ul className="list-disc list-inside" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                <li>При операциях от 10 000 ₽</li>
                <li>При частых заявках</li>
                <li>При несовпадении данных</li>
              </ul>
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                Процесс верификации включает видеозвонок и может потребовать предоставления документов.
              </p>
            </div>
          </section>

          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Отмена и возврат
            </h2>
            <div className="space-y-4">
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                После выполнения заявки возврат средств невозможен. До оплаты вы можете отменить заявку в любой момент.
              </p>
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                В случае спорных ситуаций поддержка рассмотрит обращение и примет решение в течение 3 рабочих дней.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
