import { NextResponse } from 'next/server';
import { OrdersStore } from '@/lib/ordersStore';

export async function GET() {
  try {
    const all = OrdersStore.all();
    return NextResponse.json({ count: all.length, orders: all });
  } catch (e) {
    console.error('debug orders error', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
