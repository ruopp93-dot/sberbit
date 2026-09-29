// Public site URL. Without a custom domain Vercel provides the *.vercel.app
// address via system env vars; NEXT_PUBLIC_SITE_URL overrides it if set.
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return 'http://localhost:3000';
}
