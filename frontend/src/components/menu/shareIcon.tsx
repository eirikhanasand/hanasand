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
            <Code className={`${!isShare && 'hidden'} pointer-events-none absolute z-100 mt-[5px] h-2.5 w-2.5 bg-ui-panel stroke-4 stroke-ui-primary group-hover:block group-hover:bg-ui-raised`} />
        </LinkorDiv>
    )
}
