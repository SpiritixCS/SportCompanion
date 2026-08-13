import { AppNav } from "@/components/AppNav";
import { currentUser } from "@/lib/auth/currentUser";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="lg:flex lg:justify-center">
      <div className="lg:flex lg:w-full lg:max-w-[calc(520px+5rem)]">
        <AppNav userSlug={user.slug} />
        <main className="pb-24 lg:pb-0 lg:flex-1 lg:max-w-[520px]">{children}</main>
      </div>
    </div>
  );
}
