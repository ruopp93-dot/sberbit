import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPallySignature } from "@/lib/pally";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-pally-signature") || "";

  if (!verifyPallySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const event = JSON.parse(body);
    const paymentId = event.payment_id;

    const order = await prisma.exchangeOrder.findFirst({
      where: { paymentId },
    });

    if (order && order.paymentStatus !== "paid") {
      await prisma.exchangeOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: "paid",
          exchangeStatus: "paid",
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
