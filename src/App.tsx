import { useState } from 'react'
import { Player } from './components/Player'
import { Search } from './components/Search'
import { InstallPrompt } from './components/InstallPrompt'
import { useAuth } from './contexts/AuthContext'
import { Button } from './components/ui/button'

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
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsPanelOpen((prev) => !prev)}
        className="text-slate-300 hover:text-white hover:bg-slate-800"
      >
        Login
      </Button>
      {isPanelOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <p className="text-sm text-white font-medium">
                Enter access code
              </p>
            </div>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" className="w-full bg-white text-black text-sm">
              Login
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 pb-32 md:pb-24">
      {/* Main Content Area */}
      <div className="container mx-auto pt-6">
        <InstallPrompt />
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto px-4 mb-4">
          <h1 className="text-white text-2xl font-semibold tracking-tight">
            nipstream
          </h1>
          <AuthControls />
        </div>
        {/* Search Component */}
        <Search />
      </div>

      {/* Player stays at the bottom */}
      <Player />
    </div>
  )
}

export default App
