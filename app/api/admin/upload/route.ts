import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/api";
import { getStorageProvider } from "@/lib/data";
import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_SIZE, mediaKindFromMime } from "@/lib/validators";

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
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (!ALLOWED_MEDIA_TYPES.includes(contentType as (typeof ALLOWED_MEDIA_TYPES)[number])) {
      return NextResponse.json({ error: "Ten format pliku nie jest obsługiwany." }, { status: 415 });
    }
    if (!request.body || !Number.isFinite(contentLength) || contentLength <= 0) {
      return NextResponse.json({ error: "Plik jest pusty." }, { status: 400 });
    }
    if (contentLength > MAX_MEDIA_SIZE) {
      return NextResponse.json({ error: "Plik może mieć maksymalnie 100 MB." }, { status: 413 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    const resourceType = mediaKindFromMime(contentType) === "video" ? "video" : "image";
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `mvp-mafia/media/${crypto.randomUUID()}`;
    const signature = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(
        `public_id=${publicId}&timestamp=${timestamp}&upload_preset=${process.env.CLOUDINARY_UPLOAD_PRESET ?? "ml_default"}${apiSecret}`,
      ),
    );
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const form = new FormData();
    form.append("file", new Blob([await request.arrayBuffer()], { type: contentType }), publicId);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("public_id", publicId);
    form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET ?? "ml_default");
    form.append("signature", signatureHex);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`,
      { method: "POST", body: form },
    );
    const result = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message ?? "Cloudinary upload nie powiódł się.");
    }
    return NextResponse.json({
      url: result.secure_url,
      pathname: `${resourceType}|${publicId}`,
      contentType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
