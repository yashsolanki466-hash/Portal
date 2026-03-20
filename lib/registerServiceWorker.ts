type ServiceWorkerUpdateDetail = {
  registration: ServiceWorkerRegistration
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return

        installing.addEventListener('statechange', () => {
          if (installing.state !== 'installed') return

          if (navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent<ServiceWorkerUpdateDetail>('sw:update-available', { detail: { registration } }))
          } else {
            window.dispatchEvent(new CustomEvent<ServiceWorkerUpdateDetail>('sw:offline-ready', { detail: { registration } }))
          }
        })
      })
    } catch {
      // ignore registration failures
    }
  }

  if (document.readyState === 'complete') {
    void register()
    return
  }

  window.addEventListener('load', () => {
    void register()
  })
}

export async function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  try {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
  } catch {
    // ignore
  }
}
