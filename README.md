This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Email notifications (SMTP)

The app can send emails to users on order status changes. This is optional and is enabled when SMTP environment variables are set.

Set the following env vars (e.g. in `.env.local`):

```
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_SECURE=false # set to true if you use port 465
FROM_EMAIL=Support <support@example.com>
NEXT_PUBLIC_SITE_URL=https://your-site.example
```

Notes:

- The implementation uses dynamic import of `nodemailer`. If `nodemailer` is not installed or SMTP is not configured, email sending is skipped gracefully.
- To enable real sending, install nodemailer in your project:

```
npm install nodemailer
```

- Emails are sent on:
  - Order creation (`POST /api/exchange`)
  - Payment confirmation by user (`POST /api/exchange/[id]/confirm`)
  - Order cancellation by user (`POST /api/exchange/[id]/cancel`)
  - Admin actions in Telegram bot (confirm/cancel)

Environment variables also used by Telegram bot:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=optional-secret
```
