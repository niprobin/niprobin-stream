import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('Please enter your username')
      return
    }
    if (!code.trim()) {
      setError('Please enter your access code')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const result = await login(username, code)
      if (!result.success) {
        setError(result.error ?? 'Login failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-0-deep flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} />
          <h1 className="font-serif-display italic text-2xl text-text-1">nipstream</h1>
          <p className="text-text-2 text-sm">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="block text-xs font-mono-label text-text-3 uppercase tracking-wider">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full rounded-md-crate bg-bg-1 border border-border px-4 py-3 text-sm text-text-1 placeholder-text-3 focus:outline-none focus:border-accent transition"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="access-code" className="block text-xs font-mono-label text-text-3 uppercase tracking-wider">
              Access code
            </label>
            <input
              id="access-code"
              type="password"
              autoComplete="current-password"
              name="niprobin-access"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your access code"
              className="w-full rounded-md-crate bg-bg-1 border border-border px-4 py-3 text-sm text-text-1 placeholder-text-3 focus:outline-none focus:border-accent transition"
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="text-error-dot text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-md-crate bg-accent text-accent-ink hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold transition"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
