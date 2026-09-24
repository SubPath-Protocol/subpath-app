export default function DashboardPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Merchant Dashboard</h1>
          <p className="text-gray-400">Manage your subscription plans and revenue.</p>
        </div>
        <button className="px-5 py-2.5 rounded-lg font-semibold bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
          + Create Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6 border-indigo-500/20 bg-indigo-500/5">
          <p className="text-sm font-medium text-indigo-300 mb-1">Total Recurring Revenue (USDC)</p>
          <h2 className="text-4xl font-black tracking-tight">$4,250.00</h2>
        </div>
        <div className="glass-panel p-6">
          <p className="text-sm font-medium text-gray-400 mb-1">Active Subscribers</p>
          <h2 className="text-4xl font-black tracking-tight">128</h2>
        </div>
        <div className="glass-panel p-6">
          <p className="text-sm font-medium text-gray-400 mb-1">Active Plans</p>
          <h2 className="text-4xl font-black tracking-tight">3</h2>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-6">Your Subscription Plans</h3>
      <div className="flex flex-col gap-4">
        {[
          { name: "Pro Tier", price: "20.00 USDC", cycle: "Monthly", subs: 89 },
          { name: "Enterprise Tier", price: "99.00 USDC", cycle: "Monthly", subs: 12 },
          { name: "Basic Support", price: "5.00 USDC", cycle: "Weekly", subs: 27 },
        ].map((plan, i) => (
          <div key={i} className="glass-panel p-5 flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm shadow-md">
                {plan.name[0]}
              </div>
              <div>
                <h4 className="font-bold">{plan.name}</h4>
                <p className="text-sm text-gray-400">{plan.price} / {plan.cycle}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{plan.subs} active</p>
              </div>
              <button className="text-gray-400 hover:text-white transition-colors">
                Manage →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
