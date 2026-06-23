type AuthJsonResponse = {
    ok: boolean
    status: number
    text: string
}

export default function postAuthJson(path: string, data: unknown): Promise<AuthJsonResponse> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('POST', path, true)
        request.withCredentials = true
        request.timeout = 15000
        request.setRequestHeader('Content-Type', 'application/json')

        request.onload = () => {
            resolve({
                ok: request.status >= 200 && request.status < 300,
                status: request.status,
                text: request.responseText || '',
            })
        }
        request.onerror = () => reject(new Error('Authentication request failed.'))
        request.ontimeout = () => reject(new Error('Authentication request timed out.'))
        request.send(JSON.stringify(data))
    })
}
