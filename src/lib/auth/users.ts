import path from "node:path";

export type UserSlug = "mathis" | "clement";

export type UserProfile = {
  slug: UserSlug;
  label: string;
  email: string | undefined;
  dbPath: string;
};

function dataDir(): string {
  const dbPath = process.env.DB_PATH;
  return dbPath ? path.dirname(dbPath) : path.join(process.cwd(), "data");
}

export function knownUsers(): UserProfile[] {
  const dir = dataDir();
  const users: UserProfile[] = [
    {
      slug: "mathis",
      label: "Mathis",
      email: process.env.MATHIS_EMAIL,
      dbPath: process.env.DB_PATH ?? path.join(dir, "sportcompanion.db"),
    },
  ];
  if (process.env.CLEMENT_EMAIL) {
    users.push({
      slug: "clement",
      label: "Clément",
      email: process.env.CLEMENT_EMAIL,
      dbPath: path.join(dir, "sportcompanion.clement.db"),
    });
  }
  return users;
}
