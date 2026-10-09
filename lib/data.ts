import "server-only";

import { createHash } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "cloudflare:workers";
import { cloneDefaultForumData, defaultForumData } from "./default-data";
import type {
  ForumData,
  ForumPost,
  ListCategory,
  ListEntry,
  MediaType,
  StorageProvider,
} from "./types";

type CloudflareBindings = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
};

type PostRow = {
  id: string;
  title: string;
  description: string;
  media_url: string | null;
  media_pathname: string | null;
  media_type: MediaType | null;
  published_at: string;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type EntryRow = {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type PostInput = {
  title: string;
  description: string;
  media?: {
    url: string;
    pathname: string;
    type: MediaType;
  } | null;
};

type PostPatch = Partial<PostInput>;

const bindings = env as CloudflareBindings;
let d1Ready: Promise<void> | null = null;
let postgresReady: Promise<void> | null = null;
let postgresClient: NeonQueryFunction<false, false> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function mapPost(row: PostRow): ForumPost {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mediaUrl: row.media_url,
    mediaPathname: row.media_pathname,
    mediaType: row.media_type,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEntry(row: EntryRow): ListEntry {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
  };
}

function joinCategories(
  categoryRows: CategoryRow[],
  entryRows: EntryRow[],
): ListCategory[] {
  const byCategory = new Map<string, ListEntry[]>();
  for (const row of entryRows) {
    const entry = mapEntry(row);
    const current = byCategory.get(entry.categoryId) ?? [];
    current.push(entry);
    byCategory.set(entry.categoryId, current);
  }

  return categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    entries: byCategory.get(row.id) ?? [],
  }));
}

function demoStore(): ForumData {
  const scope = globalThis as typeof globalThis & {
    __mvpMafiaDemoData?: ForumData;
  };
  scope.__mvpMafiaDemoData ??= cloneDefaultForumData();
  return scope.__mvpMafiaDemoData;
}

function isPreviewMode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_DATA === "true";
}

function getPostgres(): NeonQueryFunction<false, false> | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  postgresClient ??= neon(databaseUrl);
  return postgresClient;
}

function backend(): "d1" | "postgres" | "preview" {
  if (bindings.DB) return "d1";
  if (getPostgres()) return "postgres";
  if (isPreviewMode()) return "preview";
  throw new Error(
    "Brak bazy danych. Połącz Neon z projektem Vercel i ustaw DATABASE_URL.",
  );
}

async function initializeD1(): Promise<void> {
  if (!bindings.DB) return;
  if (!d1Ready) {
    d1Ready = (async () => {
      const db = bindings.DB!;
      await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          media_url TEXT,
          media_pathname TEXT,
          media_type TEXT CHECK (media_type IN ('image', 'video') OR media_type IS NULL),
          published_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS list_entries (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL,
          name TEXT NOT NULL COLLATE NOCASE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
          UNIQUE (category_id, name)
        )`),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts (published_at DESC)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories (sort_order, id)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS idx_entries_category_sort ON list_entries (category_id, sort_order, id)",
        ),
      ]);

      await db.batch([
        ...defaultForumData.posts.map((post) =>
          db
            .prepare(
              `INSERT INTO posts
                (id, title, description, media_url, media_pathname, media_type, published_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO NOTHING`,
            )
            .bind(
              post.id,
              post.title,
              post.description,
              post.mediaUrl,
              post.mediaPathname,
              post.mediaType,
              post.publishedAt,
              post.createdAt,
              post.updatedAt,
            ),
        ),
        ...defaultForumData.categories.map((category) =>
          db
            .prepare(
              `INSERT INTO categories (id, name, sort_order, created_at)
               VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
            )
            .bind(
              category.id,
              category.name,
              category.sortOrder,
              category.createdAt,
            ),
        ),
        ...defaultForumData.categories.flatMap((category) =>
          category.entries.map((entry) =>
            db
              .prepare(
                `INSERT INTO list_entries (id, category_id, name, sort_order, created_at)
                 VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
              )
              .bind(
                entry.id,
                entry.categoryId,
                entry.name,
                entry.sortOrder,
                entry.createdAt,
              ),
          ),
        ),
      ]);

      await db.prepare("PRAGMA optimize").run();
    })().catch((error) => {
      d1Ready = null;
      throw error;
    });
  }
  await d1Ready;
}

async function initializePostgres(): Promise<void> {
  const sql = getPostgres();
  if (!sql) return;
  if (!postgresReady) {
    postgresReady = (async () => {
      await sql.transaction((tx) => [
        tx.query(`CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          title VARCHAR(120) NOT NULL,
          description TEXT NOT NULL,
          media_url TEXT,
          media_pathname TEXT,
          media_type VARCHAR(10) CHECK (media_type IN ('image', 'video') OR media_type IS NULL),
          published_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )`),
        tx.query(`CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name VARCHAR(40) NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL
        )`),
        tx.query(`CREATE TABLE IF NOT EXISTS list_entries (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          name VARCHAR(80) NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL
        )`),
        tx.query(
          "CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts (published_at DESC)",
        ),
        tx.query(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique ON categories (LOWER(name))",
        ),
        tx.query(
          "CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories (sort_order, id)",
        ),
        tx.query(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_category_name_unique ON list_entries (category_id, LOWER(name))",
        ),
        tx.query(
          "CREATE INDEX IF NOT EXISTS idx_entries_category_sort ON list_entries (category_id, sort_order, id)",
        ),
      ]);

      if (defaultForumData.posts.length > 0 || defaultForumData.categories.length > 0) {
        await sql.transaction((tx) => [
          ...defaultForumData.posts.map((post) =>
            tx.query(
              `INSERT INTO posts
                (id, title, description, media_url, media_pathname, media_type, published_at, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT(id) DO NOTHING`,
              [
                post.id,
                post.title,
                post.description,
                post.mediaUrl,
                post.mediaPathname,
                post.mediaType,
                post.publishedAt,
                post.createdAt,
                post.updatedAt,
              ],
            ),
          ),
          ...defaultForumData.categories.map((category) =>
            tx.query(
              `INSERT INTO categories (id, name, sort_order, created_at)
               VALUES ($1, $2, $3, $4) ON CONFLICT(id) DO NOTHING`,
              [category.id, category.name, category.sortOrder, category.createdAt],
            ),
          ),
          ...defaultForumData.categories.flatMap((category) =>
            category.entries.map((entry) =>
              tx.query(
                `INSERT INTO list_entries (id, category_id, name, sort_order, created_at)
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO NOTHING`,
                [
                  entry.id,
                  entry.categoryId,
                  entry.name,
                  entry.sortOrder,
                  entry.createdAt,
                ],
              ),
            ),
          ),
        ]);
      }
    })().catch((error) => {
      postgresReady = null;
      throw error;
    });
  }
  await postgresReady;
}

async function prepareBackend(): Promise<"d1" | "postgres" | "preview"> {
  const selected = backend();
  if (selected === "d1") await initializeD1();
  if (selected === "postgres") await initializePostgres();
  return selected;
}

export async function getForumData(): Promise<ForumData> {
  const selected = await prepareBackend();
  if (selected === "preview") return structuredClone(demoStore());

  let posts: PostRow[];
  let categories: CategoryRow[];
  let entries: EntryRow[];

  if (selected === "d1") {
    const db = bindings.DB!;
    const [postResult, categoryResult, entryResult] = await Promise.all([
      db
        .prepare(
          `SELECT id, title, description, media_url, media_pathname, media_type,
                  published_at, created_at, updated_at
           FROM posts ORDER BY published_at DESC, id DESC LIMIT 100`,
        )
        .all<PostRow>(),
      db
        .prepare(
          `SELECT id, name, sort_order, created_at
           FROM categories ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
        )
        .all<CategoryRow>(),
      db
        .prepare(
          `SELECT id, category_id, name, sort_order, created_at
           FROM list_entries ORDER BY category_id, sort_order ASC, name COLLATE NOCASE ASC`,
        )
        .all<EntryRow>(),
    ]);
    posts = postResult.results;
    categories = categoryResult.results;
    entries = entryResult.results;
  } else {
    const sql = getPostgres()!;
    const [postRows, categoryRows, entryRows] = await sql.transaction((tx) => [
      tx.query(
        `SELECT id, title, description, media_url, media_pathname, media_type,
                published_at::text, created_at::text, updated_at::text
         FROM posts ORDER BY published_at DESC, id DESC LIMIT 100`,
      ),
      tx.query(
        `SELECT id, name, sort_order, created_at::text
         FROM categories ORDER BY sort_order ASC, LOWER(name) ASC`,
      ),
      tx.query(
        `SELECT id, category_id, name, sort_order, created_at::text
         FROM list_entries ORDER BY category_id, sort_order ASC, LOWER(name) ASC`,
      ),
    ]);
    posts = postRows as PostRow[];
    categories = categoryRows as CategoryRow[];
    entries = entryRows as EntryRow[];
  }

  return {
    posts: posts.map(mapPost),
    categories: joinCategories(categories, entries),
    source: "database",
  };
}

export async function createPost(input: PostInput): Promise<ForumPost> {
  const selected = await prepareBackend();
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const media = input.media ?? null;

  if (selected === "preview") {
    const post: ForumPost = {
      id,
      title: input.title,
      description: input.description,
      mediaUrl: media?.url ?? null,
      mediaPathname: media?.pathname ?? null,
      mediaType: media?.type ?? null,
      publishedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    demoStore().posts.unshift(post);
    return structuredClone(post);
  }

  let row: PostRow | null;
  if (selected === "d1") {
    row = await bindings.DB!
      .prepare(
        `INSERT INTO posts
          (id, title, description, media_url, media_pathname, media_type, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .bind(
        id,
        input.title,
        input.description,
        media?.url ?? null,
        media?.pathname ?? null,
        media?.type ?? null,
        timestamp,
        timestamp,
        timestamp,
      )
      .first<PostRow>();
  } else {
    const rows = (await getPostgres()!.query(
      `INSERT INTO posts
        (id, title, description, media_url, media_pathname, media_type, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, media_url, media_pathname, media_type,
                 published_at::text, created_at::text, updated_at::text`,
      [
        id,
        input.title,
        input.description,
        media?.url ?? null,
        media?.pathname ?? null,
        media?.type ?? null,
        timestamp,
        timestamp,
        timestamp,
      ],
    )) as PostRow[];
    row = rows[0] ?? null;
  }
  if (!row) throw new Error("Nie udało się utworzyć publikacji.");
  return mapPost(row);
}

export async function updatePost(
  id: string,
  patch: PostPatch,
): Promise<{ post: ForumPost; previousMediaPathname: string | null }> {
  const selected = await prepareBackend();
  const timestamp = nowIso();
  const mediaChanged = Object.prototype.hasOwnProperty.call(patch, "media");

  if (selected === "preview") {
    const index = demoStore().posts.findIndex((post) => post.id === id);
    if (index < 0) throw new Error("Publikacja nie istnieje.");
    const current = demoStore().posts[index];
    const previousMediaPathname = current.mediaPathname;
    const media = mediaChanged ? patch.media ?? null : undefined;
    const next: ForumPost = {
      ...current,
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      mediaUrl: mediaChanged ? media?.url ?? null : current.mediaUrl,
      mediaPathname: mediaChanged ? media?.pathname ?? null : current.mediaPathname,
      mediaType: mediaChanged ? media?.type ?? null : current.mediaType,
      updatedAt: timestamp,
    };
    demoStore().posts[index] = next;
    return { post: structuredClone(next), previousMediaPathname };
  }

  const media = patch.media ?? null;
  let previous: PostRow | null;
  let updated: PostRow | null;

  if (selected === "d1") {
    const db = bindings.DB!;
    previous = await db
      .prepare("SELECT * FROM posts WHERE id = ?")
      .bind(id)
      .first<PostRow>();
    if (!previous) throw new Error("Publikacja nie istnieje.");
    updated = await db
      .prepare(
        `UPDATE posts SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          media_url = CASE WHEN ? = 1 THEN ? ELSE media_url END,
          media_pathname = CASE WHEN ? = 1 THEN ? ELSE media_pathname END,
          media_type = CASE WHEN ? = 1 THEN ? ELSE media_type END,
          updated_at = ?
         WHERE id = ? RETURNING *`,
      )
      .bind(
        patch.title ?? null,
        patch.description ?? null,
        mediaChanged ? 1 : 0,
        media?.url ?? null,
        mediaChanged ? 1 : 0,
        media?.pathname ?? null,
        mediaChanged ? 1 : 0,
        media?.type ?? null,
        timestamp,
        id,
      )
      .first<PostRow>();
  } else {
    const sql = getPostgres()!;
    const previousRows = (await sql.query(
      `SELECT id, title, description, media_url, media_pathname, media_type,
              published_at::text, created_at::text, updated_at::text
       FROM posts WHERE id = $1`,
      [id],
    )) as PostRow[];
    previous = previousRows[0] ?? null;
    if (!previous) throw new Error("Publikacja nie istnieje.");
    const rows = (await sql.query(
      `UPDATE posts SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        media_url = CASE WHEN $3 THEN $4 ELSE media_url END,
        media_pathname = CASE WHEN $3 THEN $5 ELSE media_pathname END,
        media_type = CASE WHEN $3 THEN $6 ELSE media_type END,
        updated_at = $7
       WHERE id = $8
       RETURNING id, title, description, media_url, media_pathname, media_type,
                 published_at::text, created_at::text, updated_at::text`,
      [
        patch.title ?? null,
        patch.description ?? null,
        mediaChanged,
        media?.url ?? null,
        media?.pathname ?? null,
        media?.type ?? null,
        timestamp,
        id,
      ],
    )) as PostRow[];
    updated = rows[0] ?? null;
  }

  if (!updated || !previous) throw new Error("Nie udało się zapisać publikacji.");
  return {
    post: mapPost(updated),
    previousMediaPathname: previous.media_pathname,
  };
}

export async function deletePost(id: string): Promise<ForumPost> {
  const selected = await prepareBackend();
  if (selected === "preview") {
    const index = demoStore().posts.findIndex((post) => post.id === id);
    if (index < 0) throw new Error("Publikacja nie istnieje.");
    const [removed] = demoStore().posts.splice(index, 1);
    return structuredClone(removed);
  }

  let row: PostRow | null;
  if (selected === "d1") {
    row = await bindings.DB!
      .prepare("DELETE FROM posts WHERE id = ? RETURNING *")
      .bind(id)
      .first<PostRow>();
  } else {
    const rows = (await getPostgres()!.query(
      `DELETE FROM posts WHERE id = $1
       RETURNING id, title, description, media_url, media_pathname, media_type,
                 published_at::text, created_at::text, updated_at::text`,
      [id],
    )) as PostRow[];
    row = rows[0] ?? null;
  }
  if (!row) throw new Error("Publikacja nie istnieje.");
  return mapPost(row);
}

export async function createCategory(name: string): Promise<ListCategory> {
  const selected = await prepareBackend();
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  if (selected === "preview") {
    if (
      demoStore().categories.some(
        (category) => category.name.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"),
      )
    ) {
      throw new Error("Kategoria o tej nazwie już istnieje.");
    }
    const category: ListCategory = {
      id,
      name,
      sortOrder: (demoStore().categories.at(-1)?.sortOrder ?? 0) + 10,
      createdAt: timestamp,
      entries: [],
    };
    demoStore().categories.push(category);
    return structuredClone(category);
  }

  let row: CategoryRow | null;
  if (selected === "d1") {
    row = await bindings.DB!
      .prepare(
        `INSERT INTO categories (id, name, sort_order, created_at)
         VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 10 FROM categories), 10), ?)
         RETURNING *`,
      )
      .bind(id, name, timestamp)
      .first<CategoryRow>();
  } else {
    const rows = (await getPostgres()!.query(
      `INSERT INTO categories (id, name, sort_order, created_at)
       VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 10 FROM categories), 10), $3)
       RETURNING id, name, sort_order, created_at::text`,
      [id, name, timestamp],
    )) as CategoryRow[];
    row = rows[0] ?? null;
  }
  if (!row) throw new Error("Nie udało się dodać kategorii.");
  return { ...row, sortOrder: Number(row.sort_order), createdAt: row.created_at, entries: [] };
}

export async function updateCategory(id: string, name: string): Promise<void> {
  const selected = await prepareBackend();
  if (selected === "preview") {
    const category = demoStore().categories.find((item) => item.id === id);
    if (!category) throw new Error("Kategoria nie istnieje.");
    if (
      demoStore().categories.some(
        (item) =>
          item.id !== id &&
          item.name.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"),
      )
    ) {
      throw new Error("Kategoria o tej nazwie już istnieje.");
    }
    category.name = name;
    return;
  }

  if (selected === "d1") {
    const result = await bindings.DB!
      .prepare("UPDATE categories SET name = ? WHERE id = ?")
      .bind(name, id)
      .run();
    if (!result.meta.changes) throw new Error("Kategoria nie istnieje.");
  } else {
    const rows = await getPostgres()!.query(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING id",
      [name, id],
    );
    if (!rows.length) throw new Error("Kategoria nie istnieje.");
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const selected = await prepareBackend();
  if (selected === "preview") {
    const index = demoStore().categories.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Kategoria nie istnieje.");
    demoStore().categories.splice(index, 1);
    return;
  }

  if (selected === "d1") {
    const result = await bindings.DB!
      .prepare("DELETE FROM categories WHERE id = ?")
      .bind(id)
      .run();
    if (!result.meta.changes) throw new Error("Kategoria nie istnieje.");
  } else {
    const rows = await getPostgres()!.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [id],
    );
    if (!rows.length) throw new Error("Kategoria nie istnieje.");
  }
}

export async function createEntry(
  categoryId: string,
  name: string,
): Promise<ListEntry> {
  const selected = await prepareBackend();
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  if (selected === "preview") {
    const category = demoStore().categories.find((item) => item.id === categoryId);
    if (!category) throw new Error("Kategoria nie istnieje.");
    if (
      category.entries.some(
        (entry) => entry.name.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"),
      )
    ) {
      throw new Error("Taka pozycja już istnieje w tej kategorii.");
    }
    const entry: ListEntry = {
      id,
      categoryId,
      name,
      sortOrder: (category.entries.at(-1)?.sortOrder ?? 0) + 10,
      createdAt: timestamp,
    };
    category.entries.push(entry);
    return structuredClone(entry);
  }

  let row: EntryRow | null;
  if (selected === "d1") {
    row = await bindings.DB!
      .prepare(
        `INSERT INTO list_entries (id, category_id, name, sort_order, created_at)
         VALUES (
           ?, ?, ?,
           COALESCE((SELECT MAX(sort_order) + 10 FROM list_entries WHERE category_id = ?), 10),
           ?
         ) RETURNING *`,
      )
      .bind(id, categoryId, name, categoryId, timestamp)
      .first<EntryRow>();
  } else {
    const rows = (await getPostgres()!.query(
      `INSERT INTO list_entries (id, category_id, name, sort_order, created_at)
       VALUES (
         $1, $2, $3,
         COALESCE((SELECT MAX(sort_order) + 10 FROM list_entries WHERE category_id = $2), 10),
         $4
       ) RETURNING id, category_id, name, sort_order, created_at::text`,
      [id, categoryId, name, timestamp],
    )) as EntryRow[];
    row = rows[0] ?? null;
  }
  if (!row) throw new Error("Nie udało się dodać pozycji.");
  return mapEntry(row);
}

export async function updateEntry(id: string, name: string): Promise<void> {
  const selected = await prepareBackend();
  if (selected === "preview") {
    for (const category of demoStore().categories) {
      const entry = category.entries.find((item) => item.id === id);
      if (!entry) continue;
      if (
        category.entries.some(
          (item) =>
            item.id !== id &&
            item.name.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"),
        )
      ) {
        throw new Error("Taka pozycja już istnieje w tej kategorii.");
      }
      entry.name = name;
      return;
    }
    throw new Error("Pozycja nie istnieje.");
  }

  if (selected === "d1") {
    const result = await bindings.DB!
      .prepare("UPDATE list_entries SET name = ? WHERE id = ?")
      .bind(name, id)
      .run();
    if (!result.meta.changes) throw new Error("Pozycja nie istnieje.");
  } else {
    const rows = await getPostgres()!.query(
      "UPDATE list_entries SET name = $1 WHERE id = $2 RETURNING id",
      [name, id],
    );
    if (!rows.length) throw new Error("Pozycja nie istnieje.");
  }
}

export async function deleteEntry(id: string): Promise<void> {
  const selected = await prepareBackend();
  if (selected === "preview") {
    for (const category of demoStore().categories) {
      const index = category.entries.findIndex((item) => item.id === id);
      if (index < 0) continue;
      category.entries.splice(index, 1);
      return;
    }
    throw new Error("Pozycja nie istnieje.");
  }

  if (selected === "d1") {
    const result = await bindings.DB!
      .prepare("DELETE FROM list_entries WHERE id = ?")
      .bind(id)
      .run();
    if (!result.meta.changes) throw new Error("Pozycja nie istnieje.");
  } else {
    const rows = await getPostgres()!.query(
      "DELETE FROM list_entries WHERE id = $1 RETURNING id",
      [id],
    );
    if (!rows.length) throw new Error("Pozycja nie istnieje.");
  }
}

export function getStorageProvider(): StorageProvider {
  if (bindings.MEDIA) return "r2";
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return "cloudinary";
  }
  return "unconfigured";
}

export function getR2Bucket(): R2Bucket | null {
  return bindings.MEDIA ?? null;
}

export async function deleteStoredMedia(pathname: string | null): Promise<void> {
  if (!pathname) return;
  try {
    if (bindings.MEDIA && pathname.startsWith("media/")) {
      await bindings.MEDIA.delete(pathname);
      return;
    }
    const [resourceType, publicId] = pathname.split("|", 2);
    if (
      resourceType !== "image" &&
      resourceType !== "video"
    ) {
      return;
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret || !publicId) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/destroy`,
      { method: "POST", body },
    );
    if (!response.ok) {
      throw new Error(`Cloudinary delete failed with ${response.status}.`);
    }
  } catch (error) {
    console.error("Nie udało się usunąć nieużywanego pliku multimedialnego.", error);
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(bindings.DB || process.env.DATABASE_URL);
}
