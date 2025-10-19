import { access, constants } from 'fs/promises'

export default async function fileExists(filePath: string) {
    try {
        await access(filePath, constants.W_OK)
        return true
    } catch {
        return false
    }
}
