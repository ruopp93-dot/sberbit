import { NextResponse } from 'next/server';

export async function GET() {
  const key = '__SB_RATES_SSE_CLIENTS_V1__';
  const g: any = (globalThis as any) || {};
  if (!g[key]) g[key] = new Set();
  const clients: Set<any> = g[key];

  const stream = new ReadableStream({
    start(controller) {
      // enqueue a comment to keep connection alive
      controller.enqueue(':' + Array(2048).join(' ') + '\n');
      controller.enqueue('\n');
  // register client
  clients.add(controller);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
