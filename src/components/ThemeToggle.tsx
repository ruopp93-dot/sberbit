"use client";

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('site-theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  function applyTheme(t: 'dark' | 'light') {
    const el = document.documentElement;
    if (t === 'dark') {
      el.style.setProperty('--background', '#0b1020');
      el.style.setProperty('--foreground', '#e8edf6');
      el.style.setProperty('--sb-surface', 'rgba(255, 255, 255, 0.06)');
      el.style.setProperty('--sb-surface-2', 'rgba(255, 255, 255, 0.04)');
      el.style.setProperty('--sb-border', 'rgba(255, 255, 255, 0.1)');
      el.style.setProperty('--sb-border-strong', 'rgba(255, 255, 255, 0.16)');
      el.style.setProperty('--sb-muted', 'rgba(232, 237, 246, 0.72)');
      el.style.setProperty('--sb-muted-2', 'rgba(232, 237, 246, 0.58)');
      el.style.setProperty(
        '--sb-page-gradient',
        'radial-gradient(800px circle at 15% 0%, rgba(34, 197, 94, 0.15), transparent 60%), radial-gradient(900px circle at 85% 15%, rgba(59, 130, 246, 0.12), transparent 55%), linear-gradient(180deg, #0e1730 0%, #0b1020 35%, #070b14 100%)'
      );
    } else {
      el.style.setProperty('--background', '#f6f7fb');
      el.style.setProperty('--foreground', '#0b1020');
      el.style.setProperty('--sb-surface', 'rgba(11, 16, 32, 0.06)');
      el.style.setProperty('--sb-surface-2', 'rgba(11, 16, 32, 0.04)');
      el.style.setProperty('--sb-border', 'rgba(11, 16, 32, 0.14)');
      el.style.setProperty('--sb-border-strong', 'rgba(11, 16, 32, 0.22)');
      el.style.setProperty('--sb-muted', 'rgba(11, 16, 32, 0.74)');
      el.style.setProperty('--sb-muted-2', 'rgba(11, 16, 32, 0.6)');
      el.style.setProperty(
        '--sb-page-gradient',
        'radial-gradient(900px circle at 15% 0%, rgba(34, 197, 94, 0.12), transparent 55%), radial-gradient(900px circle at 85% 15%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, #ffffff 0%, #f6f7fb 45%, #eef1f8 100%)'
      );
    }
  }

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('site-theme', next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      title="Переключить тему"
      className="ml-2 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--sb-muted)] hover:text-[var(--foreground)]"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
