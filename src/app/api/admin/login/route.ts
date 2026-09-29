import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, SESSION_TTL_SEC, createSessionToken } from "@/lib/adminSession";
import { getClientIp, hashPassword, rateLimit, verifyPassword } from "@/lib/security";

const loginSchema = z.object({
  login: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts, try later" }, { status: 429 });
  }

  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const { login, password } = parsed.data;

    const admin = await prisma.admin.findUnique({
      where: { login },
    });

    const check = admin ? verifyPassword(password, admin.passwordHash) : { ok: false, needsRehash: false };
    if (!admin || !check.ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (check.needsRehash) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash: hashPassword(password) },
      });
    }

    const token = await createSessionToken(admin.id);
    if (!token) {
      console.error("ADMIN_SESSION_SECRET is not set (min 32 chars); admin login disabled");
      return NextResponse.json({ error: "Login unavailable" }, { status: 503 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL_SEC,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 400 });
  }
}
