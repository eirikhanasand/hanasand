import { Eye, Wifi, WifiOff } from 'lucide-react'

export default function GPT_Header({
    isConnected,
    participants,
}: {
    isConnected: boolean
    participants: number
}) {
    return (
        <div className='grid gap-3 sm:grid-cols-2'>
            <GPT_HeaderCard label={participants === 1 ? 'Viewer' : 'Viewers'} value={String(participants)} icon={<Eye className='h-4 w-4' />} />
            <GPT_ConnectionCard isConnected={isConnected} />
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
