import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedStatuses = ['CREATED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;
const statusSchema = z.enum(allowedStatuses);
const patchSchema = z.object({
  id: z.string().cuid(),
  status: statusSchema,
  note: z.string().trim().max(500).optional(),
});

type AllowedStatus = z.infer<typeof statusSchema>;

function serializeOrder(order: any) {
  return {
    id: order.id,
    amount: String(order.amount),
    fromCurrency: order.fromCurrency,
    toCurrency: order.toCurrency,
    toAmount: String(order.toAmount),
    walletAddress: order.walletAddress,
    contact: order.contact,
    fromAccount: order.fromAccount,
    paymentId: order.paymentId,
    paymentUrl: order.paymentUrl,
    paymentStatus: order.paymentStatus,
    exchangeStatus: order.exchangeStatus,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    payment: order.payment
      ? { service: order.payment.service, externalId: order.payment.externalId, status: order.payment.status, amount: String(order.payment.amount) }
      : null,
    statusHistory: order.statusHistory?.map((entry: any) => ({
      id: entry.id,
      from: entry.from,
      to: entry.to,
      actor: entry.actor,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
    })) ?? [],
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const parsed = statusSchema.safeParse(request.nextUrl.searchParams.get('status') || undefined);
  const status = parsed.success ? parsed.data : undefined;

  const orders = await prisma.exchangeOrder.findMany({
    where: status ? { exchangeStatus: status } : undefined,
    include: {
      payment: true,
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ orders: orders.map(serializeOrder) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
  }

  const { id, status: nextStatus, note } = parsed.data;
  const current = await prisma.exchangeOrder.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });

  if (current.exchangeStatus === nextStatus && !note) {
    const same = await prisma.exchangeOrder.findUnique({
      where: { id },
      include: { payment: true, statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    return NextResponse.json({ order: serializeOrder(same) });
  }

  const updated = await prisma.$transaction(async (tx) => {
    return tx.exchangeOrder.update({
      where: { id },
      data: {
        exchangeStatus: nextStatus as AllowedStatus,
        statusHistory: {
          create: {
            from: current.exchangeStatus,
            to: nextStatus as AllowedStatus,
            actor: 'admin',
            note: note || 'Изменение статуса администратором',
          },
        },
      },
      include: {
        payment: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  });

  return NextResponse.json({ order: serializeOrder(updated) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
