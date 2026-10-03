import { normalizeEmail } from "./email";
import { verifyAccessJwt } from "./accessJwt";

let warnedNoJwt = false;

// Ordre : identité forcée (dev seulement) → JWT Cloudflare vérifié si la
// configuration est posée → sinon header email (déploiement progressif).
export async function resolveEmail(
  h: Headers | null,
  env: NodeJS.ProcessEnv,
  verify: typeof verifyAccessJwt = verifyAccessJwt,
): Promise<string | null> {
  if (env.NODE_ENV !== "production") {
    const forced = normalizeEmail(env.DEV_FORCE_USER_EMAIL);
    if (forced) return forced;
  }
  if (!h) return null;

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  if (teamDomain && aud) {
    const token = h.get("cf-access-jwt-assertion");
    return token ? verify(token, { teamDomain, aud }) : null;
  }

  // Sans configuration JWT : header email, comme en v0.1 (l'app n'écoute que
  // sur 127.0.0.1, seul le tunnel Cloudflare l'atteint).
  if (!warnedNoJwt && env.NODE_ENV === "production") {
    warnedNoJwt = true;
    console.warn(
      "[auth] CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD absents : identité lue dans le header email, sans vérification de signature.",
    );
  }
  return normalizeEmail(h.get("cf-access-authenticated-user-email"));
}
