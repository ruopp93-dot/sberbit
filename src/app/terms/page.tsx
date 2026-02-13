export default function Terms() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">Условия обмена</h1>

        <div className="space-y-8">
          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Общие положения</h2>
            <p className="mb-4 text-[var(--sb-muted)]">
              Наш сервис предоставляет услуги по обмену криптовалют в полуавтоматическом режиме. Обмен производится после подтверждения оператором поступления и отправки средств.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Время обработки</h2>
            <p className="mb-4 text-[var(--sb-muted)]">
              Стандартное время обработки заявки составляет от 15 до 90 минут после подтверждения платежа. Время может варьироваться в зависимости от загруженности сети и работы операторов.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Тарифы и комиссии</h2>
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Ускоренная обработка:</h3>
              <p className="text-[var(--sb-muted)]">
                Дополнительно взимается стандартная комиссия сети, которая зависит от её загруженности и типа криптовалюты.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Верификация (KYC)</h2>
            <div className="space-y-4">
              <p className="text-[var(--sb-muted)]">
                Верификация требуется в следующих случаях:
              </p>
              <ul className="list-disc list-inside text-[var(--sb-muted)]">
                <li>При операциях от 10 000 ₽</li>
                <li>При частых заявках</li>
                <li>При несовпадении данных</li>
              </ul>
              <p className="text-[var(--sb-muted)]">
                Процесс верификации включает видеозвонок и может потребовать предоставления документов.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Отмена и возврат</h2>
            <div className="space-y-4">
              <p className="text-[var(--sb-muted)]">
                После выполнения заявки возврат средств невозможен. До оплаты вы можете отменить заявку в любой момент.
              </p>
              <p className="text-[var(--sb-muted)]">
                В случае спорных ситуаций поддержка рассмотрит обращение и примет решение в течение 3 рабочих дней.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

