import { mkdir, writeFile } from 'node:fs/promises'
import { publicTiOpenApi } from '../src/contracts/publicTiOpenApi.ts'

await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/openapi.json', import.meta.url), `${JSON.stringify(publicTiOpenApi, null, 2)}\n`)
