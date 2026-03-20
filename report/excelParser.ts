import * as XLSX from 'xlsx'
import type { ComparisonStats, EnrichmentTerm, KeggStatRow, TranscriptStat } from './types'

type AnyRecord = Record<string, any>

function extOf(fileName: string) {
    const idx = fileName.lastIndexOf('.')
    if (idx === -1) return ''
    return fileName.slice(idx + 1).toLowerCase() || ''
}

function parseDelimitedLine(line: string, delimiter: string) {
    if (delimiter === 'ws') {
        return line.trim().split(/\s+/)
    }
    return line.split(delimiter).map(s => s.trim())
}

async function parseTextTableData(file: File): Promise<string[][]> {
    const text = await file.text()
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .filter(l => l.length > 0)

    if (lines.length === 0) return []

    const head = lines[0]
    const delimiter = head.includes('\t') ? '\t' : (head.includes(',') ? ',' : 'ws')

    return lines
        .map(l => parseDelimitedLine(l, delimiter))
        .filter(r => r.length > 0)
}

function matrixToRecords(matrix: string[][]): AnyRecord[] {
    if (matrix.length < 2) return []
    const headers = matrix[0].map(h => String(h || '').trim())
    return matrix.slice(1).map(row => {
        const obj: AnyRecord = {}
        headers.forEach((h, idx) => {
            obj[h] = row[idx]
        })
        return obj
    })
}

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            if (e.target?.result) resolve(e.target.result as ArrayBuffer)
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

const smartSheetToJson = (sheet: XLSX.WorkSheet, keywords: string[]): AnyRecord[] => {
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    if (rawData.length === 0) return []

    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rawData.length, 20); i++) {
        const rowStr = rawData[i].join(' ').toLowerCase()
        const matchCount = keywords.filter(k => rowStr.includes(k.toLowerCase())).length
        if (matchCount >= 1) {
            headerRowIndex = i
            break
        }
    }

    const headers = rawData[headerRowIndex].map(h => String(h).trim())
    const result: AnyRecord[] = []

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i]
        if (!row || row.length === 0) continue
        const obj: AnyRecord = {}
        headers.forEach((h, idx) => {
            obj[h] = row[idx]
        })
        result.push(obj)
    }

    return result
}

export const parseTableData = async (file: File): Promise<string[][]> => {
    const ext = extOf(file.name)
    if (ext !== 'xlsx' && ext !== 'xls') {
        return parseTextTableData(file)
    }

    const buffer = await readFileAsArrayBuffer(file)
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return []
    const firstSheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][]
    return jsonData.filter(row => row.length > 0 && row.some(cell => !!cell))
}

export const parseDGESummary = async (file: File): Promise<AnyRecord[]> => {
    const ext = extOf(file.name)
    if (ext !== 'xlsx' && ext !== 'xls') {
        const matrix = await parseTextTableData(file)
        return matrixToRecords(matrix)
    }

    const buffer = await readFileAsArrayBuffer(file)
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return []

    const firstSheet = workbook.Sheets[firstSheetName]
    return smartSheetToJson(firstSheet, ['comparison', 'total', 'up', 'down', 'sig', 'regulated'])
}

export const parseGTF = async (file: File): Promise<TranscriptStat> => {
    const text = await file.text()
    const lines = text.split('\n')

    const transcriptLengths: Record<string, number> = {}

    for (const line of lines) {
        if (!line || line.startsWith('#')) continue
        const parts = line.split('\t')
        if (parts.length < 9) continue
        const featureType = parts[2]
        if (featureType !== 'exon') continue

        const start = parseInt(parts[3])
        const end = parseInt(parts[4])
        const attributes = parts[8]

        const match = attributes.match(/transcript_id\s+\"([^\"]+)\";/)
        if (match) {
            const transcriptId = match[1]
            const length = end - start + 1
            transcriptLengths[transcriptId] = (transcriptLengths[transcriptId] || 0) + length
        }
    }

    const lengths = Object.values(transcriptLengths)
    const count = lengths.length

    if (count === 0) {
        return { name: file.name, count: 0, totalLen: 0, meanLen: 0, maxLen: 0 }
    }

    const totalLen = lengths.reduce((a, b) => a + b, 0)
    const maxLen = Math.max(...lengths)
    const meanLen = Math.round(totalLen / count)

    return { name: file.name, count, totalLen, meanLen, maxLen }
}

export const parseComparisonDGE = async (file: File): Promise<{ sigCount: number; stats: ComparisonStats; maPoints: any[]; volcanoPoints: any[] }> => {
    const ext = extOf(file.name)
    let jsonData: AnyRecord[] = []

    if (ext !== 'xlsx' && ext !== 'xls') {
        const matrix = await parseTextTableData(file)
        jsonData = matrixToRecords(matrix)
    } else {
        const buffer = await readFileAsArrayBuffer(file)
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) return { sigCount: 0, stats: { total: 0, up: 0, down: 0, sigUp: 0, sigDown: 0, sigTotal: 0 }, maPoints: [], volcanoPoints: [] }

        const firstSheet = workbook.Sheets[firstSheetName]
        jsonData = smartSheetToJson(firstSheet, ['logfc', 'fdr', 'pvalue', 'padj', 'foldchange'])
    }

    if (jsonData.length === 0) return { sigCount: 0, stats: { total: 0, up: 0, down: 0, sigUp: 0, sigDown: 0, sigTotal: 0 }, maPoints: [], volcanoPoints: [] }

    const row0 = jsonData[0]
    const keys = Object.keys(row0)

    const logFCKey = keys.find(k => /log2?fc|foldchange|log2_fold_change/i.test(k)) || keys[1]
    const fdrKey = keys.find(k => /fdr|padj|adj\.?p|q_?value/i.test(k)) || keys[keys.length - 1]
    const cpmKey = keys.find(k => /logcpm|log2?cpm|cpm|aveexpr|basemean/i.test(k))
    const idKey = keys.find(k => /gene|transcript|id|symbol|name|target_id/i.test(k)) || keys[0]

    const statKeys = [logFCKey, fdrKey, cpmKey, idKey, 'pvalue', 'p.value', 'padj', 'fdr'].map(s => String(s).toLowerCase())
    const sampleKeys = keys.filter(k => {
        const kl = k.toLowerCase()
        if (statKeys.includes(kl) || kl.includes('logfc') || kl.includes('pvalue') || kl.includes('fdr')) return false
        const val = (jsonData[0] as AnyRecord)[k]
        return typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val))
    })

    const stats: ComparisonStats = { total: 0, up: 0, down: 0, sigUp: 0, sigDown: 0, sigTotal: 0 }
    const sigPoints: any[] = []
    const nonSigPoints: any[] = []
    const MAX_POINTS = 5000

    jsonData.forEach((row: AnyRecord) => {
        const fc = parseFloat(row[logFCKey])
        const fdr = parseFloat(row[fdrKey])
        const cpm = cpmKey ? parseFloat(row[cpmKey]) : 0
        const label = String(row[idKey] || 'Unknown')

        if (isNaN(fc) || isNaN(fdr)) return

        stats.total++
        if (fc > 0) stats.up++
        else if (fc < 0) stats.down++

        const isSig = fdr < 0.05 && Math.abs(fc) > 1
        if (isSig) {
            stats.sigTotal++
            if (fc > 0) stats.sigUp++
            else stats.sigDown++
        }

        const negLogFdr = fdr === 0 ? 50 : Math.min(-Math.log10(fdr), 50)

        const samples: Record<string, number> = {}
        sampleKeys.forEach(sk => {
            samples[sk] = parseFloat(row[sk]) || 0
        })

        const point = {
            x: parseFloat(fc.toFixed(3)),
            y: parseFloat(negLogFdr.toFixed(3)),
            maX: cpmKey ? parseFloat(cpm.toFixed(3)) : parseFloat(fc.toFixed(3)),
            sig: isSig,
            label,
            samples: Object.keys(samples).length > 0 ? samples : null,
        }

        if (isSig) sigPoints.push(point)
        else nonSigPoints.push(point)
    })

    const SIG_LIMIT = 3000
    let finalPoints: any[] = []

    if (sigPoints.length <= SIG_LIMIT) {
        finalPoints = [...sigPoints]
    } else {
        sigPoints.sort((a, b) => b.y - a.y)
        finalPoints = sigPoints.slice(0, SIG_LIMIT)
    }

    const slotsLeft = MAX_POINTS - finalPoints.length
    if (slotsLeft > 0 && nonSigPoints.length > 0) {
        const step = Math.max(1, Math.floor(nonSigPoints.length / slotsLeft))
        for (let i = 0; i < nonSigPoints.length; i += step) {
            if (finalPoints.length >= MAX_POINTS) break
            finalPoints.push(nonSigPoints[i])
        }
    }

    const volcanoData = finalPoints.map(p => ({ x: p.x, y: p.y, sig: p.sig, label: p.label, maX: p.maX, samples: p.samples }))
    const maData = finalPoints.map(p => ({ x: p.maX, y: p.x, sig: p.sig, label: p.label, samples: p.samples }))

    return {
        sigCount: stats.sigTotal,
        stats,
        volcanoPoints: volcanoData,
        maPoints: maData,
    }
}

export const parseEnrichment = async (file: File): Promise<EnrichmentTerm[]> => {
    const ext = extOf(file.name)
    let jsonData: AnyRecord[] = []

    if (ext !== 'xlsx' && ext !== 'xls') {
        const matrix = await parseTextTableData(file)
        jsonData = matrixToRecords(matrix)
    } else {
        const buffer = await readFileAsArrayBuffer(file)
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) return []

        const firstSheet = workbook.Sheets[firstSheetName]
        jsonData = smartSheetToJson(firstSheet, [
            'term', 'description', 'pathway', 'id',
            'count', 'significant', 'n',
            'pvalue', 'p-value', 'p.adjust', 'fdr', 'qvalue', 'q-value',
        ])
    }

    if (jsonData.length === 0) return []

    const keys = Object.keys(jsonData[0])

    let termKey = keys.find(k => /description/i.test(k))
    if (!termKey) termKey = keys.find(k => /term/i.test(k))
    if (!termKey) termKey = keys.find(k => /pathway/i.test(k))
    if (!termKey) termKey = keys.find(k => /id/i.test(k))
    if (!termKey) termKey = keys[0]

    let countKey = keys.find(k => /^count/i.test(k))
    if (!countKey) countKey = keys.find(k => /significant/i.test(k))
    if (!countKey) countKey = keys.find(k => /^n$/i.test(k))
    if (!countKey) countKey = keys.find(k => /gene_?count/i.test(k))

    const catKey = keys.find(k => /ontology|category|namespace|type/i.test(k))
    const pKey = keys.find(k => /p[-_.]?val|p[-_.]?adj|fdr|q[-_.]?val/i.test(k))

    return jsonData.slice(0, 50).map((row: AnyRecord) => {
        const term = row[termKey as string] || 'Unknown'

        let count = 0
        if (countKey && row[countKey] !== undefined) {
            const parsed = parseInt(String(row[countKey]))
            if (!isNaN(parsed)) count = parsed
        }

        let pVal = 0
        if (pKey && row[pKey] !== undefined) {
            const parsed = parseFloat(String(row[pKey]))
            if (!isNaN(parsed)) pVal = parsed
        }

        const category = catKey ? String(row[catKey]) : undefined

        return {
            term: String(term),
            count,
            pAdjust: pVal,
            category,
        }
    })
}

export const parseKeggStats = async (file: File): Promise<KeggStatRow[]> => {
    const ext = extOf(file.name)
    let jsonData: AnyRecord[] = []

    if (ext !== 'xlsx' && ext !== 'xls') {
        const matrix = await parseTextTableData(file)
        jsonData = matrixToRecords(matrix)
    } else {
        const buffer = await readFileAsArrayBuffer(file)
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) return []

        const firstSheet = workbook.Sheets[firstSheetName]
        jsonData = smartSheetToJson(firstSheet, ['level', 'count', 'name'])
    }
    if (jsonData.length === 0) return []

    const keys = Object.keys(jsonData[0])
    const l1Key = keys.find(k => /level1|level 1|category/i.test(k)) || keys[0]
    const l2Key = keys.find(k => /level2|level 2|subcategory|sub-category/i.test(k)) || keys[1]
    const countKey = keys.find(k => /count|num|sequence/i.test(k)) || keys[2]

    return jsonData
        .map((row: AnyRecord) => ({
            level1: String(row[l1Key] || '').trim(),
            level2: String(row[l2Key] || '').trim(),
            count: parseInt(String(row[countKey] || '0')) || 0,
        }))
        .filter(r => r.level1 || r.level2)
}
