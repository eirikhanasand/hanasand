import config from '@/config'

export type ProfileStats = {
    loginDays: Array<{ day: string, logins: number }>
    counts: {
        organizations: number
        containers: number
        vms: number
        shares: number
        articles: number
    }
}

export default async function getProfileStats(userId: string, token: string): Promise<ProfileStats | null> {
    try {
        const response = await fetch(`${config.url.api}/user/${encodeURIComponent(userId)}/profile-stats`, {
            cache: 'no-store',
            headers: { id: userId, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return null
        return await response.json() as ProfileStats
    } catch {
        return null
    }
}
