import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { TelegramSupport } from "@/components/TelegramSupport";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Обмен криптовалют",
  description: "Быстрый и безопасный обмен криптовалют на рубли и обратно",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
  {/* no inline theme script to avoid hydration mismatch; ThemeToggle updates CSS variables on user interaction */}
      <body className={`${inter.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}>
        <Navigation />
        {children}
        <TelegramSupport />
      </body>
    </html>
  );
}
