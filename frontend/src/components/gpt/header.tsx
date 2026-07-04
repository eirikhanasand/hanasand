import { Bot, Eye, Wifi, WifiOff } from 'lucide-react'

export default function GPT_Header({
    isConnected,
    participants,
}: {
    isConnected: boolean
    participants: number
}) {
    return (
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]'>
            <div className='rounded-lg bg-ui-panel p-5 border border-ui-border'>
                <div>
                    <div className='flex items-center gap-3'>
                        <div className='rounded-full bg-ui-primary/10 p-3 text-ui-primary border border-ui-primary/25'>
                            <Bot className='h-5 w-5' />
                        </div>
                        <div>
                            <h1 className='font-semibold text-lg text-ui-text'>Workspace assistant</h1>
                            <p className='max-w-2xl text-sm text-ui-muted'>
                                Live workspace activity and connected runtime status.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
                <GPT_HeaderCard label='Viewers' value={String(participants)} icon={<Eye className='h-4 w-4' />} />
                <GPT_ConnectionCard isConnected={isConnected} />
            </div>
        </div>
    )
}

function GPT_HeaderCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{label}</span>
                {icon}
            </div>
            <div className='mt-3 text-3xl font-semibold text-ui-text'>{value}</div>
        </div>
    )
}

function GPT_ConnectionCard({ isConnected }: { isConnected: boolean }) {
    return (
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Socket</span>
                {isConnected ? <Wifi className='h-4 w-4 text-ui-success' /> : <WifiOff className='h-4 w-4 text-ui-danger' />}
            </div>
            <div
                className={`mt-3 text-sm font-semibold uppercase tracking-[0.18em]
                    ${isConnected ? 'text-ui-success' : 'text-ui-danger'}`}
            >
                {isConnected ? 'Connected' : 'Reconnecting'}
            </div>
        </div>
    )
}
