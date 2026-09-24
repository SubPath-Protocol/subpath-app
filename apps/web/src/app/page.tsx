export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center pt-20 pb-32 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-sm text-indigo-300 mb-8 border-indigo-500/30">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        Live on Stellar Testnet
      </div>
      
      <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-tight">
        Recurring crypto <br/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
          subscriptions.
        </span>
      </h1>
      
      <p className="text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
        SubPath enables businesses to accept seamless, automated recurring payments using native Stellar stablecoins. No manual claims, no friction.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-24">
        <button className="px-8 py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/25">
          Launch Dashboard
        </button>
        <button className="px-8 py-4 rounded-xl font-bold glass-panel hover:bg-white/10 transition-all">
          Read the Docs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mt-12">
        {[
          { title: "Native Path Payments", desc: "Users pay in any token, merchants receive USDC. SubPath handles the swap natively on Stellar." },
          { title: "Time-locked Execution", desc: "Soroban smart contracts ensure funds can only be pulled precisely when the billing cycle triggers." },
          { title: "Zero State Bloat", desc: "Dynamic TTL extension prevents state archival, keeping subscriptions active indefinitely." }
        ].map((feature, i) => (
          <div key={i} className="glass-panel p-8 hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <div className="w-6 h-6 bg-indigo-400 rounded-md" />
            </div>
            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
            <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
