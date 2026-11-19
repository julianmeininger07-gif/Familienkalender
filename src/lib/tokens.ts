import { createHash, randomBytes } from "node:crypto";

/** Zufälliges, URL-taugliches Token (256 Bit). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** In der Datenbank landen nur Hashes, nie die Tokens selbst. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
