import type { Metadata } from "next";
import { archivo, interTight } from "@/lib/fonts";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "SportCompanion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${archivo.variable} ${interTight.variable}`}>
      <body className="font-[family-name:var(--font-inter-tight)] lg:flex lg:justify-center">
        <div className="lg:flex lg:w-full lg:max-w-[calc(520px+5rem)]">
          <AppNav />
          <main className="pb-24 lg:pb-0 lg:flex-1 lg:max-w-[520px]">{children}</main>
        </div>
      </body>
    </html>
  );
}
