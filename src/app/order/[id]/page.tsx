"use client";

import { OrderStatus } from '@/components/OrderStatus';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!orderId) {
      router.push('/'); // Перенаправляем на главную, если нет ID заказа
    }
  }, [orderId, router]);

  if (!orderId) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 pb-16 pt-10">
      <OrderStatus orderId={orderId} />
    </main>
  );
}
