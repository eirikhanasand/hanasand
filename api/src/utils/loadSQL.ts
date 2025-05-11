import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * Loads an SQL query from a SQL file located in the `src/queries` folder.
 * 
 * @param file Name of the file, including the `.sql` suffix.
 * 
 * @returns The file content as a `string`
 */
export async function loadSQL(file: string) {
    const filePath = join(process.cwd(), 'src/queries', file)
    return readFile(filePath, 'utf-8')
}
