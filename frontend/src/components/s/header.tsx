type HeaderProps = {
    share: Share
    isConnected: boolean
    participants: number
}

export default function Header({share, isConnected, participants}: HeaderProps) {
    return (
        <header className='bg-[#2d2d2d] p-4 flex justify-between items-center shadow-md'>
            <h1 className='font-semibold text-lg'>{share.path}</h1>
            <div className='flex items-center gap-4'>
                <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                    {participants}
                </span>
                <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                    {isConnected ? 'Connected' : 'Offline'}
                </span>
                <span className='text-sm text-gray-400'>
                    Last updated: {new Date(share.timestamp).toLocaleString()}
                </span>
            </div>
        </header>
    )
}
