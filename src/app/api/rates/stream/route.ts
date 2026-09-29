import { NextResponse } from 'next/server';

const MAX_CLIENTS = 500;

export async function GET() {
  const key = '__SB_RATES_SSE_CLIENTS_V1__';
  const g: any = (globalThis as any) || {};
  if (!g[key]) g[key] = new Set();
  const clients: Set<any> = g[key];

  if (clients.size >= MAX_CLIENTS) {
    return NextResponse.json({ error: 'Too many connections' }, { status: 503 });
  }

  let ctl: ReadableStreamDefaultController | null = null;
  const stream = new ReadableStream({
    start(controller) {
      ctl = controller;
      // enqueue a comment to keep connection alive
      controller.enqueue(':' + Array(2048).join(' ') + '\n');
      controller.enqueue('\n');
      // register client
      clients.add(controller);
    },
    cancel() {
      // client disconnected — drop the controller so it can be garbage-collected
      if (ctl) clients.delete(ctl);
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
