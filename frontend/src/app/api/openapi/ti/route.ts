import { NextResponse } from 'next/server'

const errorSchema = {
    type: 'object',
    required: ['error'],
    properties: {
        error: { type: 'string' },
        message: { type: 'string' },
    },
}

const sourceSchema = {
    type: 'object',
    required: ['id', 'name', 'type', 'provenance'],
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string' },
        provenance: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        captureId: { type: 'string' },
        sourceRequestId: { type: 'string' },
        sourceFamily: { type: 'string' },
        parserStatus: { type: 'string' },
        reportDate: { type: 'string' },
        lastCollectedAt: { type: 'string' },
    },
}

const searchSchema = {
    type: 'object',
    required: ['query', 'queryKind', 'generatedAt', 'mode', 'status', 'summary', 'confidence', 'lastSeen', 'aliases', 'recentActivity', 'targets', 'ttps', 'datasets', 'sources', 'notes', 'actionability'],
    properties: {
        query: { type: 'string' },
        queryKind: { type: 'string', enum: ['actor', 'domain', 'cve', 'indicator', 'organization', 'free_text'] },
        generatedAt: { type: 'string', format: 'date-time' },
        mode: { type: 'string', enum: ['scraper', 'seeded', 'live_search'] },
        status: { type: 'string', enum: ['ready', 'partial', 'searching'] },
        summary: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        lastSeen: { type: 'string' },
        aliases: { type: 'array', items: { type: 'string' } },
        sources: { type: 'array', items: sourceSchema },
        recentActivity: {
            type: 'array',
            items: {
                type: 'object',
                required: ['date', 'title', 'detail', 'confidence', 'sourceIds'],
                properties: {
                    date: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 }, sourceIds: { type: 'array', items: { type: 'string' } },
                    url: { type: 'string', format: 'uri' }, claimType: { type: 'string' }, victimName: { type: 'string' },
                    affectedSectors: { type: 'array', items: { type: 'string' } }, countries: { type: 'array', items: { type: 'string' } }, impact: { type: 'string' },
                },
            },
        },
        targets: { type: 'array', items: { type: 'object', required: ['sector', 'regions', 'rationale', 'confidence'], properties: { sector: { type: 'string' }, regions: { type: 'array', items: { type: 'string' } }, rationale: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
        ttps: { type: 'array', items: { type: 'object', required: ['name', 'tactic', 'detail', 'confidence'], properties: { name: { type: 'string' }, attackId: { type: 'string' }, tactic: { type: 'string' }, detail: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
        datasets: { type: 'array', items: { type: 'object', required: ['name', 'type', 'coverage', 'status'], properties: { name: { type: 'string' }, type: { type: 'string' }, coverage: { type: 'string' }, status: { type: 'string' }, url: { type: 'string', format: 'uri' } } } },
        actionability: { type: 'object', required: ['schemaVersion', 'alertDisposition', 'shouldAlert', 'rationale'], properties: { schemaVersion: { type: 'string', const: 'ti.query.actionability.v1' }, alertDisposition: { type: 'string' }, shouldAlert: { type: 'boolean' }, rationale: { type: 'string' }, watchlistCandidates: { type: 'array', items: { type: 'object' } } } },
        notes: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: true,
}

const searchRequest = {
    required: true,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                required: ['query'],
                properties: { query: { type: 'string', minLength: 2, maxLength: 200 } },
                additionalProperties: false,
            },
        },
    },
}

const responses = {
    '200': { description: 'Evidence-aware search result.', content: { 'application/json': { schema: searchSchema } } },
    '400': { description: 'Invalid request.', content: { 'application/json': { schema: errorSchema } } },
    '401': { description: 'Missing or invalid API key.', content: { 'application/json': { schema: errorSchema } } },
    '403': { description: 'API key scope does not allow the route.', content: { 'application/json': { schema: errorSchema } } },
    '429': { description: 'Rate limit exceeded.', content: { 'application/json': { schema: errorSchema } } },
    '502': { description: 'Search service unavailable.', content: { 'application/json': { schema: errorSchema } } },
}

const batchSuccessResponse = {
    description: 'Ordered search results.',
    content: {
        'application/json': {
            schema: {
                type: 'object',
                required: ['generatedAt', 'count', 'results'],
                properties: {
                    generatedAt: { type: 'string', format: 'date-time' },
                    count: { type: 'integer' },
                    results: { type: 'array', items: searchSchema },
                },
            },
        },
    },
}

export function GET() {
    return NextResponse.json({
        openapi: '3.1.0',
        info: { title: 'Hanasand Threat Intelligence API', version: '1.0.0' },
        servers: [{ url: 'https://hanasand.com/api' }],
        security: [{ ApiKey: [] }],
        paths: {
            '/ti/search': { post: { summary: 'Search threat intelligence', operationId: 'searchThreatIntelligence', requestBody: searchRequest, responses } },
            '/ti/search/batch': {
                post: {
                    summary: 'Search up to 25 unique queries',
                    operationId: 'batchSearchThreatIntelligence',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['queries'], properties: { queries: { type: 'array', minItems: 1, maxItems: 25, items: { type: 'string', minLength: 2, maxLength: 200 } } }, additionalProperties: false } } },
                    },
                    responses: { ...responses, '200': batchSuccessResponse },
                },
            },
        },
        components: { securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } },
    }, { headers: { 'cache-control': 'no-store' } })
}
