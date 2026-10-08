import { apiError, guardAdminWrite } from "@/lib/api";
import { createCategory } from "@/lib/data";
import { categoryCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;

  try {
    const parsed = categoryCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Nieprawidłowa nazwa kategorii." },
        { status: 400 },
      );
    }
    const category = await createCategory(parsed.data.name);
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return apiError(error, "Nie udało się dodać kategorii.");
  }
}
