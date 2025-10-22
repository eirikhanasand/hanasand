import { Code, FileCode } from 'lucide-react'
import LinkorDiv from '../misc/linkOrDiv'

type ShareIconProps = {
    baseStyles: string
    isShare: boolean
    href?: string
}

export default function ShareIcon({ baseStyles, isShare, href }: ShareIconProps) {
    return (
        <LinkorDiv href={href} className='group relative grid place-items-center'>
            <div className={baseStyles}>
                <FileCode />
            </div>
            <Code className={`${!isShare && 'hidden'} group-hover:block absolute stroke-[#e25822] pointer-events-none stroke-4 bg-dark group-hover:bg-dark-reverse w-[10px] h-[10px] mt-[5px] z-100`} />
        </LinkorDiv>
    )
}
