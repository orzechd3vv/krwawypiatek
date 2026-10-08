"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  LayoutDashboard,
  ListPlus,
  ListTree,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PostEditor } from "./PostEditor";
import type {
  ForumData,
  ForumPost,
  ListCategory,
  ListEntry,
  StorageProvider,
} from "@/lib/types";

type Tab = "overview" | "posts" | "list";
type DeleteTarget = {
  type: "post" | "category" | "entry";
  id: string;
  name: string;
} | null;
type EditState = { id: string; value: string } | null;

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 401) window.location.reload();
    throw new Error(payload.error || "Operacja nie powiodła się.");
  }
  return payload;
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  );
}

export function AdminDashboard({
  initialData,
  storageProvider,
}: {
  initialData: ForumData;
  storageProvider: StorageProvider;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("overview");
  const [editorPost, setEditorPost] = useState<ForumPost | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryPending, setCategoryPending] = useState(false);
  const [entryNames, setEntryNames] = useState<Record<string, string>>({});
  const [entryPending, setEntryPending] = useState<string | null>(null);
  const [categoryEdit, setCategoryEdit] = useState<EditState>(null);
  const [entryEdit, setEntryEdit] = useState<EditState>(null);

  const totalEntries = useMemo(
    () => data.categories.reduce((total, category) => total + category.entries.length, 0),
    [data.categories],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3_200);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  function savePost(post: ForumPost, isNew: boolean) {
    setData((current) => ({
      ...current,
      posts: isNew
        ? [post, ...current.posts]
        : current.posts.map((item) => (item.id === post.id ? post : item)),
    }));
    setEditorPost(undefined);
    notify(isNew ? "Komunikat został opublikowany." : "Zmiany zostały zapisane.");
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryName.trim() || categoryPending) return;
    setCategoryPending(true);
    setError("");
    try {
      const result = await requestJson<{ category: ListCategory }>("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      setData((current) => ({ ...current, categories: [...current.categories, result.category] }));
      setCategoryName("");
      notify("Kategoria została dodana.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się dodać kategorii.");
    } finally {
      setCategoryPending(false);
    }
  }

  async function addEntry(categoryId: string) {
    const name = entryNames[categoryId]?.trim();
    if (!name || entryPending) return;
    setEntryPending(categoryId);
    setError("");
    try {
      const result = await requestJson<{ entry: ListEntry }>("/api/admin/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, name }),
      });
      setData((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === categoryId
            ? { ...category, entries: [...category.entries, result.entry] }
            : category,
        ),
      }));
      setEntryNames((current) => ({ ...current, [categoryId]: "" }));
      notify("Pozycja została dodana do listy.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się dodać pozycji.");
    } finally {
      setEntryPending(null);
    }
  }

  async function saveCategoryEdit() {
    if (!categoryEdit?.value.trim()) return;
    setError("");
    try {
      await requestJson(`/api/admin/categories/${encodeURIComponent(categoryEdit.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryEdit.value.trim() }),
      });
      setData((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === categoryEdit.id
            ? { ...category, name: categoryEdit.value.trim() }
            : category,
        ),
      }));
      setCategoryEdit(null);
      notify("Nazwa kategorii została zmieniona.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać nazwy.");
    }
  }

  async function saveEntryEdit() {
    if (!entryEdit?.value.trim()) return;
    setError("");
    try {
      await requestJson(`/api/admin/entries/${encodeURIComponent(entryEdit.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: entryEdit.value.trim() }),
      });
      setData((current) => ({
        ...current,
        categories: current.categories.map((category) => ({
          ...category,
          entries: category.entries.map((entry) =>
            entry.id === entryEdit.id ? { ...entry, name: entryEdit.value.trim() } : entry,
          ),
        })),
      }));
      setEntryEdit(null);
      notify("Nazwa pozycji została zmieniona.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać nazwy.");
    }
  }

  async function performDelete() {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    setError("");
    try {
      const paths = {
        post: "/api/admin/posts/",
        category: "/api/admin/categories/",
        entry: "/api/admin/entries/",
      } as const;
      await requestJson(`${paths[deleteTarget.type]}${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      setData((current) => {
        if (deleteTarget.type === "post") {
          return { ...current, posts: current.posts.filter((post) => post.id !== deleteTarget.id) };
        }
        if (deleteTarget.type === "category") {
          return {
            ...current,
            categories: current.categories.filter((category) => category.id !== deleteTarget.id),
          };
        }
        return {
          ...current,
          categories: current.categories.map((category) => ({
            ...category,
            entries: category.entries.filter((entry) => entry.id !== deleteTarget.id),
          })),
        };
      });
      notify("Element został usunięty.");
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się usunąć elementu.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          <span className="brand-mark"><span>M</span></span>
          <span><strong>MVP MAFIA</strong><small>CONTROL CENTER</small></span>
        </Link>
        <div className="admin-role"><ShieldCheck size={15} /><span>Administrator</span><i /></div>
        <nav aria-label="Nawigacja panelu">
          <NavButton active={tab === "overview"} label="Przegląd" icon={<LayoutDashboard size={18} />} onClick={() => setTab("overview")} />
          <NavButton active={tab === "posts"} label="Publikacje" icon={<FileText size={18} />} onClick={() => setTab("posts")} />
          <NavButton active={tab === "list"} label="Lista" icon={<ListTree size={18} />} onClick={() => setTab("list")} />
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank"><ExternalLink size={16} /> Otwórz forum</Link>
          <button type="button" onClick={logout}><LogOut size={16} /> Wyloguj</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">MVP MAFIA / ADMIN</span>
            <h1>{tab === "overview" ? "Przegląd" : tab === "posts" ? "Publikacje" : "Zarządzanie listą"}</h1>
          </div>
          <div className="topbar-actions">
            {data.source === "preview" && <span className="preview-pill">TRYB PODGLĄDU</span>}
            <button type="button" className="primary-button" onClick={() => setEditorPost(null)}>
              <Plus size={16} /> Nowy komunikat
            </button>
          </div>
        </header>

        <div className="admin-mobile-nav" role="tablist" aria-label="Sekcje panelu">
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 size={16} /> Przegląd</button>
          <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}><FileText size={16} /> Posty</button>
          <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}><ListTree size={16} /> Lista</button>
        </div>

        {error && <div className="admin-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Zamknij"><X size={15} /></button></div>}

        {tab === "overview" && (
          <div className="dashboard-content">
            <section className="stats-grid" aria-label="Statystyki">
              <article><span><FileText size={19} /></span><div><strong>{data.posts.length}</strong><small>Publikacji</small></div></article>
              <article><span><ListTree size={19} /></span><div><strong>{data.categories.length}</strong><small>Kategorii</small></div></article>
              <article><span><ListPlus size={19} /></span><div><strong>{totalEntries}</strong><small>Nazw na liście</small></div></article>
              <article><span><ImageIcon size={19} /></span><div><strong>{data.posts.filter((post) => post.mediaUrl).length}</strong><small>Materiałów</small></div></article>
            </section>

            <section className="admin-panel overview-panel">
              <div className="panel-heading"><div><span className="eyebrow">OSTATNIA AKTYWNOŚĆ</span><h2>Najnowsze publikacje</h2></div><button className="text-button" onClick={() => setTab("posts")}>Zobacz wszystkie <ArrowRight size={13} /></button></div>
              <div className="recent-list">
                {data.posts.slice(0, 5).map((post) => (
                  <button key={post.id} type="button" onClick={() => setEditorPost(post)}>
                    <span className="recent-icon">{post.mediaType === "video" ? <Film size={14} /> : post.mediaType === "image" ? <ImageIcon size={14} /> : "T"}</span>
                    <span><strong>{post.title}</strong><small>{dateFormatter.format(new Date(post.publishedAt))}</small></span>
                    <Pencil size={15} />
                  </button>
                ))}
                {data.posts.length === 0 && <div className="admin-empty">Brak publikacji. Utwórz pierwszy komunikat.</div>}
              </div>
            </section>

            <section className="admin-panel readiness-panel">
              <div><span className="eyebrow">STATUS SYSTEMU</span><h2>Gotowość publikacji</h2></div>
              <div className="readiness-row"><span>Baza treści</span><strong><i className="ok-dot" /> Aktywna</strong></div>
              <div className="readiness-row"><span>Magazyn mediów</span><strong className={storageProvider === "unconfigured" ? "warning-text" : ""}><i className={storageProvider === "unconfigured" ? "warning-dot" : "ok-dot"} /> {storageProvider === "r2" ? "R2 / aktywny" : storageProvider === "vercel-blob" ? "Vercel Blob / aktywny" : "Do konfiguracji"}</strong></div>
              <div className="readiness-row"><span>Sesja administratora</span><strong><i className="ok-dot" /> Chroniona</strong></div>
            </section>
          </div>
        )}

        {tab === "posts" && (
          <section className="admin-panel posts-panel">
            <div className="panel-heading"><div><span className="eyebrow">FORUM / TREŚCI</span><h2>Wszystkie publikacje</h2></div><span className="table-count">{data.posts.length} wpisów</span></div>
            <div className="admin-post-list">
              {data.posts.map((post) => (
                <article key={post.id}>
                  <div className={`admin-post-thumb ${post.mediaType ? "has-media" : ""}`}>
                    {post.mediaUrl && post.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.mediaUrl} alt="" />
                    ) : post.mediaType === "video" ? <Film size={19} /> : <FileText size={19} />}
                  </div>
                  <div className="admin-post-copy"><strong>{post.title}</strong><p>{post.description}</p><small>{dateFormatter.format(new Date(post.publishedAt))}</small></div>
                  <div className="row-actions">
                    <button type="button" onClick={() => setEditorPost(post)} aria-label={`Edytuj ${post.title}`}><Pencil size={16} /></button>
                    <button type="button" className="danger" onClick={() => setDeleteTarget({ type: "post", id: post.id, name: post.title })} aria-label={`Usuń ${post.title}`}><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
              {data.posts.length === 0 && <div className="admin-empty">Nie ma jeszcze żadnych publikacji.</div>}
            </div>
          </section>
        )}

        {tab === "list" && (
          <div className="list-admin-layout">
            <section className="admin-panel add-category-panel">
              <span className="eyebrow">NOWA SEKCJA</span><h2>Dodaj kategorię</h2>
              <p>Utwórz nagłówek, pod którym będziesz dodawać dowolną liczbę nazw.</p>
              <form onSubmit={addCategory}>
                <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={40} placeholder="np. XD" aria-label="Nazwa nowej kategorii" />
                <button className="primary-button" disabled={categoryPending || !categoryName.trim()}><Plus size={16} /> Dodaj</button>
              </form>
            </section>

            <section className="category-admin-stack">
              {data.categories.map((category, categoryIndex) => (
                <article className="admin-panel category-admin-card" key={category.id}>
                  <header>
                    <span className="category-number">{String(categoryIndex + 1).padStart(2, "0")}</span>
                    {categoryEdit?.id === category.id ? (
                      <div className="inline-edit">
                        <input value={categoryEdit.value} maxLength={40} autoFocus onChange={(event) => setCategoryEdit({ ...categoryEdit, value: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void saveCategoryEdit(); if (event.key === "Escape") setCategoryEdit(null); }} />
                        <button onClick={() => void saveCategoryEdit()} aria-label="Zapisz"><Check size={15} /></button>
                        <button onClick={() => setCategoryEdit(null)} aria-label="Anuluj"><X size={15} /></button>
                      </div>
                    ) : (
                      <div className="category-title"><h2>{category.name}</h2><small>{category.entries.length} pozycji</small></div>
                    )}
                    <div className="row-actions">
                      <button type="button" onClick={() => setCategoryEdit({ id: category.id, value: category.name })} aria-label={`Edytuj kategorię ${category.name}`}><Pencil size={15} /></button>
                      <button type="button" className="danger" onClick={() => setDeleteTarget({ type: "category", id: category.id, name: category.name })} aria-label={`Usuń kategorię ${category.name}`}><Trash2 size={15} /></button>
                    </div>
                  </header>

                  <form className="add-entry-form" onSubmit={(event) => { event.preventDefault(); void addEntry(category.id); }}>
                    <input value={entryNames[category.id] ?? ""} onChange={(event) => setEntryNames((current) => ({ ...current, [category.id]: event.target.value }))} maxLength={80} placeholder={`Dodaj nazwę do „${category.name}”`} aria-label={`Nowa nazwa w kategorii ${category.name}`} />
                    <button className="secondary-button compact" disabled={entryPending === category.id || !entryNames[category.id]?.trim()}><Plus size={15} /> Dodaj nazwę</button>
                  </form>

                  <div className="entry-admin-list">
                    {category.entries.map((entry, entryIndex) => (
                      <div key={entry.id}>
                        <span>{String(entryIndex + 1).padStart(2, "0")}</span>
                        {entryEdit?.id === entry.id ? (
                          <div className="inline-edit entry-inline-edit">
                            <input value={entryEdit.value} maxLength={80} autoFocus onChange={(event) => setEntryEdit({ ...entryEdit, value: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void saveEntryEdit(); if (event.key === "Escape") setEntryEdit(null); }} />
                            <button onClick={() => void saveEntryEdit()} aria-label="Zapisz"><Check size={14} /></button>
                            <button onClick={() => setEntryEdit(null)} aria-label="Anuluj"><X size={14} /></button>
                          </div>
                        ) : <strong>{entry.name}</strong>}
                        <div className="row-actions">
                          <button type="button" onClick={() => setEntryEdit({ id: entry.id, value: entry.name })} aria-label={`Edytuj ${entry.name}`}><Pencil size={14} /></button>
                          <button type="button" className="danger" onClick={() => setDeleteTarget({ type: "entry", id: entry.id, name: entry.name })} aria-label={`Usuń ${entry.name}`}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                    {category.entries.length === 0 && <div className="empty-category"><ListPlus size={18} /> Ta kategoria nie ma jeszcze nazw.</div>}
                  </div>
                </article>
              ))}
              {data.categories.length === 0 && <div className="admin-panel admin-empty">Dodaj pierwszą kategorię, aby rozpocząć budowanie listy.</div>}
            </section>
          </div>
        )}
      </main>

      {editorPost !== undefined && (
        <PostEditor post={editorPost} storageProvider={storageProvider} onClose={() => setEditorPost(undefined)} onSaved={savePost} />
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <span className="danger-icon"><Trash2 size={22} /></span>
            <span className="eyebrow">POTWIERDZENIE</span>
            <h2 id="confirm-title">Usunąć „{deleteTarget.name}”?</h2>
            <p>{deleteTarget.type === "category" ? "Usunięta zostanie również cała zawartość tej kategorii." : "Tej operacji nie można cofnąć."}</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeleteTarget(null)} disabled={deletePending}>Anuluj</button>
              <button className="danger-button" onClick={() => void performDelete()} disabled={deletePending}><Trash2 size={15} /> {deletePending ? "Usuwanie..." : "Usuń"}</button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </div>
  );
}
