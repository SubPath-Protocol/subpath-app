import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "../contexts/WalletContext";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { Toaster } from "sonner";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SubPath Protocol",
  description: "Native recurring billing and subscriptions for the Stellar network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-white selection:bg-indigo-500/30`}>
        <Toaster theme="dark" position="top-center" />
        <WalletProvider>
          <nav className="fixed w-full z-50 glass-nav px-6 py-4 transition-all duration-300">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <Link href="/" className="font-outfit font-black text-2xl tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg animated-gradient-bg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <span className="text-white text-sm">SP</span>
                </div>
                SubPath
              </Link>
              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
                  <a href="https://github.com/SubPath-Protocol/subpath-contract" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                    Developers
                  </a>
                  <a href="#features" className="hover:text-white transition-colors">
                    Features
                  </a>
                </div>
                <ConnectWalletButton />
              </div>
            </div>
          </nav>
          
          <main className="pt-24 min-h-screen">
            {children}
          </main>

          <footer className="border-t border-white/5 py-12 mt-20">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
              <p>© 2026 SubPath Protocol. Built on Soroban.</p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
                <a href="#" className="hover:text-white transition-colors">Discord</a>
                <a href="#" className="hover:text-white transition-colors">GitHub</a>
              </div>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
