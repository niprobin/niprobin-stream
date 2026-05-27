import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function InstallPrompt() {
  const { canInstall, install } = useInstallPrompt()
  const [isDismissed, setIsDismissed] = useState(false)

  if (!canInstall || isDismissed) return null

  return (
    <div className="flex items-center gap-2 justify-center mb-4">
      <Button
        onClick={install}
        variant="outline"
        size="sm"
        className="gap-2 text-white"
      >
        <Download className="h-4 w-4" />
        Install App
      </Button>
      <Button
        onClick={() => setIsDismissed(true)}
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
