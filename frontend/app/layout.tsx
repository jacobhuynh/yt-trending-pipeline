import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YouTube ETL Pipeline",
  description: "Dashboard for the YouTube Trending Data ETL Pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} dark h-full antialiased`}>
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="h-6 w-6 rounded bg-red-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">YT</span>
              </div>
              <span className="font-semibold text-white">ETL Pipeline</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/videos"
                className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
              >
                Videos
              </Link>
              <Link
                href="/analytics"
                className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
              >
                Analytics
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
