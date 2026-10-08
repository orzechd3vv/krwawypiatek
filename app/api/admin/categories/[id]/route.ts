import { apiError, guardAdminWrite } from "@/lib/api";
import { deleteCategory, updateCategory } from "@/lib/data";
import { categoryCreateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const parsed = categoryCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Nieprawidłowa nazwa kategorii." },
        { status: 400 },
      );
    }
    await updateCategory(id, parsed.data.name);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Nie udało się zmienić kategorii.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    await deleteCategory(id);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Nie udało się usunąć kategorii.");
  }
}
