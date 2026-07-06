import Link from 'next/link'
import Image from 'next/image'

type BrandLogoProps = {
    compact?: boolean
    className?: string
}

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
    return (
        <Link href='/' className={`flex min-w-0 items-center gap-3 ${className}`}>
            <span className='relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                <Image src='/favicon.svg' alt='' width={28} height={28} className='h-7 w-7' priority />
            </span>
            {!compact && <span className='hidden truncate text-xl font-semibold tracking-normal text-ui-text min-[430px]:inline'>hanasand</span>}
        </Link>
    )
}
