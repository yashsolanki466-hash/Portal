export interface ProjectMetadata {
    projectID: string
    clientName: string
    institute: string
    organism: string
    genomeBuild: string
    platform: string
    date: string
    serviceType: string
    sampleType: string
    shippingCondition: string
    ftpServer?: {
        host: string
        port: number
        enabled: boolean
    }
}

export interface ProjectStats {
    totalSamples: number
    totalDataGB: number
    readLength: string
    mappingRate: string
    mergedTranscripts: number
    novelIsoforms: number
}

export interface TranscriptStat {
    name: string
    count: number
    totalLen: number
    meanLen: number
    maxLen: number
}

export interface ComparisonStats {
    total: number
    up: number
    down: number
    sigUp: number
    sigDown: number
    sigTotal: number
}

export interface KeggStatRow {
    level1: string
    level2: string
    count: number
}

export interface EnrichmentTerm {
    term: string
    count: number
    pAdjust: number
    category?: string
}

export type ScatterPoint = {
    x: number
    y: number
    sig: boolean
    label: string
    maX?: number
    samples?: Record<string, number> | null
}

export interface ComparisonData {
    id: string
    name: string
    description: string
    sigCount: number
    stats?: ComparisonStats
    maPoints: ScatterPoint[]
    volcanoPoints: ScatterPoint[]
    goTerms: EnrichmentTerm[]
    goTermsUp: EnrichmentTerm[]
    goTermsDown: EnrichmentTerm[]
    keggPathways: EnrichmentTerm[]
    keggPathwaysUp: EnrichmentTerm[]
    keggPathwaysDown: EnrichmentTerm[]
    keggStats?: KeggStatRow[]
}

export type DgeSummaryRow = {
    comp: string
    desc: string
    total: number
    downTotal: number
    upTotal: number
    sigDown: number
    sigUp: number
    sig: number
}

export type FileUploadType =
    | 'stats'
    | 'mapping'
    | 'template'
    | 'gtf_novel'
    | 'gtf_merged'
    | 'dge_summary'
    | 'comparison_dge'
    | 'comparison_go'
    | 'comparison_go_up'
    | 'comparison_go_down'
    | 'comparison_kegg'
    | 'comparison_kegg_up'
    | 'comparison_kegg_down'
    | 'comparison_kegg_stats'
    | 'deliverable_only'

export type RawDataSample = {
    sample: string
    r1?: string
    r2?: string
}

export type RawDataArtifacts = {
    statsFiles: string[]
    checksumFiles: string[]
    otherFiles: string[]
}

export type RawDataSummary = {
    folderName?: string
    samples: RawDataSample[]
    artifacts: RawDataArtifacts
}

export interface ProcessedData {
    dataStatsTable: string[][]
    mappingStatsTable: string[][]
    transcriptStats: TranscriptStat[]
    dgeSummaryTable: DgeSummaryRow[]
    comparisons: Record<string, ComparisonData>
    deliverablesTree: string
    rawData?: RawDataSummary
}
