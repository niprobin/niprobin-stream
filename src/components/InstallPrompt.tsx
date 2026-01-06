import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => {
    // Check if already installed during initialization
    return window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    // Skip if already installed
    if (isInstalled) return

    // Listen for install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInstallClick = async () => {
    if (!installPrompt) return

    installPrompt.prompt()
    const result = await installPrompt.userChoice

    if (result.outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
  }

  // Don't show if already installed or prompt not available
  if (isInstalled || !installPrompt) {
    return null
  }

  return (
    <Button
      onClick={handleInstallClick}
      variant="outline"
      size="sm"
      className="gap-2 text-white"
    >
      <Download className="h-4 w-4" />
      Install App
    </Button>
  )
}