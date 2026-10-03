import { describe, it, expect, vi } from "vitest";
import { resolveEmail } from "./resolveEmail";

const H = (o: Record<string, string>) => new Headers(o);
const verifyOk = vi.fn(async () => "jwt@user.fr");
const verifyKo = vi.fn(async () => null);
const CF = { CF_ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", CF_ACCESS_AUD: "aud" };
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe("resolveEmail", () => {
  it("uses DEV_FORCE_USER_EMAIL outside production", async () => {
    expect(await resolveEmail(null, env({ NODE_ENV: "development", DEV_FORCE_USER_EMAIL: "Dev@X.fr" }), verifyKo)).toBe("dev@x.fr");
  });

  it("ignores DEV_FORCE_USER_EMAIL in production", async () => {
    expect(await resolveEmail(null, env({ NODE_ENV: "production", DEV_FORCE_USER_EMAIL: "dev@x.fr" }), verifyKo)).toBeNull();
  });

  it("requires a valid JWT when CF variables are set, ignoring a bare (forged) email header", async () => {
    const h = H({ "cf-access-authenticated-user-email": "forged@x.fr" });
    expect(await resolveEmail(h, env({ NODE_ENV: "production", ...CF }), verifyOk)).toBeNull();
  });

  it("returns the JWT email when valid", async () => {
    const h = H({ "cf-access-jwt-assertion": "tok", "cf-access-authenticated-user-email": "other@x.fr" });
    expect(await resolveEmail(h, env({ NODE_ENV: "production", ...CF }), verifyOk)).toBe("jwt@user.fr");
    expect(verifyOk).toHaveBeenCalledWith("tok", { teamDomain: CF.CF_ACCESS_TEAM_DOMAIN, aud: CF.CF_ACCESS_AUD });
  });

  it("returns null when the JWT is invalid", async () => {
    const h = H({ "cf-access-jwt-assertion": "bad" });
    expect(await resolveEmail(h, env({ NODE_ENV: "production", ...CF }), verifyKo)).toBeNull();
  });

  it("falls back to the email header when CF variables are missing", async () => {
    const h = H({ "cf-access-authenticated-user-email": "Mathis@Gmail.com" });
    expect(await resolveEmail(h, env({ NODE_ENV: "production" }), verifyKo)).toBe("mathis@gmail.com");
  });

  it("returns null with no identity at all", async () => {
    expect(await resolveEmail(H({}), env({ NODE_ENV: "production" }), verifyKo)).toBeNull();
    expect(await resolveEmail(null, env({ NODE_ENV: "development" }), verifyKo)).toBeNull();
  });
});
