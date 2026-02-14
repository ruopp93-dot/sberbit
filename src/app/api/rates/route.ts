import { NextResponse } from "next/server"

let cachedRate: number | null = null
let lastFetch = 0

export async function GET() {
  const now = Date.now()

  // кэш 60 секунд
  if (cachedRate && now - lastFetch < 60000) {
    return NextResponse.json({ rate: cachedRate })
  }

  try {
    const res = await fetch(
      "https://api.exchangerate.host/latest?base=USDT&symbols=RUB",
      { cache: "no-store" }
    )

    const data = await res.json()
    const rate = data?.rates?.RUB

    if (!rate) throw new Error("Invalid rate")

    cachedRate = rate
    lastFetch = now

    return NextResponse.json({ rate })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch rate" },
      { status: 500 }
    )
  }
}
