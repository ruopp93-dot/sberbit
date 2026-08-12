export default function AdminLoginPage() {
  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">SberBits Admin Login</h1>
      <form className="space-y-4">
        <input name="login" placeholder="Логин" className="border p-2 w-full rounded" />
        <input name="password" type="password" placeholder="Пароль" className="border p-2 w-full rounded" />
        <button className="bg-black text-white px-4 py-2 rounded">Войти</button>
      </form>
    </main>
  );
}
