import { useMemo } from 'react'

/**
 * Hook for calculating virtualized list rendering
 * Useful for large lists (1000+ items)
 */
export const useVirtualizedList = <T,>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number = 0
) => {
  return useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight))
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    )

    return {
      visibleItems: items.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
      offsets: {
        before: startIndex * itemHeight,
        after: Math.max(0, (items.length - endIndex - 1) * itemHeight)
      }
    }
  }, [items, itemHeight, containerHeight, scrollTop])
}
