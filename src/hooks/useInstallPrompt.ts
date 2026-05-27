import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    if (isInstalled) return
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isInstalled])

  const install = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
  }

  return {
    canInstall: !isInstalled && !!installPrompt,
    isInstalled,
    install,
  }
}
