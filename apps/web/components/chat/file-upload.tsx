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

  const uploadFile = async (file: File) => {
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
  }

  const onDrop = useCallback(
    (accepted: File[]) => {
      for (const f of accepted) uploadFile(f)
    },
    [sessionId],
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
        <div className="absolute inset-0 z-10 rounded-xl bg-blue-500/10 border-2 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
            <Upload className="h-4 w-4" />
            Drop log file here
          </div>
        </div>
      )}

      {/* Attached file chips */}
      {(attachedFiles.length > 0 || uploading) && (
        <div className="flex flex-wrap gap-1.5 mb-2 px-1">
          {attachedFiles.map((f) => (
            <FileChip
              key={f.id}
              name={f.originalName}
              size={f.sizeBytes}
              onRemove={() => onDetach(f.id)}
            />
          ))}
          {uploading && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Uploading… {progress}%</span>
            </div>
          )}
        </div>
      )}

      {/* Upload trigger button */}
      <button
        type="button"
        onClick={open}
        disabled={uploading}
        className={cn(
          'p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors',
          uploading && 'opacity-50 cursor-not-allowed',
        )}
        title="Attach log file"
      >
        <Upload className="h-4 w-4" />
      </button>
    </div>
  )
}

function FileChip({
  name,
  size,
  onRemove,
}: {
  name: string
  size: number
  onRemove: () => void
}) {
  const kb = size < 1024 * 1024 ? `${(size / 1024).toFixed(0)}KB` : `${(size / 1024 / 1024).toFixed(1)}MB`
  return (
    <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 max-w-[180px]">
      <FileText className="h-3 w-3 text-blue-400 shrink-0" />
      <span className="truncate">{name}</span>
      <span className="text-zinc-500 shrink-0">{kb}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-zinc-500 hover:text-zinc-200 ml-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}