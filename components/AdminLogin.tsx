"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminLogin({ showDevelopmentHint }: { showDevelopmentHint: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Logowanie nie powiodło się.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Logowanie nie powiodło się.");
      setPending(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <div className="login-grid" aria-hidden="true" />
      <Link className="admin-back-link" href="/">← Wróć do forum</Link>
      <section className="login-card">
        <div className="login-accent" aria-hidden="true" />
        <div className="login-brand">
          <span className="brand-mark"><span>M</span></span>
          <div>
            <span className="eyebrow">MVP MAFIA / SECURE ACCESS</span>
            <h1>Panel administratora</h1>
          </div>
        </div>
        <p className="login-copy">
          Zaloguj się, aby publikować komunikaty i zarządzać zawartością listy.
        </p>

        <form onSubmit={submit} className="login-form">
          <label>
            <span>Login</span>
            <div className="field-with-icon">
              <ShieldCheck size={17} aria-hidden="true" />
              <input
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nazwa administratora"
                required
                maxLength={80}
              />
            </div>
          </label>
          <label>
            <span>Hasło</span>
            <div className="field-with-icon">
              <KeyRound size={17} aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="????????????"
                required
                maxLength={256}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="primary-button login-button" type="submit" disabled={pending}>
            {pending ? <span className="button-loader" /> : <LockKeyhole size={16} />}
            {pending ? "Weryfikacja..." : "Zaloguj bezpiecznie"}
            {!pending && <ArrowRight size={16} />}
          </button>
        </form>

        {showDevelopmentHint && (
          <div className="dev-credentials">
            <strong>Podgląd lokalny</strong>
            <span>Login: <code>admin</code></span>
            <span>Hasło: <code>MafiaDemo!2026</code></span>
          </div>
        )}

        <div className="login-security">
          <LockKeyhole size={14} />
          Sesja jest podpisana, szyfrowana w transmisji i wygasa automatycznie.
        </div>
      </section>
    </main>
  );
}
