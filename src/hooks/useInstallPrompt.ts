import { useState, useEffect } from 'react'
import { getInstallPrompt, clearInstallPrompt, type BeforeInstallPromptEvent } from '@/installPromptStore'

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getInstallPrompt()
  )
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    if (isInstalled) return
    // Handle the case where the event fires after this hook mounts
    const onCaptured = () => setInstallPrompt(getInstallPrompt())
    window.addEventListener('installpromptcaptured', onCaptured)
    return () => window.removeEventListener('installpromptcaptured', onCaptured)
  }, [isInstalled])

  const install = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      clearInstallPrompt()
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
