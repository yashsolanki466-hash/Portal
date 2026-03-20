import React, { useEffect, useCallback } from 'react'

// Keyboard shortcut configuration
export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
  preventDefault?: boolean
}

export interface KeyboardShortcutsConfig {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

// Common keyboard shortcuts for file management
export const FILE_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'a',
    ctrl: true,
    description: 'Select all files',
    action: () => console.log('Select all'),
    preventDefault: true
  },
  {
    key: 'd',
    ctrl: true,
    description: 'Download selected files',
    action: () => console.log('Download selected'),
    preventDefault: true
  },
  {
    key: 'Delete',
    description: 'Delete selected files',
    action: () => console.log('Delete selected'),
    preventDefault: true
  },
  {
    key: 'f',
    ctrl: true,
    description: 'Focus search',
    action: () => console.log('Focus search'),
    preventDefault: true
  },
  {
    key: 'r',
    ctrl: true,
    description: 'Refresh file list',
    action: () => console.log('Refresh'),
    preventDefault: true
  },
  {
    key: 'ArrowUp',
    description: 'Navigate up',
    action: () => console.log('Navigate up'),
    preventDefault: true
  },
  {
    key: 'ArrowDown',
    description: 'Navigate down',
    action: () => console.log('Navigate down'),
    preventDefault: true
  },
  {
    key: 'ArrowLeft',
    description: 'Go to parent directory',
    action: () => console.log('Go to parent'),
    preventDefault: true
  },
  {
    key: 'ArrowRight',
    description: 'Enter directory',
    action: () => console.log('Enter directory'),
    preventDefault: true
  },
  {
    key: 'Enter',
    description: 'Open selected item',
    action: () => console.log('Open selected'),
    preventDefault: true
  },
  {
    key: 'Escape',
    description: 'Clear selection',
    action: () => console.log('Clear selection'),
    preventDefault: true
  },
  {
    key: ' ',
    description: 'Toggle selection',
    action: () => console.log('Toggle selection'),
    preventDefault: true
  }
]

// Global navigation shortcuts
export const NAVIGATION_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '1',
    alt: true,
    description: 'Go to Dashboard',
    action: () => console.log('Go to dashboard'),
    preventDefault: true
  },
  {
    key: '2',
    alt: true,
    description: 'Go to Projects',
    action: () => console.log('Go to projects'),
    preventDefault: true
  },
  {
    key: '3',
    alt: true,
    description: 'Go to File Browser',
    action: () => console.log('Go to files'),
    preventDefault: true
  },
  {
    key: '4',
    alt: true,
    description: 'Go to Transfers',
    action: () => console.log('Go to transfers'),
    preventDefault: true
  },
  {
    key: '5',
    alt: true,
    description: 'Go to Settings',
    action: () => console.log('Go to settings'),
    preventDefault: true
  },
  {
    key: 'b',
    ctrl: true,
    description: 'Toggle sidebar',
    action: () => console.log('Toggle sidebar'),
    preventDefault: true
  },
  {
    key: '/',
    description: 'Focus search',
    action: () => console.log('Focus global search'),
    preventDefault: true
  }
]

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const { shortcuts, enabled = true } = config

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Skip if user is typing in an input/textarea
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true') {
      // Allow certain shortcuts even when typing
      const allowedKeys = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']
      if (!allowedKeys.includes(event.key) &&
          !(event.ctrlKey || event.metaKey) &&
          !event.altKey) {
        return
      }
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatches = !!shortcut.ctrl === event.ctrlKey
      const shiftMatches = !!shortcut.shift === event.shiftKey
      const altMatches = !!shortcut.alt === event.altKey
      const metaMatches = !!shortcut.meta === event.metaKey

      return keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches
    })

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault()
        event.stopPropagation()
      }
      matchingShortcut.action()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])

  return {
    shortcuts,
    enabled
  }
}

// Utility function to format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts = []

  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.meta) parts.push('Cmd')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')

  parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key)

  return parts.join(' + ')
}

// Keyboard shortcuts help component
export function KeyboardShortcutsHelp({ shortcuts }: { shortcuts: KeyboardShortcut[] }) {
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.key.startsWith('Arrow') || shortcut.key === 'Enter' || shortcut.key === ' ' || shortcut.key === 'Delete'
      ? 'Navigation'
      : shortcut.ctrl || shortcut.alt
      ? 'Actions'
      : 'General'

    if (!acc[category]) acc[category] = []
    acc[category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Keyboard Shortcuts</h3>
        <p className="text-sm text-slate-600">Use these shortcuts to navigate and manage files more efficiently</p>
      </div>

      {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{category}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categoryShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-700">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-slate-600">
                  {formatShortcut(shortcut)}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-xs text-slate-500 text-center">
        Shortcuts work when not typing in input fields
      </div>
    </div>
  )
}
