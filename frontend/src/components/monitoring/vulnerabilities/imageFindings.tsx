'use client'

import { useMemo, useState } from 'react'
import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import VulnerabilityCard from './vulnerabilityCard'

const PAGE_SIZE = 3

export default function ImageFindings({ image }: { image: ImageVulnerabilityReport }) {
    const [pagesByImage, setPagesByImage] = useState<Record<string, number>>({})
    const totalPages = Math.max(1, Math.ceil(image.vulnerabilities.length / PAGE_SIZE))
    const page = Math.min(totalPages, pagesByImage[image.image] ?? 1)
    const visibleFindings = useMemo(() => {
        const startIndex = (page - 1) * PAGE_SIZE
        return image.vulnerabilities.slice(startIndex, startIndex + PAGE_SIZE)
    }, [image.vulnerabilities, page])

    function setPage(nextPage: React.SetStateAction<number>) {
        setPagesByImage((prev) => {
            const currentPage = prev[image.image] ?? 1
            const resolvedPage = typeof nextPage === 'function'
                ? nextPage(currentPage)
                : nextPage

            return {
                ...prev,
                [image.image]: Math.min(totalPages, Math.max(1, resolvedPage)),
            }
        })
    }

    return (
        <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <span className='text-xs font-medium uppercase tracking-[0.18em] text-white/60'>
                    Vulnerability Details
                </span>
                <span className='text-xs uppercase tracking-[0.18em] text-white/60'>
                    {image.vulnerabilities.length} findings
                </span>
            </div>
            <div className='mt-4 flex flex-col gap-3'>
                {visibleFindings.length ? visibleFindings.map((vulnerability) => (
                    <VulnerabilityCard
                        key={`${image.image}-${vulnerability.id}-${vulnerability.packageName || 'pkg'}`}
                        vulnerability={vulnerability}
                    />
                )) : (
                    <div className='rounded-xl border border-white/10 bg-black/50 px-4 py-6 text-sm text-white/80'>
                        No per-vulnerability details are stored for this image yet. Run a new scan to populate them.
                    </div>
                )}
                {image.vulnerabilities.length > PAGE_SIZE ? (
                    <FindingPagination
                        page={page}
                        setPage={setPage}
                        totalPages={totalPages}
                        totalResults={image.vulnerabilities.length}
                    />
                ) : null}
            </div>
        </div>
    )
}

function FindingPagination({
    page,
    setPage,
    totalPages,
    totalResults,
}: {
    page: number
    setPage: (nextPage: React.SetStateAction<number>) => void
    totalPages: number
    totalResults: number
}) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/50 px-4 py-3'>
            <div className='text-sm text-white/60'>
                Page {page} of {totalPages} • {totalResults} findings
            </div>
            <div className='flex items-center gap-2'>
                <button
                    type='button'
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className='rounded-full border border-white/10 bg-white/5 px-3 py-1.5
                        text-sm text-white disabled:cursor-not-allowed disabled:opacity-40'
                >
                    Previous
                </button>
                <button
                    type='button'
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className='rounded-full border border-white/10 bg-white/5 px-3 py-1.5
                        text-sm text-white disabled:cursor-not-allowed disabled:opacity-40'
                >
                    Next
                </button>
            </div>
        </div>
    )
}
