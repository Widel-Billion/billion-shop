import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Billion Shop — Le style, sans compromis.",
  description: "Une sélection singulière de vêtements, chaussures, accessoires et objets du quotidien.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
