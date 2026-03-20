import type { FileUploadType } from './types'

export const detectComparisonId = (filename: string): string | null => {
    const str = filename

    const inComparisonFolder = str.match(/(?:^|[\\/])comparison[\\/]+([^\\/]+)/i)
    if (inComparisonFolder) {
        const seg = inComparisonFolder[1]
        // If the next segment looks like a file (has an extension), don't treat it as a comparison id
        if (!seg.includes('.')) {
            const cleaned = seg.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_')
            if (cleaned) return cleaned
        }
    }

    const vsMatch = str.match(/([A-Za-z0-9][A-Za-z0-9._-]{0,30}_vs_[A-Za-z0-9][A-Za-z0-9._-]{0,30})/i)
    if (vsMatch) return vsMatch[1]

    const match1 = str.match(/(?:comparison|comp|contrast|group)\s*[-_ ]*0*(\d+)/i)
    if (match1) return `C${match1[1]}`

    const match2 = str.match(/(?:^|[\\/_-])c0*(\d+)(?:[\\/_\.-]|$)/i)
    if (match2) return `C${match2[1]}`

    const match3 = str.match(/(?:^|[\\/_-])comparison0*(\d+)(?:[\\/_\.-]|$)/i)
    if (match3) return `C${match3[1]}`

    return null
}

export const detectFileType = (filename: string): FileUploadType | 'unknown' => {
    const lower = filename.toLowerCase()
    const baseName = lower.split(/[\\/]/).filter(Boolean).pop() || lower

    const isSpreadsheetLike = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')

    // Folder-based hints
    const inRawDataFolder = /(?:^|[\\/])0?1[_-]?raw[_-]?data(?:[\\/]|$)/i.test(lower) || lower.includes('raw_data')
    const inMappingFolder = lower.includes('mapping') || lower.includes('alignment') || lower.includes('align') || lower.includes('assembly')
    const inDgeFolder = lower.includes('differential_expression') || lower.includes('differential-expression') || lower.includes('differential expression') || lower.includes('dge') || lower.includes('deg')
    const inGoFolder = lower.includes('dge_go') || (lower.includes('go') && (lower.includes('enrich') || lower.includes('enrichment')))
    const inPathwaysFolder = lower.includes('pathway') || lower.includes('kegg') || lower.includes('dge_pathway')

    if (
        lower.endsWith('.fastq') || lower.endsWith('.fq') || lower.endsWith('.fastq.gz') || lower.endsWith('.fq.gz') ||
        lower.endsWith('.bam') || lower.endsWith('.sam') || lower.endsWith('.bai') ||
        lower.endsWith('.fa') || lower.endsWith('.fasta') || lower.endsWith('.fna') ||
        lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.svg')
    ) {
        return 'deliverable_only'
    }

    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'template'

    if (lower.endsWith('.gtf')) {
        if (lower.includes('novel') || lower.includes('isoform')) return 'gtf_novel'
        return 'gtf_merged'
    }

    // Prefer folder-based classification when present
    if (inRawDataFolder && isSpreadsheetLike) {
        if (/md5|checksum/.test(baseName)) return 'deliverable_only'
        if (/(mapping|align|star|bowtie|hisat)/.test(baseName)) return 'mapping'
        if (/(raw[_\- ]?stat|multiqc|qc|qual|report|summary|stat)/.test(baseName)) return 'stats'
        return 'deliverable_only'
    }
    if (inMappingFolder && isSpreadsheetLike) return 'mapping'

    if (
        (lower.includes('mapping') || lower.includes('align') || lower.includes('star') || lower.includes('bowtie') || lower.includes('hisat')) &&
        (lower.includes('stat') || lower.includes('summary') || lower.includes('report') || lower.includes('log') || lower.endsWith('.txt') || lower.endsWith('.csv') || lower.endsWith('.xlsx'))
    ) return 'mapping'

    if (
        lower.includes('multiqc') ||
        ((lower.includes('stat') || lower.includes('report') || lower.includes('summary')) &&
            (lower.includes('data') || lower.includes('raw') || lower.includes('seq') || lower.includes('trim') || lower.includes('qc') || lower.includes('qual')))
    ) return 'stats'

    if ((lower.includes('summary') || lower.includes('overview') || lower.includes('all')) && (lower.includes('dge') || lower.includes('diff') || lower.includes('deg'))) return 'dge_summary'

    if (inDgeFolder && (lower.includes('summary') || lower.includes('overview')) && isSpreadsheetLike) return 'dge_summary'

    const isGO = inGoFolder || (lower.includes('go') && (lower.includes('enrich') || lower.includes('term') || lower.includes('result') || lower.includes('_go') || lower.includes('go_'))) || lower.includes('gene_ontology')
    if (isGO) {
        if (lower.includes('_up') || lower.includes('sig_up') || lower.includes('upregulated')) return 'comparison_go_up'
        if (lower.includes('_down') || lower.includes('sig_down') || lower.includes('downregulated')) return 'comparison_go_down'
        return 'comparison_go'
    }

    if (lower.includes('kegg') && (lower.includes('stat') || lower.includes('summary'))) return 'comparison_kegg_stats'
    if (lower.includes('pathway') && (lower.includes('stat') || lower.includes('summary'))) return 'comparison_kegg_stats'
    if (lower.includes('pathway') && lower.includes('dge') && lower.includes('significant')) return 'comparison_kegg_stats'

    const isKEGG = inPathwaysFolder || lower.includes('kegg') || lower.includes('pathway')
    if (isKEGG) {
        if (lower.includes('_up') || lower.includes('sig_up') || lower.includes('upregulated')) return 'comparison_kegg_up'
        if (lower.includes('_down') || lower.includes('sig_down') || lower.includes('downregulated')) return 'comparison_kegg_down'
        return 'comparison_kegg'
    }

    const dgeKeywords = ['dge', 'diff', 'deg', 'result', 'comp', 'contrast', 'vs', 'change', 'fc', 'volcano', 'ma_plot', 'table', 'output']
    if (dgeKeywords.some(k => lower.includes(k)) && !lower.includes('summary') && !lower.includes('overview')) {
        return 'comparison_dge'
    }

    if (lower.includes('/comparison/') && isSpreadsheetLike && inDgeFolder) return 'comparison_dge'

    if (detectComparisonId(filename) && (lower.endsWith('xlsx') || lower.endsWith('csv') || lower.endsWith('txt') || lower.endsWith('xls'))) {
        return 'comparison_dge'
    }

    if (lower.endsWith('.txt') || lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.tsv')) {
        return 'deliverable_only'
    }

    return 'unknown'
}
