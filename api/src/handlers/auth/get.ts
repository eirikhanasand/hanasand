import { FastifyReply, FastifyRequest } from 'fastify'
import config from '../../constants.js'
const {
    CLIENT_ID,
    CLIENT_SECRET,
    FRONTEND_URL,
    OAUTH_TOKEN_URL,
    SELF_URL,
    OAUTH_BASE_URL,
    OAUTH_AUTH_URL,
    API
} = config
import run from '../../db.js'

/**
 * Creates the callback url in the login sequence. Step 1 in the OAuth sequence.
 * 
 * @param _ Incoming Fastify Request (unused)
 * @param res Outgoing Fastify Response
 * 
 * @returns Fastify Response.
 */
export function loginHandler(_: FastifyRequest, res: FastifyReply) {
    const redirectUri = encodeURIComponent(`${API}/oauth2/callback`)
    const scope = encodeURIComponent('identify email guilds openid')

    // Replaces placeholders in the URL before redirecting the user.
    const authUrl = `${OAUTH_BASE_URL}${OAUTH_AUTH_URL || `?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`}`
        .replace('{CLIENT_ID}', CLIENT_ID)
        .replace('{redirectUri}', redirectUri)
        .replace('{scope}', scope)

    // Redirects the user to the OAuth provider.
    res.redirect(authUrl)
}

/**
 * Handles the callback response from the OAuth provider. Takes the 
 * authorization code and fetches the token, which is then returned to the user.
 * 
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 * 
 * @returns Fastify Response.
 */
export async function loginCallbackHandler(req: FastifyRequest, res: FastifyReply) {
    const { code } = req.query as { code?: string }
    if (!code) {
        return res.status(400).send({ error: 'Authorization code missing' })
    }

    try {
        // Fetches the token using the authorization code
        const response = await fetch(OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${API}/oauth2/callback`,
            })
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        // Fetches user info
        const data = await response.json()
        const { access_token } = data as any
        const userResponse = await fetch(SELF_URL, {
            headers: { Authorization: `Bearer ${access_token}` }
        })
        const userData = await userResponse.json()
        const {
            id,
            username,
            avatar,
            mfa_enabled,
            locale,
            email,
            verified
        } = userData as { [key: string]: string }

        // Creates a JWT which is returned to the user and decoded in the user
        // interface to display to the user.
        const token = btoa(JSON.stringify({
            token: access_token,
            id,
            username,
            avatar,
            mfa_enabled,
            locale,
            email,
            verified
        }))

        // Adds the user to the database if they dont exist
        await run(
            `INSERT INTO users (id, name, avatar)
             SELECT $1, $2, $3
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = $1);`,
            [id, username, avatar]
        )

        // Redirects the user back to the user interface with the token
        res.redirect(`${FRONTEND_URL}/login?token=${token}`)
    } catch (error) {
        console.error(`Error during OAuth2 process: ${error}`)
        res.status(500).send({ error: 'OAuth2 login failed' })
    }
}
