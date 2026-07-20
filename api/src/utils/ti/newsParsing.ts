import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'
import type { TiActivity } from './search.ts'

export interface LiveSearchMatch {
    id: string
    title: string
    url: string
    snippet: string
    publishedAt?: string
    publisher?: string
    kind: 'news' | 'web' | 'background'
}

interface LiveClaimCluster {
    matches: LiveSearchMatch[]
    tokens: Set<string>
}

const STOP_WORDS = new Set(['about', 'after', 'against', 'attack', 'attacks', 'campaign', 'claims', 'cyber', 'from', 'group', 'hacker', 'hackers', 'linked', 'malware', 'new', 'report', 'reports', 'says', 'threat', 'using', 'with'])

export function buildActorSearchExpression(query: string, aliases: string[] = []): string {
    return unique([query, ...aliases]).slice(0, 4).map(term => `"${term.replace(/"/g, '')}"`).join(' OR ')
}

export function parseGoogleNewsRss(xml: string): LiveSearchMatch[] {
    try {
        const body = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml) as { rss?: { channel?: { item?: GoogleNewsItem | GoogleNewsItem[] } } }
        const raw = body.rss?.channel?.item
        const items = Array.isArray(raw) ? raw : raw ? [raw] : []
        return items.map((item): LiveSearchMatch | null => {
            const title = text(item.title)
            const url = text(item.link)
            const publishedAt = published(item.pubDate)
            if (!title || !url || !publishedAt) return null
            return { id: `live:${hash(`${title}:${url}`)}`, title, url, snippet: clean(text(item.description) ?? ''), publishedAt, publisher: sourceName(item.source), kind: 'news' }
        }).filter((item): item is LiveSearchMatch => Boolean(item))
            .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!)).slice(0, 8)
    } catch {
        return []
    }
}

export function clusterLiveNews(query: string, matches: LiveSearchMatch[]): TiActivity[] {
    const sorted = matches.filter(match => match.kind === 'news' && match.publishedAt)
        .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
    const queryTokens = new Set(normalize(query).split(/\s+/).filter(Boolean))
    const clusters: LiveClaimCluster[] = []
    for (const match of sorted) {
        const tokens = claimTokens(match.title, queryTokens)
        const at = Date.parse(match.publishedAt!)
        const cluster = clusters.find(candidate => Math.abs(at - Date.parse(candidate.matches[0]!.publishedAt!)) <= 259_200_000 && similarity(tokens, candidate.tokens) >= 0.5)
        if (!cluster) clusters.push({ matches: [match], tokens })
        else {
            cluster.matches.push(match)
            for (const token of tokens) cluster.tokens.add(token)
        }
    }
    return clusters.map((cluster, index) => activity(query, cluster.matches, index))
        .sort((a, b) => Date.parse(b.lastReportedAt ?? b.date) - Date.parse(a.lastReportedAt ?? a.date))
}

function activity(query: string, matches: LiveSearchMatch[], index: number): TiActivity {
    const ordered = [...matches].sort((a, b) => Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!))
    const first = ordered[0]!
    const latest = ordered.at(-1)!
    const publishers = unique(matches.map(match => match.publisher).filter((value): value is string => Boolean(value)))
    const sourceIds = unique(matches.map(match => match.id))
    const combined = matches.map(match => `${match.title} ${match.snippet}`).join(' ')
    const victimName = inferVictim(query, matches)
    return {
        date: latest.publishedAt!.slice(0, 10),
        title: stripPublisher(latest.title, latest.publisher),
        detail: detail(latest, publishers),
        confidence: Math.min(0.86, Math.max(0.4, 0.64 - index * 0.04 + Math.min(0.18, (publishers.length - 1) * 0.06))),
        sourceIds,
        url: safeUrl(latest.url),
        claimType: claimType(combined),
        victimName,
        countries: countries(combined),
        impact: impact(combined),
        firstReportedAt: first.publishedAt,
        lastReportedAt: latest.publishedAt,
        publisherCount: publishers.length,
        corroboratingSourceIds: sourceIds.length > 1 ? sourceIds : [],
        contradictingSourceIds: [],
    }
}

function claimTokens(title: string, queryTokens: Set<string>) {
    return new Set(normalize(stripPublisher(title)).split(/\s+/).filter(token => token.length >= 4 && !queryTokens.has(token) && !STOP_WORDS.has(token)))
}

function similarity(left: Set<string>, right: Set<string>) {
    if (left.size < 2 || right.size < 2) return 0
    let common = 0
    for (const token of left) if (right.has(token)) common += 1
    return common / Math.min(left.size, right.size)
}

function detail(latest: LiveSearchMatch, publishers: string[]) {
    const title = normalize(stripPublisher(latest.title, latest.publisher))
    const candidate = truncate(latest.snippet, 240)
    const normalized = normalize(candidate)
    const snippet = normalized === title || normalized.startsWith(`${title} `) ? '' : candidate
    const coverage = publishers.length > 1 ? `Reported by ${publishers.length} publishers: ${publishers.slice(0, 4).join(', ')}.` : publishers[0] ? `Reported by ${publishers[0]}.` : 'Reported by one public source.'
    return snippet ? `${snippet} ${coverage}` : coverage
}

function inferVictim(query: string, matches: LiveSearchMatch[]) {
    for (const match of matches) {
        const title = stripPublisher(match.title, match.publisher)
        if (/\b(?:arrest|charged?|indict|pleads?\s+guilty|sentenced?|suspect|defendant|court|prosecutors?)\b/i.test(title)) continue
        for (const pattern of [/\b(?:targets?|targeted|hits?|hit|breaches?|breached|attacks?|attacked)\s+([A-Z][A-Za-z0-9&.' -]{2,60}?)(?:\s+(?:with|using|in|after|through|via)\b|[:,]|$)/, /\b([A-Z][A-Za-z0-9&.' -]{2,60}?)\s+(?:breach|attack|incident|hack)\b/]) {
            const candidate = title.match(pattern)?.[1]?.trim()
            if (candidate && likelyVictim(candidate, query)) return candidate
        }
    }
}

function likelyVictim(candidate: string, query: string) {
    const value = normalize(candidate)
    return Boolean(value && value !== normalize(query) && !/\b(?:man|woman|teen|hacker|suspect|defendant|member|conspirator|person|individual|group|crew|gang|actor|pleads?|guilty|charged?|arrested|sentenced|indicted)\b/.test(value))
}

function claimType(value: string): TiActivity['claimType'] {
    const text = value.toLowerCase()
    if (/\b(?:victim|breach|leak site|data leak|extortion)\b/.test(text)) return 'victim_claim'
    if (/\b(?:cve-\d{4}-\d+|zero-day|vulnerabilit|exploit)\b/.test(text)) return 'vulnerability_exploitation'
    if (/\b(?:botnet|command and control|c2|infrastructure|server|router)\b/.test(text)) return 'infrastructure_activity'
    if (/\b(?:malware|backdoor|trojan|ransomware|implant)\b/.test(text)) return 'malware_activity'
    if (/\b(?:operation|campaign|espionage|targeting)\b/.test(text)) return 'campaign'
    return 'general_activity'
}

function countries(value: string) {
    const known: Array<[RegExp, string]> = [[/\b(?:united states|u\.s\.|american)\b/i, 'United States'], [/\b(?:united kingdom|u\.k\.|british)\b/i, 'United Kingdom'], [/\b(?:ukraine|ukrainian)\b/i, 'Ukraine'], [/\b(?:germany|german)\b/i, 'Germany'], [/\b(?:france|french)\b/i, 'France'], [/\b(?:japan|japanese)\b/i, 'Japan'], [/\b(?:south korea|korean)\b/i, 'South Korea']]
    const result = known.filter(([pattern]) => pattern.test(value)).map(([, country]) => country)
    return result.length ? result : undefined
}

function impact(value: string) {
    const text = value.toLowerCase()
    if (/\b(?:data theft|stolen data|exfiltrat|data leak)\b/.test(text)) return 'Reported data theft or disclosure'
    if (/\b(?:ransomware|encrypt|extortion)\b/.test(text)) return 'Reported ransomware or extortion impact'
    if (/\b(?:account takeover|credential theft|stolen credentials)\b/.test(text)) return 'Reported credential or account compromise'
    if (/\b(?:disruption|outage|offline)\b/.test(text)) return 'Reported service disruption'
}

interface GoogleNewsItem { title?: unknown; link?: unknown; description?: unknown; pubDate?: unknown; source?: unknown }
function text(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : undefined }
function published(value: unknown) { const at = Date.parse(String(value ?? '')); return Number.isFinite(at) ? new Date(at).toISOString() : undefined }
function sourceName(value: unknown) { return typeof value === 'string' ? value : value && typeof value === 'object' ? text((value as Record<string, unknown>)['#text']) : undefined }
function stripPublisher(title: string, publisher?: string) { return publisher ? title.replace(new RegExp(`\\s+-\\s+${escapeRegExp(publisher)}$`, 'i'), '').trim() : title.replace(/\s+-\s+[^-]{2,60}$/, '').trim() }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function truncate(value: string, max: number) { const clean = value.replace(/\s+/g, ' ').trim(); return clean.length <= max ? clean : `${clean.slice(0, max - 3).trimEnd()}...` }
function clean(value: string) { return decode(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }
function decode(value: string) { return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#x27;|&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>') }
function unique(values: string[]) { return [...new Set(values.map(value => value.trim()).filter(Boolean))] }
function hash(value: string) { return createHash('sha256').update(value).digest('hex').slice(0, 16) }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function safeUrl(value: string) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined } catch { return undefined } }
