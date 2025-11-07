import run from '#utils/db.ts'

type AssignCertificateProps = {
    name: string,
    public_key: string,
    owner: string,
    created_by: string,
    user_id: string
}

export default async function assignCertificate({
    name,
    public_key,
    owner,
    created_by,
    user_id,
}: AssignCertificateProps) {
    try {
        const insertCertQuery = `
            INSERT INTO certificates (name, public_key, owner, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `
        const result = await run(insertCertQuery, [name, public_key, owner, created_by])
        if (!result || result.rowCount === 0) {
            throw new Error('Failed to insert certificate')
        }

        const certificateId = result.rows[0].id as number

        const assignQuery = `
            INSERT INTO user_certificates (user_id, certificate_id)
            VALUES ($1, $2)
        `
        await run(assignQuery, [user_id, certificateId])

        return { certificateId }
    } catch (error) {
        console.error('Error creating certificate:', error)
        throw error
    }
}
