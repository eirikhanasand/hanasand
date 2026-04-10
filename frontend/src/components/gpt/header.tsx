import { Eye, Wifi, WifiOff } from 'lucide-react'

export default function GPT_Header({
    isConnected,
    participants,
}: {
    isConnected: boolean
    participants: number
}) {
    return (
        <div className='w-full rounded-2xl border border-login-100/10 bg-login-900/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <h1 className='font-semibold text-lg'>AI (Login GPT)</h1>
                    <p className='max-w-2xl text-sm text-login-100'>Live metrics from connected inference clients.</p>
                </div>
                <div className='grid gap-3 sm:grid-cols-2 lg:min-w-[24rem]'>
                    <GPT_HeaderCard label='Viewers' value={String(participants)} icon={<Eye className='h-4 w-4' />} />
                    <GPT_ConnectionCard isConnected={isConnected} />
                </div>
            </div>
        </div>
    )
}

function GPT_HeaderCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className='rounded-xl border border-login-100/10 bg-login-50/5 p-4'>
            <div className='flex items-center justify-between text-login-200'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{label}</span>
                {icon}
            </div>
            <div className='mt-3 text-3xl font-semibold text-login-50'>{value}</div>
        </div>
    )
}

function GPT_ConnectionCard({ isConnected }: { isConnected: boolean }) {
    return (
        <div className='rounded-xl border border-login-100/10 bg-login-50/5 p-4'>
            <div className='flex items-center justify-between text-login-200'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Connection</span>
                {isConnected ? <Wifi className='h-4 w-4 text-emerald-400' /> : <WifiOff className='h-4 w-4 text-red-400' />}
            </div>
            <div
                className={`mt-3 text-sm font-semibold uppercase tracking-[0.18em]
                    ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}
            >
                {isConnected ? 'Connected' : 'Reconnecting'}
            </div>
        </div>
    )
}
