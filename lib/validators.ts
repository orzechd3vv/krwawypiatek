import { z } from "zod";

const optionalMediaSchema = z
  .object({
    url: z
      .string()
      .max(2_048)
      .refine(
        (value) =>
          value.startsWith("/media/") ||
          /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/(image|video)\/upload\//i.test(
            value,
          ),
        "Nieprawidłowy adres przesłanego pliku.",
      ),
    pathname: z.string().min(1).max(1_024),
    type: z.enum(["image", "video"]),
  })
  .nullable()
  .optional();

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
});

export const postCreateSchema = z.object({
  title: z.string().trim().min(3, "Tytuł musi mieć co najmniej 3 znaki.").max(120),
  description: z
    .string()
    .trim()
    .min(1, "Opis nie może być pusty.")
    .max(6_000, "Opis może mieć maksymalnie 6000 znaków."),
  media: optionalMediaSchema,
});

export const postUpdateSchema = postCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Brak zmian do zapisania.",
);

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę kategorii.").max(40),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const entryCreateSchema = z.object({
  categoryId: z.string().min(1).max(100),
  name: z.string().trim().min(1, "Podaj nazwę pozycji.").max(80),
});

export const entryUpdateSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę pozycji.").max(80),
});

export const MAX_MEDIA_SIZE = 100 * 1024 * 1024;

export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export function mediaKindFromMime(mime: string): "image" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}
