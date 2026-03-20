export function formatBytes(bytes: number, options?: { decimals?: number }): string {
    const decimals = options?.decimals ?? 2
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const value = bytes / Math.pow(k, i)
    return `${value.toFixed(decimals)} ${sizes[i]}`
}

export function formatBytesOrDash(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '--'
    return formatBytes(bytes)
}

export function formatSpeed(bytesPerSec: number): string {
    if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '--'
    return `${formatBytes(bytesPerSec)}/s`
}

export function formatEtaSeconds(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--:--'
    const s = Math.floor(seconds)
    if (s > 3600) {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        return `${h}h ${m}m`
    }
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m}:${rem.toString().padStart(2, '0')}`
}
