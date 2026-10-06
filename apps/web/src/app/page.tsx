"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, Repeat, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-32 pb-40 flex flex-col items-center text-center">
        
        {/* Decorative background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm font-medium text-cyan-300 mb-8 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
          SubPath v0.1 Live on Testnet
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-6xl md:text-8xl font-outfit font-black tracking-tighter mb-8 leading-[1.1]"
        >
          Crypto subscriptions, <br className="hidden md:block"/>
          <span className="gradient-text">fully automated.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl md:text-2xl text-gray-400 max-w-3xl mb-12 leading-relaxed font-light"
        >
          The native recurring payment protocol for Stellar. Accept stablecoins on auto-pilot with secure, time-locked Soroban smart contracts. No manual claims. No friction.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-5"
        >
          <Link href="/dashboard" className="px-8 py-4 rounded-xl font-bold bg-white text-black hover:bg-gray-100 transition-all flex items-center justify-center gap-2 group shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105">
            Launch Dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="https://github.com/SubPath-Protocol" target="_blank" rel="noreferrer" className="px-8 py-4 rounded-xl font-bold glass-panel hover:bg-white/10 transition-all flex items-center justify-center hover:scale-105">
            Explore Documentation
          </a>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-32 relative">
        <div className="mb-20 text-center">
          <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-6">Designed for scale.</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Everything you need to run a modern SaaS or creator platform natively on-chain.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Zap className="w-6 h-6 text-cyan-400" />, title: "Native Path Payments", desc: "Users pay in any Stellar asset, you receive USDC. The protocol handles the atomic swap automatically." },
            { icon: <Shield className="w-6 h-6 text-purple-400" />, title: "Time-locked Execution", desc: "Smart contracts enforce strict billing cycles. Funds cannot be pulled early by merchants or executors." },
            { icon: <Repeat className="w-6 h-6 text-indigo-400" />, title: "Zero State Bloat", desc: "Dynamic TTL extension prevents state archival, keeping your recurring subscriptions active indefinitely." },
            { icon: <Layers className="w-6 h-6 text-pink-400" />, title: "Decentralized Executors", desc: "Anyone can run an executor node to trigger due subscriptions and earn execution fees." },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-panel p-8 hover:bg-white/5 transition-colors group cursor-default"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-white/10 transition-all">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-6 py-32">
        <div className="glass-panel p-12 md:p-20 text-center relative overflow-hidden rounded-3xl border-indigo-500/30">
          <div className="absolute inset-0 animated-gradient-bg opacity-10 z-0" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-outfit font-bold mb-6">Ready to accept crypto?</h2>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">Join the decentralized billing revolution. Connect your wallet and create your first plan in seconds.</p>
            <Link href="/dashboard" className="px-10 py-5 rounded-2xl font-bold bg-white text-black hover:bg-gray-100 transition-all inline-flex items-center justify-center shadow-2xl hover:scale-105">
              Get Started Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
