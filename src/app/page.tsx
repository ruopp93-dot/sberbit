import { ExchangeForm } from '@/components/ExchangeForm';
import Link from 'next/link';

function FeatureIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center shadow-lg backdrop-blur">
      <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20">
        {icon}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-[var(--sb-muted)]">{value}</div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 grid grid-cols-3 gap-3 text-xs text-[var(--sb-muted)]">
          <div className="flex items-center gap-2">
            <FeatureIcon>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </FeatureIcon>
            <span className="leading-tight">Быстрый обмен: 5–10&nbsp;мин</span>
          </div>
          <div className="flex items-center gap-2">
            <FeatureIcon>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </FeatureIcon>
            <span className="leading-tight">Безопасные сделки</span>
          </div>
          <div className="flex items-center gap-2">
            <FeatureIcon>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5A8.5 8.5 0 0 1 21 11v.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </FeatureIcon>
            <span className="leading-tight">Поддержка в&nbsp;Telegram</span>
          </div>
        </div>

        <ExchangeForm />

        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard
            title="Опыт"
            value="5 лет работы"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <StatCard
            title="Сделок"
            value="235,000+"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <StatCard
            title="Отзывы"
            value={
              <span className="inline-flex items-center gap-1">
                <span className="text-amber-400">★★★★★</span>
                <span className="text-[var(--sb-muted)]">4.9</span>
              </span>
            }
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 17.3l-5.5 3 1-6.3L2 9.2l6.4-1L12 2.5l3.6 5.7 6.4 1-4.5 4.8 1 6.3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
        </div>

        <div className="mt-7 flex items-center justify-center gap-8 text-sm text-[var(--sb-muted)]">
          <Link href="/how-to-use" className="inline-flex items-center gap-2 hover:text-[var(--foreground)]">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5"
              aria-hidden="true"
            >
              i
            </span>
            О сервисе
          </Link>
          <a
            href="https://t.me/SberBitssupport"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-[var(--foreground)]"
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5"
              aria-hidden="true"
            >
              ?
            </span>
            Техподдержка
          </a>
        </div>
      </div>
    </main>
  );
}
