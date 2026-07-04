import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type SandboxTool = {
    id: string
    name: string
    url: string
}

type SandboxProfile = {
    id: string
    name: string
    tools: SandboxTool[]
}

const maxProfiles = 16
const maxToolsPerProfile = 8

export async function getBrowserSandboxProfiles(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run(`
            SELECT id, name, tools, created_at, updated_at
            FROM browser_sandbox_profiles
            WHERE owner_id = $1
            ORDER BY updated_at DESC, name ASC
        `, [userId])

        return res.send({
            profiles: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                tools: normalizeTools(row.tools),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })),
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser sandbox profiles.' })
    }
}

export async function putBrowserSandboxProfiles(req: FastifyRequest<{ Body: { profiles?: unknown } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const normalized = normalizeProfiles(req.body?.profiles)
    if (normalized.error) {
        return res.status(400).send({ error: normalized.error })
    }

    const profiles = normalized.profiles
    try {
        await run('DELETE FROM browser_sandbox_profiles WHERE owner_id = $1 AND NOT (id = ANY($2::text[]))', [userId, profiles.map(profile => profile.id)])
        for (const profile of profiles) {
            await run(`
                INSERT INTO browser_sandbox_profiles (owner_id, id, name, tools)
                VALUES ($1, $2, $3, $4::jsonb)
                ON CONFLICT (owner_id, id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    tools = EXCLUDED.tools,
                    updated_at = NOW()
            `, [userId, profile.id, profile.name, JSON.stringify(profile.tools)])
        }
        return res.send({ profiles })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to save browser sandbox profiles.' })
    }
}

function normalizeProfiles(value: unknown): { profiles: SandboxProfile[]; error?: string } {
    if (!Array.isArray(value)) {
        return { profiles: [], error: 'Profiles must be an array.' }
    }
    if (value.length > maxProfiles) {
        return { profiles: [], error: `Save ${maxProfiles} profiles or fewer.` }
    }

    const seen = new Set<string>()
    const profiles: SandboxProfile[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object') continue
        const source = item as Record<string, unknown>
        const id = cleanId(source.id)
        const name = cleanText(source.name).slice(0, 80)
        if (!id || !name || seen.has(id)) continue
        const tools = normalizeTools(source.tools)
        if (tools.length > maxToolsPerProfile) {
            return { profiles: [], error: `Profiles can include ${maxToolsPerProfile} tools or fewer.` }
        }
        profiles.push({ id, name, tools })
        seen.add(id)
    }
    return { profiles }
}

function normalizeTools(value: unknown): SandboxTool[] {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    const tools: SandboxTool[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object') continue
        const source = item as Record<string, unknown>
        const url = cleanUrl(source.url)
        const name = cleanText(source.name).slice(0, 80)
        const id = cleanId(source.id) || cleanId(name)
        if (!id || !name || !url || seen.has(id)) continue
        tools.push({ id, name, url })
        seen.add(id)
    }
    return tools.slice(0, maxToolsPerProfile)
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function cleanId(value: unknown) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function cleanUrl(value: unknown) {
    const raw = cleanText(value)
    if (!/^https?:\/\//i.test(raw)) return ''
    try {
        const url = new URL(raw)
        url.hash = ''
        return url.toString().slice(0, 600)
    } catch {
        return ''
    }
}
