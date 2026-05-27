import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AudioProvider } from './contexts/AudioContext'
import { AuthProvider } from './contexts/AuthContext'
import { LoadingProvider } from './contexts/LoadingContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { DiscoveryProvider } from './contexts/DiscoveryContext'
import { registerSW } from 'virtual:pwa-register'
import { setInstallPrompt, type BeforeInstallPromptEvent } from './installPromptStore'

// Capture beforeinstallprompt before React mounts to close the timing race
// where the event fires before useEffect registers a listener.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  setInstallPrompt(e as BeforeInstallPromptEvent)
  window.dispatchEvent(new Event('installpromptcaptured'))
})

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AudioProvider>
        <LoadingProvider>
          <NotificationProvider>
            <DiscoveryProvider>
              <App />
            </DiscoveryProvider>
          </NotificationProvider>
        </LoadingProvider>
      </AudioProvider>
    </AuthProvider>
  </StrictMode>,
)
