"use client";

import {
  FileImage,
  Film,
  ImagePlus,
  LoaderCircle,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ForumPost, MediaType, StorageProvider } from "@/lib/types";

type MediaPayload = {
  url: string;
  pathname: string;
  type: MediaType;
};

type SavedPayload = { post: ForumPost };

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function mediaTypeFor(file: File): MediaType {
  return file.type.startsWith("video/") ? "video" : "image";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 401) window.location.reload();
    throw new Error(payload.error || "Operacja nie powiodła się.");
  }
  return payload;
}

export function PostEditor({
  post,
  storageProvider,
  onClose,
  onSaved,
}: {
  post: ForumPost | null;
  storageProvider: StorageProvider;
  onClose: () => void;
  onSaved: (post: ForumPost, isNew: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [description, setDescription] = useState(post?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(selected: File | undefined) {
    setError("");
    if (!selected) {
      setFile(null);
      return;
    }
    if (!acceptedTypes.has(selected.type)) {
      setError("Obsługiwane formaty: JPG, PNG, WEBP, GIF, MP4, WEBM i MOV.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("Plik może mieć maksymalnie 100 MB.");
      return;
    }
    setFile(selected);
    setRemoveExisting(false);
  }

  async function uploadFile(selected: File): Promise<MediaPayload> {
    if (storageProvider === "unconfigured") {
      throw new Error("Najpierw skonfiguruj magazyn Cloudinary.");
    }
    setProgress(25);
    if (storageProvider === "cloudinary") {
      const result = await new Promise<{
        url: string;
        pathname: string;
        contentType: string;
      }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/admin/upload");
        request.withCredentials = true;
        request.setRequestHeader("Content-Type", selected.type);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.max(5, Math.round((event.loaded / event.total) * 90)));
          }
        };
        request.onerror = () => reject(new Error("Nie udało się połączyć z magazynem Cloudinary."));
        request.onload = () => {
          let payload: {
            url?: string;
            pathname?: string;
            contentType?: string;
            error?: string;
          };
          try {
            payload = JSON.parse(request.responseText || "{}") as typeof payload;
          } catch {
            reject(new Error("Serwer zwrócił nieprawidłową odpowiedź uploadu."));
            return;
          }
          if (request.status < 200 || request.status >= 300 || !payload.url || !payload.pathname) {
            reject(new Error(payload.error || "Upload nie powiódł się."));
            return;
          }
          resolve({
            url: payload.url,
            pathname: payload.pathname,
            contentType: payload.contentType || selected.type,
          });
        };
        request.send(selected);
      });
      setProgress(100);
      return {
        url: result.url,
        pathname: result.pathname,
        type: mediaTypeFor(selected),
      };
    }
    const response = await fetch(
      storageProvider === "r2" ? "/api/admin/media" : "/api/admin/upload",
      {
      method: "POST",
      headers: {
        "Content-Type": selected.type,
        "Content-Length": String(selected.size),
      },
      body: selected,
      },
    );
    const result = await parseResponse<{
      url: string;
      pathname: string;
      contentType: string;
    }>(response);
    setProgress(100);
    return {
      url: result.url,
      pathname: result.pathname,
      type: mediaTypeFor(selected),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (title.trim().length < 3) {
      setError("Tytuł musi mieć co najmniej 3 znaki.");
      return;
    }
    if (!description.trim()) {
      setError("Opis nie może być pusty.");
      return;
    }

    setPending(true);
    setError("");
    setProgress(file ? 2 : 0);
    try {
      const uploaded = file ? await uploadFile(file) : undefined;
      const body: {
        title: string;
        description: string;
        media?: MediaPayload | null;
      } = {
        title: title.trim(),
        description: description.trim(),
      };
      if (!post) body.media = uploaded ?? null;
      if (post && uploaded) body.media = uploaded;
      if (post && removeExisting && !uploaded) body.media = null;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch(
          post ? `/api/admin/posts/${encodeURIComponent(post.id)}` : "/api/admin/posts",
          {
            method: post ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        );
      } finally {
        window.clearTimeout(timeout);
      }
      const result = await parseResponse<SavedPayload>(response);
      onSaved(result.post, !post);
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === "AbortError"
          ? "Zapis trwał zbyt długo. Sprawdź połączenie z bazą danych i spróbuj ponownie."
          : caught instanceof Error
            ? caught.message
            : "Nie udało się zapisać wpisu.",
      );
      setPending(false);
    }
  }

  const activeMediaUrl = previewUrl || (!removeExisting ? post?.mediaUrl : null);
  const activeMediaType = file ? mediaTypeFor(file) : post?.mediaType;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !pending) onClose();
    }}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">REDAKCJA / PUBLIKACJA</span>
            <h2 id="editor-title">{post ? "Edytuj komunikat" : "Nowy komunikat"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={pending} aria-label="Zamknij edytor">
            <X size={19} />
          </button>
        </header>

        <form className="editor-form" onSubmit={submit}>
          <label className="admin-field">
            <span>Tytuł <small>{title.length}/120</small></span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Tytuł komunikatu"
              required
            />
          </label>
          <label className="admin-field">
            <span>Opis <small>{description.length}/6000</small></span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={6_000}
              rows={8}
              placeholder="Napisz konkretną treść komunikatu..."
              required
            />
          </label>

          <div className="media-editor">
            <div className="media-editor-heading">
              <div>
                <strong>Zdjęcie lub film</strong>
                <small>Opcjonalnie • maks. 100 MB</small>
              </div>
              <button type="button" className="secondary-button compact" onClick={() => fileInput.current?.click()} disabled={pending}>
                <ImagePlus size={15} /> {activeMediaUrl ? "Zmień plik" : "Dodaj plik"}
              </button>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
            </div>

            {activeMediaUrl ? (
              <div className="media-preview">
                {activeMediaType === "video" ? (
                  <video src={activeMediaUrl} controls playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeMediaUrl} alt="Podgląd załącznika" />
                )}
                <div className="media-preview-bar">
                  <span>{activeMediaType === "video" ? <Film size={14} /> : <FileImage size={14} />}</span>
                  <span>{file?.name ?? "Aktualny materiał"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setRemoveExisting(true);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    aria-label="Usuń załącznik"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="media-dropzone" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={25} />
                <span>Dodaj wizualny materiał do wpisu</span>
                <small>JPG, PNG, WEBP, GIF, MP4, WEBM lub MOV</small>
              </button>
            )}
            {storageProvider === "unconfigured" && (
              <p className="storage-warning">Upload będzie dostępny po skonfigurowaniu Cloudinary. Wpis tekstowy możesz opublikować już teraz.</p>
            )}
          </div>

          {pending && file && (
            <div className="upload-progress" aria-live="polite">
              <span style={{ width: `${progress}%` }} />
              <small>Przesyłanie pliku: {Math.round(progress)}%</small>
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}

          <footer className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Anuluj</button>
            <button type="submit" className="primary-button" disabled={pending}>
              {pending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
              {pending ? "Zapisywanie..." : post ? "Zapisz zmiany" : "Opublikuj komunikat"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
