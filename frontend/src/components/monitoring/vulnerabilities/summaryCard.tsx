import { Container } from 'lucide-react'

const tones = {
    blue: 'border-[#315b92] bg-[#10223d] text-[#9db4ff]',
    amber: 'border-[#6f4a19] bg-[#281a0b] text-[#f6b45f]',
    emerald: 'border-[#285c3b] bg-[#102318] text-[#7bd39a]',
    violet: 'border-[#3a4f84] bg-[#111f3a] text-[#9db4ff]',
    rose: 'border-[#6d3a20] bg-[#29130b] text-[#ff9b6b]',
    slate: 'border-[#22334d] bg-[#0b1220] text-[#aab7cc]',
} as const

export default function SummaryCard({
    title,
    value,
    icon: Icon,
    tone,
}: {
    title: string
    value: string
    icon: typeof Container
    tone: keyof typeof tones
}) {
    return (
        <div className='rounded-lg border border-[#22334d] bg-[#0f172a] p-3'>
            <div className='flex items-center justify-between'>
                <span className='text-[10px] font-semibold uppercase text-[#8795ad]'>{title}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${tones[tone]}`}>
                    <Icon className='h-4 w-4' />
                </div>
            </div>
            <div className='mt-2 line-clamp-1 text-sm font-semibold text-[#edf4ff]'>{value}</div>
        </div>
    )
}
