import { apiError, guardAdminWrite } from "@/lib/api";
import { deleteEntry, updateEntry } from "@/lib/data";
import { entryUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const parsed = entryUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Nieprawidłowa nazwa pozycji." },
        { status: 400 },
      );
    }
    await updateEntry(id, parsed.data.name);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Nie udało się zmienić pozycji.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    await deleteEntry(id);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Nie udało się usunąć pozycji.");
  }
}
