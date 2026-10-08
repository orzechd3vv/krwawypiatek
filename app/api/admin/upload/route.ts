import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdminRequest, isSameOrigin } from "@/lib/auth";
import { getStorageProvider } from "@/lib/data";
import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_SIZE } from "@/lib/validators";

export async function POST(request: Request) {
  if (getStorageProvider() !== "vercel-blob") {
    return NextResponse.json(
      { error: "Magazyn Vercel Blob nie jest skonfigurowany." },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie uploadu." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => {
        if (!isSameOrigin(request) || !(await isAdminRequest(request))) {
          throw new Error("Sesja administratora wygasła.");
        }
        return {
          allowedContentTypes: [...ALLOWED_MEDIA_TYPES],
          maximumSizeInBytes: MAX_MEDIA_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ scope: "mvp-mafia-post-media" }),
        };
      },
      onUploadCompleted: async () => {
        // The post is created only after the authenticated browser receives the
        // resulting Blob URL. The signed callback is still consumed here.
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
