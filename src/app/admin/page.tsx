import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  if (!(await verifySessionToken(cookieStore.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login");
  }

  const orders = await prisma.exchangeOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">SberBits Admin</h1>
      <div className="space-y-3">
        {orders.map((order) => (
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
