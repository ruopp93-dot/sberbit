export interface ExchangeOrder {
  id: string;
  status: string;
  fromAmount: string; // сумма в рублях, введенная пользователем
  fromCurrency: string; // способ оплаты (банк/МИР/СБП)
  toAmount: string; // рассчитанная сумма криптовалюты
  toCurrency: string; // выбранная монета
  toAccount: string; // адрес кошелька пользователя
  paymentDetails: string; // реквизиты для оплаты (системные)
  createdAt: string;
  lastStatusUpdate: string;
  // необязательное поле, если пользователь не вводил реквизиты отправителя
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
  }
};
