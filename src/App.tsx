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
import { SearchBar } from './components/SearchBar'
import {
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
import { isAlbumSaved, type AlbumsView } from './utils/albumUtils'
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
  const [albumsView, setAlbumsView] = useState<AlbumsView>('backlog')
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
          setAlbumsView(parseFiltersFromUrl(window.location.search).view ?? 'backlog')

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
    preserveFilters?: boolean,
    albumsViewOverride?: AlbumsView
  ) => {
    if (page === 'digging' && !isAuthenticated) {
      return
    }

    let path = '/'
    if (page === 'digging') {
      const targetTab = diggingTabOverride || diggingTab
      const targetPage = pageNumber !== undefined ? pageNumber : diggingPage
      // The Backlog / Listen to sub-view only exists on the albums tab
      const targetView = targetTab === 'albums' ? (albumsViewOverride ?? albumsView) : 'backlog'

      if (preserveFilters) {
        // Parse current filters from URL and preserve them
        const currentFilters = parseFiltersFromUrl(window.location.search)
        path = buildDiggingUrlWithFilters(targetTab, { ...currentFilters, page: targetPage, view: targetView })
      } else {
        path = buildDiggingUrlWithFilters(targetTab, { page: targetPage, view: targetView })
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
      if (albumsViewOverride) {
        setAlbumsView(albumsViewOverride)
      }
    }

    setActivePage(page)
  }

  const handleMobilePageChange = (page: string) => {
    if (page === 'tracks') navigateToDiggingTab('tracks')
    else if (page === 'albums') navigateToAlbumsView('backlog')
    else if (page === 'menu') setActivePage('menu')
    else navigate('home')
  }

  const navigateToDiggingTab = (tab: 'tracks' | 'albums', page?: number) => {
    // When switching tabs, preserve filters
    navigate('digging', undefined, tab, page !== undefined ? page : 1, true)
  }

  const navigateToAlbumsView = (view: AlbumsView) => {
    navigate('digging', undefined, 'albums', 1, true, view)
  }

  const navigateToDiggingPage = (page: number) => {
    // Validate page number - ensure it's at least 1
    const validPage = Math.max(1, Math.floor(page))
    console.log(`navigateToDiggingPage: page=${page}, validPage=${validPage}, diggingTab=${diggingTab}`)
    // Preserve filters when changing pages within the same context
    navigate('digging', undefined, diggingTab, validPage, true)
  }

  // Desktop album grid is sized to fit the viewport (no scroll), so its page
  // needs a definite height down the wrapper chain.
  const isFitToViewport = activePage === 'digging' && diggingTab === 'albums'

  const pageContent = (
    <div className={`w-full px-4 sm:px-6 lg:px-10 ${isFitToViewport ? 'lg:h-full' : ''}`}>
      <div className={`w-full ${isFitToViewport ? 'lg:h-full' : ''}`}>
        {activePage === 'artist' && currentArtistId ? (
          <ArtistPage key={currentArtistId} artistId={currentArtistId} />
        ) : activePage === 'album' && currentAlbumId ? (
          <AlbumPage key={currentAlbumId} albumId={currentAlbumId} />
        ) : activePage === 'digging' ? (
          <AlbumsPage
            activeTab={diggingTab}
            albumsView={albumsView}
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

  const mobileCurrentPage: 'home' | 'tracks' | 'albums' | 'menu' =
    activePage === 'album' ? 'albums'
    : activePage === 'digging' ? diggingTab
    : activePage === 'menu' ? 'menu'
    : 'home'

  const listenCount = discoverAlbums.filter(isAlbumSaved).length
  const backlogCount = discoverAlbums.length - listenCount

  const isRefreshing = isLoadingTracks || isLoadingAlbums
  const handleRefresh = () => { refreshTracks(); refreshAlbums() }

  return (
    <>
      <NotificationBanner />
      <GlobalLoadingOverlay />

      <div className="flex h-[100dvh] bg-bg-0 overflow-hidden">
        {/* Desktop sidebar (>= lg) */}
        <Sidebar
          isAuthenticated={isAuthenticated}
          activePage={activePage}
          diggingTab={diggingTab}
          tracksCount={discoverTracks.length}
          albumsView={albumsView}
          albumsCount={backlogCount}
          listenCount={listenCount}
          username={username}
          isRefreshing={isRefreshing}
          onNavigateHome={() => navigate('home')}
          onNavigateTracks={() => navigateToDiggingTab('tracks')}
          onNavigateAlbumsView={navigateToAlbumsView}
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

          {/* Desktop top bar (>= lg) — the one global search, on every page.
              Mobile gets the same SearchBar in MobileHeader. */}
          <div className="hidden lg:block flex-shrink-0 px-10 pt-5 pb-1">
            <div className="max-w-md">
              <SearchBar containerClassName="h-[42px]" />
            </div>
          </div>

          {/* Mobile albums sub-menu: Backlog / Listen to (< lg) */}
          {activePage === 'digging' && diggingTab === 'albums' && (
            <div className="lg:hidden flex-shrink-0 px-[18px] py-3 border-b border-border">
              <div className="flex bg-bg-1 rounded-md-crate p-[3px] gap-[3px]">
                {([
                  { view: 'backlog', label: 'Backlog', count: backlogCount },
                  { view: 'listen', label: 'Listen to', count: listenCount },
                ] as const).map(({ view, label, count }) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => navigateToAlbumsView(view)}
                    className={`flex-1 flex items-center justify-center gap-[5px] py-2 text-sm font-semibold rounded-sm-crate transition-all ${
                      albumsView === view
                        ? 'bg-accent text-accent-ink'
                        : 'text-text-2'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`text-[11px] font-mono-label ${albumsView === view ? 'text-accent-ink/70' : 'text-text-3'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable page content — mobile padding clears the floating
              player+nav card; desktop docked bar is in-flow (no padding).
              Digging's own sticky header (see AlbumsPage) keeps its title/
              filter/pagination pinned at the top of this scroll
              container as the list/grid below it scrolls. */}
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
