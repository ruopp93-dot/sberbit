"use client";

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

export function Navigation() {
  return (
  <nav className="shadow" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center" style={{ textDecoration: 'none' }}>
                <Image src="/logo.png" alt="SberBitS" width={120} height={36} style={{ height: 36, width: 'auto' }} />
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className="border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                style={{ color: 'var(--foreground)', opacity: 0.85 }}
              >
                Главная
              </Link>
              <Link
                href="/rates"
                className="border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                style={{ color: 'var(--foreground)', opacity: 0.85 }}
              >
                Курсы
              </Link>
              <Link
                href="/how-to-use"
                className="border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                style={{ color: 'var(--foreground)', opacity: 0.85 }}
              >
                Как пользоваться
              </Link>
              <Link
                href="/terms"
                className="border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                style={{ color: 'var(--foreground)', opacity: 0.85 }}
              >
                Условия
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <a
              href="https://t.me/SberBitssupport"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md"
              style={{ background: 'var(--accent, #2563eb)', color: '#fff' }}
            >
              Связаться с поддержкой
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
