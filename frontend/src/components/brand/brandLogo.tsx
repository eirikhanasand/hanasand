import Link from 'next/link'
import Image from 'next/image'

type BrandLogoProps = {
    compact?: boolean
    className?: string
}

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
    return (
        <Link href='/' className={`flex min-w-0 items-center gap-3 ${className}`}>
            <Image src='/hanasand-logo-transparent.png' alt='' width={36} height={36} className='h-9 w-9 shrink-0 object-contain' priority />
            {!compact && <span className='hidden truncate text-xl font-semibold tracking-normal text-ui-text min-[430px]:inline'>hanasand</span>}
        </Link>
    )
}
