import { useState, useEffect } from 'react'
import { getDeferredInstallPrompt, clearDeferredInstallPrompt } from '@/main'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  // Initialize from the event already captured in main.tsx (closes the timing race)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getDeferredInstallPrompt()
  )
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    if (isInstalled) return
    // Handle the case where the event fires after this hook mounts
    const onCaptured = () => setInstallPrompt(getDeferredInstallPrompt())
    window.addEventListener('installpromptcaptured', onCaptured)
    return () => window.removeEventListener('installpromptcaptured', onCaptured)
  }, [isInstalled])

  const install = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      clearDeferredInstallPrompt()
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
