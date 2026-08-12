import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, comment } = await request.json();

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
