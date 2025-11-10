import { ArrowUp, UploadIcon } from 'lucide-react'
import LinkorDiv from '../misc/linkOrDiv'

type UploadProps = { 
    baseStyles: string
    isUpload: boolean
    href?: string 
}

export default function Upload({ baseStyles, isUpload, href }: UploadProps) {
    return (
        <LinkorDiv href={href} className='group relative grid place-items-center'>
            <div className={baseStyles}>
                <UploadIcon />
            </div>
            <div className={`${!isUpload && 'hidden'} group-hover:block absolute pointer-events-none grid place-items-center w-4 h-[22px] -mt-[3px] overflow-hidden`}>
                <ArrowUp className={`stroke-[#e25822] stroke-[2.8px] bg-[#0c0d0b] md:bg-dark group-hover:bg-dark-reverse h-full z-10 self-center upload rounded-lg`} />
                <div className='upload-overlay absolute bottom-0 w-full h-[1.5px] z-20' />
            </div>
        </LinkorDiv>
    )
}
