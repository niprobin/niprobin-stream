import { useEffect, useState } from 'react'
import { Player } from './components/Player'
import { Search } from './components/Search'
import { InstallPrompt } from './components/InstallPrompt'
import { useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationBanner } from './components/NotificationBanner'
import GlobalLoadingOverlay from '@/components/GlobalLoadingOverlay'
import { Button } from './components/ui/button'
import { LogIn } from 'lucide-react'
import { AlbumsPage } from './pages/Albums'
import { useNotification } from './contexts/NotificationContext'
import { useAudio } from './contexts/AudioContext'
import { extractTrackHashFromPath } from './utils/urlBuilder'
import { getTrackByHash } from './services/api'

function AuthControls() {
  const { isAuthenticated, login, logout } = useAuth()
  const { showNotification } = useNotification()
  const [code, setCode] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const success = login(code)
    if (!success) {
      showNotification('Invalid access code', 'error')
    } else {
      setCode('')
      setIsPanelOpen(false)
    }
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-slate-300 hover:text-white hover:bg-slate-800"
        >
          Logout
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsPanelOpen((prev) => !prev)}
        className="text-slate-300 hover:text-white hover:bg-slate-800"
      >
        Login
      </Button>
      {isPanelOpen && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="password"
            inputMode="text"
            autoComplete="off"
            name="niprobin-access"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            className="w-32 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/30"
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 bg-white text-black hover:bg-white/90"
            aria-label="Submit access code"
          >
            <LogIn className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  )
}

function AppContent() {
  const { isAuthenticated } = useAuth()
  const { loadTrack } = useAudio()
  const [activePage, setActivePage] = useState<'home' | 'digging'>('home')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromLocation = async () => {
      const path = window.location.pathname

      // Check if this is a track URL (/play/:hash)
      const trackHash = extractTrackHashFromPath(path)
      if (trackHash) {
        try {
          // Fetch track data from the hash
          const streamResponse = await getTrackByHash(trackHash)

          // Load the track (paused, not playing)
          loadTrack({
            id: streamResponse.trackId,
            hashUrl: streamResponse.hashUrl,
            title: streamResponse.track,
            artist: streamResponse.artist,
            album: streamResponse.album,
            streamUrl: streamResponse.streamUrl,
            coverArt: streamResponse.cover,
          })

          // Stay on home page when loading from URL
          setActivePage('home')
        } catch (err) {
          console.error('Failed to load track from URL:', err)
          // If track loading fails, just go to home
          window.history.replaceState({}, '', '/')
          setActivePage('home')
        }
        return
      }

      // Existing page routing logic
      const wantsDigging = path === '/digging'
      if (wantsDigging) {
        if (isAuthenticated) {
          setActivePage('digging')
        } else {
          window.history.replaceState({}, '', '/')
          setActivePage('home')
        }
      } else {
        setActivePage('home')
      }
    }

    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [isAuthenticated, loadTrack])

  const navigate = (page: 'home' | 'digging') => {
    if (page === 'digging' && !isAuthenticated) {
      return
    }

    const path = page === 'digging' ? '/digging' : '/'
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setActivePage(page)
  }

  return (
    <>
      <NotificationBanner />
      <GlobalLoadingOverlay />
      <div className="min-h-screen bg-slate-950 pb-32 md:pb-24">
        {/* Main Content Area */}
        <div className="w-full px-4 sm:px-6 lg:px-10 pt-6">
          <InstallPrompt />
          <div className="w-full mb-1 space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h1 className="text-white text-2xl font-semibold tracking-tight">
                nipstream
              </h1>
              <AuthControls />
            </div>

            {isAuthenticated && (
              <div className="rounded-full border border-slate-800 bg-slate-900/70 p-1.5 shadow-inner">
                <nav
                  className="grid grid-cols-2 gap-1.5 text-sm sm:text-base"
                  role="tablist"
                  aria-label="Primary pages"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePage === 'home'}
                    onClick={() => navigate('home')}
                    className={`py-2.5 rounded-full font-medium transition ${
                      activePage === 'home'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePage === 'digging'}
                    onClick={() => navigate('digging')}
                    className={`py-2.5 rounded-full font-medium transition ${
                      activePage === 'digging'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Digging
                  </button>
                </nav>
              </div>
            )}
          </div>

          <div className="w-full">
            {activePage === 'digging' ? <AlbumsPage /> : <Search />}
          </div>
        </div>

        {/* Player stays at the bottom */}
        <Player />
      </div>
    </>
  )
}

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  )
}

export default App
