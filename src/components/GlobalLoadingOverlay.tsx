import { useLoading } from '@/contexts/LoadingContext'

export default function GlobalLoadingOverlay() {
  const { isLoading } = useLoading()
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0-deep/70 backdrop-blur-sm">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-text-1/15 border-t-accent animate-spin" />
        <div className="font-mono-label text-xs uppercase tracking-[0.18em] text-text-3">
          Loading
        </div>
      </div>
    </div>
  )
}
