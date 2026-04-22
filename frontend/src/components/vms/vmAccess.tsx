type VMAccessProps = {
    boxStyle: string
    boxTitleStyle: string
    connection: VMConnectionDetails | null
}

export default function VMAccess({ boxStyle, boxTitleStyle, connection }: VMAccessProps) {
    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Access</h1>
            {connection ? (
                <div className='space-y-2 text-sm text-bright/72'>
                    <p>Connect with your saved SSH public keys. New VMs now inherit the certificates on your profile automatically.</p>
                    <div className='space-y-1 text-xs text-almostbright/80'>
                        <p><span className='font-semibold text-bright/70'>Username:</span> {connection.username}</p>
                        <p><span className='font-semibold text-bright/70'>Host:</span> {connection.vmIp || 'Waiting for IP'}</p>
                        <p><span className='font-semibold text-bright/70'>Profile certificates:</span> {connection.certificateCount}</p>
                    </div>
                    {connection.sshCommand && (
                        <div className='rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-bright/84'>
                            {connection.sshCommand}
                        </div>
                    )}
                    {!connection.certificateCount && (
                        <p className='text-xs text-orange-200/80'>
                            Add a certificate on your profile to enable passwordless terminal access from your own machine.
                        </p>
                    )}
                </div>
            ) : (
                <h1>Unable to load VM access details right now.</h1>
            )}
        </div>
    )
}
