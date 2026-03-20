import { sftpApi } from '../api/sftp'
import type { SFTPFile } from '../types'
import { detectComparisonId, detectFileType } from './fileDetection'
import type { DgeSummaryRow, ProcessedData, ProjectMetadata, ProjectStats, RawDataSummary } from './types'
import { parseComparisonDGE, parseDGESummary, parseEnrichment, parseGTF, parseKeggStats, parseTableData } from './excelParser'

type AnyRecord = Record<string, any>

function extractRawDataFromReadme(readmeText: string): { folderName: string; files: string[] } | null {
    const lines = readmeText.split(/\r?\n/)
    const startIdx = lines.findIndex(l => /(├──|└──)\s+01[_\s-]?raw[_\s-]?data\b/i.test(l))
    if (startIdx < 0) return null

    const titleLine = lines[startIdx] || ''
    const titleMatch = titleLine.match(/(?:├──|└──)\s+(.+)$/)
    const folderName = (titleMatch?.[1] || '01_Raw_Data').trim()

    const baseIndent = (titleLine.match(/^(\s*)/)?.[1] || '').length
    const out: string[] = []
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i] || ''
        const indent = (line.match(/^(\s*)/)?.[1] || '').length
        const isTreeItem = line.includes('├──') || line.includes('└──')
        if (!isTreeItem) continue

        // Stop once we hit the next top-level folder.
        if (indent <= baseIndent && /(├──|└──)/.test(line) && i > startIdx + 1) break

        const m = line.match(/(?:├──|└──)\s+(.+)$/)
        const name = (m?.[1] || '').trim()
        if (name) out.push(name)
    }

    return { folderName, files: out }
}

function extractRawDataFromFiles(projectPath: string, files: SFTPFile[]): { folderName: string; files: string[] } | null {
    const prefix = projectPath.endsWith('/') ? projectPath : `${projectPath}/`
    const rawFolderSeg = '01_Raw_Data'
    const matches = files
        .filter(f => !f.isDirectory)
        .map(f => (f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path.replace(/^\/+/, '')))
        .filter(rel => new RegExp(`(^|/)${rawFolderSeg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}/`, 'i').test(rel))
        .map(rel => {
            const parts = rel.split('/').filter(Boolean)
            const idx = parts.findIndex(p => p.toLowerCase() === rawFolderSeg.toLowerCase())
            return idx >= 0 ? parts.slice(idx + 1).join('/') : rel
        })
        .filter(Boolean)

    if (matches.length === 0) return null
    return { folderName: rawFolderSeg, files: matches }
}

function buildRawDataSummary(src: { folderName: string; files: string[] } | null): RawDataSummary | null {
    if (!src) return null

    const artifacts = {
        statsFiles: [] as string[],
        checksumFiles: [] as string[],
        otherFiles: [] as string[],
    }

    const r1Map = new Map<string, string>()
    const r2Map = new Map<string, string>()

    const normalizeSample = (fileName: string) => {
        const base = fileName.split('/').pop() || fileName
        const m = fileName.match(/^(.*?)_S\d+_L\d+_R[12]_/i)
        if (m?.[1]) return m[1]
        const m2 = base.match(/^(.*?)(?:_R[12])\b/i)
        if (m2?.[1]) return m2[1]
        return base.replace(/\.(fastq|fq)(\.gz)?$/i, '')
    }

    for (const name of src.files) {
        const base = name.split('/').pop() || name
        const lower = base.toLowerCase()
        if (/md5|checksum/.test(lower)) {
            artifacts.checksumFiles.push(name)
            continue
        }
        if (/raw[_\- ]?stats?\b|fastqc|multiqc|qc/.test(lower) && /\.(txt|tsv|csv|html?)$/i.test(lower)) {
            artifacts.statsFiles.push(name)
            continue
        }

        if (/\.(fastq|fq)(\.gz)?$/i.test(lower)) {
            const sample = normalizeSample(name)
            if (/_R1_/i.test(base) || /_R1\b/i.test(base)) r1Map.set(sample, name)
            else if (/_R2_/i.test(base) || /_R2\b/i.test(base)) r2Map.set(sample, name)
            else artifacts.otherFiles.push(name)
            continue
        }

        artifacts.otherFiles.push(name)
    }

    const sampleNames = new Set<string>([...r1Map.keys(), ...r2Map.keys()])
    const samples = [...sampleNames]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(sample => ({ sample, r1: r1Map.get(sample), r2: r2Map.get(sample) }))

    artifacts.statsFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    artifacts.checksumFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    artifacts.otherFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    return {
        folderName: src.folderName,
        samples,
        artifacts,
    }
}

function renderTreeFromFiles(projectPath: string, files: SFTPFile[]) {
    const prefix = projectPath.endsWith('/') ? projectPath : `${projectPath}/`
    const rels = files
        .filter(f => !f.isDirectory)
        .map(f => (f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path.replace(/^\/+/, '')))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    const root = { name: 'Deliverables', children: new Map<string, any>(), isFile: false }

    for (const rel of rels) {
        const segs = rel.split('/').filter(Boolean)
        let cur = root
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i]
            const isLast = i === segs.length - 1
            if (!cur.children.has(seg)) {
                cur.children.set(seg, { name: seg, children: new Map<string, any>(), isFile: isLast })
            }
            const next = cur.children.get(seg)
            if (isLast) next.isFile = true
            cur = next
        }
    }

    const lines: string[] = ['Deliverables', '.']

    const walk = (node: any, depth: number, isLast: boolean, prefixParts: boolean[]) => {
        const connectors = prefixParts
            .slice(0, depth)
            .map(p => (p ? '    ' : '│   '))
            .join('')

        const conn = depth === 0 ? '' : (isLast ? '└── ' : '├── ')
        if (depth > 0) lines.push(`${connectors}${conn}${node.name}`)

        const children = [...node.children.values()].sort((a, b) => {
            if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })

        children.forEach((c, idx) => {
            const last = idx === children.length - 1
            walk(c, depth + 1, last, [...prefixParts, last])
        })
    }

    const topChildren = [...root.children.values()].sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })

    topChildren.forEach((c, idx) => {
        const last = idx === topChildren.length - 1
        walk(c, 0, last, [])
    })

    return lines.join('\n')
}

function blobToFile(blob: Blob, name: string) {
    return new File([blob], name, { type: blob.type || 'application/octet-stream' })
}

async function downloadAsFile(sessionId: string, remotePath: string): Promise<File> {
    const res = await sftpApi.download(sessionId, remotePath, { timeout: 60000 })
    const blob = res.data as Blob
    const fileName = remotePath.split('/').filter(Boolean).pop() || 'file'
    return blobToFile(blob, fileName)
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let t: number | undefined
    const timeout = new Promise<T>((_, reject) => {
        t = window.setTimeout(() => reject(new Error(label)), ms)
    })
    return Promise.race([p.finally(() => { if (t) window.clearTimeout(t) }), timeout])
}

function toDgeSummaryRows(raw: AnyRecord[]): DgeSummaryRow[] {
    return raw.map((r: AnyRecord) => {
        const keys = Object.keys(r)
        const findKey = (pattern: RegExp) => keys.find(k => pattern.test(k))
        const get = (key?: string) => (key ? r[key] : undefined)

        const compKey = findKey(/comp/i) || keys[0]
        const descKey = findKey(/desc/i)
        const totalKey = findKey(/total.*deg|total.*gene/i) || findKey(/^total$/i)

        const sigDownKey = findKey(/sig.*down/i) || findKey(/down.*sig/i)
        const sigUpKey = findKey(/sig.*up/i) || findKey(/up.*sig/i)
        const sigTotalKey = findKey(/total.*sig/i) || findKey(/^sig/i) || findKey(/#.*sig/i)

        let downTotalKey = findKey(/^down/i)
        if (downTotalKey === sigDownKey) downTotalKey = undefined

        let upTotalKey = findKey(/^up/i)
        if (upTotalKey === sigUpKey) upTotalKey = undefined

        return {
            comp: String(r[compKey] || 'Unknown'),
            desc: descKey ? String(r[descKey] || '') : 'Test vs Control',
            total: Number(get(totalKey) || 0),
            downTotal: Number(get(downTotalKey) || 0),
            upTotal: Number(get(upTotalKey) || 0),
            sigDown: Number(get(sigDownKey) || 0),
            sigUp: Number(get(sigUpKey) || 0),
            sig: Number(get(sigTotalKey) || 0),
        }
    })
}

function mean(nums: number[]) {
    if (nums.length === 0) return 0
    return nums.reduce((a, b) => a + b, 0) / nums.length
}

function computeMappingRate(mappingTable: string[][]): string {
    if (mappingTable.length < 2) return '0%'
    const headers = mappingTable[0].map(h => String(h || '').toLowerCase())
    const mappedIdx = headers.findIndex(h => (h.includes('mapped') || h.includes('total')) && h.includes('%'))
    if (mappedIdx < 0) return '0%'
    const vals = mappingTable.slice(1).map(r => parseFloat(String(r[mappedIdx] || '0'))).filter(v => !isNaN(v))
    const avg = mean(vals)
    return `${avg.toFixed(1)}%`
}

export async function loadReportData(args: {
    sessionId: string
    projectPath: string
    readmeText?: string
    readmeMetadata?: { projectId?: string; projectPi?: string; application?: string; samples?: string }
    files: SFTPFile[]
}): Promise<{ metadata: ProjectMetadata; stats: ProjectStats; processed: ProcessedData }> {
    const { sessionId, projectPath, readmeText, readmeMetadata, files } = args

    const processed: ProcessedData = {
        dataStatsTable: [],
        mappingStatsTable: [],
        transcriptStats: [],
        dgeSummaryTable: [],
        comparisons: {},
        deliverablesTree: 'Deliverables\n.',
    }

    const candidates = files.filter(f => !f.isDirectory)

    processed.deliverablesTree = renderTreeFromFiles(projectPath, files)

    const rawSrc = (readmeText ? extractRawDataFromReadme(readmeText) : null) || extractRawDataFromFiles(projectPath, files)
    const rawSummary = buildRawDataSummary(rawSrc)
    if (rawSummary) processed.rawData = rawSummary

    const byType = new Map<string, SFTPFile[]>()
    for (const f of candidates) {
        const t = detectFileType(f.path)
        const key = String(t)
        byType.set(key, [...(byType.get(key) || []), f])
    }

    const scoreCandidate = (t: string, f: SFTPFile) => {
        const p = (f.path || '').toLowerCase()
        const n = (f.name || '').toLowerCase()
        const s = `${p} ${n}`
        if (/md5|checksum/.test(s)) return -100

        let score = 0
        if (t === 'stats') {
            if (/raw[_\- ]?stats?\b/.test(s)) score += 50
            if (/multiqc/.test(s)) score += 25
            if (/qc|qual|fastqc/.test(s)) score += 15
            if (/report|summary|stat/.test(s)) score += 5
        }
        if (t === 'mapping') {
            if (/mapping|align|star|hisat|bowtie/.test(s)) score += 30
            if (/log|summary|stat|report/.test(s)) score += 10
        }
        if (t === 'dge_summary') {
            if (/summary|overview|all/.test(s)) score += 20
        }

        // Prefer smaller text tables over huge artifacts
        if ((f.size || 0) > 0 && (f.size || 0) < 5 * 1024 * 1024) score += 2

        return score
    }

    const pickOne = (types: string[]) => {
        for (const t of types) {
            const arr = byType.get(t)
            if (arr && arr.length > 0) {
                const sorted = [...arr].sort((a, b) => scoreCandidate(t, b) - scoreCandidate(t, a))
                return sorted[0]
            }
        }
        return null
    }

    const statsFile = pickOne(['stats'])
    const mappingFile = pickOne(['mapping'])
    const gtfMerged = pickOne(['gtf_merged'])
    const gtfNovel = pickOne(['gtf_novel'])
    const dgeSummaryFile = pickOne(['dge_summary'])

    if (statsFile) {
        const file = await withTimeout(downloadAsFile(sessionId, statsFile.path), 60000, 'Timeout downloading stats file')
        processed.dataStatsTable = await withTimeout(parseTableData(file), 60000, 'Timeout parsing stats file')
    }

    if (mappingFile) {
        const file = await withTimeout(downloadAsFile(sessionId, mappingFile.path), 60000, 'Timeout downloading mapping file')
        processed.mappingStatsTable = await withTimeout(parseTableData(file), 60000, 'Timeout parsing mapping file')
    }

    if (gtfMerged) {
        if ((gtfMerged.size || 0) <= 25 * 1024 * 1024) {
            const file = await withTimeout(downloadAsFile(sessionId, gtfMerged.path), 60000, 'Timeout downloading merged GTF')
            processed.transcriptStats.push(await withTimeout(parseGTF(file), 60000, 'Timeout parsing merged GTF'))
        }
    }

    if (gtfNovel) {
        if ((gtfNovel.size || 0) <= 25 * 1024 * 1024) {
            const file = await withTimeout(downloadAsFile(sessionId, gtfNovel.path), 60000, 'Timeout downloading novel GTF')
            processed.transcriptStats.push(await withTimeout(parseGTF(file), 60000, 'Timeout parsing novel GTF'))
        }
    }

    if (dgeSummaryFile) {
        const file = await withTimeout(downloadAsFile(sessionId, dgeSummaryFile.path), 60000, 'Timeout downloading DGE summary')
        const raw = await withTimeout(parseDGESummary(file), 60000, 'Timeout parsing DGE summary')
        processed.dgeSummaryTable = toDgeSummaryRows(raw).sort((a, b) => a.comp.localeCompare(b.comp, undefined, { numeric: true }))
    }

    const comparisonFiles = candidates
        .map(f => ({ f, type: detectFileType(f.path), compId: detectComparisonId(f.path) }))
        .filter(x => x.compId && String(x.type).startsWith('comparison_'))

    for (const { f, type, compId } of comparisonFiles) {
        const id = compId as string
        const existing = processed.comparisons[id] || {
            id,
            name: `Comparison ${id.replace(/\D/g, '') || id}`,
            description: 'Test vs Control',
            sigCount: 0,
            maPoints: [],
            volcanoPoints: [],
            goTerms: [],
            goTermsUp: [],
            goTermsDown: [],
            keggPathways: [],
            keggPathwaysUp: [],
            keggPathwaysDown: [],
            keggStats: [],
        }
        processed.comparisons[id] = existing

        const file = await withTimeout(downloadAsFile(sessionId, f.path), 60000, `Timeout downloading ${f.name}`)

        if (type === 'comparison_dge') {
            const dgeData = await withTimeout(parseComparisonDGE(file), 60000, `Timeout parsing DGE ${f.name}`)
            processed.comparisons[id] = {
                ...processed.comparisons[id],
                sigCount: dgeData.sigCount,
                stats: dgeData.stats,
                maPoints: dgeData.maPoints,
                volcanoPoints: dgeData.volcanoPoints,
            }
        } else if (type === 'comparison_go') {
            const terms = await withTimeout(parseEnrichment(file), 60000, `Timeout parsing GO ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], goTerms: [...(processed.comparisons[id].goTerms || []), ...terms] }
        } else if (type === 'comparison_go_up') {
            const terms = await withTimeout(parseEnrichment(file), 60000, `Timeout parsing GO up ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], goTermsUp: [...(processed.comparisons[id].goTermsUp || []), ...terms] }
        } else if (type === 'comparison_go_down') {
            const terms = await withTimeout(parseEnrichment(file), 60000, `Timeout parsing GO down ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], goTermsDown: [...(processed.comparisons[id].goTermsDown || []), ...terms] }
        } else if (type === 'comparison_kegg') {
            const terms = await withTimeout(parseEnrichment(file), 60000, `Timeout parsing KEGG ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], keggPathways: [...(processed.comparisons[id].keggPathways || []), ...terms] }
        } else if (type === 'comparison_kegg_up') {
            const terms = await withTimeout(parseEnrichment(file), 60000, `Timeout parsing KEGG up ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], keggPathwaysUp: [...(processed.comparisons[id].keggPathwaysUp || []), ...terms] }
        } else if (type === 'comparison_kegg_down') {
            const terms = await withTimeout(parseEnrichment(file), 60000, `Timeout parsing KEGG down ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], keggPathwaysDown: [...(processed.comparisons[id].keggPathwaysDown || []), ...terms] }
        } else if (type === 'comparison_kegg_stats') {
            const stats = await withTimeout(parseKeggStats(file), 60000, `Timeout parsing KEGG stats ${f.name}`)
            processed.comparisons[id] = { ...processed.comparisons[id], keggStats: stats }
        }
    }

    const sampleNames = processed.dataStatsTable.length > 1
        ? processed.dataStatsTable.slice(1).map(row => row[0]).join(', ')
        : 'Information not available'

    const metadata: ProjectMetadata = {
        projectID: (readmeMetadata?.projectId || 'NGS-XXXXXX').toString(),
        clientName: (readmeMetadata?.projectPi || '').toString(),
        institute: (readmeMetadata?.application || '').toString(),
        organism: '',
        genomeBuild: '',
        platform: 'Illumina Novaseq',
        date: new Date().toISOString().split('T')[0],
        serviceType: 'RNA Sequencing',
        sampleType: '',
        shippingCondition: '',
        ftpServer: undefined,
    }

    const mergedTranscripts = processed.transcriptStats.find(s => /merged/i.test(s.name))?.count || 0
    const novelIsoforms = processed.transcriptStats.find(s => /novel|isoform/i.test(s.name))?.count || 0

    const stats: ProjectStats = {
        totalSamples: processed.dataStatsTable.length > 1 ? processed.dataStatsTable.length - 1 : (parseInt(String(readmeMetadata?.samples || '0')) || 0),
        totalDataGB: 0,
        readLength: '2 X 150 PE',
        mappingRate: computeMappingRate(processed.mappingStatsTable),
        mergedTranscripts,
        novelIsoforms,
    }

    metadata.clientName = metadata.clientName || sampleNames

    return { metadata, stats, processed }
}
