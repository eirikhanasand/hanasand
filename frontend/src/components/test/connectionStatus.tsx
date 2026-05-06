import ErrorNotice from '@/components/error/errorNotice'

type ConnectionStatusProps = {
    isConnected: boolean
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
    return (
        <ErrorNotice compact variant='info' message={!isConnected ? 'Live updates are disconnected. The saved run data is still available.' : null} />
    )
}
