// Keep legacy runtime contracts intact while publishing the current API reference.
export function currentOpenApi<T>(document: T): T {
    function target(reference: string): unknown {
        if (!reference.startsWith('#/')) return undefined
        return reference.slice(2).split('/').reduce<unknown>((value, key) => value && typeof value === 'object'
            ? (value as Record<string, unknown>)[key.replace(/~1/g, '/').replace(/~0/g, '~')]
            : undefined, document)
    }
    function deprecated(value: unknown): boolean {
        return !!value && typeof value === 'object' && (value as Record<string, unknown>).deprecated === true
    }
    function visit(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(visit).filter(item => item !== undefined)
        if (!value || typeof value !== 'object') return value
        const node = value as Record<string, unknown>
        if (deprecated(node) || (typeof node.$ref === 'string' && deprecated(target(node.$ref)))) return undefined
        const result: Record<string, unknown> = Object.fromEntries(Object.entries(node).map(([key, child]) => [key, visit(child)]).filter(([, child]) => child !== undefined))
        if (node.properties && result.properties && Array.isArray(result.required)) {
            const properties = result.properties as Record<string, unknown>
            const required = result.required.filter((name: unknown) => typeof name === 'string' && Object.hasOwn(properties, name))
            if (required.length) result.required = required
            else delete result.required
        }
        return result
    }
    return visit(document) as T
}
