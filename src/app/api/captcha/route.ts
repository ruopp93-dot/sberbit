import { NextResponse } from 'next/server'
import { CaptchaStore } from '@/lib/captchaStore'

export async function GET() {
  const { token, imageData } = CaptchaStore.create()
  return NextResponse.json({ token, imageData })
}
