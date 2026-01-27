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
import { extractTrackHashFromPath, extractAlbumIdFromPath, parsePageFromUrl, buildDiggingUrl } from './utils/urlBuilder'
import { getTrackByHash } from './services/api'
import { AlbumPage } from './pages/Album'

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
  const [activePage, setActivePage] = useState<'home' | 'digging' | 'album'>('home')
  const [currentAlbumId, setCurrentAlbumId] = useState<number | null>(null)
  const [diggingTab, setDiggingTab] = useState<'tracks' | 'albums'>('tracks')
  const [diggingPage, setDiggingPage] = useState<number>(1)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromLocation = async () => {
      const path = window.location.pathname
      const search = window.location.search
      console.log(`syncFromLocation: path=${path}, search=${search}`)

      // Check if this is an album URL (/album/:id)
      const albumId = extractAlbumIdFromPath(path)
      if (albumId) {
        setCurrentAlbumId(albumId)
        setActivePage('album')
        return
      }

      // Check if this is a track URL (/play/:hash)
      const trackHash = extractTrackHashFromPath(path)
      if (trackHash) {
        try {
          // Fetch track data from the hash
          const streamResponse = await getTrackByHash(trackHash)

          // Load the track from shared link (paused, not playing)
          loadTrack({
            id: streamResponse.trackId,
            hashUrl: streamResponse.hashUrl,
            title: streamResponse.track,
            artist: streamResponse.artist,
            album: streamResponse.album,
            streamUrl: streamResponse.streamUrl,
            coverArt: streamResponse.cover,
          })

          // Redirect URL to home page after successful track load
          window.history.replaceState({}, '', '/')
          setActivePage('home')
        } catch (err) {
          console.error('Failed to load track from URL:', err)
          // If track loading fails, just go to home
          window.history.replaceState({}, '', '/')
          setActivePage('home')
        }
        return
      }

      // Existing page routing logic - check pathname only (no query params)
      const isDiggingRoute = path === '/digging' || path === '/digging/tracks' || path === '/digging/albums'
      console.log(`syncFromLocation: isDiggingRoute=${isDiggingRoute}`)
      if (isDiggingRoute) {
        if (isAuthenticated) {
          setActivePage('digging')

          // Parse page from URL query parameters
          const currentPage = parsePageFromUrl(window.location.search)
          console.log(`syncFromLocation: parsed page=${currentPage}`)
          setDiggingPage(currentPage)

          // Set tab based on URL
          if (path === '/digging/albums') {
            setDiggingTab('albums')
          } else if (path === '/digging/tracks') {
            setDiggingTab('tracks')
          } else {
            // Default /digging to tracks
            setDiggingTab('tracks')
          }
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

  const navigate = (page: 'home' | 'digging' | 'album', albumId?: number, diggingTabOverride?: 'tracks' | 'albums', pageNumber?: number) => {
    if (page === 'digging' && !isAuthenticated) {
      return
    }

    let path = '/'
    if (page === 'digging') {
      const targetTab = diggingTabOverride || diggingTab
      const targetPage = pageNumber !== undefined ? pageNumber : diggingPage
      path = buildDiggingUrl(targetTab, targetPage)
      console.log(`navigate: building digging URL - tab=${targetTab}, page=${targetPage}, result=${path}`)
    } else if (page === 'album' && albumId) {
      path = `/album/${albumId}`
    }

    const currentUrl = window.location.pathname + window.location.search
    console.log(`navigate: currentUrl=${currentUrl}, newPath=${path}`)

    if (typeof window !== 'undefined' && currentUrl !== path) {
      console.log(`navigate: updating URL from ${currentUrl} to ${path}`)
      window.history.pushState({}, '', path)
    }

    if (page === 'album' && albumId) {
      setCurrentAlbumId(albumId)
    } else {
      setCurrentAlbumId(null)
    }

    if (page === 'digging') {
      if (diggingTabOverride) {
        setDiggingTab(diggingTabOverride)
      }
      if (pageNumber !== undefined) {
        setDiggingPage(pageNumber)
      }
    }

    setActivePage(page)
  }

  const navigateToDiggingTab = (tab: 'tracks' | 'albums', page?: number) => {
    navigate('digging', undefined, tab, page !== undefined ? page : 1)
  }

  const handleAlbumBack = () => {
    window.history.back()
  }

  const navigateToDiggingPage = (page: number) => {
    // Validate page number - ensure it's at least 1
    const validPage = Math.max(1, Math.floor(page))
    console.log(`navigateToDiggingPage: page=${page}, validPage=${validPage}, diggingTab=${diggingTab}`)
    navigate('digging', undefined, diggingTab, validPage)
  }

  return (
    <>
      <NotificationBanner />
      <GlobalLoadingOverlay />
      
      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-50 bg-slate-950 md:border-b md:border-slate-800">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
          {/* Left: Logo + Tabs */}
          <div className="flex items-center gap-6">
            <h1 className="text-white text-2xl font-semibold tracking-tight">
              nipstream
            </h1>
            
            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-4">
                <nav
                  className="flex space-x-2"
                  role="tablist"
                  aria-label="Primary pages"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePage === 'home'}
                    onClick={() => navigate('home')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                      activePage === 'home'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePage === 'digging'}
                    onClick={() => navigate('digging')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                      activePage === 'digging'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    Digging
                  </button>
                </nav>

                {/* Sub-tabs for Digging page */}
                {activePage === 'digging' && (
                  <>
                    <div className="w-px h-6 bg-slate-700" />
                    <div className="border-b border-slate-700">
                      <nav className="flex space-x-2 -mb-px" role="tablist" aria-label="Digging sections">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={diggingTab === 'tracks'}
                          onClick={() => navigateToDiggingTab('tracks')}
                          className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                            diggingTab === 'tracks'
                              ? 'border-white text-white'
                              : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          Tracks
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={diggingTab === 'albums'}
                          onClick={() => navigateToDiggingTab('albums')}
                          className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                            diggingTab === 'albums'
                              ? 'border-white text-white'
                              : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          Albums
                        </button>
                      </nav>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Right: Auth Controls */}
          <AuthControls />
        </div>
        
        {/* Mobile tabs - shown only on small screens when authenticated */}
        {isAuthenticated && (
          <div className="md:hidden pb-4">
            <nav className="flex space-x-2 px-4 sm:px-6 lg:px-10">
              <button
                type="button"
                role="tab"
                aria-selected={activePage === 'home'}
                onClick={() => navigate('home')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition ${
                  activePage === 'home'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Home
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePage === 'digging'}
                onClick={() => navigate('digging')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition ${
                  activePage === 'digging'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Digging
              </button>
            </nav>

            {/* Sub-tabs for Digging page on mobile */}
            {activePage === 'digging' && (
              <>
                <div className="mt-3 border-b border-slate-800 px-4 sm:px-6 lg:px-10">
                  <nav className="flex space-x-2 -mb-px" role="tablist" aria-label="Digging sections">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diggingTab === 'tracks'}
                      onClick={() => navigateToDiggingTab('tracks')}
                      className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition ${
                        diggingTab === 'tracks'
                          ? 'border-white text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Tracks
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diggingTab === 'albums'}
                      onClick={() => navigateToDiggingTab('albums')}
                      className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition ${
                        diggingTab === 'albums'
                          ? 'border-white text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Albums
                    </button>
                  </nav>
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      <div className="min-h-screen bg-slate-950 pb-32 md:pb-24">
        {/* Main Content Area */}
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <InstallPrompt />

          <div className="w-full">
            {activePage === 'album' && currentAlbumId ? (
              <AlbumPage key={currentAlbumId} albumId={currentAlbumId} onBack={handleAlbumBack} />
            ) : activePage === 'digging' ? (
              <AlbumsPage activeTab={diggingTab} currentPage={diggingPage} onPageChange={navigateToDiggingPage} />
            ) : (
              <Search />
            )}
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
