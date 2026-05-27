// Module-level store for the beforeinstallprompt event.
// Lives outside main.tsx to avoid circular imports with the hooks that consume it.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let _prompt: BeforeInstallPromptEvent | null = null

export function getInstallPrompt() {
  return _prompt
}

export function setInstallPrompt(e: BeforeInstallPromptEvent) {
  _prompt = e
}

export function clearInstallPrompt() {
  _prompt = null
}
