import { redirect } from 'next/navigation'

// Keep existing signup links working without a second registration page.
export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const query = new URLSearchParams({ mode: 'signup' })
    for (const key of ['path', 'internal', 'error']) {
        const value = Array.isArray(params[key]) ? params[key][0] : params[key]
        if (value) query.set(key, value)
    }
    redirect(`/login?${query}`)
}
