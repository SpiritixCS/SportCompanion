import { headers } from "next/headers";
import { knownUsers, type UserProfile } from "./users";

const HEADER_NAME = "cf-access-authenticated-user-email";

// Dev-only override so Mathis can preview Clément's screens locally: no
// Cloudflare Access sits in front of `next dev`, so the CF header this
// function reads never arrives outside of production. Never set this in
// deploy/sportcompanion.service.
function devForcedUser(): UserProfile | undefined {
  const slug = process.env.DEV_FORCE_USER_SLUG;
  if (!slug) return undefined;
  return knownUsers().find((u) => u.slug === slug);
}

export async function currentUser(): Promise<UserProfile> {
  const forced = devForcedUser();
  if (forced) return forced;

  const users = knownUsers();
  const mathis = users[0]!;

  let email: string | null = null;
  try {
    email = (await headers()).get(HEADER_NAME);
  } catch {
    // No active request scope (a script, a build, or a test that hasn't
    // mocked next/headers) — equivalent to Cloudflare Access not sitting
    // in front: fall back to Mathis, same as local dev today.
    email = null;
  }

  if (!email) return mathis;

  const match = users.find((u) => u.email === email);
  if (!match) throw new Error(`Accès non reconnu : ${email}`);
  return match;
}

export type { UserProfile as CurrentUser };
