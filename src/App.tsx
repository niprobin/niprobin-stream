import { useEffect, useState } from 'react'
import { Player } from './components/Player'
import { InstallPrompt } from './components/InstallPrompt'
import { useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationBanner } from './components/NotificationBanner'
import GlobalLoadingOverlay from '@/components/GlobalLoadingOverlay'
import { Button } from './components/ui/button'
import { LogIn } from 'lucide-react'
import { AlbumsPage } from './pages/Digging'
import { LibraryPage } from './pages/Library'
import { useNotification } from './contexts/NotificationContext'
import { useAudio } from './contexts/AudioContext'
import {
  buildDiggingUrl,
  buildLibraryUrl,
  buildDiggingUrlWithFilters,
  buildLibraryUrlWithFilters,
} from './utils/urlBuilder'
import {
  extractDeezerIdFromPath,
  extractAlbumIdFromPath,
  parsePageFromUrl,
  parseFiltersFromUrl,
} from './utils/urlParser'
import { ROUTES } from './utils/routes'
import { getTrackByDeezerId } from './services/api'
import { AlbumPage } from './pages/Album'
import { HomePage } from './pages/Home'
import { useMetaTags } from './hooks/useMetaTags'
import { generateTrackMetaTags } from './utils/metaTagHelpers'

function AuthControls() {
  const { isAuthenticated, login, logout } = useAuth()
  const { showNotification } = useNotification()
  const [code, setCode] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoggingIn(true)
    try {
      const result = await login(code)
      if (!result.success) {
        showNotification(result.error ?? 'Invalid code', 'error')
      } else {
        setCode('')
        setIsPanelOpen(false)
      }
    } catch (error) {
      showNotification('Login failed - please try again', 'error')
    } finally {
      setIsLoggingIn(false)
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
            disabled={isLoggingIn}
            className="h-8 w-8 bg-white text-black hover:bg-white/90 disabled:opacity-50"
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
  const { isAuthenticated, token } = useAuth()
  const { loadTrack } = useAudio()
  const { setMetaTags, resetToDefault } = useMetaTags()
  const [activePage, setActivePage] = useState<'home' | 'library' | 'digging' | 'album'>('home')
  const [currentAlbumId, setCurrentAlbumId] = useState<number | null>(null)
  const [diggingTab, setDiggingTab] = useState<'tracks' | 'albums'>('tracks')
  const [diggingPage, setDiggingPage] = useState<number>(1)
  const [libraryPage, setLibraryPage] = useState<number>(1)

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

      // Check if this is a track URL (/track/:deezer_id)
      const deezerId = extractDeezerIdFromPath(path)
      if (deezerId) {
        try {
          // Fetch track data from the deezer_id
          const streamResponse = await getTrackByDeezerId(deezerId, token)

          // Update meta tags for the track BEFORE redirect
          const trackMetaTags = generateTrackMetaTags({
            title: streamResponse.track,
            artist: streamResponse.artist,
            album: streamResponse.album,
            coverArt: streamResponse.cover,
            deezer_id: deezerId
          })
          setMetaTags(trackMetaTags)

          // Load the track from shared link (paused, not playing)
          loadTrack({
            id: streamResponse.trackId,
            hashUrl: streamResponse.hashUrl,
            title: streamResponse.track,
            artist: streamResponse.artist,
            album: streamResponse.album,
            streamUrl: streamResponse.streamUrl,
            coverArt: streamResponse.cover,
            deezer_id: deezerId,
          })

          // Redirect URL to home page after successful track load
          window.history.replaceState({}, '', '/')
          setActivePage('home')
        } catch (err) {
          console.error('Failed to load track from URL:', err)
          // Reset to default meta tags on error
          resetToDefault()
          // If track loading fails, just go to home
          window.history.replaceState({}, '', '/')
          setActivePage('home')
        }
        return
      }

      // Check if this is a library URL (/library)
      const isLibraryRoute = path === '/library'
      console.log(`syncFromLocation: isLibraryRoute=${isLibraryRoute}`)
      if (isLibraryRoute) {
        if (isAuthenticated) {
          resetToDefault()  // Reset to default meta tags for library page
          setActivePage('library')

          // Parse page from URL query parameters
          const currentPage = parsePageFromUrl(window.location.search)
          console.log(`syncFromLocation: parsed library page=${currentPage}`)
          setLibraryPage(currentPage)
        } else {
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
          resetToDefault()  // Reset to default meta tags for digging page
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
        resetToDefault()  // Reset to default meta tags for home page
        setActivePage('home')
      }
    }

    syncFromLocation()

    window.addEventListener('popstate', syncFromLocation)

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [isAuthenticated, loadTrack])

  const navigate = (
    page: 'home' | 'library' | 'digging' | 'album',
    albumId?: number,
    diggingTabOverride?: 'tracks' | 'albums',
    pageNumber?: number,
    preserveFilters?: boolean
  ) => {
    if ((page === 'digging' || page === 'library') && !isAuthenticated) {
      return
    }

    let path = '/'
    if (page === 'library') {
      const targetPage = pageNumber !== undefined ? pageNumber : libraryPage

      if (preserveFilters) {
        // Parse current filters from URL and preserve them
        const currentFilters = parseFiltersFromUrl(window.location.search)
        path = buildLibraryUrlWithFilters({ ...currentFilters, page: targetPage })
      } else {
        path = buildLibraryUrl(targetPage)
      }
      console.log(`navigate: building library URL - page=${targetPage}, preserveFilters=${preserveFilters}, result=${path}`)
    } else if (page === 'digging') {
      const targetTab = diggingTabOverride || diggingTab
      const targetPage = pageNumber !== undefined ? pageNumber : diggingPage

      if (preserveFilters) {
        // Parse current filters from URL and preserve them
        const currentFilters = parseFiltersFromUrl(window.location.search)
        path = buildDiggingUrlWithFilters(targetTab, { ...currentFilters, page: targetPage })
      } else {
        path = buildDiggingUrl(targetTab, targetPage)
      }
      console.log(`navigate: building digging URL - tab=${targetTab}, page=${targetPage}, preserveFilters=${preserveFilters}, result=${path}`)
    } else if (page === 'album' && albumId) {
      path = ROUTES.album(albumId)
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

    if (page === 'library') {
      if (pageNumber !== undefined) {
        setLibraryPage(pageNumber)
      }
    } else if (page === 'digging') {
      if (diggingTabOverride) {
        setDiggingTab(diggingTabOverride)
      }
      if (pageNumber !== undefined) {
        setDiggingPage(pageNumber)
      }
    }

    setActivePage(page)
  }

  // Navigation function that preserves filters (for use within the same page type)
  // Currently not used directly but kept for future extensibility
  // const navigatePreservingFilters = (
  //   page: 'library' | 'digging',
  //   diggingTabOverride?: 'tracks' | 'albums',
  //   pageNumber?: number
  // ) => {
  //   navigate(page, undefined, diggingTabOverride, pageNumber, true)
  // }

  const navigateToDiggingTab = (tab: 'tracks' | 'albums', page?: number) => {
    // When switching tabs, preserve filters
    navigate('digging', undefined, tab, page !== undefined ? page : 1, true)
  }

  const navigateToDiggingPage = (page: number) => {
    // Validate page number - ensure it's at least 1
    const validPage = Math.max(1, Math.floor(page))
    console.log(`navigateToDiggingPage: page=${page}, validPage=${validPage}, diggingTab=${diggingTab}`)
    // Preserve filters when changing pages within the same context
    navigate('digging', undefined, diggingTab, validPage, true)
  }

  const navigateToLibraryPage = (page: number) => {
    // Validate page number - ensure it's at least 1
    const validPage = Math.max(1, Math.floor(page))
    console.log(`navigateToLibraryPage: page=${page}, validPage=${validPage}`)
    // Preserve filters when changing pages within the same context
    navigate('library', undefined, undefined, validPage, true)
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
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('home')}
            >
              <img
                src="/android-chrome-192x192.png"
                alt="nipstream logo"
                className="w-8 h-8"
              />
            </div>
            
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
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePage === 'library'}
                    onClick={() => navigate('library')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                      activePage === 'library'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    Library
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
              <button
                type="button"
                role="tab"
                aria-selected={activePage === 'library'}
                onClick={() => navigate('library')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition ${
                  activePage === 'library'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Library
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
              <AlbumPage key={currentAlbumId} albumId={currentAlbumId} />
            ) : activePage === 'library' ? (
              <LibraryPage
                currentPage={libraryPage}
                onPageChange={navigateToLibraryPage}
              />
            ) : activePage === 'digging' ? (
              <AlbumsPage
                activeTab={diggingTab}
                currentPage={diggingPage}
                onPageChange={navigateToDiggingPage}
              />
            ) : (
              <HomePage />
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
