import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SubPath - Decentralized Recurring Billing",
  description: "Seamless subscription payments on the Stellar network using Soroban.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <nav className="fixed w-full z-50 glass-panel border-b-0 border-x-0 rounded-none px-6 py-4 flex justify-between items-center">
          <div className="font-bold text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            SubPath
          </div>
          <div className="flex gap-4">
            <a href="https://github.com/SubPath-Protocol/subpath-contract" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors inline-flex items-center">
              Documentation
            </a>
            <Link href="/dashboard" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/20 inline-flex items-center">
              Connect Wallet
            </Link>
          </div>
        </nav>
        <main className="pt-24 min-h-screen px-6 max-w-7xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
