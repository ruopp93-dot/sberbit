import { NextResponse } from "next/server"
import { getRates, updateRate } from "@/lib/cryptoRates"

let lastFetch = 0

export async function GET() {
  const now = Date.now()

  // Обновляем курсы с CoinGecko раз в 60 секунд
  if (now - lastFetch > 60000) {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=rub",
        { cache: "no-store" }
      )
      if (res.ok) {
        const data = await res.json()
        if (data?.tether?.rub) updateRate("USDT", data.tether.rub)
        if (data?.bitcoin?.rub) updateRate("BTC", data.bitcoin.rub)
        if (data?.ethereum?.rub) updateRate("ETH", data.ethereum.rub)
        lastFetch = now
      }
    } catch {
      // Используем кэшированные/начальные курсы
    }
  }

  return NextResponse.json(getRates())
}
