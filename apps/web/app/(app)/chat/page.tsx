import { ScanSearch } from 'lucide-react'

export const metadata = { title: 'SkyLog' }

export default function ChatPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <ScanSearch className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SkyLog</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-xs">
          Upload a log file and start a new analysis session from the sidebar.
        </p>
      </div>
    </div>
  )
}