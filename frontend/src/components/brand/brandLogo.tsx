import Link from 'next/link'

type BrandLogoProps = {
    compact?: boolean
    className?: string
}

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
    return (
        <Link href='/' className={`flex min-w-0 items-center gap-3 ${className}`}>
            <span className='relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                <svg viewBox='0 0 36 36' aria-hidden='true' className='h-7 w-7'>
                    <path d='M18 3.8 30.7 28.6H5.3L18 3.8Z' fill='none' stroke='var(--ui-text)' strokeWidth='3.2' strokeLinejoin='round' />
                    <path d='M18 10.5 25.2 25H10.8L18 10.5Z' fill='var(--ui-primary)' />
                    <path d='M18 3.8v6.7' stroke='var(--ui-warning)' strokeWidth='3.2' strokeLinecap='round' />
                    <circle cx='18' cy='27.2' r='2.2' fill='var(--ui-success)' />
                </svg>
            </span>
            {!compact && <span className='hidden truncate text-xl font-semibold tracking-normal text-ui-text min-[430px]:inline'>hanasand</span>}
        </Link>
    )
}
