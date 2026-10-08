import type { Metadata } from "next";
import Link from "next/link";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminLogin } from "@/components/AdminLogin";
import { developmentCredentialsEnabled, hasAdminSession } from "@/lib/auth";
import { getForumData, getStorageProvider } from "@/lib/data";
import type { ForumData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel administratora",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const authenticated = await hasAdminSession();
  if (!authenticated) {
    return <AdminLogin showDevelopmentHint={developmentCredentialsEnabled()} />;
  }

  let data: ForumData | null = null;
  let errorMessage = "Nie udało się połączyć z bazą.";
  try {
    data = await getForumData();
  } catch (error) {
    if (error instanceof Error) errorMessage = error.message;
  }

  if (data) {
    return <AdminDashboard initialData={data} storageProvider={getStorageProvider()} />;
  }
  return (
    <main className="fatal-shell admin-fatal-shell">
      <div className="fatal-card">
        <span className="eyebrow">PANEL / KONFIGURACJA</span>
        <h1>Panel jest zalogowany, ale baza nie odpowiada</h1>
        <p>{errorMessage}</p>
        <Link className="secondary-button" href="/">Wróć do forum</Link>
      </div>
    </main>
  );
}
