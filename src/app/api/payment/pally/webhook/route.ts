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
    const paymentId = event?.payment_id;

    if (typeof paymentId !== "string" || !paymentId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Ignore notifications about unsuccessful payments.
    const eventStatus = typeof event.status === "string" ? event.status.toLowerCase() : null;
    if (eventStatus && !["success", "succeeded", "paid", "completed"].includes(eventStatus)) {
      return NextResponse.json({ received: true });
    }

    const order = await prisma.exchangeOrder.findFirst({
      where: { paymentId },
    });

    // Do not resurrect canceled orders and do not accept underpayments.
    const paidAmount = event.amount != null ? Number(event.amount) : null;
    const underpaid = paidAmount != null && (!Number.isFinite(paidAmount) || paidAmount < Number(order?.amount));

    if (order && order.paymentStatus !== "paid" && order.exchangeStatus !== "canceled" && !underpaid) {
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
    console.error("Pally webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
