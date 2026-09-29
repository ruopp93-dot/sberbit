import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

const STATIC_PAGES = ['/', '/rates', '/how-to-use', '/terms'];

export async function GET() {
  // Host header is not trusted (the response is cached by CDN → cache poisoning).
  const origin = getSiteUrl();
  const urls = STATIC_PAGES.map(
    (p) => `  <url>\n    <loc>${origin}${p}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
