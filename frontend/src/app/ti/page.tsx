import TiPageClient from './pageClient'
import searchThreatIntel, { TiSearchResponse } from '@/utils/ti/search'

interface TiPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: TiPageProps) {
    const params = await searchParams
    const rawQuery = params?.q ?? params?.query
    const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim()
    const initialResult = query ? sanitizeTiResultForPublicPage(await searchThreatIntel(query)) : null

    return (
        <main className='min-h-[calc(100vh-4.5rem)] w-full bg-[#f7f8fb] px-4 py-8 text-[#171a21] md:px-8'>
            <TiPageClient initialQuery={query || ''} initialResult={initialResult} />
        </main>
    )
}

function sanitizeTiResultForPublicPage(result: TiSearchResponse | null): TiSearchResponse | null {
    if (!result) return null

    return {
        query: result.query,
        generatedAt: result.generatedAt,
        mode: result.mode,
        status: result.status,
        refreshAfterSeconds: result.refreshAfterSeconds,
        summary: result.summary,
        confidence: result.confidence,
        lastSeen: result.lastSeen,
        aliases: result.aliases,
        recentActivity: result.recentActivity.map(item => ({
            date: item.date,
            title: item.title,
            detail: item.detail,
            confidence: item.confidence,
            sourceIds: item.sourceIds,
            url: item.url,
            claimType: item.claimType,
            victimName: item.victimName,
            affectedSectors: item.affectedSectors,
            countries: item.countries,
            impact: item.impact,
            firstReportedAt: item.firstReportedAt,
            lastReportedAt: item.lastReportedAt,
            publisherCount: item.publisherCount,
            corroboratingSourceIds: item.corroboratingSourceIds,
            contradictingSourceIds: item.contradictingSourceIds
        })),
        targets: result.targets,
        ttps: result.ttps,
        datasets: result.datasets,
        sources: result.sources.map(source => ({
            id: source.id,
            name: source.name,
            type: source.type,
            url: source.url
        })),
        notes: result.notes,
        analystLoop: result.analystLoop ? {
            resultState: result.analystLoop.resultState,
            headline: result.analystLoop.headline,
            nextSteps: result.analystLoop.nextSteps,
            runStatusClarity: {
                reviewTasks: result.analystLoop.runStatusClarity.reviewTasks,
                rejectedSources: result.analystLoop.runStatusClarity.rejectedSources,
                blockedUnsafeTargets: result.analystLoop.runStatusClarity.blockedUnsafeTargets,
                meaningfulWorkCount: result.analystLoop.runStatusClarity.meaningfulWorkCount,
                queuedTasks: 0,
                summary: result.analystLoop.runStatusClarity.summary
            },
            metadataReviewInbox: result.analystLoop.metadataReviewInbox.map(item => ({
                id: item.id,
                company: item.company,
                victim: item.victim,
                affectedAccounts: item.affectedAccounts,
                accountSubjects: item.accountSubjects,
                datasetSize: item.datasetSize,
                actorStatement: item.actorStatement,
                claimedDate: item.claimedDate,
                sourceHash: item.sourceHash,
                confidence: item.confidence,
                status: item.status,
                allowedActions: item.allowedActions
            })),
            sourceActivationWorkflow: result.analystLoop.sourceActivationWorkflow,
            victimNotificationPacket: result.analystLoop.victimNotificationPacket
        } : undefined,
        collectionStrategy: result.collectionStrategy ? {
            thesis: result.collectionStrategy.thesis,
            productFocus: result.collectionStrategy.productFocus.map(item => item.replace(/\bprovenance\b/gi, 'source context')),
            sourcePosture: result.collectionStrategy.sourcePosture
                .filter(source => source.role !== 'rejected_paid_rows')
                .map(source => ({
                    source: source.source,
                    role: source.role,
                    summary: source.summary,
                    buyerValue: source.buyerValue
                })),
            ownedCollection: {
                priority: result.collectionStrategy.ownedCollection.priority,
                summary: result.collectionStrategy.ownedCollection.summary.replace(/\bprovenance\b/gi, 'source context'),
                requirements: result.collectionStrategy.ownedCollection.requirements.map(item => item.replace(/\bprovenance\b/gi, 'source context')),
                prohibited: []
            },
            distribution: result.collectionStrategy.distribution
        } : undefined
    }
}
