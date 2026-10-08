import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("contains the public forum and exact protected admin route", async () => {
  const [page, forum, admin] = await Promise.all([
    read("app/page.tsx"),
    read("components/Forum.tsx"),
    read("app/a/ad/adm/admi/admin/page.tsx"),
  ]);
  assert.match(page, /MVP MAFIA/);
  assert.match(forum, /Lista<\/h2>/);
  assert.match(forum, /post\.mediaType === "video"/);
  assert.match(admin, /hasAdminSession/);
});

test("keeps authorization and write validation on the server", async () => {
  const [auth, postRoute, categoryRoute] = await Promise.all([
    read("lib/auth.ts"),
    read("app/api/admin/posts/route.ts"),
    read("app/api/admin/categories/route.ts"),
  ]);
  assert.match(auth, /httpOnly: true/);
  assert.match(auth, /sameSite: "strict"/);
  assert.match(auth, /PBKDF2/);
  assert.match(postRoute, /guardAdminWrite/);
  assert.match(categoryRoute, /safeParse/);
});

test("is ready for Vercel persistence and media uploads", async () => {
  const [vercel, environment, data, upload] = await Promise.all([
    read("vercel.json"),
    read(".env.example"),
    read("lib/data.ts"),
    read("app/api/admin/upload/route.ts"),
  ]);
  assert.match(vercel, /nextjs/);
  assert.match(environment, /DATABASE_URL/);
  assert.match(environment, /BLOB_READ_WRITE_TOKEN/);
  assert.match(data, /@neondatabase\/serverless/);
  assert.match(upload, /allowedContentTypes/);
});
