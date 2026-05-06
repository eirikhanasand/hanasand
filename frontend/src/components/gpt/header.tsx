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
            <div className='rounded-xl bg-dark/35 p-5 outline outline-dark'>
                <div>
                    <div className='flex items-center gap-3'>
                        <div className='rounded-full bg-[#f07d33]/12 p-3 text-[#f07d33] outline outline-[#f07d33]/20'>
                            <Bot className='h-5 w-5' />
                        </div>
                        <div>
                            <h1 className='font-semibold text-lg text-bright/90'>Hanasand AI</h1>
                            <p className='max-w-2xl text-sm text-bright/50'>
                                Live metrics from connected inference clients.
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
        <div className='rounded-xl bg-dark/35 p-4 outline outline-dark'>
            <div className='flex items-center justify-between text-bright/35'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{label}</span>
                {icon}
            </div>
            <div className='mt-3 text-3xl font-semibold text-bright/90'>{value}</div>
        </div>
    )
}

function GPT_ConnectionCard({ isConnected }: { isConnected: boolean }) {
    return (
        <div className='rounded-xl bg-dark/35 p-4 outline outline-dark'>
            <div className='flex items-center justify-between text-bright/35'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Socket</span>
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
