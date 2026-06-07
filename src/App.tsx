import { useEffect, useState } from 'react'
import { Player } from './components/Player'
import { MobileBottomNav } from './components/MobileBottomNav'
import { MobilePlayer } from './components/MobilePlayer'
import { useAuth } from './contexts/AuthContext'
import { NotificationBanner } from './components/NotificationBanner'
import GlobalLoadingOverlay from '@/components/GlobalLoadingOverlay'
import { Button } from './components/ui/button'
import { RefreshCw } from 'lucide-react'
import { AlbumsPage } from './pages/Digging'
import { useAudio } from './contexts/AudioContext'
import { useDiscovery } from './contexts/DiscoveryContext'
import { useIsMobile } from './hooks/useIsMobile'
import { Search } from './components/Search'
import { SearchBar } from './components/SearchBar'
import {
  buildDiggingUrl,
  buildDiggingUrlWithFilters,
} from './utils/urlBuilder'
import {
  extractDeezerIdFromPath,
  extractAlbumIdFromPath,
  extractArtistIdFromPath,
  parsePageFromUrl,
  parseFiltersFromUrl,
} from './utils/urlParser'
import { ROUTES } from './utils/routes'
import { getTrackByDeezerId } from './services/api'
import { AlbumPage } from './pages/Album'
import { ArtistPage } from './pages/Artist'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { useMetaTags } from './hooks/useMetaTags'
import { generateTrackMetaTags } from './utils/metaTagHelpers'

function AppContent() {
  const { isAuthenticated, token, username, logout } = useAuth()
  const { loadTrack } = useAudio()
  const { setMetaTags, resetToDefault } = useMetaTags()
  const { refreshTracks, refreshAlbums, isLoadingTracks, isLoadingAlbums, discoverTracks, discoverAlbums } = useDiscovery()
  const isMobile = useIsMobile()
  const [activePage, setActivePage] = useState<'home' | 'digging' | 'album' | 'artist' | 'search' | 'menu'>('home')
  const [currentAlbumId, setCurrentAlbumId] = useState<number | null>(null)
  const [currentArtistId, setCurrentArtistId] = useState<string | null>(null)
  const [diggingTab, setDiggingTab] = useState<'tracks' | 'albums'>('tracks')
  const [diggingPage, setDiggingPage] = useState<number>(1)
  const [searchInitialQuery, setSearchInitialQuery] = useState('')
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false)

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

      // Check if this is an artist URL (/artist/:deezer_id)
      const artistId = extractArtistIdFromPath(path)
      if (artistId) {
        setCurrentArtistId(artistId)
        setActivePage('artist')
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
      } else if (path === '/search') {
        const params = new URLSearchParams(window.location.search)
        setSearchInitialQuery(params.get('q') ?? '')
        setActivePage('search')
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
    page: 'home' | 'digging' | 'album' | 'search',
    albumId?: number,
    diggingTabOverride?: 'tracks' | 'albums',
    pageNumber?: number,
    preserveFilters?: boolean
  ) => {
    if (page === 'digging' && !isAuthenticated) {
      return
    }

    let path = '/'
    if (page === 'digging') {
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
    } else if (page === 'search') {
      path = '/search'
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

  const handleMobilePageChange = (page: string) => {
    if (page === 'digging') navigate('digging')
    else if (page === 'menu') setActivePage('menu')
    else navigate('home')
  }

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

  const pageContent = (
    <div className="w-full px-4 sm:px-6 lg:px-10">
      <div className="w-full">
        {activePage === 'artist' && currentArtistId ? (
          <ArtistPage key={currentArtistId} artistId={currentArtistId} />
        ) : activePage === 'album' && currentAlbumId ? (
          <AlbumPage key={currentAlbumId} albumId={currentAlbumId} />
        ) : activePage === 'digging' ? (
          <AlbumsPage
            activeTab={diggingTab}
            currentPage={diggingPage}
            onPageChange={navigateToDiggingPage}
          />
        ) : activePage === 'search' ? (
          <Search key={searchInitialQuery} initialQuery={searchInitialQuery} />
        ) : (
          <HomePage />
        )}
      </div>
    </div>
  )

  if (isMobile) {
    const mobileCurrentPage: 'home' | 'digging' | 'menu' =
      activePage === 'digging' || activePage === 'album' ? 'digging'
      : activePage === 'menu' ? 'menu'
      : 'home'

    const mobileMenuContent = (
      <div className="py-8 px-6 space-y-6">
        <h2 className="text-white text-xl font-semibold">Menu</h2>

        {isAuthenticated && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Discovery</p>
            <button
              type="button"
              onClick={() => { refreshTracks(); refreshAlbums() }}
              disabled={isLoadingTracks || isLoadingAlbums}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-slate-900 text-white disabled:opacity-40 active:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`h-5 w-5 text-slate-400 ${isLoadingTracks || isLoadingAlbums ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">
                {isLoadingTracks || isLoadingAlbums ? 'Refreshing…' : 'Refresh discovery'}
              </span>
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Account</p>
          <div className="px-4 py-3 rounded-xl bg-slate-900 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{username ?? 'User'}</p>
              <p className="text-xs text-slate-500">Signed in</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )

    return (
      <>
        <NotificationBanner />
        <GlobalLoadingOverlay />
        <div
          className="flex flex-col bg-slate-950"
          style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Search bar — shown on all pages except menu */}
          {activePage !== 'menu' && (
            <div className="flex-shrink-0 px-[18px] py-[10px]">
              <SearchBar containerClassName="h-[42px] !rounded-[12px]" />
            </div>
          )}

          {/* Digging segmented control — only shown when on digging page */}
          {isAuthenticated && activePage === 'digging' && (
            <div className="flex-shrink-0 px-[18px] py-3 border-b border-slate-800">
              <div className="flex bg-slate-800 rounded-[11px] p-[3px] gap-[3px]">
                <button
                  type="button"
                  onClick={() => navigateToDiggingTab('tracks')}
                  className={`flex-1 flex items-center justify-center gap-[5px] py-2 text-sm font-semibold rounded-[8px] transition-all ${
                    diggingTab === 'tracks'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400'
                  }`}
                >
                  Tracks
                  {discoverTracks.length > 0 && (
                    <span className={`text-[11px] font-mono ${diggingTab === 'tracks' ? 'text-blue-500' : 'text-blue-400'}`}>
                      {discoverTracks.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigateToDiggingTab('albums')}
                  className={`flex-1 flex items-center justify-center gap-[5px] py-2 text-sm font-semibold rounded-[8px] transition-all ${
                    diggingTab === 'albums'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400'
                  }`}
                >
                  Albums
                  {discoverAlbums.length > 0 && (
                    <span className={`text-[11px] font-mono ${diggingTab === 'albums' ? 'text-blue-500' : 'text-blue-400'}`}>
                      {discoverAlbums.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Scrollable page content */}
          <div className="flex-1 overflow-y-auto pb-[104px]">
            {activePage === 'menu' ? mobileMenuContent : pageContent}
          </div>

          <MobileBottomNav
            currentPage={mobileCurrentPage}
            onPageChange={handleMobilePageChange}
            onNowPlayingClick={() => setMobilePlayerOpen(true)}
          />
          <MobilePlayer
            isOpen={mobilePlayerOpen}
            onClose={() => setMobilePlayerOpen(false)}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </>
    )
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
          
          {/* Center: SearchBar on desktop */}
          {isAuthenticated && (
            <div className="hidden md:flex flex-1 max-w-2xl mx-6">
              <SearchBar />
            </div>
          )}

          {/* Right: Refresh + Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refreshTracks(); refreshAlbums() }}
              disabled={isLoadingTracks || isLoadingAlbums}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              aria-label="Refresh discovery data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTracks || isLoadingAlbums ? 'animate-spin' : ''}`} />
            </button>
            {username && (
              <span className="hidden md:block text-sm text-slate-400">{username}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Logout
            </Button>
          </div>
        </div>
        
        {/* Mobile search bar - full width, shown below logo row */}
        {isAuthenticated && (
          <div className="md:hidden px-4 sm:px-6 pb-2">
            <SearchBar />
          </div>
        )}

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
        {pageContent}
        <Player />
      </div>
    </>
  )
}

function App() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <LoginPage />
  return <AppContent />
}

export default App
