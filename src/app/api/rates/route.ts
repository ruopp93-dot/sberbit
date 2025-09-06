import { NextResponse } from 'next/server';
import exchangeRates from '@/lib/exchangeRates';

export async function GET() {
  try {
    const rates = exchangeRates.getRates();
    return NextResponse.json(rates);
  } catch (error) {
    console.error('Ошибка при получении курсов:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении курсов' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { currency, price } = await request.json();

    if (!currency || typeof price !== 'number') {
      return NextResponse.json(
        { error: 'Необходимо указать валюту и цену' },
        { status: 400 }
      );
    }

    exchangeRates.updateRate(currency, price);
    return NextResponse.json(exchangeRates.getRates());
  } catch (error) {
    console.error('Ошибка при обновлении курса:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении курса' },
      { status: 500 }
    );
  }
}
