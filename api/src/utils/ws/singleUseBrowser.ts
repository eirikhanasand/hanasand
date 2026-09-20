export class SingleUseBrowser<T> {
    state: 'starting' | 'ready' | 'claimed' | 'retired' = 'starting'
    sessionId?: string
    private value?: T
    private connected = false

    ready(value: T) { this.value = value; this.state = 'ready' }
    claim(sessionId: string) {
        if (this.state !== 'ready') return false
        this.state = 'claimed'
        this.sessionId = sessionId
        return true
    }
    connect(sessionId: string) {
        if (this.state !== 'claimed' || this.sessionId !== sessionId || this.connected) return false
        this.connected = true
        return true
    }
    take(sessionId: string) {
        if (this.state !== 'claimed' || this.sessionId !== sessionId || !this.connected || !this.value) throw new Error('Prestarted browser is unavailable.')
        const value = this.value
        this.value = undefined
        return value
    }
    retire() {
        if (this.state !== 'ready') return false
        this.state = 'retired'
        return true
    }
}
