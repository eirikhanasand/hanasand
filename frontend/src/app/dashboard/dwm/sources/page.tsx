import DashboardDwmPage, { dynamic } from '../page'

export { dynamic }

export default function Page(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    return DashboardDwmPage({
        searchParams: Promise.resolve(props.searchParams).then(async params => ({ ...(await params), panel: 'sources' })),
    })
}
