import { useEffect, useState } from 'react'
import { Player } from './components/Player'
import { Search } from './components/Search'
import { InstallPrompt } from './components/InstallPrompt'
import { useAuth } from './contexts/AuthContext'
import { Button } from './components/ui/button'
import { LogIn } from 'lucide-react'
import { AlbumsPage } from './pages/Albums'

function AuthControls() {
  const { isAuthenticated, login, logout } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const success = login(code)
    if (!success) {
      setError('Invalid access code')
    } else {
      setError('')
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
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      )}
    </div>
  )
}

function App() {
  const { isAuthenticated } = useAuth()
  const [activePage, setActivePage] = useState<'home' | 'digging'>('home')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromLocation = () => {
      const wantsDigging = window.location.pathname === '/digging'
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
  }, [isAuthenticated])

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
  )
}

export default App
