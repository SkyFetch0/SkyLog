import Image from 'next/image'

export default function ChatHomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background p-8 select-none relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-7 max-w-md text-center">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" aria-hidden />
          <Image
            src="/images/SkyLogo.png"
            alt="SkyLog"
            width={80}
            height={80}
            className="relative object-contain drop-shadow-[0_0_24px_hsl(var(--primary)/0.4)]"
            priority
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight gradient-text">SkyLog</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            AI-powered log analyzer. Upload a log file, ask a question, and get instant insights.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full mt-1">
          {[
            { icon: '🛡️', label: 'Security threats', desc: 'Brute force, DDoS, suspicious IPs' },
            { icon: '⚡', label: 'Performance',     desc: 'Slow queries, bottlenecks, p99 latency' },
            { icon: '🔍', label: 'Error patterns',  desc: '4xx/5xx spikes, crash indicators' },
            { icon: '📊', label: 'Traffic analysis',desc: 'Top endpoints, peak hours, trends' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3.5 rounded-xl bg-[hsl(0_0%_100%/0.03)] border border-[hsl(var(--glass-border))] text-left hover-lift"
            >
              <div className="text-xl mb-1.5">{item.icon}</div>
              <p className="text-xs font-semibold text-foreground">{item.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/70 mt-1">
          Select or create a session from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}