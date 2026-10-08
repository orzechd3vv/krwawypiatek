"use client";

import {
  BellRing,
  ChevronDown,
  ChevronRight,
  Clock3,
  ListTree,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ForumData, ListCategory } from "@/lib/types";

const formatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function CategorySection({ category }: { category: ListCategory }) {
  const [open, setOpen] = useState(category.sortOrder === 10);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(50);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pl");
    if (!normalized) return category.entries;
    return category.entries.filter((entry) =>
      entry.name.toLocaleLowerCase("pl").includes(normalized),
    );
  }, [category.entries, query]);

  return (
    <section className={`list-category ${open ? "is-open" : ""}`}>
      <button
        className="category-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="category-arrow" aria-hidden="true">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span>{category.name}</span>
        <small>{category.entries.length.toLocaleString("pl-PL")}</small>
      </button>
      {open && (
        <div className="category-body">
          {category.entries.length > 12 && (
            <label className="mini-search">
              <Search size={13} aria-hidden="true" />
              <span className="sr-only">Szukaj w kategorii {category.name}</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(50);
                }}
                placeholder="Filtruj nazwy..."
              />
            </label>
          )}
          <ul>
            {filtered.slice(0, visible).map((entry, index) => (
              <li
                key={entry.id}
                style={{ "--entry-delay": `${Math.min(index, 12) * 22}ms` } as CSSProperties}
              >
                <span className="entry-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{entry.name}</span>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <p className="list-empty">Brak pasujących nazw.</p>}
          {filtered.length > visible && (
            <button
              type="button"
              className="show-more"
              onClick={() => setVisible((value) => value + 50)}
            >
              Pokaż kolejne 50
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function Forum({ initialData }: { initialData: ForumData }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sidebarOpen]);

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="site-header">
        <a href="#start" className="brand" aria-label="MVP Mafia - Info, strona główna">
          <span className="brand-mark" aria-hidden="true"><span>M</span></span>
          <span className="brand-copy">
            <strong>MVP MAFIA</strong>
            <small>INFO / OFFICIAL FEED</small>
          </span>
        </a>
        <div className="header-status">
          <span className="status-dot" aria-hidden="true" />
          <span>SYSTEM ONLINE</span>
        </div>
        <button
          type="button"
          className="mobile-list-button"
          aria-expanded={sidebarOpen}
          aria-controls="forum-list"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={18} /> Lista
        </button>
      </header>

      <div className="ticker" aria-label="Oficjalny kanał informacyjny">
        <div>
          <span><ShieldCheck size={13} /> OFICJALNY KANAŁ</span>
          <i aria-hidden="true" />
          <span>AKTUALNOŚCI • KOMUNIKATY • MEDIA</span>
          <i aria-hidden="true" />
          <span><BellRing size={13} /> MVP MAFIA INFO</span>
        </div>
      </div>

      <div className="forum-layout" id="start">
        {sidebarOpen && (
          <button
            className="sidebar-scrim"
            aria-label="Zamknij listę"
            type="button"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside id="forum-list" className={`forum-sidebar ${sidebarOpen ? "is-visible" : ""}`}>
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">NAWIGACJA</span>
              <h2><ListTree size={19} /> Lista</h2>
            </div>
            <button
              className="sidebar-close"
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Zamknij listę"
            >
              <X size={18} />
            </button>
          </div>
          <p className="sidebar-intro">Kategorie i nazwy zarządzane przez administrację.</p>
          <div className="category-stack">
            {initialData.categories.map((category) => (
              <CategorySection category={category} key={category.id} />
            ))}
          </div>
          {initialData.categories.length === 0 && (
            <div className="empty-mini">Lista jest jeszcze pusta.</div>
          )}
          <div className="sidebar-foot">
            <ShieldCheck size={15} />
            <span>Treści zweryfikowane przez administrację</span>
          </div>
        </aside>

        <main className="forum-main">
          <section className="forum-hero">
            <div className="hero-grid" aria-hidden="true" />
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={13} /> CENTRUM INFORMACYJNE</span>
              <h1>MVP MAFIA <em>&mdash; INFO</em></h1>
              <p>
                Jeden kanał. Konkretne informacje. Wszystkie oficjalne komunikaty
                społeczności w jednym miejscu.
              </p>
            </div>
            <div className="hero-sigil" aria-hidden="true">
              <span>MM</span>
              <small>EST. 2026</small>
            </div>
          </section>

          <div className="feed-heading">
            <div>
              <span className="eyebrow">FORUM / NAJNOWSZE</span>
              <h2>Komunikaty</h2>
            </div>
            <span className="post-count">{initialData.posts.length} PUBLIKACJI</span>
          </div>

          <section className="post-feed" aria-label="Najnowsze komunikaty">
            {initialData.posts.map((post, index) => (
              <article
                className="forum-post"
                key={post.id}
                style={{ "--post-index": index } as CSSProperties}
              >
                <div className="post-rail" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="post-content">
                  <div className="post-meta">
                    <span className="official-badge"><ShieldCheck size={12} /> ADMINISTRACJA</span>
                    <time dateTime={post.publishedAt}>
                      <Clock3 size={12} /> {formatter.format(new Date(post.publishedAt))}
                    </time>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.description}</p>
                  {post.mediaUrl && post.mediaType === "image" && (
                    <figure className="post-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.mediaUrl} alt={`Materiał do wpisu: ${post.title}`} loading="lazy" />
                    </figure>
                  )}
                  {post.mediaUrl && post.mediaType === "video" && (
                    <figure className="post-media">
                      <video src={post.mediaUrl} controls preload="metadata" playsInline>
                        Twoja przeglądarka nie obsługuje odtwarzania wideo.
                      </video>
                    </figure>
                  )}
                  <div className="post-signature">
                    <span />
                    <small>MVP MAFIA / OFFICIAL</small>
                  </div>
                </div>
              </article>
            ))}
            {initialData.posts.length === 0 && (
              <div className="feed-empty">
                <BellRing size={30} />
                <h3>Jeszcze bez komunikatów</h3>
                <p>Pierwsza publikacja administracji pojawi się tutaj.</p>
              </div>
            )}
          </section>

          <footer className="site-footer">
            <span>MVP MAFIA • INFO</span>
            <small>OFICJALNE CENTRUM KOMUNIKATÓW • 2026</small>
          </footer>
        </main>
      </div>
    </div>
  );
}
