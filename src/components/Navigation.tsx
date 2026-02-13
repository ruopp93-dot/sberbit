"use client";

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Navigation() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <img src="/logo.png" alt="SberBits" className="h-9 w-auto" />
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--sb-muted)]">
            <span
              className="h-3 w-3 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 0 4px rgba(52, 211, 153, 0.12)' }}
              aria-hidden="true"
            />
            <span>Онлайн сейчас</span>
          </div>

          <div className="hidden sm:flex items-center gap-6 ml-6 text-sm text-[var(--sb-muted)]">
            <Link href="/" className="hover:text-[var(--foreground)]">
              Главная
            </Link>
            <Link href="/rates" className="hover:text-[var(--foreground)]">
              Курсы
            </Link>
            <Link href="/how-to-use" className="hover:text-[var(--foreground)]">
              Как пользоваться
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">
              Условия
            </Link>
          </div>

          <div className="hidden sm:flex items-center gap-3 ml-2">
            <a
              href="https://t.me/SberBitssupport"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-white shadow-lg"
              style={{ background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-2) 100%)' }}
            >
              Поддержка в Telegram
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
