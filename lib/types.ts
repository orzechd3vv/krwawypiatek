export type MediaType = "image" | "video";

export type ForumPost = {
  id: string;
  title: string;
  description: string;
  mediaUrl: string | null;
  mediaPathname: string | null;
  mediaType: MediaType | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ListEntry = {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type ListCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  entries: ListEntry[];
};

export type ForumData = {
  posts: ForumPost[];
  categories: ListCategory[];
  source: "database" | "preview";
};

export type StorageProvider = "r2" | "cloudinary" | "unconfigured";

export type ApiError = {
  error: string;
  fieldErrors?: Record<string, string[]>;
};
