import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/api";
import { getStorageProvider } from "@/lib/data";
import { createHash } from "node:crypto";
import { ALLOWED_MEDIA_TYPES, mediaKindFromMime } from "@/lib/validators";

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  if (getStorageProvider() !== "cloudinary") {
    return NextResponse.json(
      { error: "Magazyn Cloudinary nie jest skonfigurowany." },
      { status: 503 },
    );
  }

  try {
    const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!ALLOWED_MEDIA_TYPES.includes(contentType as (typeof ALLOWED_MEDIA_TYPES)[number])) {
      return NextResponse.json({ error: "Ten format pliku nie jest obsługiwany." }, { status: 415 });
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    const resourceType = mediaKindFromMime(contentType) === "video" ? "video" : "image";
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `mvp-mafia/media/${crypto.randomUUID()}`;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET ?? "ml_default";
    const signature = createHash("sha1")
      .update(
        `public_id=${publicId}&timestamp=${timestamp}&upload_preset=${uploadPreset}${apiSecret}`,
      )
      .digest("hex");
    return NextResponse.json({
      cloudName,
      apiKey,
      resourceType,
      publicId,
      timestamp,
      uploadPreset,
      signature,
      contentType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
