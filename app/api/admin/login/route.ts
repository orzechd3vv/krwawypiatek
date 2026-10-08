import { NextResponse } from "next/server";
import {
  adminCookie,
  clearFailedLogins,
  createAdminSession,
  isSameOrigin,
  loginRateLimited,
  loginRateLimitKey,
  productionAuthConfigured,
  recordFailedLogin,
  verifyAdminCredentials,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Odrzucono żądanie z innej domeny." }, { status: 403 });
  }
  if (process.env.NODE_ENV === "production" && !productionAuthConfigured()) {
    return NextResponse.json(
      { error: "Panel administratora nie został jeszcze skonfigurowany." },
      { status: 503 },
    );
  }

  const key = loginRateLimitKey(request);
  const limit = loginRateLimited(key);
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Zbyt wiele prób. Spróbuj ponownie za kilka minut." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane logowania." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    recordFailedLogin(key);
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło." }, { status: 401 });
  }

  if (!(await verifyAdminCredentials(parsed.data.username, parsed.data.password))) {
    recordFailedLogin(key);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło." }, { status: 401 });
  }

  clearFailedLogins(key);
  const token = await createAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookie.name, token, adminCookie.options);
  return response;
}
