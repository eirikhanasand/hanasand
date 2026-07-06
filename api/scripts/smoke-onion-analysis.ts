import { extractIndicators, extractThreatAssociations } from '../src/handlers/onionSession/analysis.ts'

function assert(value: boolean, message: string) {
    if (!value) throw new Error(message)
}

const indicators = extractIndicators('https://payload.example/a document.createElement object.assign el.style 203.0.113.10')

assert(indicators.urls.includes('https://payload.example/a'), 'keeps real URLs')
assert(indicators.ips.includes('203.0.113.10'), 'keeps real IPs')
assert(!indicators.domains.includes('document.createelement'), 'filters DOM API pseudo-domains')
assert(!indicators.domains.includes('object.assign'), 'filters JS API pseudo-domains')
assert(!indicators.domains.includes('el.style'), 'filters element pseudo-domains')
assert(extractThreatAssociations('Vidar (26) woke up with a new name.', 'rendered_page').length === 0, 'ignores bare rendered-page name mentions')
assert(extractThreatAssociations('Security vendors detected Vidar malware family activity.', 'tool_context').some(item => item.name === 'Vidar'), 'keeps sourced security context')
