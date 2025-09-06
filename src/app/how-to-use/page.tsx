"use client";

export default function HowToUsePage() {
  return (
    <main className="min-h-screen py-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>
          Как пользоваться сервисом
        </h1>

        <div className="space-y-8">
          {/* Общая информация */}
          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Общая информация
            </h2>
            <p style={{ color: 'var(--foreground)', opacity: 0.85 }} className="mb-4">
              Наш сервис предоставляет быстрый и безопасный обмен криптовалют на рубли и обратно. 
              Мы поддерживаем популярные платежные методы и криптовалюты, обеспечивая надежный и удобный процесс обмена.
            </p>
          </section>

          {/* Пошаговая инструкция */}
          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Пошаговая инструкция по обмену
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  1. Создание заявки
                </h3>
                <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <li>Выберите направление обмена (например, Сбербанк ₽ → Bitcoin)</li>
                  <li>Введите сумму для обмена (минимальная сумма - 1000 ₽)</li>
                  <li>Проверьте расчетную сумму к получению и текущий курс обмена</li>
                  <li>Укажите ваш email для получения уведомлений</li>
                  <li>Введите адрес криптовалютного кошелька для получения средств</li>
                  <li>Нажмите кнопку &quot;Создать заявку&quot;</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  2. Оплата заявки
                </h3>
                <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <li>После создания заявки вы получите реквизиты для оплаты</li>
                  <li>Переведите указанную сумму по предоставленным реквизитам</li>
                  <li>Сохраните чек или скриншот перевода</li>
                  <li>Вернитесь на страницу заявки и нажмите кнопку &quot;Я оплатил заявку&quot;</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  3. Ожидание обработки
                </h3>
                <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <li>После подтверждения оплаты ваша заявка поступает в обработку</li>
                  <li>Среднее время обработки составляет 15-90 минут</li>
                  <li>Страница заявки автоматически обновляется каждые 30 секунд</li>
                  <li>Вы получите email-уведомление при изменении статуса заявки</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Важные моменты */}
          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Важные моменты
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Верификация
                </h3>
                <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  При суммах от 10 000 ₽ или при частых обменах может потребоваться верификация через видеозвонок. 
                  Это необходимо для обеспечения безопасности и соответствия требованиям KYC/AML.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Отмена и возврат
                </h3>
                <ul className="list-disc list-inside" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <li>До оплаты заявку можно отменить в любой момент</li>
                  <li>После выполнения заявки возврат средств невозможен</li>
                  <li>Если заявка оплачена, но не выполнена, возможен возврат за вычетом комиссии</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Безопасность */}
          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Безопасность
            </h2>
            <div className="space-y-4">
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                Для обеспечения безопасности обменов мы рекомендуем:
              </p>
              <ul className="list-disc list-inside" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                <li>Всегда проверяйте реквизиты перед отправкой средств</li>
                <li>Используйте актуальный email для получения уведомлений</li>
                <li>Не передавайте никому данные о своих транзакциях</li>
                <li>При возникновении проблем обращайтесь в поддержку через Telegram</li>
              </ul>
            </div>
          </section>

          {/* Поддержка */}
          <section className="p-6 rounded-lg shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Поддержка
            </h2>
            <div className="space-y-4">
              <p style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                Если у вас возникли вопросы или нужна помощь:
              </p>
              <ul className="list-disc list-inside" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
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
