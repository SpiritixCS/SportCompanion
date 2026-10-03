import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet, type JWTVerifyGetKey, type CryptoKey } from "jose";
import { verifyAccessJwt } from "./accessJwt";

const TEAM = "team.cloudflareaccess.com";
const AUD = "aud-tag";
let priv: CryptoKey;
let otherPriv: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  priv = pair.privateKey;
  otherPriv = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

function sign(claims: Record<string, unknown>, key: CryptoKey = priv) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(`https://${TEAM}`)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

const opts = () => ({ teamDomain: TEAM, aud: AUD, jwks });

describe("verifyAccessJwt", () => {
  it("returns the normalized email of a valid token", async () => {
    expect(await verifyAccessJwt(await sign({ email: "Mathis@Gmail.com" }), opts())).toBe("mathis@gmail.com");
  });

  it("rejects a wrong audience", async () => {
    expect(await verifyAccessJwt(await sign({ email: "a@b.fr" }), { ...opts(), aud: "other" })).toBeNull();
  });

  it("rejects a wrong issuer", async () => {
    expect(await verifyAccessJwt(await sign({ email: "a@b.fr" }), { ...opts(), teamDomain: "evil.cloudflareaccess.com" })).toBeNull();
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ email: "a@b.fr" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(`https://${TEAM}`)
      .setAudience(AUD)
      .setIssuedAt(now - 3600)
      .setExpirationTime(now - 60)
      .sign(priv);
    expect(await verifyAccessJwt(token, opts())).toBeNull();
  });

  it("rejects a token signed by another key", async () => {
    expect(await verifyAccessJwt(await sign({ email: "a@b.fr" }, otherPriv), opts())).toBeNull();
  });

  it("rejects a token without email", async () => {
    expect(await verifyAccessJwt(await sign({}), opts())).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyAccessJwt("not.a.jwt", opts())).toBeNull();
  });
});
