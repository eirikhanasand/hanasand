import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import {
    BackupOperationError,
    collectDatabaseBackupServices,
    createDatabaseBackup,
    listDatabaseBackupFiles,
    restoreDatabaseBackupToLive,
    restoreDatabaseBackupFile,
    sanitizeBackupError,
    verifyDatabaseBackupFile,
} from '#utils/db/backups.ts'

type BackupFilesQuery = {
    service?: string
    date?: string
}

type RestoreBody = {
    file?: string
    targetDatabase?: string
    confirmation?: string
}

type VerifyBody = {
    file?: string
}

type LiveRestoreBody = {
    file?: string
    confirmation?: string
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
    const actorId = await requireBackupAccess(req, res)
    if (!actorId) return

    try {
        const operation = await createDatabaseBackup({ actorId })
        return res.send({
            message: `Backup completed: ${operation.file}.`,
            operation,
        })
    } catch (error) {
        req.log.error(error)
        const statusCode = error instanceof BackupOperationError ? error.statusCode : (error as { statusCode?: number })?.statusCode || 503
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

export async function postDatabaseBackupVerify(req: FastifyRequest<{ Body: VerifyBody }>, res: FastifyReply) {
    const actorId = await requireBackupAccess(req, res)
    if (!actorId) return
    if (!req.body?.file) {
        return res.status(400).send({ message: 'Verification requires a backup filename from the configured backup directory.' })
    }

    try {
        const operation = await verifyDatabaseBackupFile(req.body.file, actorId)
        return res.send({ message: `Backup verified: ${operation.file}.`, operation })
    } catch (error) {
        req.log.error(error)
        const statusCode = error instanceof BackupOperationError ? error.statusCode : (error as { statusCode?: number })?.statusCode || 503
        return res.status(statusCode).send({ message: sanitizeBackupError(error) })
    }
}

export async function postDatabaseBackupRestore(req: FastifyRequest<{ Body: RestoreBody }>, res: FastifyReply) {
    const actorId = await requireBackupAccess(req, res)
    if (!actorId) return

    if (!req.body?.file || !req.body.targetDatabase || !req.body.confirmation) {
        return res.status(400).send({ message: 'Restore drill requires a backup file, an isolated target database, and exact confirmation.' })
    }

    try {
        const operation = await restoreDatabaseBackupFile({
            file: req.body.file,
            targetDatabase: req.body.targetDatabase,
            confirmation: req.body.confirmation,
            actorId,
        })
        return res.send({
            message: `Restore drill passed for ${operation.file}; isolated target ${operation.targetDatabase} was removed.`,
            operation,
        })
    } catch (error) {
        req.log.error(error)
        const statusCode = error instanceof BackupOperationError ? error.statusCode : (error as { statusCode?: number })?.statusCode || 503
        return res.status(statusCode).send({ message: sanitizeBackupError(error) })
    }
}

export async function postDatabaseBackupRestoreLive(req: FastifyRequest<{ Body: LiveRestoreBody }>, res: FastifyReply) {
    const actorId = await requireBackupAccess(req, res)
    if (!actorId) return

    if (!req.body?.file || !req.body.confirmation) {
        return res.status(400).send({ message: 'Live restore requires a backup file and exact confirmation.' })
    }

    try {
        const operation = await restoreDatabaseBackupToLive({
            file: req.body.file,
            confirmation: req.body.confirmation,
            actorId,
        })
        return res.send({
            message: `Database ${operation.targetDatabase} restored from ${operation.file}.`,
            operation,
        })
    } catch (error) {
        req.log.error(error)
        const statusCode = error instanceof BackupOperationError ? error.statusCode : (error as { statusCode?: number })?.statusCode || 503
        return res.status(statusCode).send({ message: sanitizeBackupError(error) })
    }
}

async function requireBackupAccess(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    const { valid } = auth
    if (!valid) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }

    const role = await hasHanasandInternalRouteAccess(req)
    if (!role.valid) {
        res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })
        return null
    }

    const id = auth.authenticatedId || auth.id || req.headers.id
    return Array.isArray(id) ? id[0] || null : id || null
}
