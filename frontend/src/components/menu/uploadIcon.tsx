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
                <ArrowUp className='upload z-10 h-full self-center rounded-lg bg-ui-panel stroke-[2.8px] stroke-ui-primary group-hover:bg-ui-raised' />
                <div className='upload-overlay absolute bottom-0 w-full h-[1.5px] z-20' />
            </div>
        </LinkorDiv>
    )
}
