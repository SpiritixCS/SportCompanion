import { AppNav } from "@/components/AppNav";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lg:flex lg:justify-center">
      <div className="lg:flex lg:w-full lg:max-w-[calc(520px+5rem)]">
        <AppNav />
        <main className="pb-24 lg:pb-0 lg:flex-1 lg:max-w-[520px]">{children}</main>
      </div>
    </div>
  );
}
