import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Brak DATABASE_URL. Dodaj połączenie Neon do pliku .env.local.");
  process.exit(1);
}

const source = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
const statements = source
  .split("-- statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);
const sql = neon(databaseUrl);

await sql.transaction((transaction) =>
  statements.map((statement) => transaction.query(statement)),
);

console.log(`Migracja zakończona. Wykonano zapytań: ${statements.length}.`);
