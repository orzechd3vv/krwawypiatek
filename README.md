# MVP Mafia - Info

Produkcyjne forum informacyjne w Next.js/TypeScript z chronionym panelem administratora pod adresem:

`/a/ad/adm/admi/admin`

## Funkcje

- publiczne forum z responsywną listę kategorii i nazw,
- dodawanie, edycja i usuwanie komunikatów,
- opcjonalne zdjęcia i filmy do 100 MB,
- zarządzanie kategoriami i dowolną liczbę pozycji,
- podpisane sesje administratora, ochrona CSRF, limit prób logowania i walidacja serwerowa,
- Neon Postgres dla danych oraz Vercel Blob dla mediów,
- lokalny backend D1/R2 podczas pracy przez Sites/Vinext,
- pełna responsywność i obsługa `prefers-reduced-motion`.

## Uruchomienie lokalne

```bash
npm ci
npm run dev
```

W trybie lokalnym działa pamięciowy podgląd i konto demonstracyjne:

- login: `admin`
- hasło: `MafiaDemo!2026`

Nie używaj tych danych w produkcji. Lokalny Vinext może również korzystać z D1/R2 zadeklarowanych w `.openai/hosting.json`.

## Wdrożenie na Vercel

1. Zaimportuj repozytorium jako projekt Next.js.
2. W Vercel Marketplace podłącz bazą **Neon Postgres**. Powinna dodać `DATABASE_URL`.
3. W zakładce Storage utwórz **publiczny Vercel Blob store** i połącz go z projektem. Vercel doda `BLOB_READ_WRITE_TOKEN`.
4. Wygeneruj hash mocnego hasła:

   ```bash
   npm run auth:hash -- "tu-wpisz-bardzo-mocne-haslo"
   ```

5. Dodaj w Vercel Environment Variables:

   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH` — wynik poprzedniej komendy
   - `ADMIN_SESSION_SECRET` — losowy sekret mający minimum 32 znaki
   - `NEXT_PUBLIC_SITE_URL` — docelowy adres strony

6. Wdróż projekt. Tabele i początkowa zawartość zostaną utworzone automatycznie przy pierwszym żądaniu. Migrację można również wykonać ręcznie poleceniem `npm run db:migrate` przy ustawionym `DATABASE_URL`.

## Walidacja

```bash
npm run typecheck
npm run lint
npm run build:vercel
```
