import { apiError, guardAdminWrite } from "@/lib/api";
import { deletePost, deleteStoredMedia, updatePost } from "@/lib/data";
import { postUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    if (!id || id.length > 100) return Response.json({ error: "Nieprawidłowe ID." }, { status: 400 });
    const parsed = postUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          error: "Sprawdź dane publikacji.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const result = await updatePost(id, parsed.data);
    if (
      Object.prototype.hasOwnProperty.call(parsed.data, "media") &&
      result.previousMediaPathname &&
      result.previousMediaPathname !== result.post.mediaPathname
    ) {
      await deleteStoredMedia(result.previousMediaPathname);
    }
    return Response.json({ post: result.post });
  } catch (error) {
    return apiError(error, "Nie udało się zapisać publikacji.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    if (!id || id.length > 100) return Response.json({ error: "Nieprawidłowe ID." }, { status: 400 });
    const post = await deletePost(id);
    await deleteStoredMedia(post.mediaPathname);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Nie udało się usunąć publikacji.");
  }
}
