import { useCallback, useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'pwa:install:dismissed'

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      // ignore
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferred(null)
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {
        // ignore
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const isInstallable = useMemo(() => {
    return !!deferred && !dismissed && !isInstalled
  }, [deferred, dismissed, isInstalled])

  const promptInstall = useCallback(async () => {
    if (!deferred) return { outcome: 'dismissed' as const }

    try {
      await deferred.prompt()
      const choice = await deferred.userChoice

      setDeferred(null)
      if (choice.outcome === 'dismissed') {
        try {
          localStorage.setItem(DISMISS_KEY, '1')
        } catch {
          // ignore
        }
        setDismissed(true)
      }

      return choice
    } catch {
      return { outcome: 'dismissed' as const }
    }
  }, [deferred])

  const dismissInstall = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }, [])

  return {
    isInstallable,
    promptInstall,
    dismissInstall,
  }
}
