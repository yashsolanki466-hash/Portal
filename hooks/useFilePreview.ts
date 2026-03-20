import { useState, useCallback, useRef, useEffect } from 'react'
import { sftpApi } from '../api/sftp'
import type { SFTPFile } from '../types'
import { isImageFile as isImageFileUtil, isTextFile as isTextFileUtil } from '../utils'

export const useFilePreview = (sessionId: string) => {
  const [previewFile, setPreviewFile] = useState<SFTPFile | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uiError, setUiError] = useState<string | null>(null)

  const previewPanelRef = useRef<HTMLElement | null>(null)
  const previewCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const previewAbortRef = useRef<AbortController | null>(null)
  const previewRequestIdRef = useRef(0)

  const clearPreview = useCallback(() => {
    previewAbortRef.current?.abort()
    setPreviewFile(null)
    setPreviewContent(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [previewUrl])

  const openPreview = useCallback(async (file: SFTPFile) => {
    const requestId = ++previewRequestIdRef.current
    previewAbortRef.current?.abort()
    const controller = new AbortController()
    previewAbortRef.current = controller

    setPreviewFile(file)
    setPreviewContent(null)
    if (previewUrl) { 
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null) 
    }
    setPreviewLoading(true)

    const isText = isTextFileUtil(file.name)
    const isImage = isImageFileUtil(file.name)

    try {
      // Guard: don't attempt to preview very large files in-browser
      const MAX_PREVIEW = 2 * 1024 * 1024 // 2 MB
      if (file.size && file.size > MAX_PREVIEW) {
        setPreviewContent('File too large to preview in the browser (over 2 MB). Please download to view it locally.')
        setPreviewLoading(false)
        return
      }
      
      if (isText) {
        const resp = await sftpApi.preview(sessionId, file.path, { signal: controller.signal })
        setPreviewContent(resp.data || '')
      } else if (isImage) {
        const resp = await sftpApi.download(sessionId, file.path, { responseType: 'blob', signal: controller.signal })
        const url = window.URL.createObjectURL(new Blob([resp.data]))
        setPreviewUrl(url)
      } else {
        setPreviewContent('Preview not available for this file type.')
      }
    } catch (err) {
      const e = err as Error
      if (e?.name === 'CanceledError' || e?.name === 'AbortError') return
      console.error('Preview failed', err)
      setPreviewContent('Failed to load preview.')
      setUiError('Preview failed. Please try again.')
    } finally {
      const isLatest = requestId === previewRequestIdRef.current
      if (isLatest) {
        setPreviewLoading(false)
      }
    }
  }, [sessionId, previewUrl])

  // Keyboard navigation for preview
  useEffect(() => {
    if (!previewFile) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearPreview()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewFile, clearPreview])

  // Focus management for preview
  useEffect(() => {
    if (!previewFile) return

    const prevActive = document.activeElement as HTMLElement | null
    const focusTarget = previewCloseButtonRef.current
    if (focusTarget) {
      window.setTimeout(() => focusTarget.focus(), 0)
    }

    const rootContains = (root: HTMLElement | null, node: HTMLElement) => {
      if (!root) return false
      return root === node || root.contains(node)
    }

    const getFocusable = () => {
      const root = previewPanelRef.current
      if (!root) return [] as HTMLElement[]
      const nodes = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      return Array.from(nodes).filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        clearPreview()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (!active || active === first || !rootContains(previewPanelRef.current, active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (!active || active === last || !rootContains(previewPanelRef.current, active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (prevActive && typeof prevActive.focus === 'function') prevActive.focus()
    }
  }, [previewFile, clearPreview])

  return {
    previewFile,
    previewContent,
    previewUrl,
    previewLoading,
    previewPanelRef,
    previewCloseButtonRef,
    openPreview,
    clearPreview
  }
}
