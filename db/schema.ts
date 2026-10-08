import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    mediaUrl: text("media_url"),
    mediaPathname: text("media_pathname"),
    mediaType: text("media_type"),
    publishedAt: text("published_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check(
      "posts_media_type_check",
      sql`${table.mediaType} IN ('image', 'video') OR ${table.mediaType} IS NULL`,
    ),
    index("idx_posts_published_at").on(table.publishedAt),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_categories_name_unique").on(table.name),
    index("idx_categories_sort_order").on(table.sortOrder, table.id),
  ],
);

export const listEntries = sqliteTable(
  "list_entries",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_entries_category_name_unique").on(table.categoryId, table.name),
    index("idx_entries_category_sort").on(table.categoryId, table.sortOrder, table.id),
  ],
);
