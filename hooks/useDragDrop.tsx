import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface DragItem {
  id: string
  type: 'file' | 'folder'
  data: any
}

export interface DropZone {
  id: string
  accepts: string[]
  onDrop: (items: DragItem[], dropZone: DropZone) => void
  onDragOver?: (items: DragItem[], dropZone: DropZone) => boolean
}

interface DragContextType {
  draggedItems: DragItem[]
  isDragging: boolean
  dragOverZone: string | null
  startDrag: (items: DragItem[]) => void
  endDrag: () => void
  setDragOverZone: (zoneId: string | null) => void
  dropZones: Map<string, DropZone>
  registerDropZone: (zone: DropZone) => void
  unregisterDropZone: (zoneId: string) => void
}

const DragContext = createContext<DragContextType | null>(null)

export function useDragContext() {
  const context = useContext(DragContext)
  if (!context) {
    throw new Error('useDragContext must be used within a DragProvider')
  }
  return context
}

interface DragProviderProps {
  children: ReactNode
}

export function DragProvider({ children }: DragProviderProps) {
  const [draggedItems, setDraggedItems] = useState<DragItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverZone, setDragOverZone] = useState<string | null>(null)
  const [dropZones] = useState(() => new Map<string, DropZone>())

  const startDrag = useCallback((items: DragItem[]) => {
    setDraggedItems(items)
    setIsDragging(true)
  }, [])

  const endDrag = useCallback(() => {
    setDraggedItems([])
    setIsDragging(false)
    setDragOverZone(null)
  }, [])

  const registerDropZone = useCallback((zone: DropZone) => {
    dropZones.set(zone.id, zone)
  }, [dropZones])

  const unregisterDropZone = useCallback((zoneId: string) => {
    dropZones.delete(zoneId)
    if (dragOverZone === zoneId) {
      setDragOverZone(null)
    }
  }, [dropZones, dragOverZone])

  const value: DragContextType = {
    draggedItems,
    isDragging,
    dragOverZone,
    startDrag,
    endDrag,
    setDragOverZone,
    dropZones,
    registerDropZone,
    unregisterDropZone,
  }

  return (
    <DragContext.Provider value={value}>
      {children}
    </DragContext.Provider>
  )
}

// Drag Handle Component
interface DragHandleProps {
  items: DragItem[]
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function DragHandle({ items, children, className = '', disabled = false }: DragHandleProps) {
  const { startDrag, endDrag, isDragging } = useDragContext()

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (disabled) return

    startDrag(items)

    // Set drag image and data
    const dragData = JSON.stringify(items)
    e.dataTransfer.setData('application/json', dragData)
    e.dataTransfer.effectAllowed = 'copyMove'

    // Create custom drag image
    const dragImage = document.createElement('div')
    dragImage.innerHTML = `${items.length} item${items.length > 1 ? 's' : ''}`
    dragImage.className = 'px-3 py-2 bg-blue-500 text-white rounded-lg shadow-lg text-sm font-medium'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 10, 10)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }, [items, startDrag, disabled])

  const handleDragEnd = useCallback(() => {
    endDrag()
  }, [endDrag])

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`${className} ${isDragging ? 'opacity-50' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-grab'}`}
      style={{ userSelect: 'none' }}
    >
      {children}
    </div>
  )
}

// Drop Zone Component
interface DropZoneComponentProps {
  id: string
  accepts: string[]
  onDrop: (items: DragItem[]) => void
  onDragOver?: (items: DragItem[]) => boolean
  children: ReactNode
  className?: string
  activeClassName?: string
  disabled?: boolean
}

export function DropZoneComponent({
  id,
  accepts,
  onDrop,
  onDragOver,
  children,
  className = '',
  activeClassName = '',
  disabled = false
}: DropZoneComponentProps) {
  const { draggedItems, dragOverZone, setDragOverZone, registerDropZone, unregisterDropZone } = useDragContext()

  React.useEffect(() => {
    const zone: DropZone = {
      id,
      accepts,
      onDrop: (items) => onDrop(items),
      onDragOver: onDragOver ? (items) => onDragOver(items) : undefined,
    }

    registerDropZone(zone)
    return () => unregisterDropZone(id)
  }, [id, accepts, onDrop, onDragOver, registerDropZone, unregisterDropZone])

  const isActive = dragOverZone === id && !disabled
  const canDrop = draggedItems.some(item => accepts.includes(item.type))

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (disabled || !canDrop) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverZone(id)
  }, [disabled, canDrop, id, setDragOverZone])

  const handleDragLeave = useCallback(() => {
    if (dragOverZone === id) {
      setDragOverZone(null)
    }
  }, [dragOverZone, id, setDragOverZone])

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (disabled || !canDrop) return

    e.preventDefault()
    setDragOverZone(null)

    try {
      const dragData = e.dataTransfer.getData('application/json')
      const items: DragItem[] = JSON.parse(dragData)

      if (items && items.length > 0) {
        onDrop(items)
      }
    } catch (error) {
      console.error('Failed to parse drag data:', error)
    }
  }, [disabled, canDrop, onDrop, setDragOverZone])

  return (
    <div
      className={`${className} ${isActive ? activeClassName : ''} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  )
}

// Batch Operations Hook
export function useBatchOperations() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const selectItem = useCallback((id: string) => {
    setSelectedItems(prev => new Set(prev).add(id))
  }, [])

  const deselectItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedItems(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const getSelectedItems = useCallback(() => Array.from(selectedItems), [selectedItems])

  return {
    selectedItems,
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedItems,
    hasSelection: selectedItems.size > 0,
    selectedCount: selectedItems.size,
  }
}
