import Notify from '@/components/notify/notify'

export default function DisplayError({ error }: { error: string | boolean | null }) {
    if (!error) {
        return null
    }

    const isCmdW = error === 'cmdw'

    return (
        <div className="absolute top-0 left-0 z-20 w-full h-full grid place-items-center text-bright/80">
            <div className="flex flex-col items-center gap-2 text-center px-4 min-h-[85%]">
                {isCmdW ? (
                    <div className='block bg-bright/8 backdrop-blur-md rounded-lg p-2 px-8'>
                        <div className='flex gap-1'>
                            <span>You can use </span>
                            <span className="font-mono bg-bright/10 px-2 py-0.5 rounded -mt-[2px]">⌥ + W</span>
                            <span> to close files.</span>
                        </div>
                        <div className={`h-1 bg-bright/5 w-0 my-1 animate-slide-line rounded-lg`} />
                    </div>
                ) : (
                    <div className='w-[20rem]'>
                        <Notify fullWidth message={'test'} />
                    </div>
                )}
            </div>
        </div>
    )
}
