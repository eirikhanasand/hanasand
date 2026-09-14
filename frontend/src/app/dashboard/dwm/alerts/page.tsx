import { redirect } from 'next/navigation'

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const scope = new URLSearchParams()
    for (const name of ['organizationId', 'tenantId']) {
        const value = params?.[name]
        if (typeof value === 'string' && value) scope.set(name, value)
    }
    redirect(`/cases${scope.size ? `?${scope}` : ''}`)
}
