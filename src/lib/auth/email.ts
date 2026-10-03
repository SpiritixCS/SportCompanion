import path from "node:path";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

// Un email devient un nom de fichier : la regex exclut « / », « \ » et tout
// caractère de contrôle, et « .. » ne peut pas former un segment de chemin
// puisque le nom contient toujours « @ ».
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

export function userDbPath(email: string): string {
  return path.join(dataDir(), "users", `${email}.db`);
}
