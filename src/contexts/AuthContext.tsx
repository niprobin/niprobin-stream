import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { STORAGE_KEYS } from '@/utils/storageKeys'

type AuthContextType = {
  isAuthenticated: boolean
  token: string | null
  username: string | null
  login: (username: string, code: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_WEBHOOK_URL = import.meta.env.VITE_AUTH_WEBHOOK_URL || 'https://n8n.niprobin.com/webhook/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    const storedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME)
    if (storedToken) {
      setToken(storedToken)
      setIsAuthenticated(true)
    }
    if (storedUsername) {
      setUsername(storedUsername)
    }
  }, [])

  const login = useCallback(async (username: string, code: string): Promise<{ success: boolean; error?: string }> => {
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

      const trimmedUsername = username.trim()
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authToken)
      localStorage.setItem(STORAGE_KEYS.USERNAME, trimmedUsername)
      setToken(authToken)
      setUsername(trimmedUsername)
      setIsAuthenticated(true)
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error - please try again' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USERNAME)
    setToken(null)
    setUsername(null)
    setIsAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        username,
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
