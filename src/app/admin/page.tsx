import { prisma } from "@/lib/prisma";

type Order = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number | bigint;
  paymentStatus: string;
  exchangeStatus: string;
};

export default async function AdminPage() {
  const orders: Order[] = await prisma.exchangeOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">SberBits Admin</h1>
      <div className="space-y-3">
        {orders.map((order: Order) => (
          <div key={order.id} className="border rounded p-4">
            <div>Заявка: {order.id}</div>
            <div>{order.fromCurrency} → {order.toCurrency}</div>
            <div>Сумма: {order.amount.toString()}</div>
            <div>Оплата: {order.paymentStatus}</div>
            <div>Статус: {order.exchangeStatus}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
