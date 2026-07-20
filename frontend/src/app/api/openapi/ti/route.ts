import { NextResponse } from 'next/server'

const errorSchema = {
    type: 'object',
    required: ['error'],
    properties: {
        error: { type: 'string' },
        message: { type: 'string' },
    },
}

const searchSchema = {
    type: 'object',
    required: ['query', 'generatedAt', 'status', 'summary', 'confidence', 'sources'],
    properties: {
        query: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['ready', 'partial', 'searching', 'review_required'] },
        summary: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        sources: { type: 'array', items: { type: 'object' } },
        recentActivity: { type: 'array', items: { type: 'object' } },
        actionability: { type: 'object' },
        notes: { type: 'array', items: { type: 'string' } },
    },
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
