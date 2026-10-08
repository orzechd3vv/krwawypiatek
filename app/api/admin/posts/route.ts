import { apiError, guardAdminWrite } from "@/lib/api";
import { createPost } from "@/lib/data";
import { postCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;

  try {
    const parsed = postCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          error: "Sprawdź dane publikacji.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const post = await createPost(parsed.data);
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return apiError(error, "Nie udało się opublikować wpisu.");
  }
}
