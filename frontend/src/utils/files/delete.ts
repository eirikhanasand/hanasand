import config from '@/config'

/**
 * Deletes a file by ID
 * @param id - The ID of the file to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFile(id: string): Promise<boolean> {
    if (!id) return false

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.cdn}/files/${id}`, {
            method: 'DELETE',
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            console.error('Failed to delete file', await response.text())
            return false
        }

        const json = await response.json()
        return Boolean(json.deleted)
    } catch (error) {
        console.error(`Error deleting file: ${error}`)
        return false
    }
}
