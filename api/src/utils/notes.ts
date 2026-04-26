export type NoteBody = {
    title?: string
    content?: string
    source?: string
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function hasField(body: NoteBody | undefined, key: keyof NoteBody) {
    return Object.prototype.hasOwnProperty.call(body ?? {}, key)
}

export function buildNoteUpdateFields(body: NoteBody | undefined) {
    const title = clean(body?.title)
    const content = clean(body?.content)
    const source = clean(body?.source)
    const hasTitle = hasField(body, 'title')
    const hasContent = hasField(body, 'content')
    const hasSource = hasField(body, 'source')

    if (!hasTitle && !hasContent && !hasSource) {
        return null
    }

    const fields: string[] = []
    const values: string[] = []

    if (hasTitle) {
        values.push(title || 'Untitled')
        fields.push(`title = $${values.length}`)
    }
    if (hasContent) {
        values.push(content)
        fields.push(`content = $${values.length}`)
    }
    if (hasSource) {
        values.push(source || 'api')
        fields.push(`source = $${values.length}`)
    }

    return { fields, values }
}
