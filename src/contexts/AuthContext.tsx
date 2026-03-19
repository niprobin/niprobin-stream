import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

type AuthContextType = {
  isAuthenticated: boolean
  token: string | null
  login: (code: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_STORAGE_KEY = 'niprobin-auth-token'
const AUTH_WEBHOOK_URL = import.meta.env.VITE_AUTH_WEBHOOK_URL

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (storedToken) {
      setToken(storedToken)
      setIsAuthenticated(true)
    }
  }, [])

  const login = useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(AUTH_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim() }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid access code' }
        }
        return { success: false, error: 'Authentication failed' }
      }

      const data = await response.json()
      const authToken = data.token

      if (!authToken) {
        return { success: false, error: 'No token received from server' }
      }

      localStorage.setItem(TOKEN_STORAGE_KEY, authToken)
      setToken(authToken)
      setIsAuthenticated(true)
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error - please try again' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
