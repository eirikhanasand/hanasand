import { suggestRoutes } from '../src/utils/routes/routeSuggestions'

const suggestion = suggestRoutes('/browsee')

if (suggestion[0] !== '/browser') {
    throw new Error(`Expected /browser, got ${suggestion.join(', ')}`)
}

if (suggestion.length > 3) {
    throw new Error(`Expected at most three suggestions, got ${suggestion.length}`)
}

console.log('route suggestions ok')
