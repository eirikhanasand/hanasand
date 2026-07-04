import ErrorNotice from '@/components/error/errorNotice'

type ConnectionStatusProps = {
    isConnected: boolean
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
    return (
        <ErrorNotice compact variant='info' message={!isConnected ? 'Live updates are reconnecting. Saved run data remains available.' : null} />
    )
}
