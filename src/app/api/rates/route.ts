import { NextResponse } from "next/server"
import { getRates, updateRate } from "@/lib/cryptoRates"

// Store lastFetch in globalThis so it persists across hot reloads and serverless warm instances
const _g: any = globalThis as any;
const FETCH_KEY = '__SB_RATES_LAST_FETCH__';
if (!_g[FETCH_KEY]) _g[FETCH_KEY] = 0;

export async function GET() {
  const now = Date.now()

  // Обновляем курсы с CoinGecko раз в 60 секунд
  if (now - _g[FETCH_KEY] > 60000) {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=rub",
        {
          cache: "no-store",
          headers: { "Accept": "application/json", "User-Agent": "SberBit/1.0" },
          signal: AbortSignal.timeout(8000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data?.tether?.rub) updateRate("USDT", data.tether.rub)
        if (data?.bitcoin?.rub) updateRate("BTC", data.bitcoin.rub)
        if (data?.ethereum?.rub) updateRate("ETH", data.ethereum.rub)
        _g[FETCH_KEY] = now;
      }
    } catch {
      // Используем кэшированные/начальные курсы
    }
  }

  return NextResponse.json(getRates())
}
