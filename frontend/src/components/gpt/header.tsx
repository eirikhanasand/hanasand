import { Eye, Wifi, WifiOff } from 'lucide-react'

export default function GPT_Header({
    isConnected,
    participants,
}: {
    isConnected: boolean
    participants: number
}) {
    return (
        <div className='flex flex-wrap items-center justify-end gap-2'>
            <GPT_HeaderCard label={participants === 1 ? 'Viewer' : 'Viewers'} value={String(participants)} icon={<Eye className='h-4 w-4' />} />
            <GPT_ConnectionCard isConnected={isConnected} />
        </div>
    )
}

function GPT_HeaderCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className='flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3'>
            <div className='flex items-center gap-2 text-ui-muted'>
                <span className='text-[10px] font-medium uppercase tracking-[0.18em]'>{label}</span>
                {icon}
            </div>
            <div className='text-sm font-semibold text-ui-text'>{value}</div>
        </div>
    )
}

function GPT_ConnectionCard({ isConnected }: { isConnected: boolean }) {
    return (
        <div className='flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3'>
            <div className='flex items-center gap-2 text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Socket</span>
                {isConnected ? <Wifi className='h-4 w-4 text-ui-success' /> : <WifiOff className='h-4 w-4 text-ui-danger' />}
            </div>
            <div
                className={`text-[10px] font-semibold uppercase tracking-[0.18em]
                    ${isConnected ? 'text-ui-success' : 'text-ui-danger'}`}
            >
                {isConnected ? 'Connected' : 'Reconnecting'}
            </div>
        </div>
    )
}
