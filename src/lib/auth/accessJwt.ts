import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { normalizeEmail } from "./email";

const remoteSets = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let set = remoteSets.get(teamDomain);
  if (!set) {
    // jose garde les clés en cache et les recharge à la rotation (kid inconnu).
    set = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    remoteSets.set(teamDomain, set);
  }
  return set;
}

// Email du jeton signé que Cloudflare Access ajoute à chaque requête
// autorisée, ou null si le jeton est absent, invalide, expiré, ou émis pour
// une autre application.
export async function verifyAccessJwt(
  token: string,
  opts: { teamDomain: string; aud: string; jwks?: JWTVerifyGetKey },
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, opts.jwks ?? remoteJwks(opts.teamDomain), {
      issuer: `https://${opts.teamDomain}`,
      audience: opts.aud,
      algorithms: ["RS256"],
    });
    return normalizeEmail(typeof payload.email === "string" ? payload.email : null);
  } catch {
    return null;
  }
}
