import { useCallback, useRef } from 'react'

/**
 * Optimized callback hook that handles async operations with proper cleanup
 * Prevents memory leaks and stale closures
 */
export const useOptimizedCallback = <T extends any[], R>(
  callback: (...args: T) => Promise<R> | R,
  deps: React.DependencyList
) => {
  const callbackRef = useRef(callback)
  const abortRef = useRef<AbortController | null>(null)

  // Update callback ref without triggering dependencies
  callbackRef.current = callback

  return useCallback(
    async (...args: T) => {
      // Abort previous request if still pending
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      try {
        return await callbackRef.current(...args)
      } catch (error) {
        if (!abortRef.current.signal.aborted) {
          throw error
        }
      }
    },
    deps
  )
}
