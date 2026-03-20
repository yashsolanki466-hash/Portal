import { useMemo } from 'react'
import type { SFTPFile } from '../types'

interface UseFileGridOptions {
  files: SFTPFile[]
  search: string
}

export const useFileGrid = ({ files, search }: UseFileGridOptions) => {
  // Memoize filtered files to prevent unnecessary recalculations
  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files
    const searchLower = search.toLowerCase()
    return files.filter(f => f.name.toLowerCase().includes(searchLower))
  }, [files, search])

  // Memoize breadcrumbs
  const breadcrumbs = useMemo(() => {
    // This would be calculated from currentPath if passed
    return []
  }, [])

  // Memoize statistics
  const stats = useMemo(() => {
    const folders = files.filter(f => f.isDirectory).length
    const fileCount = files.length - folders
    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0)
    return { folders, files: fileCount, size: totalSize }
  }, [files])

  return { filteredFiles, breadcrumbs, stats }
}
