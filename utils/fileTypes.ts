function extOf(fileName: string): string {
    const part = (fileName.split('.').pop() || '').toLowerCase()
    if (!part || part === fileName.toLowerCase()) return ''
    return part
}

export function isTextFile(fileName: string): boolean {
    const ext = extOf(fileName)
    if (!ext) return false
    const textExtensions = ['txt', 'csv', 'tsv', 'gtf', 'bed', 'json', 'md', 'log', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts']
    return textExtensions.includes(ext)
}

export function isImageFile(fileName: string): boolean {
    const ext = extOf(fileName)
    if (!ext) return false
    const imageExtensions = ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp', 'ico']
    return imageExtensions.includes(ext)
}
