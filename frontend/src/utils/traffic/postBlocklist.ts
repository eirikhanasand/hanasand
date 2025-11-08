import config from '@/config'

export default async function postBlocklist(editingBlock: BlocklistEntry | null, form: Partial<BlocklistEntry>) {
    try {
        const endpoint = editingBlock
            ? `${config.url.cdn}/blocklist/${editingBlock.id}`
            : `${config.url.cdn}/blocklist`
        const method = editingBlock ? 'PUT' : 'POST'
        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        })
        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return { error }
    }
}
