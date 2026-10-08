import { apiError, guardAdminWrite } from "@/lib/api";
import { createEntry } from "@/lib/data";
import { entryCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  try {
    const parsed = entryCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane pozycji." },
        { status: 400 },
      );
    }
    const entry = await createEntry(parsed.data.categoryId, parsed.data.name);
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    return apiError(error, "Nie udało się dodać pozycji.");
  }
}
