import { getLogs, getLogServices } from '@/utils/logs/getLogs'
import { AlertTriangle, Server, TerminalSquare } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function when(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}

export default async function LogsPage({
    searchParams,
}: {
    searchParams: Promise<{ service?: string, level?: string }>
}) {
    const params = await searchParams
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    const level = params.level || 'error'
    const [services, logs] = await Promise.all([
        getLogServices({ token, id }),
        getLogs({ token, id, service: params.service, level }),
    ])

    return (
        <main className='grid gap-5 px-6 py-8 md:px-16 lg:px-32'>
            <section className='glass-panel rounded-[2rem] p-6'>
                <div className='flex flex-wrap items-center justify-between gap-4'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Operations</p>
                        <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Error logs</h1>
                        <p className='mt-2 max-w-2xl text-sm leading-6 text-bright/50'>
                            Filter application errors without tailing server logs. Other services can post into the same API contract using `/api/logs/ingest`.
                        </p>
                    </div>
                    <div className='icon-tile bg-red-500/12 text-red-200'>
                        <AlertTriangle className='h-5 w-5' />
                    </div>
                </div>
            </section>

            <section className='grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]'>
                <aside className='glass-card rounded-3xl p-4'>
                    <h2 className='flex items-center gap-2 font-semibold text-bright'>
                        <Server className='h-4 w-4 text-orange-300' />
                        Services
                    </h2>
                    <div className='mt-4 grid gap-2'>
                        <Link href={`/dashboard/logs?level=${level}`} className={`rounded-2xl px-3 py-2 text-sm ${!params.service ? 'bg-white/12 text-bright' : 'text-bright/55 hover:bg-white/6'}`}>
                            All services
                        </Link>
                        {services.map(item => (
                            <Link key={item.service} href={`/dashboard/logs?service=${encodeURIComponent(item.service)}&level=${level}`} className={`rounded-2xl px-3 py-2 text-sm ${params.service === item.service ? 'bg-white/12 text-bright' : 'text-bright/55 hover:bg-white/6'}`}>
                                <span className='block font-semibold'>{item.service}</span>
                                <span className='text-xs text-bright/35'>{item.entries} entries</span>
                            </Link>
                        ))}
                    </div>
                    <div className='mt-5 flex flex-wrap gap-2'>
                        {['error', 'warn', 'fatal', 'info'].map(item => (
                            <Link key={item} href={`/dashboard/logs?${params.service ? `service=${encodeURIComponent(params.service)}&` : ''}level=${item}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${level === item ? 'bg-orange-300 text-background' : 'bg-white/6 text-bright/60'}`}>
                                {item}
                            </Link>
                        ))}
                    </div>
                </aside>

                <section className='grid gap-3'>
                    {logs.map(log => (
                        <article key={log.id} className='glass-card rounded-3xl p-5'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div>
                                    <p className='text-xs uppercase tracking-[0.25em] text-bright/35'>{log.service} · {log.host}</p>
                                    <h3 className='mt-2 break-words text-lg font-semibold text-bright'>{log.message}</h3>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${log.level === 'error' || log.level === 'fatal' ? 'bg-red-500/15 text-red-100' : log.level === 'warn' ? 'bg-amber-500/15 text-amber-100' : 'bg-white/10 text-bright/70'}`}>
                                    {log.level}
                                </span>
                            </div>
                            <p className='mt-3 text-xs text-bright/35'>{when(log.created_at)}</p>
                            {Object.keys(log.metadata || {}).length > 0 && (
                                <pre className='mt-4 max-h-48 overflow-auto rounded-2xl bg-black/35 p-4 text-xs text-bright/55'>
                                    {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                            )}
                        </article>
                    ))}
                    {!logs.length && (
                        <div className='grid min-h-64 place-content-center rounded-3xl border border-dashed border-white/10 text-center text-bright/45'>
                            <TerminalSquare className='mx-auto mb-3 h-8 w-8 text-emerald-300' />
                            No `{level}` logs found for this filter.
                        </div>
                    )}
                </section>
            </section>
        </main>
    )
}
