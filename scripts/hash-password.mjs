import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Użycie: npm run auth:hash -- "bardzo-mocne-hasło" (minimum 12 znaków)');
  process.exit(1);
}

const iterations = 310_000;
const salt = randomBytes(18);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const base64url = (value) => value.toString("base64url");

console.log(`pbkdf2-sha256$${iterations}$${base64url(salt)}$${base64url(hash)}`);
