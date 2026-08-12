import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPallyPayment } from "@/lib/pally";

const exchangeSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  amount: z.coerce.number().positive(),
  walletAddress: z.string().min(3),
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const data = exchangeSchema.parse(await request.json());

    const order = await prisma.exchangeOrder.create({
      data: {
        direction: `${data.fromCurrency}-${data.toCurrency}`,
        amount: data.amount,
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        walletAddress: data.walletAddress,
        contact: data.email,
        paymentStatus: "pending",
        exchangeStatus: "created",
      },
    });

    const payment = await createPallyPayment({
      amount: data.amount,
      orderId: order.id,
    });

    await prisma.exchangeOrder.update({
      where: { id: order.id },
      data: {
        paymentId: payment.payment_id,
        paymentUrl: payment.payment_url,
        exchangeStatus: "waiting_payment",
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentUrl: payment.payment_url,
    });
  } catch (error: any) {
    console.error("EXCHANGE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Ошибка создания заявки",
      },
      { status: 500 }
    );
  }
}
