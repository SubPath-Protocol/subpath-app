export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-6rem)] w-full max-w-7xl mx-auto pt-6 gap-6">
      <aside className="w-64 flex flex-col gap-2">
        {['Overview', 'My Plans', 'Subscribers', 'Settings'].map((item, i) => (
          <button key={i} className={`text-left px-4 py-3 rounded-xl transition-all ${i === 0 ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            {item}
          </button>
        ))}
      </aside>
      <main className="flex-1 glass-panel p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
