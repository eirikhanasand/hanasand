export function sessionDevice(userAgent: string, hasPublicIp = true) {
    // Old web logins captured the proxy's Bun agent, so the device is unknowable.
    if (!userAgent || (!hasPublicIp && /^Bun\//i.test(userAgent))) return { label: 'Device details unavailable', kind: 'unknown' }
    if (/hanasand[-_\s]?desktop|desktop[-_\s]?app|tauri|electron/i.test(userAgent)) return { label: 'Hanasand desktop app', kind: 'desktop' }
    if (/hanasand[-_\s]?mobile|mobile[-_\s]?app|reactnative|expo|okhttp/i.test(userAgent)) return { label: 'Mobile app', kind: 'mobile' }
    if (/curl|node|bun\/|monitor|playwright|python/i.test(userAgent)) return { label: 'Automation or API client', kind: 'api' }
    const os = /iphone/i.test(userAgent) ? 'iPhone' : /ipad/i.test(userAgent) ? 'iPad' : /android/i.test(userAgent) ? 'Android' : /windows/i.test(userAgent) ? 'Windows' : /macintosh|mac os x/i.test(userAgent) ? 'macOS' : /linux/i.test(userAgent) ? 'Linux' : ''
    const browser = /Edg[AiOS]*\//i.test(userAgent) ? 'Edge' : /OPR\//i.test(userAgent) ? 'Opera' : /Firefox\/|FxiOS\//i.test(userAgent) ? 'Firefox' : /Chrome\/|CriOS\//i.test(userAgent) ? 'Chrome' : /Safari\//i.test(userAgent) ? 'Safari' : ''
    const kind = /mobile|iphone|ipad|android/i.test(userAgent) ? 'mobile' : 'desktop'
    return { label: browser && os ? `${browser} on ${os}` : browser || os || 'Unknown client', kind }
}
