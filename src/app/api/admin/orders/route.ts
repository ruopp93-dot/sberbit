import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedStatuses = ['CREATED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;
type AllowedStatus = (typeof allowedStatuses)[number];

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const status = request.nextUrl.searchParams.get('status') as AllowedStatus | null;
  const orders = await prisma.exchangeOrder.findMany({
    where: status && allowedStatuses.includes(status) ? { exchangeStatus: status } : undefined,
    include: { payment: true, statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ orders });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const body = await request.json().catch(() => null) as { id?: string; status?: string; note?: string } | null;
  if (!body?.id || !body.status || !allowedStatuses.includes(body.status as AllowedStatus)) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
  }

  const current = await prisma.exchangeOrder.findUnique({ where: { id: body.id } });
  if (!current) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });

  const nextStatus = body.status as AllowedStatus;
  const updated = await prisma.exchangeOrder.update({
    where: { id: body.id },
    data: {
      exchangeStatus: nextStatus,
      statusHistory: {
        create: {
          from: current.exchangeStatus,
          to: nextStatus,
          actor: 'admin',
          note: body.note?.trim().slice(0, 500) || 'Изменение статуса администратором',
        },
      },
    },
    include: { payment: true, statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });

  return NextResponse.json({ order: updated });
}
