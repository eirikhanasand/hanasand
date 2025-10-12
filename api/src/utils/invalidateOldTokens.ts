import run from '#db'

export default async function invalidateOldTokens() {
    const EXPIRATION_HOURS = 24

    const query = `
      DELETE FROM tokens
      WHERE timestamp < NOW() - INTERVAL '${EXPIRATION_HOURS} hours'
      RETURNING id;
    `;

    const result = await run(query)
    console.log(`🧹 Deleted ${result.rowCount} old tokens`);
}
