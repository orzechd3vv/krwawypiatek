import "server-only";

import { NextResponse } from "next/server";
import { isAdminRequest, isSameOrigin } from "./auth";

export function apiError(error: unknown, fallback = "Wystąpił nieoczekiwany błąd.") {
  const message = error instanceof Error ? error.message : fallback;
  const duplicate =
    message.includes("UNIQUE constraint failed") ||
    message.includes("duplicate key value") ||
    message.includes("23505");
  return NextResponse.json(
    { error: duplicate ? "Element o tej nazwie już istnieje." : message },
    { status: duplicate ? 409 : 500 },
  );
}

export async function guardAdminWrite(request: Request): Promise<NextResponse | null> {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Odrzucono żądanie z innej domeny." }, { status: 403 });
  }
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Sesja wygasła. Zaloguj się ponownie." }, { status: 401 });
  }
  return null;
}
