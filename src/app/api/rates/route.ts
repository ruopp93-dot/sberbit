import { NextResponse } from "next/server"
import { getRates, updateRate } from "@/lib/cryptoRates"

// Never statically cache this route — rates change every request
export const dynamic = 'force-dynamic'

// Store lastFetch in globalThis so it persists across hot reloads and serverless warm instances
const _g: any = globalThis as any;
const FETCH_KEY = '__SB_RATES_LAST_FETCH__';
if (!_g[FETCH_KEY]) _g[FETCH_KEY] = 0;

interface BinancePrice { price: string }
interface CBRData { Valute?: { USD?: { Value?: number } } }

async function fetchRatesFromBinance(): Promise<boolean> {
  try {
    // Fetch BTC/USDT and ETH/USDT from Binance
    const [btcRes, ethRes, cbrRes] = await Promise.all([
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', {
        cache: 'no-store', signal: AbortSignal.timeout(5000),
      }),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', {
        cache: 'no-store', signal: AbortSignal.timeout(5000),
      }),
      // CBR for USD/RUB
      fetch('https://www.cbr-xml-daily.ru/daily_json.js', {
        cache: 'no-store', signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (!btcRes.ok || !ethRes.ok || !cbrRes.ok) return false;

    const [btcData, ethData, cbrData] = await Promise.all([
      btcRes.json() as Promise<BinancePrice>,
      ethRes.json() as Promise<BinancePrice>,
      cbrRes.json() as Promise<CBRData>,
    ]);

    const usdRub = cbrData?.Valute?.USD?.Value;
    const btcUsdt = parseFloat(btcData?.price);
    const ethUsdt = parseFloat(ethData?.price);

    if (!usdRub || !btcUsdt || !ethUsdt) return false;

    updateRate('BTC', Math.round(btcUsdt * usdRub));
    updateRate('ETH', Math.round(ethUsdt * usdRub));
    updateRate('USDT', parseFloat(usdRub.toFixed(2)));
    return true;
  } catch {
    return false;
  }
}

async function fetchRatesFromCoinGecko(): Promise<boolean> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=rub',
      {
        cache: 'no-store',
        headers: { 'Accept': 'application/json', 'User-Agent': 'SberBit/1.0' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.tether?.rub) updateRate('USDT', data.tether.rub);
    if (data?.bitcoin?.rub) updateRate('BTC', data.bitcoin.rub);
    if (data?.ethereum?.rub) updateRate('ETH', data.ethereum.rub);
    return !!(data?.tether?.rub || data?.bitcoin?.rub);
  } catch {
    return false;
  }
}

export async function GET() {
  const now = Date.now();

  // Refresh at most once per 60s per Lambda instance
  if (now - _g[FETCH_KEY] > 60000) {
    // Try CoinGecko first, fall back to Binance + CBR
    const ok = await fetchRatesFromCoinGecko();
    if (!ok) {
      await fetchRatesFromBinance();
    }
    _g[FETCH_KEY] = now;
  }

  const rates = getRates();

  // Sanity check: if all rates are zero (shouldn't happen), re-initialize defaults
  const anyNonZero = Object.values(rates).some(r => r.rub > 0);
  if (!anyNonZero) {
    updateRate('BTC', Number(process.env.DEFAULT_BTC_RATE) || 3500000);
    updateRate('ETH', Number(process.env.DEFAULT_ETH_RATE) || 180000);
    updateRate('USDT', Number(process.env.DEFAULT_USDT_RATE) || 95.45);
  }

  return NextResponse.json(getRates(), {
    headers: { 'Cache-Control': 'no-store, no-cache' },
  });
}
