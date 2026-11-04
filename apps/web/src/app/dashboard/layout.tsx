export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)] w-full max-w-7xl mx-auto pt-4 md:pt-6 px-4 md:px-0 gap-4 md:gap-6">
      <aside className="hidden md:flex w-64 flex-col gap-2">
        {['Overview', 'My Plans', 'Subscribers', 'Settings'].map((item, i) => (
          <button key={i} className={`text-left px-4 py-3 rounded-xl transition-all ${i === 0 ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            {item}
          </button>
        ))}
      </aside>
      <main className="flex-1 glass-panel p-4 sm:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
