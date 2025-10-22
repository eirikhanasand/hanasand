import { UploadIcon } from 'lucide-react'

export default function UploadIconArrow({ isUpload }: { isUpload: boolean }) {
    return (
        <div className={`${!isUpload && 'hidden'} group-hover:block absolute z-100`}>
            <UploadIcon className={'stroke-[#e25822] bg-dark mt-[4px] z-0 relative'} />
            <div className="absolute bg-dark hover:bg-[#6464641a] h-1 w-full z-50 bottom-0 left-0" />
            <div className="absolute bg-dark hover:bg-[#6464641a] h-3 w-1 z-50 bottom-0 right-0" />
            <div className="absolute bg-dark hover:bg-[#6464641a] h-3 w-1 z-50 bottom-0 left-0" />
        </div>
    )
}
