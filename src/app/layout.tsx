import type { Metadata } from "next";
import { archivo, interTight } from "@/lib/fonts";
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
      <body className="font-[family-name:var(--font-inter-tight)]">{children}</body>
    </html>
  );
}
