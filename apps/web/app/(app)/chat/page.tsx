import { Zap } from 'lucide-react'

export default function ChatHomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#070b14] p-8 select-none">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/6 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
          <Zap className="w-6 h-6 text-blue-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">SkyLog</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            AI-powered log analyzer. Upload a log file, ask a question, and get instant insights.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          {[
            { icon: '🛡️', label: 'Security threats', desc: 'Brute force, DDoS, suspicious IPs' },
            { icon: '⚡', label: 'Performance', desc: 'Slow queries, bottlenecks, p99 latency' },
            { icon: '🔍', label: 'Error patterns', desc: '4xx/5xx spikes, crash indicators' },
            { icon: '📊', label: 'Traffic analysis', desc: 'Top endpoints, peak hours, trends' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left"
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <p className="text-xs font-medium text-zinc-300">{item.label}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-700 mt-2">
          Select or create a session from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}