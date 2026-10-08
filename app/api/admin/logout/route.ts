import { NextResponse } from "next/server";
import { adminCookie, isSameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Odrzucono żądanie z innej domeny." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookie.name, "", {
    ...adminCookie.options,
    maxAge: 0,
  });
  return response;
}
