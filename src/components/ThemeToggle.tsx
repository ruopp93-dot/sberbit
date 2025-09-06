"use client";

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system');

  useEffect(() => {
    const saved = localStorage.getItem('site-theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      applyTheme(saved);
    } else {
      setTheme('system');
      // respect system preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  function applyTheme(t: 'dark' | 'light') {
    const el = document.documentElement;
    if (t === 'dark') {
      el.style.setProperty('--background', '#0a0a0a');
      el.style.setProperty('--foreground', '#ededed');
    } else {
      el.style.setProperty('--background', '#ffffff');
      el.style.setProperty('--foreground', '#171717');
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
      className="ml-3 p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
