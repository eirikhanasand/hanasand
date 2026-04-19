import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Inbox, MailWarning, RefreshCw, UserRound } from 'lucide-react'
import { getInboxPayload } from '@/utils/mail/jmap'

export const dynamic = 'force-dynamic'

export default async function Page(props: { searchParams: Promise<{ message?: string }> }) {
    const searchParams = await props.searchParams
    const cookieStore = await cookies()
    const name = cookieStore.get('name')?.value
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value

    if (!name || !id || !token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/mail%26expired=true')
    }

    let error = ''
    let messages: Awaited<ReturnType<typeof getInboxPayload>>['messages'] = []
    let selected: Awaited<ReturnType<typeof getInboxPayload>>['selected'] = null

    try {
        const payload = await getInboxPayload(searchParams.message)
        messages = payload.messages
        selected = payload.selected
    } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Unable to load inbox.'
    }

    return (
        <div className='px-8 md:px-16 lg:px-32 py-4 md:py-8 grid gap-4'>
            <section className='glass-panel rounded-4xl p-6'>
                <div className='flex flex-wrap items-center justify-between gap-4'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.3em] text-orange-200/70'>Private inbox</p>
                        <h1 className='mt-2 text-3xl font-semibold text-bright'>eirik@hanasand.com</h1>
                        <p className='mt-2 max-w-2xl text-sm text-bright/50'>
                            This view reads straight from the self-hosted Stalwart mailbox over JMAP and stays inside the existing Hanasand dashboard.
                        </p>
                    </div>
                    <div className='flex items-center gap-3 text-sm text-bright/55'>
                        <div className='icon-tile bg-orange-500/12 text-orange-300'>
                            <Inbox className='h-4 w-4' />
                        </div>
                        <Link href='/dashboard/mail' className='rounded-full border border-white/10 px-4 py-2 hover:bg-white/5'>
                            <span className='inline-flex items-center gap-2'><RefreshCw className='h-4 w-4' /> Refresh</span>
                        </Link>
                    </div>
                </div>
            </section>

            {error && <section className='glass-card rounded-3xl p-5 text-sm text-red-100'>
                <div className='flex items-center gap-3'>
                    <div className='icon-tile bg-red-500/12 text-red-300'>
                        <MailWarning className='h-4 w-4' />
                    </div>
                    <div>
                        <h2 className='font-semibold'>Mail is not ready yet</h2>
                        <p className='mt-1 text-red-100/80'>{error}</p>
                    </div>
                </div>
            </section>}

            <div className='grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]'>
                <aside className='glass-card rounded-3xl p-4'>
                    <div className='mb-3 flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-bright'>Inbox</h2>
                        <span className='text-xs text-bright/35'>{messages.length} messages</span>
                    </div>

                    <div className='grid gap-2'>
                        {messages.map((message) => {
                            const active = message.id === selected?.id
                            return (
                                <Link
                                    key={message.id}
                                    href={`/dashboard/mail?message=${encodeURIComponent(message.id)}`}
                                    className={`rounded-2xl border p-4 transition ${active ? 'border-orange-400/30 bg-orange-500/10' : 'border-white/8 bg-white/2 hover:bg-white/5'}`}
                                >
                                    <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>{formatReceivedAt(message.receivedAt)}</p>
                                    <h3 className='mt-2 line-clamp-1 text-sm font-semibold text-bright'>{message.subject}</h3>
                                    <p className='mt-2 text-xs text-bright/45'>{message.from || 'Unknown sender'}</p>
                                    <p className='mt-3 line-clamp-3 text-sm text-bright/55'>{message.preview}</p>
                                </Link>
                            )
                        })}

                        {!messages.length && !error && <div className='rounded-2xl border border-dashed border-white/10 p-6 text-sm text-bright/45'>
                            The inbox is empty right now. Send a message to `eirik@hanasand.com` and it will appear here.
                        </div>}
                    </div>
                </aside>

                <section className='glass-card rounded-3xl p-6'>
                    {selected ? (
                        <div className='grid gap-6'>
                            <div className='grid gap-3 border-b border-white/8 pb-4'>
                                <p className='text-xs uppercase tracking-[0.3em] text-orange-200/70'>Selected message</p>
                                <h2 className='text-2xl font-semibold text-bright'>{selected.subject}</h2>
                                <div className='grid gap-2 text-sm text-bright/55'>
                                    <p className='inline-flex items-center gap-2'><UserRound className='h-4 w-4' /> From: {selected.from || 'Unknown sender'}</p>
                                    <p>To: {selected.to || 'eirik@hanasand.com'}</p>
                                    {selected.cc && <p>CC: {selected.cc}</p>}
                                    <p>Received: {formatReceivedAt(selected.receivedAt, true)}</p>
                                </div>
                            </div>
                            <article className='whitespace-pre-wrap wrap-break-word text-sm leading-7 text-bright/80'>
                                {selected.body}
                            </article>
                        </div>
                    ) : (
                        <div className='rounded-2xl border border-dashed border-white/10 p-8 text-sm text-bright/45'>
                            Choose a message to read it here.
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

function formatReceivedAt(value: string, verbose = false) {
    if (!value) {
        return 'Unknown time'
    }

    const date = new Date(value)

    return new Intl.DateTimeFormat('en', {
        dateStyle: verbose ? 'full' : 'medium',
        timeStyle: 'short',
    }).format(date)
}
