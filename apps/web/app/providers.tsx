'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {/*
       * Theme system is data-theme based (CSS selector [data-theme="dark"]).
       * `themes` lists all valid palettes — adding a new palette is:
       *   1. Add `[data-theme="purple"] { ... }` block to globals.css
       *   2. Add 'purple' to this array
       *   3. Add a chip in the Settings page selector
       *
       * `defaultTheme="dark"` ensures fresh visitors get the dark palette.
       * `enableSystem={false}` disables auto OS-theme detection — we want
       *  explicit user choice; uncomment to re-enable.
       */}
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="light"
        enableSystem={false}
        themes={['light', 'dark', 'purple', 'ocean']}
        storageKey="skylog-theme"
        disableTransitionOnChange
      >
        {children}
        <Toaster
          richColors
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--surface-2))',
              border: '1px solid hsl(var(--border-strong))',
              color: 'hsl(var(--foreground))',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
