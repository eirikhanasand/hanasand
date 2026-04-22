import config from '#constants'
import run from '#db'

type SyncUserCertificatesToVmProps = {
    vmName: string
    userIds: string[]
}

type InternalSyncResponse = {
    username: string
    received: number
    added: number
    total: number
}

export default async function syncUserCertificatesToVm({ vmName, userIds }: SyncUserCertificatesToVmProps) {
    const normalizedUserIds = [...new Set(
        userIds
            .map((userId) => userId.trim())
            .filter(Boolean)
    )]

    if (!normalizedUserIds.length) {
        return { ok: true, received: 0, added: 0, total: 0, certificates: [] as string[] }
    }

    const result = await run(`
        SELECT DISTINCT c.public_key
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        WHERE uc.user_id = ANY($1::text[])
    `, [normalizedUserIds])

    const certificates = result.rows
        .map((row) => String(row.public_key || '').trim())
        .filter(Boolean)

    if (!certificates.length) {
        return { ok: true, received: 0, added: 0, total: 0, certificates }
    }

    const response = await fetch(`${config.internal_api}/vm/${encodeURIComponent(vmName)}/authorized-keys`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
            'Content-Type': 'application/json',
            'User-Agent': 'hanasand_api',
        },
        body: JSON.stringify({
            keys: certificates,
        }),
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) as Partial<InternalSyncResponse> & { error?: string } : {}

    if (!response.ok) {
        throw new Error(payload.error || `Unable to synchronize certificates to VM ${vmName}.`)
    }

    return {
        ok: true,
        received: payload.received || certificates.length,
        added: payload.added || 0,
        total: payload.total || certificates.length,
        certificates,
    }
}
