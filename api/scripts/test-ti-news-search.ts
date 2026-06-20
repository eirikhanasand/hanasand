import { parseGoogleNewsRss } from '../src/utils/ti/search.ts'

const xml = `<?xml version="1.0"?>
<rss><channel><item>
  <title>APT29 targets cloud accounts - Security Vendor</title>
  <link>https://example.com/report</link>
  <description><![CDATA[<b>APT29</b> campaign details.]]></description>
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

console.log('TI news feed parsing passed')
