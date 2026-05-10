'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { filesApi } from '@/lib/api'
import type { FileRecord } from '@/lib/types'

interface Props {
  sessionId: string
  attachedFiles: FileRecord[]
  onAttach: (file: FileRecord) => void
  onDetach: (fileId: string) => void
}

export function FileUpload({ sessionId, attachedFiles, onAttach, onDetach }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setProgress(0)
    try {
      const record = await filesApi.upload(sessionId, file, setProgress)
      onAttach(record)
      toast.success(`${file.name} uploaded`)
    } catch {
      toast.error(`Failed to upload ${file.name}`)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [sessionId, onAttach])

  const onDrop = useCallback(
    (accepted: File[]) => { for (const f of accepted) uploadFile(f) },
    [uploadFile],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    maxSize: 500 * 1024 * 1024,
  })

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-10 rounded-xl bg-blue-500/10 border-2 border-dashed border-blue-500/50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
            <Upload className="h-4 w-4" />
            Drop log file here
          </div>
        </div>
      )}

      {/* Drop zone button */}
      <button
        type="button"
        onClick={open}
        disabled={uploading}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed text-sm transition-all',
          'border-[hsl(var(--glass-border))] text-muted-foreground hover:text-foreground hover:border-[hsl(0_0%_100%/0.2)] hover:bg-[hsl(0_0%_100%/0.02)]',
          uploading && 'opacity-50 cursor-not-allowed',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">Uploading…</span>
                <span className="text-xs text-muted-foreground/70">{progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-[hsl(0_0%_100%/0.06)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(199_89%_55%)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 shrink-0" />
            <span>Upload log file</span>
            <span className="ml-auto text-xs text-muted-foreground/60">Apache · Nginx · MySQL · Syslog · JSON</span>
          </>
        )}
      </button>

      {/* Attached file chips */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachedFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 max-w-[200px]"
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{f.originalName}</span>
              <span className="text-blue-500/60 shrink-0">{formatSize(f.sizeBytes)}</span>
              <button
                type="button"
                onClick={() => onDetach(f.id)}
                className="shrink-0 text-blue-500/60 hover:text-blue-300 ml-0.5 p-0.5 rounded-md hover:bg-blue-500/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}