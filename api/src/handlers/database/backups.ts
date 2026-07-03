import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import {
    BackupOperationError,
    collectDatabaseBackupServices,
    createDatabaseBackup,
    listDatabaseBackupFiles,
    restoreDatabaseBackupFile,
    sanitizeBackupError,
} from '#utils/db/backups.ts'

type BackupFilesQuery = {
    service?: string
    date?: string
}

type RestoreBody = {
    file?: string
}

export async function getDatabaseBackups(req: FastifyRequest, res: FastifyReply) {
    if (!await requireBackupAccess(req, res)) return

    try {
        return res.send(await collectDatabaseBackupServices())
    } catch (error) {
        req.log.error(error)
        return res.status(503).send({ message: sanitizeBackupError(error) })
    }
}

export async function postDatabaseBackup(req: FastifyRequest, res: FastifyReply) {
    if (!await requireBackupAccess(req, res)) return

    try {
        const backup = await createDatabaseBackup()
        return res.send({ message: `Backup completed: ${backup.file} (${backup.size}, ${backup.duration}).` })
    } catch (error) {
        req.log.error(error)
        const statusCode = error instanceof BackupOperationError ? error.statusCode : 503
        return res.status(statusCode).send({ message: sanitizeBackupError(error) })
    }
}

export async function getDatabaseBackupFiles(req: FastifyRequest<{ Querystring: BackupFilesQuery }>, res: FastifyReply) {
    if (!await requireBackupAccess(req, res)) return

    try {
        return res.send(await listDatabaseBackupFiles(req.query.service, req.query.date))
    } catch (error) {
        req.log.error(error)
        return res.status(503).send({ message: sanitizeBackupError(error) })
    }
}

export async function postDatabaseBackupRestore(req: FastifyRequest<{ Body: RestoreBody }>, res: FastifyReply) {
    if (!await requireBackupAccess(req, res)) return

    if (!req.body?.file) {
        return res.status(400).send({ message: 'Restore requires a backup filename from the configured backup directory.' })
    }

    try {
        return res.send(await restoreDatabaseBackupFile(req.body.file))
    } catch (error) {
        req.log.error(error)
        const statusCode = error instanceof BackupOperationError ? error.statusCode : 503
        return res.status(statusCode).send({ message: sanitizeBackupError(error) })
    }
}

async function requireBackupAccess(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }

    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'Missing system_admin role.' })
        return false
    }

    return true
}
