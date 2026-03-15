// Payment requisites stored in memory (survives HMR in dev)
const globalKey = '__SB_PAYMENT_CONFIG_V1__';
const _g: any = (globalThis as any);

export interface PaymentConfig {
  phone: string;
  recipient: string;
  bank: string;
}

if (!_g[globalKey]) {
  _g[globalKey] = {
    phone: '+7 999 000-00-00',
    recipient: 'ИВАН ИВАНОВ',
    bank: 'Тинькофф',
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
