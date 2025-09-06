// Email helper using dynamic import of nodemailer to avoid hard dependency.
// Works only if SMTP env vars are configured; otherwise it no-ops.

export type OrderEmailPayload = {
  id: string;
  status: string;
  email?: string | null;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  toAccount: string;
  createdAt?: string;
  lastStatusUpdate?: string;
  paymentDetails?: string;
  siteUrl?: string;
};

function canSend() {
  return (
    !!process.env.SMTP_HOST &&
    !!process.env.SMTP_PORT &&
    !!process.env.SMTP_USER &&
    !!process.env.SMTP_PASS &&
    !!process.env.FROM_EMAIL
  );
}

export async function sendOrderStatusEmail(
  toEmail: string | undefined | null,
  subject: string,
  payload: OrderEmailPayload
) {
  if (!toEmail) return;
  if (!canSend()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('SMTP is not configured. Skipping email to', toEmail);
    }
    return;
  }

  try {
    // Dynamically import nodemailer; handle both default and namespace forms
    const mod: any = await import('nodemailer');
    const nodemailer = mod?.default ?? mod;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Boolean(process.env.SMTP_SECURE === 'true'),
      auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PASS as string,
      },
    });

    const orderUrl = payload.siteUrl
      ? `${payload.siteUrl.replace(/\/$/, '')}/order/${payload.id}`
      : undefined;

    const textLines = [
      `Заявка #${payload.id}`,
      `Статус: ${payload.status}`,
      `Отдаете: ${payload.fromAmount} ${payload.fromCurrency}`,
      `Получаете: ${payload.toAmount} ${payload.toCurrency}`,
      `На счет: ${payload.toAccount}`,
      payload.paymentDetails ? `Реквизиты для оплаты: ${payload.paymentDetails}` : undefined,
      payload.createdAt ? `Создана: ${payload.createdAt}` : undefined,
      payload.lastStatusUpdate ? `Время изменения статуса: ${payload.lastStatusUpdate}` : undefined,
      orderUrl ? `Страница заявки: ${orderUrl}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Заявка #${payload.id}</h2>
        <p><strong>Статус:</strong> ${payload.status}</p>
        <ul>
          <li><strong>Отдаете:</strong> ${payload.fromAmount} ${payload.fromCurrency}</li>
          <li><strong>Получаете:</strong> ${payload.toAmount} ${payload.toCurrency}</li>
          <li><strong>На счет:</strong> ${payload.toAccount}</li>
          ${payload.paymentDetails ? `<li><strong>Реквизиты для оплаты:</strong> ${payload.paymentDetails}</li>` : ''}
          ${payload.createdAt ? `<li><strong>Создана:</strong> ${payload.createdAt}</li>` : ''}
          ${payload.lastStatusUpdate ? `<li><strong>Изменена:</strong> ${payload.lastStatusUpdate}</li>` : ''}
        </ul>
        ${orderUrl ? `<p><a href="${orderUrl}">Открыть страницу заявки</a></p>` : ''}
      </div>
    `;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL as string,
      to: toEmail,
      subject,
      text: textLines,
      html,
    });
  } catch (e) {
    // If nodemailer is not installed, or SMTP fails, just log & continue
    console.warn('sendOrderStatusEmail failed:', e);
  }
}
