export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  service?: string
  traceId?: string
  spanId?: string
  meta?: Record<string, unknown>
}

export interface LogFilter {
  level?: LogLevel
  service?: string
  from?: string
  to?: string
  search?: string
  limit?: number
  offset?: number
}