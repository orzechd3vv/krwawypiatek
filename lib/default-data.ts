import type { ForumData } from "./types";

const seededAt = "2026-10-09T18:00:00.000Z";

export const defaultForumData: ForumData = {
  source: "preview",
  posts: [
    {
      id: "seed-post-welcome",
      title: "Witamy w centrum informacji MVP Mafia",
      description:
        "To oficjalne miejsce na komunikaty, aktualizacje i materiały społeczności. Najnowsze informacje zawsze pojawiają się tutaj jako pierwsze.",
      mediaUrl: null,
      mediaPathname: null,
      mediaType: null,
      publishedAt: "2026-10-09T18:00:00.000Z",
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    {
      id: "seed-post-rules",
      title: "Najważniejsze zasady społeczności",
      description:
        "Szanuj innych, nie publikuj prywatnych danych i trzymaj się tematów wyznaczonych przez administrację. Pełny regulamin znajdziesz na liście po lewej stronie.",
      mediaUrl: null,
      mediaPathname: null,
      mediaType: null,
      publishedAt: "2026-10-08T20:30:00.000Z",
      createdAt: seededAt,
      updatedAt: seededAt,
    },
  ],
  categories: [
    {
      id: "seed-cat-info",
      name: "INFORMACJE",
      sortOrder: 10,
      createdAt: seededAt,
      entries: [
        {
          id: "seed-entry-rules",
          categoryId: "seed-cat-info",
          name: "Regulamin",
          sortOrder: 10,
          createdAt: seededAt,
        },
        {
          id: "seed-entry-recruitment",
          categoryId: "seed-cat-info",
          name: "Rekrutacja",
          sortOrder: 20,
          createdAt: seededAt,
        },
        {
          id: "seed-entry-contact",
          categoryId: "seed-cat-info",
          name: "Kontakt",
          sortOrder: 30,
          createdAt: seededAt,
        },
      ],
    },
    {
      id: "seed-cat-xd",
      name: "XD",
      sortOrder: 20,
      createdAt: seededAt,
      entries: [
        {
          id: "seed-entry-xd1",
          categoryId: "seed-cat-xd",
          name: "xd1",
          sortOrder: 10,
          createdAt: seededAt,
        },
      ],
    },
  ],
};

export function cloneDefaultForumData(): ForumData {
  return structuredClone(defaultForumData);
}
