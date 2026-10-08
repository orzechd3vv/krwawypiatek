CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  media_url TEXT,
  media_pathname TEXT,
  media_type VARCHAR(10) CHECK (media_type IN ('image', 'video') OR media_type IS NULL),
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS list_entries (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts (published_at DESC);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique ON categories (LOWER(name));
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories (sort_order, id);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_category_name_unique ON list_entries (category_id, LOWER(name));
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_entries_category_sort ON list_entries (category_id, sort_order, id);
