import { useMemo, useState } from 'react'
import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { SortMode } from './types'
import { impactScore } from './helpers'

export default function useSortedImages(data: GetVulnerabilities | null, initialQuery: string) {
    const [sortMode, setSortMode] = useState<SortMode>('impact')
    const images = useMemo(() => (data?.images || []).filter((img) => {
        if (!initialQuery) return true
        return img.image.toLowerCase().includes(initialQuery)
            || img.groups.some(group => group.source.toLowerCase().includes(initialQuery))
            || img.vulnerabilities.some(v => (
                v.id.toLowerCase().includes(initialQuery)
                || v.title.toLowerCase().includes(initialQuery)
                || (v.packageName || '').toLowerCase().includes(initialQuery)
            ))
    }).sort((a, b) => sortMode === 'alphabetical'
        ? a.image.localeCompare(b.image)
        : impactScore(b) - impactScore(a) || b.totalVulnerabilities - a.totalVulnerabilities || a.image.localeCompare(b.image)), [
        data?.images,
        initialQuery,
        sortMode,
    ])

    return { images, sortMode, setSortMode }
}
