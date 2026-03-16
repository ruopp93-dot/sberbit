import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { TelegramSupport } from "@/components/TelegramSupport";

export const metadata: Metadata = {
  title: "SberBits — Обмен криптовалют",
  description: "Быстрый и безопасный обмен USDT, BTC, ETH на рубли. Переводы через Тинькофф, Сбербанк, СБП.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
  {/* no inline theme script to avoid hydration mismatch; ThemeToggle updates CSS variables on user interaction */}
      <body className={`antialiased bg-[var(--background)] text-[var(--foreground)]`}>
        <Navigation />
        {children}
        <TelegramSupport />
      </body>
    </html>
  );
}
