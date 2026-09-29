"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: form.get("login"), password: form.get("password") }),
      });
      if (res.ok) {
        window.location.href = "/admin";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Ошибка входа");
    } catch {
      setError("Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">SberBits Admin Login</h1>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        <input name="login" placeholder="Логин" autoComplete="username" required className="border p-2 w-full rounded" />
        <input name="password" type="password" placeholder="Пароль" autoComplete="current-password" required className="border p-2 w-full rounded" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading} className="bg-black text-white px-4 py-2 rounded">Войти</button>
      </form>
    </main>
  );
}
