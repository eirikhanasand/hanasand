'use client'

import { useMemo, useState } from 'react'
import type { ImageVulnerabilityReport, VulnerabilityDetail } from '@/utils/monitoring/types'
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
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'>
                <span className='text-xs font-medium uppercase tracking-[0.18em] text-ui-muted'>
                    Vulnerability Details
                </span>
                <span className='text-xs uppercase tracking-[0.18em] text-ui-muted'>
                    {image.vulnerabilities.length} findings
                </span>
            </div>
            <RemediationSummary image={image} />
            <div className='mt-4 flex flex-col gap-3'>
                {visibleFindings.length ? visibleFindings.map((vulnerability) => (
                    <VulnerabilityCard
                        key={`${image.image}-${vulnerability.id}-${vulnerability.packageName || 'pkg'}`}
                        vulnerability={vulnerability}
                    />
                )) : (
                    <div className='rounded-lg border border-ui-border bg-ui-raised px-4 py-6 text-sm text-ui-muted'>
                        Scanner is tracking this image. Package findings stream here as soon as the current pass resolves them.
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

function RemediationSummary({ image }: { image: ImageVulnerabilityReport }) {
    const fixable = image.vulnerabilities.filter(vulnerability => vulnerability.fixedVersion)
    const unresolved = image.vulnerabilities.length - fixable.length
    const firstFix = fixable.find(isHighImpact) || fixable[0]
    const packageCounts = packageConcentration(image.vulnerabilities)

    return (
        <section className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3' data-testid='vulnerability-remediation-summary'>
            <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:items-start'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Recommended remediation</p>
                    <h3 className='mt-1 text-base font-semibold text-ui-text'>{remediationHeadline(firstFix, image.vulnerabilities.length)}</h3>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{remediationDetail(firstFix, unresolved)}</p>
                </div>
                <div className='grid grid-cols-2 gap-2 text-xs text-ui-muted'>
                    <RemediationFact label='Fixable' value={String(fixable.length)} />
                    <RemediationFact label='No fix yet' value={String(unresolved)} />
                </div>
            </div>
            {packageCounts.length ? (
                <div className='flex flex-wrap gap-2' data-testid='vulnerability-package-concentration'>
                    {packageCounts.slice(0, 3).map(item => (
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted' key={item.packageName}>
                            {item.packageName}: {item.count}
                        </span>
                    ))}
                </div>
            ) : null}
        </section>
    )
}

function RemediationFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-panel px-3 py-2'>
            <p className='font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function isHighImpact(vulnerability: VulnerabilityDetail) {
    return vulnerability.severity === 'critical' || vulnerability.severity === 'high'
}

function remediationHeadline(firstFix: VulnerabilityDetail | undefined, total: number) {
    if (!total) return 'No package remediation required'
    if (!firstFix) return 'Track vendor fixes before changing the image'
    return `Upgrade ${firstFix.packageName || firstFix.id}`
}

function remediationDetail(firstFix: VulnerabilityDetail | undefined, unresolved: number) {
    if (!firstFix) {
        return unresolved
            ? `${unresolved} finding${unresolved === 1 ? '' : 's'} do not expose a fixed version yet. Keep the image in review and rerun the scanner after vendor updates.`
            : 'No actionable package upgrade is available from this scan.'
    }
    const fix = firstFix.fixedVersion ? ` to ${firstFix.fixedVersion}` : ''
    const blocker = unresolved ? ` ${unresolved} finding${unresolved === 1 ? '' : 's'} still need vendor or base-image follow-up.` : ''
    return `Start with ${firstFix.id}${fix}; it is the clearest package-level fix in this image.${blocker}`
}

function packageConcentration(vulnerabilities: VulnerabilityDetail[]) {
    const counts = new Map<string, number>()
    vulnerabilities.forEach(vulnerability => {
        const packageName = vulnerability.packageName || 'package pending'
        counts.set(packageName, (counts.get(packageName) || 0) + 1)
    })
    return Array.from(counts.entries())
        .map(([packageName, count]) => ({ packageName, count }))
        .sort((a, b) => b.count - a.count || a.packageName.localeCompare(b.packageName))
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
        <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-4 py-3'>
            <div className='text-sm text-ui-muted'>
                Page {page} of {totalPages} • {totalResults} findings
            </div>
            <div className='flex items-center gap-2'>
                <button
                    type='button'
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className='rounded-full border border-ui-border bg-ui-raised px-3 py-1.5
                        text-sm text-ui-text disabled:cursor-not-allowed disabled:opacity-40'
                >
                    Previous
                </button>
                <button
                    type='button'
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className='rounded-full border border-ui-border bg-ui-raised px-3 py-1.5
                        text-sm text-ui-text disabled:cursor-not-allowed disabled:opacity-40'
                >
                    Next
                </button>
            </div>
        </div>
    )
}
