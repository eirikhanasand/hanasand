import useKeyPress from '@/hooks/keyPressed'
import { setCookie } from '@/utils/cookies/cookies'
import { X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dispatch, SetStateAction, useEffect } from 'react'

type OpenFilesProps = {
    openFiles: OpenFile[]
    setOpenFiles: Dispatch<SetStateAction<OpenFile[]>>
}

type FileProps = {
    file: OpenFile
    pathname: string
    setOpenFiles: Dispatch<SetStateAction<OpenFile[]>>
}

export default function OpenFiles({ openFiles, setOpenFiles }: OpenFilesProps) {
    const keys = useKeyPress(['Ω'])
    const pathname = usePathname()

    useEffect(() => {
        setCookie('openFiles', JSON.stringify(openFiles))
    }, [openFiles])

    useEffect(() => {
        if (keys['Ω'] || (keys['alt'] && keys['w'])) {
            setOpenFiles(prev => prev.filter(file => !pathname.includes(`/${file.id}`)))
        }

        function downHandler(e: KeyboardEvent) {
            if (e.key === 'Ω' || (e.key === 'w' && e.altKey)) {
                setOpenFiles(prev => prev.filter(file => !pathname.includes(`/${file.id}`)))
            }
        }

        window.addEventListener('keydown', downHandler)
    }, [])

    if (!openFiles.length) {
        return
    }

    return (
        <div className='rounded-lg flex max-w-full overflow-auto gap-2 p-px pr-[1.75px] noscroll'>
            {openFiles.map((file) => <File
                key={file.id}
                file={file}
                pathname={pathname}
                setOpenFiles={setOpenFiles}
            />)}
        </div>
    )
}

function File({ file, pathname, setOpenFiles }: FileProps) {
    const selected = pathname.includes(`/${file.id}`)
    const color = selected ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-raised text-ui-muted hover:border-ui-primary/35 hover:text-ui-text'

    function handleClose(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        setOpenFiles(prev => prev.filter(f => f.id !== file.id))
    }

    return (
        <Link prefetch={false} href={`/s/${file.id}`} className={`group flex items-center justify-between gap-2 rounded-md border px-3 py-0.8 transition hover:pr-0 ${color}`}>
            <h1 className='text-sm'>{file.name}</h1>
            <div onClick={handleClose} className='hidden rounded-sm p-0.5 hover:bg-ui-panel group-hover:block'>
                <X className='h-4 w-4' />
            </div>
        </Link>
    )
}
