import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireAiUser } from './shared.ts'

export default async function postAiRepository(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const repo = req.body as AIImportedRepo | null
    if (!repo?.id || !repo.fullName || !Array.isArray(repo.files)) {
        return res.status(400).send({ error: 'Invalid repository payload.' })
    }

    await run(`
        INSERT INTO ai_imported_repositories (
            id, owner_id, name, full_name, branch, default_branch, source_path, source_url,
            sync_status, last_synced_at, last_sync_error, sync_history, truncated, imported_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
        ON CONFLICT (id)
        DO UPDATE SET
            name = EXCLUDED.name,
            full_name = EXCLUDED.full_name,
            branch = EXCLUDED.branch,
            default_branch = EXCLUDED.default_branch,
            source_path = EXCLUDED.source_path,
            source_url = EXCLUDED.source_url,
            sync_status = EXCLUDED.sync_status,
            last_synced_at = EXCLUDED.last_synced_at,
            last_sync_error = EXCLUDED.last_sync_error,
            sync_history = EXCLUDED.sync_history,
            truncated = EXCLUDED.truncated,
            imported_at = EXCLUDED.imported_at
    `, [
        repo.id,
        userId,
        repo.name,
        repo.fullName,
        repo.branch,
        repo.defaultBranch || repo.branch,
        repo.sourcePath || '',
        repo.sourceUrl,
        repo.syncStatus || 'ready',
        repo.lastSyncedAt,
        repo.lastSyncError,
        JSON.stringify(Array.isArray(repo.syncHistory) ? repo.syncHistory.slice(0, 12) : []),
        Boolean(repo.truncated),
        repo.importedAt,
    ])

    await run(`DELETE FROM ai_imported_repository_files WHERE repository_id = $1`, [repo.id])

    for (const file of repo.files) {
        await run(`
            INSERT INTO ai_imported_repository_files (repository_id, path, name, content)
            VALUES ($1, $2, $3, $4)
        `, [repo.id, file.path, file.name, file.content])
    }

    return res.status(201).send({ ok: true, id: repo.id })
}
