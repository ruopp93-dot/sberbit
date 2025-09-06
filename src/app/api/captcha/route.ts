import { NextResponse } from 'next/server';
import { CaptchaStore } from '@/lib/captchaStore';

export async function GET() {
  const { token, question } = CaptchaStore.create();
  return NextResponse.json({ token, question });
}
