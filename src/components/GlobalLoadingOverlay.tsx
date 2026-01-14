import React from 'react'
import { useLoading } from '@/contexts/LoadingContext'

export default function GlobalLoadingOverlay() {
  const { isLoading } = useLoading()
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-full border-t-2 border-white animate-spin" />
        <div className="text-white text-sm">Loading...</div>
      </div>
    </div>
  )
}
