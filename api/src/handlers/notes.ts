import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { buildNoteUpdateFields, type NoteBody } from '#utils/notes.ts'
import { requestedContentOrganization, requireContentOrganization } from '#utils/contentOrganization.ts'

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function noteFields(row: Record<string, unknown>) {
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        source: row.source,
        created_at: row.created_at,
        updated_at: row.updated_at,
        organization_id: row.organization_id,
    }
}

export async function getNotes(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organizationId = requestedContentOrganization(req)
    if (!await requireContentOrganization(req, res, organizationId)) return
    try {
        const result = await run(
            `SELECT id, title, content, source, owner_id, organization_id, created_at, updated_at
             FROM notes
             WHERE ($2::text IS NOT NULL AND organization_id = $2)
                OR ($2::text IS NULL AND organization_id IS NULL AND owner_id = $1)
             ORDER BY updated_at DESC, created_at DESC`,
            [id, organizationId]
        )

        return res.send(result.rows.map(noteFields))
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load notes.' })
    }
}

export async function getNote(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run(
            `SELECT id, title, content, source, owner_id, organization_id, created_at, updated_at
             FROM notes
             WHERE id = $1 AND CASE WHEN organization_id IS NULL THEN owner_id = $2
                 ELSE content_organization_access(organization_id, $2) END`,
            [req.params.id, userId]
        )

        if (!result.rows.length) {
            return res.status(404).send({ error: 'Note not found.' })
        }

        return res.send(noteFields(result.rows[0]))
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load note.' })
    }
}

export async function postNote(req: FastifyRequest<{ Body: NoteBody }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const title = clean(req.body?.title)
    const content = clean(req.body?.content)
    const source = clean(req.body?.source) || 'api'
    const organizationId = requestedContentOrganization(req)
    if (!await requireContentOrganization(req, res, organizationId, true)) return

    if (!title && !content) {
        return res.status(400).send({ error: 'Add a title or note content.' })
    }

    try {
        const result = await run(
            `INSERT INTO notes (owner_id, title, content, source, organization_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, content, source, owner_id, organization_id, created_at, updated_at`,
            [id, title || 'Untitled', content, source, organizationId]
        )

        return res.status(201).send(noteFields(result.rows[0]))
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to create note.' })
    }
}

export async function putNote(req: FastifyRequest<{ Params: { id: string }, Body: NoteBody }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const updateFields = buildNoteUpdateFields(req.body)

    if (!updateFields) {
        return res.status(400).send({ error: 'No fields to update.' })
    }

    const { fields, values } = updateFields
    values.push(req.params.id, userId)

    try {
        const result = await run(
            `UPDATE notes
             SET ${fields.join(', ')}, updated_at = NOW()
             WHERE id = $${values.length - 1} AND CASE WHEN organization_id IS NULL THEN owner_id = $${values.length}
                 ELSE content_organization_access(organization_id, $${values.length}, TRUE) END
             RETURNING id, title, content, source, owner_id, organization_id, created_at, updated_at`,
            values
        )

        if (!result.rows.length) {
            return res.status(404).send({ error: 'Note not found.' })
        }

        return res.send(noteFields(result.rows[0]))
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to update note.' })
    }
}

export async function deleteNote(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run(
            `DELETE FROM notes WHERE id = $1 AND CASE WHEN organization_id IS NULL THEN owner_id = $2
                ELSE content_organization_access(organization_id, $2, TRUE) END RETURNING id`,
            [req.params.id, userId]
        )

        if (!result.rows.length) {
            return res.status(404).send({ error: 'Note not found.' })
        }

        return res.send({ deleted: true, id: req.params.id })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to delete note.' })
    }
}
