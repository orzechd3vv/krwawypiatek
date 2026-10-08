import { guardAdminWrite } from "@/lib/api";
import { getR2Bucket } from "@/lib/data";
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_SIZE,
  mediaKindFromMime,
} from "@/lib/validators";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(request: Request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;
  const bucket = getR2Bucket();
  if (!bucket) {
    return Response.json({ error: "Magazyn mediów nie jest skonfigurowany." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!ALLOWED_MEDIA_TYPES.includes(contentType as (typeof ALLOWED_MEDIA_TYPES)[number])) {
    return Response.json({ error: "Ten format pliku nie jest obsługiwany." }, { status: 415 });
  }
  if (!request.body || !Number.isFinite(contentLength) || contentLength <= 0) {
    return Response.json({ error: "Plik jest pusty." }, { status: 400 });
  }
  if (contentLength > MAX_MEDIA_SIZE) {
    return Response.json({ error: "Plik może mieć maksymalnie 100 MB." }, { status: 413 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const key = `media/${date}/${crypto.randomUUID()}.${extensions[contentType]}`;
  await bucket.put(key, request.body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      kind: mediaKindFromMime(contentType) ?? "unknown",
    },
  });

  return Response.json({
    url: `/media/${key}`,
    pathname: key,
    contentType,
  });
}
