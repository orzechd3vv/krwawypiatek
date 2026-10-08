import { getR2Bucket } from "@/lib/data";

type RouteContext = { params: Promise<{ key: string[] }> };

function baseHeaders(object: R2Object): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  return headers;
}

function parseRange(value: string, size: number): { offset: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;
  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  if (Number.isNaN(start)) {
    const suffixLength = Math.min(end, size);
    start = size - suffixLength;
    end = size - 1;
  } else {
    end = Number.isNaN(end) ? size - 1 : Math.min(end, size - 1);
  }
  if (start < 0 || start >= size || end < start) return null;
  return { offset: start, length: end - start + 1 };
}

export async function GET(request: Request, context: RouteContext) {
  const bucket = getR2Bucket();
  if (!bucket) return new Response("Not found", { status: 404 });
  const { key: segments } = await context.params;
  const key = segments.join("/");
  if (!key.startsWith("media/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const metadata = await bucket.head(key);
    if (!metadata) return new Response("Not found", { status: 404 });
    const range = parseRange(rangeHeader, metadata.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${metadata.size}` },
      });
    }
    const object = await bucket.get(key, { range });
    if (!object) return new Response("Not found", { status: 404 });
    const headers = baseHeaders(object);
    headers.set("content-length", String(range.length));
    headers.set(
      "content-range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`,
    );
    return new Response(object.body, { status: 206, headers });
  }

  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = baseHeaders(object);
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

export async function HEAD(_request: Request, context: RouteContext) {
  const bucket = getR2Bucket();
  if (!bucket) return new Response(null, { status: 404 });
  const { key: segments } = await context.params;
  const key = segments.join("/");
  if (!key.startsWith("media/") || key.includes("..")) {
    return new Response(null, { status: 404 });
  }
  const object = await bucket.head(key);
  if (!object) return new Response(null, { status: 404 });
  const headers = baseHeaders(object);
  headers.set("content-length", String(object.size));
  return new Response(null, { headers });
}
