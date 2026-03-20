import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { dbApi } from '../api/db'

interface UseAuditManagementProps {
  sessionId: string
  isAdmin: boolean
  view: string
}

interface AuditData {
  connections: any[]
  downloads: any[]
  logs: any[]
}

export const useAuditManagement = ({ sessionId, isAdmin, view }: UseAuditManagementProps) => {
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditData, setAuditData] = useState<AuditData | null>(null)
  
  const [auditType, setAuditType] = useState<'all' | 'connections' | 'downloads' | 'logs'>('all')
  const [auditUser, setAuditUser] = useState('')
  const [auditServer, setAuditServer] = useState('')
  const [auditQuery, setAuditQuery] = useState('')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')
  const [auditSelected, setAuditSelected] = useState<{ type: string; id: string; createdAt?: string; payload: any } | null>(null)

  const auditTimerRef = useRef<number | null>(null)
  const auditAbortRef = useRef<AbortController | null>(null)
  const auditInFlightRef = useRef(false)
  const dbDisabledRef = useRef(false)

  const checkDbOnce = useCallback(async () => {
    if (dbDisabledRef.current) return false
    try {
      await dbApi.health()
      return true
    } catch {
      dbDisabledRef.current = true
      return false
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    if (view !== 'audit') return

    let cancelled = false

    const load = async () => {
      if (auditInFlightRef.current) return
      auditInFlightRef.current = true

      auditAbortRef.current?.abort()
      const controller = new AbortController()
      auditAbortRef.current = controller

      setAuditLoading(true)
      setAuditError(null)

      try {
        const res = await dbApi.auditRecent(sessionId, 100, { signal: controller.signal })
        if (cancelled) return
        const data = (res && res.data && typeof res.data === 'object' ? (res.data as Record<string, any>) : {})
        setAuditData({
          connections: Array.isArray(data.connections) ? data.connections : [],
          downloads: Array.isArray(data.downloads) ? data.downloads : [],
          logs: Array.isArray(data.logs) ? data.logs : [],
        })
      } catch (err) {
        if (cancelled) return
        const e = (typeof err === 'object' && err !== null ? (err as Record<string, any>) : {})
        const name = typeof e.name === 'string' ? e.name : ''
        if (name === 'CanceledError' || name === 'AbortError') return
        const msg = (typeof e.message === 'string' ? e.message : null) || 'Failed to load audit logs'
        setAuditError(msg)
      } finally {
        auditInFlightRef.current = false
        if (!cancelled) setAuditLoading(false)
      }
    }

    void load()
    if (auditTimerRef.current) window.clearInterval(auditTimerRef.current)
    auditTimerRef.current = window.setInterval(() => {
      void load()
    }, 20000)

    if (!auditFrom && !auditTo) {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 7)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)
      setAuditFrom(fmt(from))
      setAuditTo(fmt(to))
    }

    return () => {
      cancelled = true
      if (auditTimerRef.current) window.clearInterval(auditTimerRef.current)
      auditTimerRef.current = null
      auditAbortRef.current?.abort()
      auditAbortRef.current = null
      auditInFlightRef.current = false
    }
  }, [view, isAdmin, sessionId, auditFrom, auditTo])

  const filteredAuditEvents = useMemo(() => {
    if (!auditData) return []
    
    let events = [
      ...auditData.connections.map((e: any) => ({ ...e, type: 'connection' })),
      ...auditData.downloads.map((e: any) => ({ ...e, type: 'download' })),
      ...auditData.logs.map((e: any) => ({ ...e, type: 'log' }))
    ]

    if (auditType !== 'all') {
      events = events.filter(e => e.type === auditType.slice(0, -1))
    }

    if (auditUser) {
      events = events.filter(e => 
        (e.username && e.username.toLowerCase().includes(auditUser.toLowerCase())) ||
        (e.user && e.user.toLowerCase().includes(auditUser.toLowerCase()))
      )
    }

    if (auditServer) {
      events = events.filter(e => 
        (e.server && e.server.toLowerCase().includes(auditServer.toLowerCase())) ||
        (e.host && e.host.toLowerCase().includes(auditServer.toLowerCase()))
      )
    }

    if (auditQuery) {
      const query = auditQuery.toLowerCase()
      events = events.filter(e => 
        JSON.stringify(e).toLowerCase().includes(query)
      )
    }

    if (auditFrom && auditTo) {
      const from = new Date(auditFrom).getTime()
      const to = new Date(auditTo).getTime() + 86400000
      events = events.filter(e => {
        const time = new Date(e.createdAt || e.timestamp).getTime()
        return time >= from && time <= to
      })
    }

    return events.sort((a, b) => 
      new Date(b.createdAt || b.timestamp).getTime() - 
      new Date(a.createdAt || a.timestamp).getTime()
    )
  }, [auditData, auditType, auditFrom, auditTo, auditUser, auditServer, auditQuery])

  const exportAuditCsv = useCallback(() => {
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }

    const headers = ['Timestamp', 'Type', 'User', 'Server', 'Details']
    const rows = filteredAuditEvents.map((event: any) => [
      event.createdAt || event.timestamp,
      event.type,
      event.username || event.user,
      event.server || event.host,
      JSON.stringify(event.payload || event)
    ])

    const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${auditFrom || 'start'}-${auditTo || 'end'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredAuditEvents, auditFrom, auditTo])

  return {
    auditLoading,
    auditError,
    auditData,
    auditType,
    setAuditType,
    auditUser,
    setAuditUser,
    auditServer,
    setAuditServer,
    auditQuery,
    setAuditQuery,
    auditFrom,
    setAuditFrom,
    auditTo,
    setAuditTo,
    auditSelected,
    setAuditSelected,
    filteredAuditEvents,
    exportAuditCsv
  }
}
