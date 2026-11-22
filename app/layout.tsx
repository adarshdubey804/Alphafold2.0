import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "alphafold-vs-pipeline",
  description: "AlphaFold-guided virtual screening dashboard",
  openGraph: {
    title: "alphafold-vs-pipeline",
    description: "AlphaFold-guided virtual screening dashboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
