import { AppNav } from "@/components/AppNav";
import { PrenomScreen } from "@/components/profile/PrenomScreen";
import { currentUser } from "@/lib/auth/currentUser";
import { getDbForUser } from "@/lib/db/client";
import { getPrenom } from "@/lib/profile/db";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nouvel utilisateur : le prénom passe avant tout écran du shell.
  if (getPrenom(getDbForUser(await currentUser())) === null) return <PrenomScreen />;

  return (
    <div className="lg:flex lg:justify-center">
      <div className="lg:flex lg:w-full lg:max-w-[calc(520px+5rem)]">
        <AppNav />
        <main className="pb-24 lg:pb-0 lg:flex-1 lg:max-w-[520px]">{children}</main>
      </div>
    </div>
  );
}
