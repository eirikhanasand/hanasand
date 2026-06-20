import { buildActorSearchExpression, clusterLiveNews, parseGoogleNewsRss } from '../src/utils/ti/search.ts'

const xml = `<?xml version="1.0"?>
<rss><channel><item>
  <title>APT29 targets cloud accounts - Security Vendor</title>
  <link>https://example.com/report</link>
  <description><![CDATA[<b>APT29</b>&nbsp;campaign details.]]></description>
  <pubDate>Fri, 20 Jun 2026 08:30:00 GMT</pubDate>
  <source url="https://example.com">Security Vendor</source>
</item></channel></rss>`

const [item] = parseGoogleNewsRss(xml)
if (!item) throw new Error('Expected one parsed news item')
if (item.kind !== 'news') throw new Error(`Expected news kind, got ${item.kind}`)
if (item.publishedAt !== '2026-06-20T08:30:00.000Z') throw new Error(`Unexpected publication time: ${item.publishedAt}`)
if (item.publisher !== 'Security Vendor') throw new Error(`Unexpected publisher: ${item.publisher}`)
if (item.snippet !== 'APT29 campaign details.') throw new Error(`Unexpected snippet: ${item.snippet}`)

const [undated] = parseGoogleNewsRss('<rss><channel><item><title>Undated</title><link>https://example.com</link></item></channel></rss>')
if (undated) throw new Error('Undated items must not become activity evidence')

const ordered = parseGoogleNewsRss(`<rss><channel>
<item><title>Older</title><link>https://example.com/older</link><pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate></item>
<item><title>Newer</title><link>https://example.com/newer</link><pubDate>Fri, 20 Jun 2026 08:30:00 GMT</pubDate></item>
</channel></rss>`)
if (ordered[0]?.title !== 'Newer') throw new Error('News items must be newest first')

const clustered = clusterLiveNews('APT29', [
    {
        id: 'source:a',
        title: 'APT29 targets Microsoft cloud tenants with phishing - Vendor A',
        url: 'https://example.com/a',
        snippet: 'APT29 used phishing against Microsoft cloud tenants.',
        publishedAt: '2026-06-20T08:30:00.000Z',
        publisher: 'Vendor A',
        kind: 'news'
    },
    {
        id: 'source:b',
        title: 'APT29 phishing campaign targets Microsoft cloud tenants - Vendor B',
        url: 'https://example.com/b',
        snippet: 'A second report covers the same phishing campaign.',
        publishedAt: '2026-06-19T14:00:00.000Z',
        publisher: 'Vendor B',
        kind: 'news'
    },
    {
        id: 'source:c',
        title: 'APT29 exploits routers in Ukraine - Vendor C',
        url: 'https://example.com/c',
        snippet: 'A separate infrastructure report.',
        publishedAt: '2026-06-20T07:00:00.000Z',
        publisher: 'Vendor C',
        kind: 'news'
    }
])
if (clustered.length !== 2) throw new Error(`Expected two incident clusters, got ${clustered.length}`)
const corroborated = clustered.find(activity => activity.publisherCount === 2)
if (!corroborated) throw new Error('Expected a two-publisher claim cluster')
if (corroborated.sourceIds.length !== 2 || corroborated.corroboratingSourceIds?.length !== 2) {
    throw new Error('Corroborated cluster must retain both source ids')
}
if (corroborated.firstReportedAt !== '2026-06-19T14:00:00.000Z' || corroborated.lastReportedAt !== '2026-06-20T08:30:00.000Z') {
    throw new Error('Claim cluster reporting window is incorrect')
}
if (!corroborated.detail.includes('Reported by 2 publishers: Vendor A, Vendor B.')) {
    throw new Error(`Claim cluster detail must name corroborating publishers: ${corroborated.detail}`)
}
if (corroborated.detail.startsWith(corroborated.title)) {
    throw new Error('Claim cluster detail must not repeat the headline')
}

const legalActivity = clusterLiveNews('Scattered Spider', [
    {
        id: 'source:d',
        title: 'Scottish man pleads guilty to attack spree that created Scattered Spider notoriety - Vendor D',
        url: 'https://example.com/d',
        snippet: 'Court reporting about a defendant, not a victim organization.',
        publishedAt: '2026-06-20T08:00:00.000Z',
        publisher: 'Vendor D',
        kind: 'news'
    }
])
if (legalActivity.some(activity => activity.victimName)) {
    throw new Error('Legal-proceeding headlines must not be promoted as victim names')
}

const aliasQuery = buildActorSearchExpression('Scattered Spider', ['UNC3944', 'Octo Tempest', '0ktapus', 'extra alias'])
if (aliasQuery !== '"Scattered Spider" OR "UNC3944" OR "Octo Tempest" OR "0ktapus"') {
    throw new Error(`Unexpected alias-aware search query: ${aliasQuery}`)
}

console.log('TI news feed parsing passed')
