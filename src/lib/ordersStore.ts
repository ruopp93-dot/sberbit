export interface ExchangeOrder {
  id: string;
  status: string;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  toAccount: string;
  paymentDetails: string;
  paymentPhone?: string;
  paymentRecipient?: string;
  paymentBank?: string;
  createdAt: string;
  lastStatusUpdate: string;
  fromAccount?: string;
  email?: string;
}

// keep orders Map on globalThis so it survives HMR in dev
const globalKey = '__SB_ORDERS_STORE_V1__';
const _g: any = (globalThis as any) || {};
if (!_g[globalKey]) _g[globalKey] = new Map<string, ExchangeOrder>();
const orders: Map<string, ExchangeOrder> = _g[globalKey];

export const OrdersStore = {
  save(order: ExchangeOrder) {
    orders.set(order.id, order);
  },
  get(id: string) {
    return orders.get(id) || null;
  },
  has(id: string) {
    return orders.has(id);
  },
  all(): ExchangeOrder[] {
    return Array.from(orders.values());
  },
  listBy(fn: (o: ExchangeOrder) => boolean): ExchangeOrder[] {
    return Array.from(orders.values()).filter(fn);
  },
};
