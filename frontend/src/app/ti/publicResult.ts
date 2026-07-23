import type { TiActionabilityContract, TiActorBusinessFinding, TiActorIntelligenceContract, TiSearchResponse } from '@/utils/ti/search'

export function sanitizeTiResultForPublicPage(result: TiSearchResponse | null): TiSearchResponse | null {
    if (!result) return null

    const publicResult: TiSearchResponse = {
        query: result.query,
        queryKind: result.queryKind,
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
            contradictingSourceIds: item.contradictingSourceIds,
            assertionKind: item.assertionKind,
            reviewState: item.reviewState,
            corroborationState: item.corroborationState,
            observationSummary: item.observationSummary ? publicTiText(item.observationSummary) : undefined
        })),
        claims: result.claims?.map(claim => ({
            ...claim,
            summary: claim.summary ? publicTiText(claim.summary) : undefined,
            uncertaintyReasons: claim.uncertaintyReasons.map(publicTiText)
        })),
        incidents: result.incidents?.map(incident => ({
            ...incident,
            title: publicTiText(incident.title),
            summary: incident.summary ? publicTiText(incident.summary) : undefined,
            reviewReasons: incident.reviewReasons.map(publicTiText)
        })),
        evidenceAssessment: result.evidenceAssessment ? {
            ...result.evidenceAssessment,
            reasons: result.evidenceAssessment.reasons.map(publicTiText),
            missingFields: result.evidenceAssessment.missingFields.map(publicTiText)
        } : undefined,
        targets: result.targets,
        ttps: result.ttps,
        datasets: result.datasets,
        sources: result.sources.map(source => ({
            id: source.id,
            name: source.name,
            type: source.type,
            provenance: source.provenance ? publicTiText(source.provenance) : undefined,
            url: source.url,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            reportDate: source.reportDate,
            lastCollectedAt: source.lastCollectedAt
        })),
        notes: result.notes,
        actorIdentity: result.actorIdentity ? {
            catalogMatched: result.actorIdentity.catalogMatched,
            ambiguous: result.actorIdentity.ambiguous,
            activityEvidenceAvailable: result.actorIdentity.activityEvidenceAvailable,
            candidates: result.actorIdentity.candidates.map(candidate => ({
                catalogId: candidate.catalogId,
                externalId: candidate.externalId,
                canonicalName: publicTiText(candidate.canonicalName),
                associatedNames: candidate.associatedNames.map(publicTiText),
                matchKinds: candidate.matchKinds,
                status: candidate.status,
                aptNumberDesignationPresent: candidate.aptNumberDesignationPresent,
                sourceUrl: candidate.sourceUrl,
                catalogVersion: candidate.catalogVersion,
                catalogModifiedAt: candidate.catalogModifiedAt,
                captureId: candidate.captureId,
            }))
        } : undefined,
        actorIntelligence: sanitizeActorIntelligence(result.actorIntelligence),
        actorCaseStudies: result.actorCaseStudies ? {
            ...result.actorCaseStudies,
            qualification: publicTiText(result.actorCaseStudies.qualification),
            cases: result.actorCaseStudies.cases.map(caseStudy => ({
                ...caseStudy,
                actor: publicTiText(caseStudy.actor),
                categories: caseStudy.categories.map(publicTiText),
                reviewStates: caseStudy.reviewStates.map(publicTiText),
                findings: caseStudy.findings?.map(sanitizeActorBusinessFinding),
            })),
            reviewedFindings: result.actorCaseStudies.reviewedFindings?.map(sanitizeActorBusinessFinding),
            pendingFindings: result.actorCaseStudies.pendingFindings?.map(sanitizeActorBusinessFinding),
            missingContexts: result.actorCaseStudies.missingContexts.map(publicTiText),
        } : undefined,
        actionability: sanitizeActionability(result.actionability),
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
            thesis: publicTiText(result.collectionStrategy.thesis),
            productFocus: result.collectionStrategy.productFocus.map(publicTiText),
            sourcePosture: result.collectionStrategy.sourcePosture
                .filter(source => source.role !== 'rejected_paid_rows')
                .map(source => ({
                    source: publicTiText(source.source),
                    role: source.role,
                    summary: publicTiText(source.summary),
                    buyerValue: publicTiText(source.buyerValue)
                })),
            ownedCollection: {
                priority: result.collectionStrategy.ownedCollection.priority,
                summary: publicTiText(result.collectionStrategy.ownedCollection.summary),
                requirements: result.collectionStrategy.ownedCollection.requirements.map(publicTiText),
                prohibited: []
            },
            distribution: result.collectionStrategy.distribution
        } : undefined
    }

    return sanitizeBackendShapedPublicText(publicResult)
}

function sanitizeActorIntelligence(actorIntelligence?: TiActorIntelligenceContract): TiActorIntelligenceContract | undefined {
    if (!actorIntelligence) return undefined

    return {
        actorClass: actorIntelligence.actorClass,
        attribution: actorIntelligence.attribution ? publicTiText(actorIntelligence.attribution) : undefined,
        firstSeen: actorIntelligence.firstSeen,
        lastSeen: actorIntelligence.lastSeen,
        motivation: actorIntelligence.motivation?.map(publicTiText),
        malwareTools: actorIntelligence.malwareTools?.map(publicTiText),
        campaigns: actorIntelligence.campaigns?.map(publicTiText),
        infrastructure: actorIntelligence.infrastructure?.map(publicTiText),
        indicators: actorIntelligence.indicators?.map(publicTiText),
        targetSectors: actorIntelligence.targetSectors?.map(publicTiText),
        geographies: actorIntelligence.geographies?.map(publicTiText),
        confidence: actorIntelligence.confidence,
        confidenceReasoning: actorIntelligence.confidenceReasoning?.map(publicTiText),
        sourceProvenance: actorIntelligence.sourceProvenance?.map(publicTiText),
        missingFields: actorIntelligence.missingFields?.map(publicTiText),
        businessModel: actorIntelligence.businessModel ? {
            ...actorIntelligence.businessModel,
            extortionModels: sanitizeBusinessObservations(actorIntelligence.businessModel.extortionModels),
            advertisedProducts: sanitizeBusinessObservations(actorIntelligence.businessModel.advertisedProducts),
            advertisedData: sanitizeBusinessObservations(actorIntelligence.businessModel.advertisedData),
            pricingClaims: sanitizeBusinessObservations(actorIntelligence.businessModel.pricingClaims),
            negotiationClaims: sanitizeBusinessObservations(actorIntelligence.businessModel.negotiationClaims),
            paymentClaims: sanitizeBusinessObservations(actorIntelligence.businessModel.paymentClaims),
            revenueClaims: sanitizeBusinessObservations(actorIntelligence.businessModel.revenueClaims),
            revenueShareClaims: sanitizeBusinessObservations(actorIntelligence.businessModel.revenueShareClaims),
            publicationStrategies: sanitizeBusinessObservations(actorIntelligence.businessModel.publicationStrategies),
            publicityTactics: sanitizeBusinessObservations(actorIntelligence.businessModel.publicityTactics),
            publicityEvents: sanitizeBusinessObservations(actorIntelligence.businessModel.publicityEvents),
            pressureTactics: sanitizeBusinessObservations(actorIntelligence.businessModel.pressureTactics),
            communicationChannels: sanitizeBusinessObservations(actorIntelligence.businessModel.communicationChannels),
            buyerSellerCommunications: sanitizeBusinessObservations(actorIntelligence.businessModel.buyerSellerCommunications),
            intermediaryCommunications: sanitizeBusinessObservations(actorIntelligence.businessModel.intermediaryCommunications),
            monetizationPaths: sanitizeBusinessObservations(actorIntelligence.businessModel.monetizationPaths),
            profitabilitySignals: sanitizeBusinessObservations(actorIntelligence.businessModel.profitabilitySignals),
            pendingFindings: sanitizeBusinessObservations(actorIntelligence.businessModel.pendingFindings),
            profitabilityConclusion: actorIntelligence.businessModel.profitabilityConclusion ? {
                status: actorIntelligence.businessModel.profitabilityConclusion.status,
                summary: publicTiText(actorIntelligence.businessModel.profitabilityConclusion.summary),
                claimIds: actorIntelligence.businessModel.profitabilityConclusion.claimIds,
                sourceIds: actorIntelligence.businessModel.profitabilityConclusion.sourceIds,
                captureIds: actorIntelligence.businessModel.profitabilityConclusion.captureIds,
            } : undefined,
            missingEvidence: actorIntelligence.businessModel.missingEvidence.map(publicTiText),
            evidenceBoundary: publicTiText(actorIntelligence.businessModel.evidenceBoundary),
        } : undefined,
        attributionEvidence: actorIntelligence.attributionEvidence ? {
            sourceId: actorIntelligence.attributionEvidence.sourceId,
            sourceName: publicTiText(actorIntelligence.attributionEvidence.sourceName),
            provenance: publicTiText(actorIntelligence.attributionEvidence.provenance),
            reportDate: actorIntelligence.attributionEvidence.reportDate,
            captureId: actorIntelligence.attributionEvidence.captureId,
        } : undefined,
        structuredProvenance: actorIntelligence.structuredProvenance?.map(row => ({
            sourceId: row.sourceId,
            sourceName: publicTiText(row.sourceName),
            provenance: publicTiText(row.provenance),
            reportDate: row.reportDate,
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceFamily: row.sourceFamily,
            parserStatus: row.parserStatus,
            lastCollectedAt: row.lastCollectedAt,
            confidence: row.confidence,
            shownBecause: publicTiText(row.shownBecause)
        }))
    }
}

function sanitizeBusinessObservations(rows: NonNullable<TiActorIntelligenceContract['businessModel']>['publicationStrategies'] | undefined) {
    return rows?.map(row => ({
        value: publicTiText(row.value),
        assertionKind: row.assertionKind,
        evidenceKind: row.evidenceKind,
        confidence: row.confidence,
        sourceIds: row.sourceIds,
        captureIds: row.captureIds,
        claimIds: row.claimIds,
        claimEvidenceIds: row.claimEvidenceIds,
        entityIds: row.entityIds,
        reviewState: row.reviewState,
        reviewReasons: row.reviewReasons.map(publicTiText),
        corroborationState: row.corroborationState,
        sourceCount: row.sourceCount,
        evidenceCount: row.evidenceCount,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        firstPublishedAt: row.firstPublishedAt,
        lastPublishedAt: row.lastPublishedAt,
        firstCollectedAt: row.firstCollectedAt,
        lastCollectedAt: row.lastCollectedAt,
        evidenceStages: row.evidenceStages,
        extractionMethods: row.extractionMethods,
        extractorVersions: row.extractorVersions,
        evidence: row.evidence?.map(evidence => ({
            sourceId: evidence.sourceId,
            captureId: evidence.captureId,
            claimId: evidence.claimId,
            claimEvidenceId: evidence.claimEvidenceId,
            entityId: evidence.entityId,
            contentHash: evidence.contentHash,
            url: safePublicTiUrl(evidence.url),
            publishedAt: evidence.publishedAt,
            collectedAt: evidence.collectedAt,
            excerpt: publicEvidenceText(evidence.excerpt),
        })),
    })) ?? []
}

function sanitizeActorBusinessFinding(finding: TiActorBusinessFinding): TiActorBusinessFinding {
    return {
        actorId: finding.actorId,
        actor: publicTiText(finding.actor),
        actorClass: finding.actorClass,
        category: finding.category,
        type: finding.type,
        value: publicTiText(finding.value),
        assertionKind: finding.assertionKind,
        confidence: finding.confidence,
        claimId: finding.claimId,
        claimEvidenceId: finding.claimEvidenceId,
        entityId: finding.entityId,
        captureId: finding.captureId,
        sourceId: finding.sourceId,
        relationship: finding.relationship,
        evidenceStage: finding.evidenceStage,
        reviewState: finding.reviewState,
        reviewedAt: finding.reviewedAt,
        reviewReasons: finding.reviewReasons.map(publicTiText),
        extractionMethod: finding.extractionMethod,
        extractorVersion: finding.extractorVersion,
        contentHash: finding.contentHash,
        publishedAt: finding.publishedAt,
        collectedAt: finding.collectedAt,
        url: safePublicTiUrl(finding.url),
        excerpt: publicEvidenceText(finding.excerpt),
    }
}

function sanitizeActionability(actionability?: TiActionabilityContract): TiActionabilityContract | undefined {
    if (!actionability) return undefined

    return {
        schemaVersion: actionability.schemaVersion,
        alertDisposition: actionability.alertDisposition,
        shouldAlert: actionability.shouldAlert,
        rationale: actionability.rationale ? publicTiText(actionability.rationale) : undefined,
        watchlistCandidates: actionability.watchlistCandidates?.map(candidate => ({
            kind: candidate.kind,
            value: candidate.value,
            reason: publicTiText(candidate.reason),
            confidence: candidate.confidence
        })),
        watchlistMatches: actionability.watchlistMatches?.map(match => ({
            tenantId: match.tenantId,
            organizationId: match.organizationId,
            watchlistId: match.watchlistId,
            watchlistItemId: match.watchlistItemId,
            kind: match.kind,
            value: match.value,
            route: match.route,
            casePath: match.casePath
        })),
        relatedAlerts: actionability.relatedAlerts?.map(alert => ({
            id: alert.id,
            title: publicTiText(alert.title),
            status: alert.status,
            severity: alert.severity,
            caseIdCandidate: alert.caseIdCandidate,
            casePath: alert.casePath,
            source: alert.source ? publicTiText(alert.source) : undefined,
            tenantId: alert.tenantId,
            organizationId: alert.organizationId,
            dedupeKey: alert.dedupeKey,
            recommendedRoute: alert.recommendedRoute,
            captureIds: alert.captureIds,
            evidenceCount: alert.evidenceCount,
            webhookDestinationIds: alert.webhookDestinationIds,
            deliveryReadinessContext: alert.deliveryReadinessContext
        })),
        relatedCases: actionability.relatedCases?.map(item => ({
            id: item.id,
            title: publicTiText(item.title),
            status: item.status,
            priority: item.priority,
            path: item.path
        })),
        relatedWebhookDestinations: actionability.relatedWebhookDestinations?.map(destination => ({
            id: destination.id,
            name: publicTiText(destination.name),
            status: destination.status,
            path: destination.path
        })),
        sourceProvenance: actionability.sourceProvenance?.map(source => ({
            sourceId: source.sourceId,
            sourceName: publicTiText(source.sourceName),
            provenance: publicTiText(source.provenance),
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            reportDate: source.reportDate,
            lastCollectedAt: source.lastCollectedAt,
            confidence: source.confidence
        })),
        enrichmentGaps: actionability.enrichmentGaps?.map(gap => ({
            id: gap.id,
            title: publicTiText(gap.title),
            severity: gap.severity,
            detail: publicTiText(gap.detail),
            dependency: publicTiText(gap.dependency),
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            requestedFields: gap.requestedFields
        })),
        handoffs: actionability.handoffs,
        entitlementReadiness: actionability.entitlementReadiness
    }
}

function publicTiText(value: string) {
    return publicEvidenceText(publicBackendCopyText(value)
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-status/gi, 'Check organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/:id\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/:id\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/dwm\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/api\/dwm\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/dwm\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/dwm\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/cases\/:caseId\/action-replay-export/gi, 'case action replay')
        .replace(/\/v1\/dwm\/alerts\/rebuild/gi, 'alert rebuild')
        .replace(/\/v1\/dwm\/watchlists/gi, 'watchlist update')
        .replace(/\/v1\/dwm\/webhooks\/deliver/gi, 'webhook delivery')
        .replace(/\/v1\/cases/gi, 'case workflow')
        .replace(/\bproof\b/gi, 'evidence')
        .replace(/\breadiness\b/gi, 'status')
        .replace(/\bactionability\b/gi, 'workflow status')
        .replace(/\breceipt\b/gi, 'record')
        .replace(new RegExp('\\bcon' + 'tract\\b', 'gi'), 'schema')
        .replace(/\bnamed\s+examples\b/gi, 'reported activity')
        .replace(/\btarget\s+signal(s)?\b/gi, 'targeting indicator$1')
        .replace(/\bsignal(s)?\b/gi, 'indicator$1')
        .replace(/\bcontrol\s+room\b/gi, 'console')
        .replace(/\bdashboard\s+slop\b/gi, 'low-value summary')
        .replace(/\bacceptance\s+criteria\b/gi, 'requirements')
        .replace(/\bteasers\b/gi, 'summaries')
        .replace(/\bteaser\b/gi, 'summary')
        .replace(/\bprovenance\b/gi, 'source context')
        .replace(/\bmetadata capture\b/gi, 'watched source monitoring')
        .replace(/\bmetadata-first\b/gi, 'company-first')
        .replace(/\bexposure metadata\b/gi, 'exposure records')
        .replace(/\bcredential-exposure metadata\b/gi, 'credential-exposure records')
        .replace(/\bcaptured metadata\b/gi, 'captured page text')
        .replace(/\bcollected as metadata\b/gi, 'collected as reviewable records'))
}

function sanitizeBackendShapedPublicText<T>(value: T, field?: string): T {
    if (typeof value === 'string') {
        if (field && PUBLIC_URL_FIELDS.has(field.toLowerCase())) return safePublicTiUrl(value) as T
        return publicContactText(publicBackendCopyText(value)) as T
    }
    if (Array.isArray(value)) return value.map(item => sanitizeBackendShapedPublicText(item, field)) as T
    if (!value || typeof value !== 'object') return value

    return Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) => {
            if (INTERNAL_REVIEW_FIELDS.has(key.toLowerCase())) return []
            if (PUBLIC_URL_FIELDS.has(key.toLowerCase()) && typeof item === 'string') {
                const url = safePublicTiUrl(item)
                return url ? [[key, url]] : []
            }
            return [[key, sanitizeBackendShapedPublicText(item, key)]]
        }),
    ) as T
}

function publicEvidenceText(value: string) {
    return publicContactText(value)
}

function publicContactText(value: string) {
    return value
        .replace(/(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/[^\s"'<>]+|\btg:(?:\/\/)?[^\s"'<>]+/gi, '[telegram contact removed]')
        .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, url => safePublicTiUrl(url) ?? '[external reference removed]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(/(^|\s)@[A-Za-z0-9_]{4,}\b/g, '$1[handle]')
        .replace(/(?<![A-Za-z0-9.-])(?<![\d-])(?!\d{4}-\d{2}-\d{2}(?:T|\b))(?!\d{1,3}(?:\.\d{1,3}){3}\b)\+?\d[\d\s().-]{7,}\d/g, '[phone]')
}

function safePublicTiUrl(value?: string) {
    if (!value) return undefined
    try {
        const parsed = new URL(value)
        const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
        if (
            !['http:', 'https:'].includes(parsed.protocol)
            || parsed.username
            || parsed.password
            || privatePublicHost(host)
            || /^(?:t\.me|telegram\.me|telegram\.dog)$/.test(host)
            || /\.onion$/.test(host)
            || [...parsed.searchParams.keys()].some(key => /(?:token|secret|password|authorization|cookie|api[_-]?key|signature)/i.test(key))
        ) return undefined
        return parsed.toString()
    } catch {
        return undefined
    }
}

function privatePublicHost(host: string) {
    if (!host.includes('.') && !host.includes(':')) return true
    if (host === 'localhost' || /\.(?:local|internal)$/.test(host)) return true
    if (host.includes(':')) return host === '::' || host === '::1' || /^0(?::0){6}:[01]$|(?:^|:)ffff:|^f[cd]|^fe[89ab]|^2001:db8:/i.test(host)
    if (!/^\d+(?:\.\d+){3}$/.test(host)) return false
    const octets = host.split('.').map(Number)
    if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true
    const [a, b] = octets
    return a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && (b === 0 || b === 168))
        || (a === 198 && (b === 18 || b === 19 || (b === 51 && octets[2] === 100)))
        || (a === 203 && b === 0 && octets[2] === 113)
}

const INTERNAL_REVIEW_FIELDS = new Set(['reviewedby', 'reviewerid', 'revieweremail'])
const PUBLIC_URL_FIELDS = new Set(['url', 'href', 'sourceurl', 'targeturl', 'messageurl'])

function publicBackendCopyText(value: string) {
    return value
        .replace(/\bWhat returned\b/gi, 'Source summary')
        .replace(/\bReturned as evidence\b/gi, 'Included as evidence')
        .replace(/\breturned actor profile\b/gi, 'sourced actor profile')
        .replace(/\breturned profile\b/gi, 'actor profile')
        .replace(/\breturned observations\b/gi, 'source observations')
        .replace(/\breturned ATT&CK\b/gi, 'mapped ATT&CK')
        .replace(/\bwas returned\b/gi, 'was found')
        .replace(/\bwere returned\b/gi, 'were found')
        .replace(/\breturned\b/gi, 'reported')
}
