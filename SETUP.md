# SberBits — Инструкция по развёртыванию

## Что это

Криптообменник с:
- Next.js 15 (фронтенд + API)
- Telegram-бот для администратора (управление заявками и курсами)
- Авторегистрация вебхука при деплое
- Персистентное хранение курсов через Upstash Redis

---

## Необходимые сервисы (все бесплатно)

| Сервис | Для чего | Ссылка |
|--------|----------|--------|
| Vercel | Хостинг Next.js | vercel.com |
| Telegram BotFather | Создание бота | t.me/BotFather |
| Upstash Redis | Хранение курсов | upstash.com |
| Gmail / Яндекс | Email-уведомления | — |

---

## Шаг 1: Создать Telegram-бота

1. Открой Telegram, найди `@BotFather`
2. Отправь `/newbot`
3. Придумай имя и username (например `SberBitsVIP_bot`)
4. Сохрани токен: `1234567890:ABCdef...`

---

## Шаг 2: Создать Upstash Redis

1. Зайди на https://upstash.com → Sign Up (бесплатно, без карты)
2. Console → Create Database
3. Название: любое (например `sberbits`)
4. Region: **EU West (Frankfurt)** — ближайший к России
5. После создания в разделе **REST API** скопируй:
   - `UPSTASH_REDIS_REST_URL` (начинается с `https://...upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (длинная строка)

---

## Шаг 3: Задеплоить на Vercel

### 3.1 Fork репозитория
1. Загрузи этот код на GitHub (New Repository → Upload files)

### 3.2 Деплой через Vercel
1. Зайди на https://vercel.com → New Project
2. Import репозиторий с GitHub
3. Framework Preset: **Next.js** (определится автоматически)
4. Нажми **Deploy** (первый деплой без переменных — пусть упадёт, добавим их следующим шагом)

### 3.3 Добавить переменные окружения
В Vercel → Settings → Environment Variables добавь:

```
TELEGRAM_BOT_TOKEN=твой_токен_от_BotFather
TELEGRAM_ADMIN_CHAT_ID=твой_chat_id_в_телеграм
TELEGRAM_WEBHOOK_SECRET=придумай_любую_строку_20+символов
NEXT_PUBLIC_SITE_URL=https://твой-домен.vercel.app
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=твой_токен_upstash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=твой@gmail.com
EMAIL_PASS=пароль_приложения_gmail
EMAIL_FROM=твой@gmail.com
```

> **Как узнать свой TELEGRAM_ADMIN_CHAT_ID:**
> Напиши боту `@userinfobot` в Telegram → он пришлёт твой ID

> **Gmail пароль приложения:**
> Gmail → Настройки аккаунта → Безопасность → Двухэтапная верификация → Пароли приложений → Создать

### 3.4 Передеплоить
После добавления переменных: Vercel → Deployments → три точки → Redeploy

---

## Шаг 4: Активировать бота

После успешного деплоя зайди в браузере:
```
https://твой-домен.vercel.app/api/telegram/setup
```

Должен прийти ответ:
```json
{
  "setWebhook": {"ok": true, ...},
  "setCommands": {"ok": true, ...}
}
```

Теперь напиши боту `/start` — он должен ответить главным меню.

---

## Шаг 5: Свой домен (опционально)

1. Vercel → Settings → Domains → Add Domain
2. Добавь свой домен (например `sberbits.com.ru`)
3. Пропиши DNS записи которые покажет Vercel у своего регистратора
4. Обнови переменную `NEXT_PUBLIC_SITE_URL` на новый домен
5. Redeploy + снова зайди на `/api/telegram/setup`

---

## Управление ботом

### Команды администратора в Telegram:
| Команда | Действие |
|---------|----------|
| `/start` | Главное меню |
| `/orders` | Активные заявки |
| `/paid` | Оплаченные заявки |
| `/canceled` | Отменённые заявки |
| `/all` | Все заявки |
| `/rates` | Текущие курсы |
| `/help` | Справка |

### Изменение курсов:
1. В боте нажми кнопку **Курсы**
2. Выбери **Изменить BTC / ETH / USDT**
3. Введи новый курс в рублях (например `95` для USDT)
4. Курс сохранится в Redis и обновится на сайте

---

## Переменные окружения — описание

| Переменная | Описание | Пример |
|------------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Токен от BotFather | `1234567890:AABBcc...` |
| `TELEGRAM_ADMIN_CHAT_ID` | Твой Telegram ID | `123456789` |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет для защиты вебхука | `my_secret_key_2024` |
| `NEXT_PUBLIC_SITE_URL` | URL сайта (без слеша в конце) | `https://sberbits.vercel.app` |
| `UPSTASH_REDIS_REST_URL` | URL Upstash Redis | `https://eu1-xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Токен Upstash Redis | `AXXXx...` |
| `EMAIL_HOST` | SMTP сервер | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP порт | `587` |
| `EMAIL_USER` | Email для отправки | `admin@gmail.com` |
| `EMAIL_PASS` | Пароль приложения | `xxxx xxxx xxxx xxxx` |
| `EMAIL_FROM` | От кого отправлять | `SberBits <admin@gmail.com>` |
| `DEFAULT_BTC_RATE` | Курс BTC при старте (руб) | `5900000` |
| `DEFAULT_ETH_RATE` | Курс ETH при старте (руб) | `185000` |
| `DEFAULT_USDT_RATE` | Курс USDT при старте (руб) | `95` |

---

## Структура проекта

```
src/
├── app/
│   ├── api/
│   │   ├── rates/          # Курсы (GET → JSON)
│   │   │   ├── route.ts    # Основной endpoint
│   │   │   ├── proxy/      # Для компонента ExchangeRates
│   │   │   └── stream/     # SSE для realtime обновлений
│   │   ├── telegram/
│   │   │   ├── webhook/    # Обработчик Telegram-обновлений
│   │   │   └── setup/      # Регистрация вебхука (вызвать 1 раз)
│   │   ├── orders/         # CRUD заявок
│   │   └── captcha/        # Капча для формы
│   └── (pages)/
│       ├── page.tsx        # Главная страница
│       ├── rates/          # Страница курсов
│       └── order/[id]/     # Статус заявки
├── components/
│   ├── ExchangeForm.tsx    # Форма обмена
│   ├── ExchangeRates.tsx   # Таблица курсов
│   └── OrderStatus.tsx     # Статус заявки
├── lib/
│   ├── bot.ts              # Grammy bot instance
│   ├── cryptoRates.ts      # Хранение курсов + Redis
│   ├── ordersStore.ts      # Хранение заявок
│   └── email.ts            # Email-уведомления
└── instrumentation.ts      # Авторегистрация вебхука при старте
```

---

## Troubleshooting

**Бот не отвечает**
→ Зайди на `/api/telegram/setup` — проверь ответ
→ Убедись что `TELEGRAM_BOT_TOKEN` правильный
→ Убедись что `NEXT_PUBLIC_SITE_URL` задан без слеша в конце

**Курсы не обновляются на сайте**
→ Убедись что `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` заданы
→ Попробуй поставить курс в боте и обновить страницу

**"Курсы недоступны" на странице курсов**
→ Проверь что `/api/rates/proxy` возвращает данные (открой в браузере)

**Email не отправляется**
→ Для Gmail нужен "Пароль приложения", не обычный пароль
→ Включи 2FA в Google аккаунте, потом создай пароль приложения
