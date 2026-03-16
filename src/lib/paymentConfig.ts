// Payment requisites
// Defaults are loaded from env vars (PAYMENT_PHONE, PAYMENT_RECIPIENT, PAYMENT_BANK)
// so admin changes persist across Vercel cold starts when env vars are updated.
const globalKey = '__SB_PAYMENT_CONFIG_V1__';
const _g: any = (globalThis as any);

export interface PaymentConfig {
  phone: string;
  recipient: string;
  bank: string;
}

if (!_g[globalKey]) {
  _g[globalKey] = {
    phone: process.env.PAYMENT_PHONE || '+7 999 000-00-00',
    recipient: process.env.PAYMENT_RECIPIENT || 'ИВАН ИВАНОВ',
    bank: process.env.PAYMENT_BANK || 'Тинькофф',
  } as PaymentConfig;
}

export const PaymentConfigStore = {
  get(): PaymentConfig {
    return _g[globalKey] as PaymentConfig;
  },
  update(data: Partial<PaymentConfig>): void {
    Object.assign(_g[globalKey], data);
  },
};
