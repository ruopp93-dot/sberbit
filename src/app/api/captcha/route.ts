import { NextResponse } from 'next/server';
import { CaptchaStore } from '@/lib/captchaStore';

// Без этого Next.js закэширует ответ при сборке и все получат одну и ту же капчу
export const dynamic = 'force-dynamic';

export async function GET() {
  const { token, question } = CaptchaStore.create();
  return NextResponse.json({ token, question }, { headers: { 'Cache-Control': 'no-store' } });
}
