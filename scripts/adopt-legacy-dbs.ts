// Lancé par deploy/deploy.sh avant db:migrate. Reprend une seule fois les
// bases v0.1 de Mathis et Clément sous leur email ; sans effet ensuite.
import path from "node:path";
import { dataDir } from "../src/lib/auth/email";
import { adoptLegacyDb } from "../src/lib/db/adoptLegacy";

const LEGACY: [file: string, email: string | undefined, prenom: string][] = [
  ["sportcompanion.db", process.env.MATHIS_EMAIL, "Mathis"],
  ["sportcompanion.clement.db", process.env.CLEMENT_EMAIL, "Clément"],
];

async function main() {
  for (const [file, email, prenom] of LEGACY) {
    const result = await adoptLegacyDb({ legacyPath: path.join(dataDir(), file), email, prenom });
    console.log(`[${file}] ${result === "adopted" ? "repris sous son email" : "ignoré (déjà repris ou rien à reprendre)"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
