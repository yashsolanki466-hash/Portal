import { useCallback } from 'react'
import { formatBytes as formatBytesUtil, formatEtaSeconds, isImageFile as isImageFileUtil, isTextFile as isTextFileUtil } from '../utils'

export const useFileManager = () => {
  const formatBytes = useCallback((bytes: number): string => {
    return formatBytesUtil(bytes)
  }, [])

  const calculateETA = useCallback((remaining: number, speed: number): string => {
    if (!speed) return '--:--'
    const seconds = Math.floor(remaining / speed)
    return formatEtaSeconds(seconds)
  }, [])

  const sanitizePath = useCallback((path: string): string => {
    return path.trim().replace(/\\/g, '/')
  }, [])

  const isTextFile = useCallback((fileName: string): boolean => {
    return isTextFileUtil(fileName)
  }, [])

  const isImageFile = useCallback((fileName: string): boolean => {
    return isImageFileUtil(fileName)
  }, [])

  return {
    formatBytes,
    calculateETA,
    sanitizePath,
    isTextFile,
    isImageFile
  }
}
