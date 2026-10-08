import type { ForumData } from "./types";

export const defaultForumData: ForumData = {
  source: "preview",
  posts: [],
  categories: [],
};

export function cloneDefaultForumData(): ForumData {
  return structuredClone(defaultForumData);
}
