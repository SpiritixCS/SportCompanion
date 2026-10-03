import type { Metadata } from "next";
import { display, body, mono } from "@/lib/fonts";
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
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
