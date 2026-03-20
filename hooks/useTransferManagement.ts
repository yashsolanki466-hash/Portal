import { useState, useEffect, useCallback, useRef } from 'react'
import type { TransferTask } from '../components/TransferManager'
import { dbApi } from '../api/db'
import toast from 'react-hot-toast'

interface UseTransferManagementProps {
  sessionId: string
}

export const useTransferManagement = ({ sessionId }: UseTransferManagementProps) => {
  const [tasks, setTasks] = useState<TransferTask[]>(() => {
    try {
      const savedTasks = localStorage.getItem('sftp-download-tasks')
      if (savedTasks) {
        const tasks = JSON.parse(savedTasks) as TransferTask[]
        return tasks.map(task => (
          task.status === 'downloading' ? { ...task, status: 'ready' } : task
        ))
      }
      return []
    } catch {
      return []
    }
  })

  const dbSyncTimerRef = useRef<number | null>(null)
  const dbSnapshotTimerRef = useRef<number | null>(null)
  const dbDisabledRef = useRef(false)

  useEffect(() => {
    localStorage.setItem('sftp-download-tasks', JSON.stringify(tasks))
  }, [tasks])

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
    if (dbSyncTimerRef.current) window.clearTimeout(dbSyncTimerRef.current)
    dbSyncTimerRef.current = window.setTimeout(async () => {
      const ok = await checkDbOnce()
      if (!ok) return
      try {
        await dbApi.upsertTasks(sessionId, tasks as unknown as any[])
      } catch {
        // do not surface DB errors to UI
      }
    }, 600)
    return () => {
      if (dbSyncTimerRef.current) window.clearTimeout(dbSyncTimerRef.current)
    }
  }, [tasks, sessionId, checkDbOnce])

  useEffect(() => {
    return () => {
      if (dbSnapshotTimerRef.current) window.clearTimeout(dbSnapshotTimerRef.current)
    }
  }, [])

  const handleCancelTransfer = useCallback((id: string) => {
    setTasks(prev => {
      const t = prev.find(x => x.id === id)
      if (t) toast.success(`Removed: ${t.name}`)
      return prev.filter(x => x.id !== id)
    })
  }, [])

  const clearCompletedDownloads = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'))
    toast.success('Cleared completed downloads')
  }, [])

  const onTaskUpdate = useCallback((id: string, updates: Partial<TransferTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

  const cancelAllDownloads = useCallback(() => {
    setTasks(prev => {
      if (prev.length > 0) toast.success('Cleared downloads')
      return []
    })
  }, [])

  const addTask = useCallback((task: Omit<TransferTask, 'id'>) => {
    const newTask: TransferTask = {
      ...task,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }
    setTasks(prev => [...prev, newTask])
    return newTask.id
  }, [])

  return {
    tasks,
    handleCancelTransfer,
    clearCompletedDownloads,
    onTaskUpdate,
    cancelAllDownloads,
    addTask
  }
}
