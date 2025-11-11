import { staticMappings } from './staticMappings'

export default function interpretQuery(query: string) {
    const normalized = query.toLowerCase().trim()

    const staticResults = staticMappings
        .filter(mapping => mapping.match.some(keyword => normalized.includes(keyword)))
        .map(mapping => mapping.action(query))

    const dynamicResult = { action: 'dynamic', text: query }

    return [...staticResults, dynamicResult]
}
