import run from '#db'

export default async function invalidateOldAttempts() {
    const EXPIRATION_HOURS = 24

    const query = `
      DELETE FROM attempts
      WHERE timestamp < NOW() - INTERVAL '${EXPIRATION_HOURS} hours'
      RETURNING id;
    `

    const result = await run(query)
    console.log(`🧹 Deleted ${result.rowCount} old attempts`)
}
