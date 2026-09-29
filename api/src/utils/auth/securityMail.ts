export function describeDevice(agent: string) {
    const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\/|FxiOS\//.test(agent) ? 'Firefox' : /Chrome\/|CriOS\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Unknown browser'
    const device = /iPad/.test(agent) ? 'iPad' : /iPhone/.test(agent) ? 'iPhone' : /Android/.test(agent) ? 'Android' : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS X/.test(agent) ? 'Mac' : /Linux/.test(agent) ? 'Linux' : 'unknown device'
    return `${browser} on ${device}`
}

export function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[character]!)
}
