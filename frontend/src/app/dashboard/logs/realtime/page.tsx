import LogsPage, { type LogsPageProps } from '../page'
export { dynamic } from '../page'
export default function Page(props: LogsPageProps) { return LogsPage({ ...props, view: 'realtime' }) }
