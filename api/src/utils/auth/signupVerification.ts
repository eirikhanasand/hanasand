import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import run, { withTransaction, type queryOnce } from '#db'
import { sendSystemMail } from '#utils/mail/system.ts'

let schemaReady: Promise<unknown> | undefined
export function ensureSignupVerification() {
    return schemaReady ||= run(`CREATE TABLE IF NOT EXISTS signup_verifications (
        id uuid PRIMARY KEY, email text NOT NULL, requested_ip text NOT NULL,
        binding text NOT NULL, code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(), expires_at timestamptz NOT NULL,
        consumed_at timestamptz
    )`).then(() => run('CREATE INDEX IF NOT EXISTS signup_verifications_email_created ON signup_verifications (email, created_at)'))
        .then(() => run('CREATE INDEX IF NOT EXISTS signup_verifications_ip_created ON signup_verifications (requested_ip, created_at)'))
        .catch(error => { schemaReady = undefined; throw error })
}

// Bind the code to the exact signup details without retaining the password.
export function signupBinding(details: string[]) {
    return crypto.createHash('sha256').update(JSON.stringify(details)).digest('hex')
}

export async function requestSignupCode(email: string, ip: string, binding: string) {
    await ensureSignupVerification()
    const id = crypto.randomUUID()
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
    const hash = await bcrypt.hash(code, 10)
    const allowed = await withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`signup-ip:${ip}`])
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`signup-email:${email}`])
        const limits = await query(`SELECT
            COUNT(*) FILTER (WHERE email = $1) AS email_count,
            COUNT(*) FILTER (WHERE requested_ip = $2) AS ip_count,
            COUNT(*) FILTER (WHERE email = $1 AND created_at > NOW() - INTERVAL '60 seconds') AS recent
            FROM signup_verifications WHERE created_at > NOW() - INTERVAL '1 hour'
            AND (email = $1 OR requested_ip = $2)`, [email, ip])
        const row = limits.rows[0]
        if (Number(row.recent) || Number(row.email_count) >= 5 || Number(row.ip_count) >= 20) return false
        await query('UPDATE signup_verifications SET consumed_at = NOW() WHERE email = $1 AND consumed_at IS NULL', [email])
        await query(`INSERT INTO signup_verifications (id,email,requested_ip,binding,code_hash,expires_at)
            VALUES ($1,$2,$3,$4,$5,NOW() + INTERVAL '10 minutes')`, [id, email, ip, binding, hash])
        return true
    })
    if (!allowed) return { status: 429, error: 'Please wait before requesting another code. You can request up to five codes per hour.' }
    try {
        await sendSystemMail({ to: email, subject: 'Verify your Hanasand email',
            textBody: `Your Hanasand signup code is ${code}.\n\nIt expires in 10 minutes. Your account will only be created after you enter this code. If you did not request this, ignore this email.`,
            htmlBody: `<p>Your Hanasand signup code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. Your account will only be created after you enter this code. If you did not request this, ignore this email.</p>` })
    } catch (error) {
        const smtp = error as { code?: string; responseCode?: number; command?: string }
        console.error('Signup verification email failed', { challengeId: id, code: smtp.code, responseCode: smtp.responseCode, command: smtp.command })
        await run('UPDATE signup_verifications SET consumed_at = NOW() WHERE id = $1', [id])
        return { status: 503, error: 'We could not send the verification email. Please try again shortly.' }
    }
    return { status: 202, verificationRequired: true, challengeId: id, expiresIn: 600 }
}

// Call inside the same transaction that inserts the user, so a code is single-use.
export async function consumeSignupCode(query: typeof queryOnce, id: string, code: string, binding: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !/^\d{6}$/.test(code)) return false
    const result = await query(`SELECT code_hash, binding, attempts FROM signup_verifications
        WHERE id = $1 AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE`, [id])
    const row = result.rows[0]
    if (!row || row.attempts >= 5) return false
    if (row.binding !== binding || !await bcrypt.compare(code, row.code_hash)) {
        await query('UPDATE signup_verifications SET attempts = attempts + 1 WHERE id = $1', [id])
        return false
    }
    await query('UPDATE signup_verifications SET consumed_at = NOW() WHERE id = $1', [id])
    return true
}
