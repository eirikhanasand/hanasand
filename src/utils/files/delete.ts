import config from '@/config'

/**
 * Deletes a file by ID
 * @param id - The ID of the file to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFile(id: string): Promise<boolean> {
    if (!id) return false

    try {
        const res = await fetch(`${config.url.cdn}/file/${id}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            console.error('Failed to delete file', await res.text())
            return false
        }

        const json = await res.json()
        return Boolean(json.deleted)
    } catch (err) {
        console.error('Error deleting file:', err)
        return false
    }
}
