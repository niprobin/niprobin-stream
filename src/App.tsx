import { useEffect, useState } from 'react'
import { MobileFullPlayer } from './components/MobileFullPlayer'
import { Sidebar } from './components/Sidebar'
import { MobileHeader } from './components/MobileHeader'
import { PlayerBar } from './components/PlayerBar'
import { MobileMenu } from './components/MobileMenu'
import { useAuth } from './contexts/AuthContext'
import { NotificationBanner } from './components/NotificationBanner'
import GlobalLoadingOverlay from '@/components/GlobalLoadingOverlay'
import { AlbumsPage } from './pages/Digging'
import { useAudio } from './contexts/AudioContext'
import { useDiscovery } from './contexts/DiscoveryContext'
import { Search } from './components/Search'
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

  const mobileCurrentPage: 'home' | 'digging' | 'menu' =
    activePage === 'digging' || activePage === 'album' ? 'digging'
    : activePage === 'menu' ? 'menu'
    : 'home'

  const isRefreshing = isLoadingTracks || isLoadingAlbums
  const handleRefresh = () => { refreshTracks(); refreshAlbums() }

  return (
    <>
      <NotificationBanner />
      <GlobalLoadingOverlay />

      <div className="flex h-[100dvh] bg-slate-950 overflow-hidden">
        {/* Desktop sidebar (>= lg) */}
        <Sidebar
          isAuthenticated={isAuthenticated}
          activePage={activePage}
          diggingTab={diggingTab}
          username={username}
          isRefreshing={isRefreshing}
          onNavigateHome={() => navigate('home')}
          onNavigateDigging={() => navigate('digging')}
          onNavigateDiggingTab={navigateToDiggingTab}
          onNavigateSearch={() => navigate('search')}
          onRefresh={handleRefresh}
          onLogout={logout}
        />

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header (< lg) */}
          <MobileHeader
            isAuthenticated={isAuthenticated}
            showSearch={activePage !== 'menu'}
            onLogoClick={() => navigate('home')}
          />

          {/* Mobile digging segmented control (< lg) */}
          {isAuthenticated && activePage === 'digging' && (
            <div className="lg:hidden flex-shrink-0 px-[18px] py-3 border-b border-slate-800">
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

          {/* Scrollable page content — mobile padding clears the floating
              player+nav card; desktop docked bar is in-flow (no padding). */}
          <div className="flex-1 overflow-y-auto pb-[140px] lg:pb-0">
            {activePage === 'menu' ? (
              <MobileMenu
                isAuthenticated={isAuthenticated}
                username={username}
                isRefreshing={isRefreshing}
                onRefresh={handleRefresh}
                onLogout={logout}
              />
            ) : (
              pageContent
            )}
          </div>

          {/* Player+nav surface: floating single card (< lg), docked bar (>= lg) */}
          <PlayerBar
            currentPage={mobileCurrentPage}
            onPageChange={handleMobilePageChange}
            onNowPlayingClick={() => setMobilePlayerOpen(true)}
          />
        </div>

        {/* Mobile-only full-screen player (< lg) */}
        <div className="lg:hidden">
          <MobileFullPlayer
            isOpen={mobilePlayerOpen}
            onClose={() => setMobilePlayerOpen(false)}
            isAuthenticated={isAuthenticated}
          />
        </div>
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
