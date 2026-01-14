import { createContext, useContext, useState, type ReactNode } from 'react'

type LoadingContextType = {
  isLoading: boolean
  increment: () => void
  decrement: () => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)

  const increment = () => setCount((c) => c + 1)
  const decrement = () => setCount((c) => Math.max(0, c - 1))

  const value: LoadingContextType = {
    isLoading: count > 0,
    increment,
    decrement,
  }

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
}

export function useLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider')
  return ctx
}

export default LoadingContext
