import { NextResponse } from 'next/server';

const STATIC_PAGES = [
  '/',
  '/rates',
  '/how-to-use',
  '/terms',
];

function formatUrl(origin: string, path: string) {
  return `${origin}${path}`;
}

export async function GET(request: Request) {
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || (request.headers.get('host') ? `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}` : 'https://sberbit.vercel.app');

    const urls = STATIC_PAGES.map((p) => `  <url>\n    <loc>${formatUrl(origin, p)}</loc>\n    <changefreq>minute</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('sitemap error', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
