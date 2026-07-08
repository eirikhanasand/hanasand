import { suggestRoutes } from '../src/utils/routes/routeSuggestions'

const suggestion = suggestRoutes('/solutions/browsee')

if (suggestion[0] !== '/solutions/browser') {
    throw new Error(`Expected /solutions/browser, got ${suggestion.join(', ')}`)
}

if (suggestion.length > 3) {
    throw new Error(`Expected at most three suggestions, got ${suggestion.length}`)
}

console.log('route suggestions ok')
