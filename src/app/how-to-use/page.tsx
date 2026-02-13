"use client";

export default function HowToUsePage() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">Как пользоваться сервисом</h1>

        <div className="space-y-8">
          {/* Общая информация */}
          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Общая информация</h2>
            <p className="mb-4 text-[var(--sb-muted)]">
              Наш сервис предоставляет быстрый и безопасный обмен криптовалют на рубли и обратно. 
              Мы поддерживаем популярные платежные методы и криптовалюты, обеспечивая надежный и удобный процесс обмена.
            </p>
          </section>

          {/* Пошаговая инструкция */}
          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Пошаговая инструкция по обмену</h2>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-lg font-medium">1. Создание заявки</h3>
                <ul className="list-disc list-inside space-y-2 text-[var(--sb-muted)]">
                  <li>Выберите направление обмена (например, Сбербанк ₽ → Bitcoin)</li>
                  <li>Введите сумму для обмена (минимальная сумма - 1000 ₽)</li>
                  <li>Проверьте расчетную сумму к получению и текущий курс обмена</li>
                  <li>Укажите ваш email для получения уведомлений</li>
                  <li>Введите адрес криптовалютного кошелька для получения средств</li>
                  <li>Нажмите кнопку &quot;Создать заявку&quot;</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-medium">2. Оплата заявки</h3>
                <ul className="list-disc list-inside space-y-2 text-[var(--sb-muted)]">
                  <li>После создания заявки вы получите реквизиты для оплаты</li>
                  <li>Переведите указанную сумму по предоставленным реквизитам</li>
                  <li>Сохраните чек или скриншот перевода</li>
                  <li>Вернитесь на страницу заявки и нажмите кнопку &quot;Я оплатил заявку&quot;</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-medium">3. Ожидание обработки</h3>
                <ul className="list-disc list-inside space-y-2 text-[var(--sb-muted)]">
                  <li>После подтверждения оплаты ваша заявка поступает в обработку</li>
                  <li>Среднее время обработки составляет 15-90 минут</li>
                  <li>Страница заявки автоматически обновляется каждые 30 секунд</li>
                  <li>Вы получите email-уведомление при изменении статуса заявки</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Важные моменты */}
          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Важные моменты</h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-lg font-medium">Верификация</h3>
                <p className="text-[var(--sb-muted)]">
                  При суммах от 10 000 ₽ или при частых обменах может потребоваться верификация через видеозвонок. 
                  Это необходимо для обеспечения безопасности и соответствия требованиям KYC/AML.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-medium">Отмена и возврат</h3>
                <ul className="list-disc list-inside text-[var(--sb-muted)]">
                  <li>До оплаты заявку можно отменить в любой момент</li>
                  <li>После выполнения заявки возврат средств невозможен</li>
                  <li>Если заявка оплачена, но не выполнена, возможен возврат за вычетом комиссии</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Безопасность */}
          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Безопасность</h2>
            <div className="space-y-4">
              <p className="text-[var(--sb-muted)]">
                Для обеспечения безопасности обменов мы рекомендуем:
              </p>
              <ul className="list-disc list-inside text-[var(--sb-muted)]">
                <li>Всегда проверяйте реквизиты перед отправкой средств</li>
                <li>Используйте актуальный email для получения уведомлений</li>
                <li>Не передавайте никому данные о своих транзакциях</li>
                <li>При возникновении проблем обращайтесь в поддержку через Telegram</li>
              </ul>
            </div>
          </section>

          {/* Поддержка */}
          <section className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-xl font-semibold">Поддержка</h2>
            <div className="space-y-4">
              <p className="text-[var(--sb-muted)]">
                Если у вас возникли вопросы или нужна помощь:
              </p>
              <ul className="list-disc list-inside text-[var(--sb-muted)]">
                <li>Используйте кнопку поддержки в Telegram (доступна 24/7)</li>
                <li>Сообщайте ID заявки при обращении в поддержку</li>
                <li>Сохраняйте все чеки и скриншоты переводов</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

}
