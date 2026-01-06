import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

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
  const [isDismissed, setIsDismissed] = useState(false)

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

  const handleClose = () => {
    setIsDismissed(true)
  }

  // Don't show if already installed or prompt not available
  if (isInstalled || !installPrompt || isDismissed) {
    return null
  }

  return (
    <div className="flex items-center gap-2 justify-center mb-4">
      <Button
        onClick={handleInstallClick}
        variant="outline"
        size="sm"
        className="gap-2 text-white"
      >
        <Download className="h-4 w-4" />
        Install App
      </Button>
      <Button
        onClick={handleClose}
        variant="ghost"
        size="icon-sm"
        className="text-white hover:text-white/80"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
)
}