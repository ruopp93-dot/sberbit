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
    <main className="min-h-screen py-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <OrderStatus orderId={orderId} />
    </main>
  );
}
