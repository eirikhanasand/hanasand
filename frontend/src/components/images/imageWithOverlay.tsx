import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import getDominantEdgeColor from '../content/getDominantEdgeColor'

export default async function ImageWithOverlay({ image, path }: { image: string, path?: string }) {
    const { hex } = await getDominantEdgeColor(image)

    return (
        <LinkIfPath path={path}>
            <div
                className="absolute -inset-[1px] scale-[1.15] rounded-full brightness-[0.8] saturate-[150%] blur-[30px] pointer-events-none z-0"
                style={{
                    backgroundColor: hex || 'transparent',
                    backgroundImage: `url(${image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            ></div>
            <Image
                src={image}
                alt='logo'
                fill
                quality={100}
                className='rounded-full object-cover'
            />
        </LinkIfPath>
    )
}

function LinkIfPath({ children, path }: { children: ReactNode, path?: string }) {
    if (path) {
        return (
            <Link
                href={path}
                className='relative w-48 h-48 cursor-pointer select-none overflow-visible rounded-lg will-change-transform, filter backface-hidden hover:scale-[1.03]'
            >{children}</Link>
        )
    } else {
        return (
            <div className='relative w-48 h-48 cursor-pointer select-none overflow-visible rounded-lg will-change-transform, filter backface-hidden hover:scale-[1.03]'>
                {children}
            </div>
        )
    }
}
