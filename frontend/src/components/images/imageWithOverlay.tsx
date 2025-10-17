import Image from 'next/image'
import Link from 'next/link'

export default function ImageWithOverlay({ image }: { image: string }) {
    return (
        <Link href='/about' className="relative w-48 h-48 cursor-pointer select-none overflow-visible rounded-lg will-change-transform, filter backface-hidden hover:scale-[1.03]">
            <Image
                src={image}
                alt="glow"
                width={192}
                height={192}
                className="absolute scale-[1.15] rounded-full blur-[30px] brightness-[0.8] saturate-[150%] pointer-events-none z-0 will-change-transform, filter translate-z-0"
            />
            <Image
                src={image}
                alt="logo"
                fill
                quality={100}
                className="rounded-full object-cover"
            />
        </Link>
    )
}
