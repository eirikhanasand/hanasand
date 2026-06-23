import Link from 'next/link'

type BrandLogoProps = {
    compact?: boolean
    className?: string
}

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
    return (
        <Link href='/' className={`flex min-w-0 items-center gap-3 ${className}`}>
            <span className='relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#cfd8e6] bg-white shadow-[0_8px_24px_rgba(22,31,49,0.08)] dark:border-[#2b3647] dark:bg-[#101722]'>
                <svg viewBox='0 0 36 36' aria-hidden='true' className='h-7 w-7'>
                    <path d='M18 3.8 30.7 28.6H5.3L18 3.8Z' fill='none' stroke='#111827' strokeWidth='3.2' strokeLinejoin='round' className='dark:stroke-white' />
                    <path d='M18 10.5 25.2 25H10.8L18 10.5Z' fill='#3056d3' />
                    <path d='M18 3.8v6.7' stroke='#e35f2b' strokeWidth='3.2' strokeLinecap='round' />
                    <circle cx='18' cy='27.2' r='2.2' fill='#14a35a' />
                </svg>
            </span>
            {!compact && <span className='truncate text-xl font-semibold tracking-normal text-[#20242c] dark:text-[#f5f7fb]'>hanasand</span>}
        </Link>
    )
}
