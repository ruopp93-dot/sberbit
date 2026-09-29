import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/adminSession";

const ORDER_STATUSES = [
  "created",
  "waiting_payment",
  "paid",
  "processing",
  "completed",
  "canceled",
] as const;

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  comment: z.string().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status, comment } = patchSchema.parse(await request.json());

    const order = await prisma.exchangeOrder.update({
      where: { id },
      data: { exchangeStatus: status },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status,
        comment,
      },
    });

    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
