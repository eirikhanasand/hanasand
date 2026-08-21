import { redirect } from 'next/navigation'

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const setup = Array.isArray(params?.setup) ? params?.setup[0] : params?.setup
    redirect(setup ? `/dashboard/automation?setup=${encodeURIComponent(setup)}` : '/dashboard/automation')
}
