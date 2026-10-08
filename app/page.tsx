import type { Metadata } from "next";
import { Forum } from "@/components/Forum";
import { getForumData } from "@/lib/data";
import type { ForumData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forum",
  alternates: { canonical: "/" },
};

export default async function Home() {
  let data: ForumData | null = null;
  let errorMessage = "Nie udało się uruchomić forum.";
  try {
    data = await getForumData();
  } catch (error) {
    if (error instanceof Error) errorMessage = error.message;
  }

  if (data) return <Forum initialData={data} />;
  return (
    <main className="fatal-shell">
      <div className="fatal-card">
        <span className="eyebrow">MVP MAFIA / SYSTEM</span>
        <div className="brand-mark" aria-hidden="true"><span>M</span></div>
        <h1>Forum czeka na połączenie</h1>
        <p>{errorMessage}</p>
        <small>Po skonfigurowaniu magazynu danych strona uruchomi się automatycznie.</small>
      </div>
    </main>
  );
}
