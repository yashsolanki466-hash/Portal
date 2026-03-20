import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { sftpApi } from '../api/sftp'
import type { SFTPFile } from '../types'
import { useDebouncedValue } from './useDebouncedValue'

interface UseFileManagementProps {
  sessionId: string
  initialPath: string
}

interface DashboardStats {
  folders: number
  files: number
  size: number
}

export const useFileManagement = ({ sessionId, initialPath }: UseFileManagementProps) => {
  const [files, setFiles] = useState<SFTPFile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [search, setSearch] = useState('')
  const [fileViewMode, setFileViewMode] = useState<'grid' | 'list'>('grid')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [stats, setStats] = useState<DashboardStats>({ folders: 0, files: 0, size: 0 })
  const [uiError, setUiError] = useState<string | null>(null)

  const listAbortRef = useRef<AbortController | null>(null)
  const listRequestIdRef = useRef(0)
  const listCacheRef = useRef<Map<string, { files: SFTPFile[]; at: number }>>(new Map())
  const currentPathRef = useRef(currentPath)

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  const fetchFiles = useCallback(async (path: string, options?: { force?: boolean }) => {
    const cacheKey = `${sessionId}:${path}`
    const TTL_MS = 15_000

    if (!options?.force) {
      const cached = listCacheRef.current.get(cacheKey)
      if (cached && Date.now() - cached.at < TTL_MS) {
        const sortedFiles = [...cached.files].sort((a: SFTPFile, b: SFTPFile) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })

        setFiles(sortedFiles)
        setCurrentPath(path)

        const folders = sortedFiles.filter((f: SFTPFile) => f.isDirectory).length
        const fileCount = sortedFiles.length - folders
        const totalSize = sortedFiles.reduce((acc: number, f: SFTPFile) => acc + (f.size || 0), 0)
        setStats({ folders, files: fileCount, size: totalSize })
        setUiError(null)
        setLoading(false)
        return
      }
    }

    const requestId = ++listRequestIdRef.current
    listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller

    setLoading(true)
    try {
      const response = await sftpApi.list(sessionId, path, { signal: controller.signal })
      const respFiles = (response.data?.files as SFTPFile[] | undefined) || []
      const sortedFiles = [...respFiles].sort((a: SFTPFile, b: SFTPFile) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      })

      listCacheRef.current.set(cacheKey, { files: sortedFiles, at: Date.now() })

      setFiles(sortedFiles)
      setCurrentPath(path)

      const folders = sortedFiles.filter((f: SFTPFile) => f.isDirectory).length
      const fileCount = sortedFiles.length - folders
      const totalSize = sortedFiles.reduce((acc: number, f: SFTPFile) => acc + (f.size || 0), 0)
      setStats({ folders, files: fileCount, size: totalSize })
      setUiError(null)
    } catch (err) {
      const e = err as Error
      if (e?.name === 'CanceledError' || e?.name === 'AbortError') return
      console.error('Failed to fetch files', err)
      setUiError('Failed to fetch files. Please try again.')
    } finally {
      const isLatest = requestId === listRequestIdRef.current
      if (isLatest) {
        setLoading(false)
      }
    }
  }, [sessionId])

  const refreshFiles = useCallback(() => {
    fetchFiles(currentPath, { force: true })
  }, [currentPath, fetchFiles])

  const filteredFiles = useMemo(() => {
    return files.filter(file => 
      file.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
  }, [files, debouncedSearch])

  useEffect(() => {
    fetchFiles(currentPath)
  }, [currentPath, fetchFiles])

  return {
    files,
    loading,
    currentPath,
    search,
    setSearch,
    fileViewMode,
    setFileViewMode,
    stats,
    uiError,
    filteredFiles,
    fetchFiles,
    refreshFiles,
    setCurrentPath
  }
}
