import { AlertTriangle } from 'lucide-react'

type ConnectionStatusProps = { 
    isConnected: boolean
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
    return (
        <div>
            {!isConnected && (
                <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 outline-1 outline-yellow-400/20 rounded-lg p-2 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <h1>Connection error</h1>
                </div>
            )}
        </div>
    )
}
